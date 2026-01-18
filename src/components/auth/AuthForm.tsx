import { useState, useCallback, useId } from "react";
import type { FormEvent, ChangeEvent } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { loginSchema, mapAuthError } from "@/lib/schemas/auth.schema";
import { createBrowserSupabaseClient } from "@/db/supabase.browser";
import type { LoginFormData, LoginFormState } from "@/types";

/**
 * Komponent formularza logowania.
 *
 * Obsługuje:
 * - Walidację client-side z użyciem Zod
 * - Logowanie przez Supabase Auth
 * - Wyświetlanie błędów walidacji i autoryzacji
 * - Stan ładowania podczas logowania
 */
export function AuthForm() {
  const emailId = useId();
  const passwordId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  const [formState, setFormState] = useState<LoginFormState>({
    isLoading: false,
    error: null,
    fieldErrors: {},
  });

  /**
   * Obsługuje zmianę wartości w polach formularza.
   * Czyści błędy walidacji dla zmienianego pola.
   */
  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Czyszczenie błędu pola przy zmianie wartości
    setFormState((prev) => ({
      ...prev,
      error: null,
      fieldErrors: {
        ...prev.fieldErrors,
        [name]: undefined,
      },
    }));
  }, []);

  /**
   * Obsługuje submit formularza.
   * Wykonuje walidację, a następnie logowanie przez Supabase.
   */
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Reset stanu i ustawienie loading
      setFormState({
        isLoading: true,
        error: null,
        fieldErrors: {},
      });

      // Walidacja client-side
      const validationResult = loginSchema.safeParse(formData);

      if (!validationResult.success) {
        const fieldErrors: LoginFormState["fieldErrors"] = {};

        for (const error of validationResult.error.errors) {
          const field = error.path[0] as keyof LoginFormState["fieldErrors"];
          if (!fieldErrors[field]) {
            fieldErrors[field] = error.message;
          }
        }

        setFormState({
          isLoading: false,
          error: null,
          fieldErrors,
        });
        return;
      }

      // Logowanie przez Supabase
      try {
        const supabase = createBrowserSupabaseClient();

        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          setFormState({
            isLoading: false,
            error: mapAuthError(error),
            fieldErrors: {},
          });
          return;
        }

        // Ustaw cookies bezpośrednio przed przekierowaniem
        // (onAuthStateChange może nie zdążyć przed nawigacją)
        if (data.session) {
          const expires = new Date();
          expires.setTime(expires.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 dni
          const expiresStr = expires.toUTCString();

          document.cookie = `sb-access-token=${data.session.access_token};expires=${expiresStr};path=/;SameSite=Lax`;
          document.cookie = `sb-refresh-token=${data.session.refresh_token};expires=${expiresStr};path=/;SameSite=Lax`;
        }

        // Sukces - przekierowanie na stronę główną
        window.location.href = "/";
      } catch (error) {
        // Obsługa błędów sieciowych
        if (error instanceof TypeError && error.message.includes("fetch")) {
          setFormState({
            isLoading: false,
            error: "Błąd połączenia. Sprawdź połączenie z internetem",
            fieldErrors: {},
          });
          return;
        }

        setFormState({
          isLoading: false,
          error: "Wystąpił nieoczekiwany błąd. Spróbuj ponownie",
          fieldErrors: {},
        });
      }
    },
    [formData]
  );

  const { isLoading, error, fieldErrors } = formState;

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Logowanie</CardTitle>
        <CardDescription>Zaloguj się do aplikacji Diff Explainer</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
          <div className="space-y-4">
            {/* Pole email */}
            <div className="space-y-2">
              <Label htmlFor={emailId}>Email</Label>
              <Input
                id={emailId}
                name="email"
                type="email"
                placeholder="jan@example.com"
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
              />
              {fieldErrors.email && (
                <p id={emailErrorId} className="text-sm text-destructive" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Pole hasło */}
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Hasło</Label>
              <Input
                id={passwordId}
                name="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLoading}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
              />
              {fieldErrors.password && (
                <p id={passwordErrorId} className="text-sm text-destructive" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {/* Alert z błędem ogólnym */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Przycisk submit */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Logowanie...
                </>
              ) : (
                "Zaloguj się"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

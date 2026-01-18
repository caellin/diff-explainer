import { z } from "zod";

/**
 * Schemat walidacji dla formularza logowania.
 * Waliduje email i hasło z odpowiednimi komunikatami błędów.
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email jest wymagany" })
    .min(1, "Email jest wymagany")
    .email("Nieprawidłowy format adresu email"),
  password: z.string({ required_error: "Hasło jest wymagane" }).min(1, "Hasło jest wymagane"),
});

/**
 * Typ danych wejściowych formularza logowania.
 * Inferowany ze schematu Zod.
 */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Mapowanie kodów błędów Supabase Auth na komunikaty dla użytkownika.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Nieprawidłowy email lub hasło",
  email_not_confirmed: "Adres email nie został potwierdzony",
  user_not_found: "Nie znaleziono użytkownika",
  too_many_requests: "Zbyt wiele prób logowania. Spróbuj ponownie później",
  default: "Wystąpił błąd podczas logowania. Spróbuj ponownie",
};

/**
 * Mapuje błąd z Supabase Auth na czytelny komunikat dla użytkownika.
 *
 * @param error - Błąd z Supabase Auth
 * @returns Komunikat błędu dla użytkownika
 */
export function mapAuthError(error: { code?: string; message?: string }): string {
  const code = error.code || error.message || "";

  if (code.includes("invalid") || code.includes("credentials")) {
    return AUTH_ERROR_MESSAGES.invalid_credentials;
  }
  if (code.includes("too_many") || code.includes("rate")) {
    return AUTH_ERROR_MESSAGES.too_many_requests;
  }
  if (code.includes("not_confirmed")) {
    return AUTH_ERROR_MESSAGES.email_not_confirmed;
  }

  return AUTH_ERROR_MESSAGES.default;
}

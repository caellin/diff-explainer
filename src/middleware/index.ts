import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

/**
 * Lista ścieżek publicznych dostępnych bez autoryzacji.
 * Wszystkie inne ścieżki wymagają zalogowania.
 *
 * UWAGA: Celowo ograniczona lista - chroni przed skanowaniem aplikacji.
 * Niezalogowani użytkownicy są przekierowywani na /login dla WSZYSTKICH
 * innych ścieżek (istniejących i nieistniejących).
 */
const PUBLIC_PATHS = ["/login"];

/**
 * Lista ścieżek API (wymagają weryfikacji tokenu Bearer, nie przekierowań).
 */
const API_PATHS = ["/api"];

/**
 * Sprawdza czy ścieżka jest publiczna (dostępna bez autoryzacji).
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

/**
 * Sprawdza czy ścieżka to API.
 */
function isApiPath(pathname: string): boolean {
  return API_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Middleware obsługujący autoryzację i dostęp do Supabase.
 *
 * Funkcjonalności:
 * - Tworzy instancję klienta Supabase dla każdego żądania
 * - Weryfikuje token Bearer z nagłówka Authorization (dla API)
 * - Weryfikuje sesję z cookies (dla stron)
 * - Przekierowuje niezalogowanych z chronionych tras na /login
 * - Przekierowuje zalogowanych z /login na /
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const supabaseUrl = import.meta.env.SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

  // Tworzymy nową instancję klienta dla każdego żądania
  // aby zapewnić izolację sesji między żądaniami
  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  context.locals.supabase = supabase;
  context.locals.user = null;

  const pathname = context.url.pathname;

  // Dla API - sprawdzamy nagłówek Authorization lub cookies
  if (isApiPath(pathname)) {
    const authHeader = context.request.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      // Bearer token w nagłówku (dla zewnętrznych klientów API)
      const token = authHeader.slice(7);
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      context.locals.user = user;
    } else {
      // Sprawdź cookies (dla wywołań z przeglądarki)
      const accessToken = context.cookies.get("sb-access-token")?.value;
      const refreshToken = context.cookies.get("sb-refresh-token")?.value;

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error && data.user) {
          context.locals.user = data.user;
        }
      }
    }

    return next();
  }

  // Dla stron - sprawdzamy sesję z cookies
  const accessToken = context.cookies.get("sb-access-token")?.value;
  const refreshToken = context.cookies.get("sb-refresh-token")?.value;

  if (accessToken && refreshToken) {
    // Próba odświeżenia sesji
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error && data.user) {
      context.locals.user = data.user;

      // Aktualizacja cookies jeśli tokeny zostały odświeżone
      if (data.session) {
        context.cookies.set("sb-access-token", data.session.access_token, {
          path: "/",
          httpOnly: true,
          secure: import.meta.env.PROD,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 dni
        });
        context.cookies.set("sb-refresh-token", data.session.refresh_token, {
          path: "/",
          httpOnly: true,
          secure: import.meta.env.PROD,
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 dni
        });
      }
    }
  }

  const user = context.locals.user;

  // Przekierowanie zalogowanych użytkowników z /login na /
  if (isPublicPath(pathname) && user) {
    return context.redirect("/");
  }

  // Przekierowanie niezalogowanych użytkowników na /login dla WSZYSTKICH innych ścieżek
  // (chroni przed skanowaniem aplikacji - nieistniejące ścieżki też przekierowują)
  if (!isPublicPath(pathname) && !user) {
    return context.redirect("/login");
  }

  return next();
});

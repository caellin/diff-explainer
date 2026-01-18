import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Pomocnicza funkcja do ustawiania cookie w przeglądarce.
 */
function setCookie(name: string, value: string, days = 7): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Pomocnicza funkcja do usuwania cookie w przeglądarce.
 */
function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

/**
 * Klient Supabase dla przeglądarki.
 * Używa publicznych zmiennych środowiskowych dostępnych po stronie klienta.
 *
 * Synchronizuje tokeny sesji z cookies, aby middleware mógł je odczytać.
 *
 * UWAGA: Ten klient używa tylko anonowego klucza i jest przeznaczony
 * wyłącznie do operacji autoryzacji (login, logout, session).
 */
export function createBrowserSupabaseClient() {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for browser client");
  }

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  // Nasłuchuj zmian sesji i synchronizuj z cookies
  client.auth.onAuthStateChange((event, session) => {
    if (session) {
      setCookie("sb-access-token", session.access_token);
      setCookie("sb-refresh-token", session.refresh_token);
    } else if (event === "SIGNED_OUT") {
      deleteCookie("sb-access-token");
      deleteCookie("sb-refresh-token");
    }
  });

  return client;
}

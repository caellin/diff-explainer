import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../db/database.types.ts";

/**
 * Middleware obsługujący autoryzację i dostęp do Supabase.
 *
 * Tworzy instancję klienta Supabase dla każdego żądania.
 * Jeśli w nagłówku Authorization znajduje się token Bearer,
 * middleware weryfikuje go i ustawia użytkownika w context.locals.
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

  // Wyodrębnienie tokenu z nagłówka Authorization
  const authHeader = context.request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    context.locals.user = user;
  } else {
    context.locals.user = null;
  }

  context.locals.supabase = supabase;
  return next();
});

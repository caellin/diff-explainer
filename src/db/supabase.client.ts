import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types.ts";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

export const supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Typ klienta Supabase z pełnym typowaniem bazy danych.
 * Używany w serwisach i handlerach API.
 */
export type SupabaseClientType = SupabaseClient<Database>;

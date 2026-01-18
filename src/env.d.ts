/// <reference types="astro/client" />

import type { AstroBuiltinAttributes } from "astro";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "./db/database.types.ts";

// Zapewnia dostęp do typów generowanych przez Astro
type _AstroTypes = AstroBuiltinAttributes;

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      user: User | null;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

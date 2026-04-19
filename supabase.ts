import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

let client: SupabaseClient<Database> | undefined;

function getClient(): SupabaseClient<Database> {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    client = createClient<Database>(url, key);
  }
  return client;
}

/** Browser / client usage: created on first access so `next build` prerender does not require env. */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const c = getClient();
    const value = Reflect.get(c, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(c) : value;
  },
});

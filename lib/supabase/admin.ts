import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/**
 * Cliente Supabase com service role (só no server). Usado para ações de admin:
 * listar usuários, gerar magic link de impersonation, etc.
 */
export function createAdminClient() {
  const key = env.supabase.serviceRoleKey();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  }
  return createClient(env.supabase.url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

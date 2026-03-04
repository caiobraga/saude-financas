/**
 * Variáveis de ambiente validadas (apenas server-side para secretas).
 * Use process.env no client apenas para NEXT_PUBLIC_*.
 */

function getEnv(key: string, required = true): string {
  const value = process.env[key];
  if (required && (value == null || value === "")) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value ?? "";
}

export const env = {
  // Belvo (só no server)
  belvo: {
    secretKey: () => getEnv("BELVO_SECRET_KEY"),
    secretPassword: () => getEnv("BELVO_SECRET_PASSWORD"),
    env: () => getEnv("BELVO_ENV", false) || "sandbox",
  },
  // Supabase (NEXT_PUBLIC_ no client)
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  },
  // Stripe
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    secretKey: () => getEnv("STRIPE_SECRET_KEY"),
    proPriceId: () => getEnv("STRIPE_PRO_PRICE_ID", false),
  },
} as const;

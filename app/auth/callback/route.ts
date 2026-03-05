import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Callback de auth: troca token_hash (magic link / impersonation) por sessão
 * e redireciona para o destino. Session cookies are set on the redirect response
 * so the browser receives them when following the redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") ?? "magiclink";
  const next = searchParams.get("next") ?? "/dashboard";

  let base = request.headers.get("origin") ?? "";
  if (!base) {
    try {
      const ref = request.headers.get("referer");
      if (ref) base = new URL(ref).origin;
    } catch {
      // ignore
    }
  }
  if (!base && request.url) {
    try {
      base = new URL(request.url).origin;
    } catch {
      // ignore
    }
  }

  const redirectTo = base ? `${base}${next.startsWith("/") ? next : `/${next}`}` : next;

  if (!tokenHash) {
    return NextResponse.redirect(base ? `${base}/dashboard` : "/dashboard");
  }

  const response = NextResponse.redirect(redirectTo);
  const supabase = createServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: type as "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    console.error("Auth callback verifyOtp error:", verifyError.message);
    return NextResponse.redirect(base ? `${base}/dashboard?auth_error=1` : "/dashboard?auth_error=1");
  }

  return response;
}

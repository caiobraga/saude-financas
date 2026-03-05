import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clearViewAsCookies } from "@/lib/view-as";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== env.admin.email.toLowerCase()) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  const res = NextResponse.redirect(new URL("/dashboard", request.url));
  clearViewAsCookies(res);
  return res;
}

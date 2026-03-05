import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Cria o usuário admin@mail.com com a senha definida, se não existir.
 * Protegido por ADMIN_SEED_SECRET (env). Chame uma vez após configurar a env.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.ADMIN_SEED_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "ADMIN_SEED_SECRET não configurado" },
        { status: 501 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (body?.secret !== secret) {
      return NextResponse.json({ error: "Secret inválido" }, { status: 403 });
    }

    const admin = createAdminClient();
    const adminEmail = env.admin.email;
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD ?? "mariagb123";
    const forceReset = body?.force === true;

    const { data: existing } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = existing?.users?.find((u) => u.email === adminEmail);

    if (existingUser) {
      if (forceReset) {
        const { error: updateError } = await admin.auth.admin.updateUserById(
          existingUser.id,
          { password: adminPassword }
        );
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        return NextResponse.json({
          ok: true,
          message: "Senha do admin atualizada. Use-a para entrar.",
          email: adminEmail,
        });
      }
      return NextResponse.json({
        ok: true,
        message: "Admin já existe. Para redefinir a senha, chame com body: { \"secret\": \"...\", \"force\": true }",
        email: adminEmail,
      });
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const uid = created?.user?.id;
    if (uid) {
      await admin.from("profiles").upsert(
        { id: uid, email: adminEmail, full_name: "Administrador", updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Admin criado. Faça login em /login com " + adminEmail,
      email: adminEmail,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY é obrigatória para criar o admin" },
        { status: 503 }
      );
    }
    console.error("Admin seed error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar admin" },
      { status: 500 }
    );
  }
}

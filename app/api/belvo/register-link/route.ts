import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBelvoClient } from "@/lib/belvo";

function mapAccountType(belvoType: string): "checking" | "savings" | "credit" {
  const t = String(belvoType || "").toLowerCase();
  if (t.includes("credit") || t === "credit_card") return "credit";
  if (t.includes("savings") || t === "savings") return "savings";
  return "checking";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const linkId = body?.linkId ?? body?.link_id;
    if (!linkId || typeof linkId !== "string") {
      return NextResponse.json(
        { error: "linkId é obrigatório" },
        { status: 400 }
      );
    }

    const client = getBelvoClient();
    await client.connect();

    const linkDetail = (await client.links.detail(linkId)) as {
      institution?: string | { display_name?: string };
      institution_name?: string;
      [k: string]: unknown;
    };
    const inst = linkDetail?.institution;
    const institution =
      typeof inst === "string"
        ? inst
        : inst && typeof inst === "object" && "display_name" in inst
          ? (inst as { display_name?: string }).display_name
          : linkDetail?.institution_name ?? "Banco";

    const { data: existingConn } = await supabase
      .from("bank_connections")
      .select("id")
      .eq("user_id", user.id)
      .eq("belvo_link_id", linkId)
      .single();

    let connectionId: string;
    if (existingConn?.id) {
      connectionId = existingConn.id;
    } else {
      const { data: newConn, error: connError } = await supabase
        .from("bank_connections")
        .insert({
          user_id: user.id,
          belvo_link_id: linkId,
          institution: String(institution),
          status: "active",
        })
        .select("id")
        .single();
      if (connError || !newConn?.id) {
        return NextResponse.json(
          { error: connError?.message ?? "Erro ao criar conexão" },
          { status: 500 }
        );
      }
      connectionId = newConn.id;
    }

    const belvoAccounts = (await client.accounts.retrieve(linkId)) as Array<{
      id?: string;
      name?: string;
      type?: string;
      balance?: { available?: number } | number;
      [k: string]: unknown;
    }>;
    const accountMap = new Map<string, string>();

    for (const acc of belvoAccounts ?? []) {
      const extId = acc.id ?? String(Math.random());
      const balance =
        typeof acc.balance === "object" && acc.balance !== null && "available" in acc.balance
          ? Number((acc.balance as { available?: number }).available ?? 0)
          : Number(acc.balance ?? 0);
      const { data: inserted } = await supabase
        .from("accounts")
        .upsert(
          {
            connection_id: connectionId,
            external_id: extId,
            name: String(acc.name ?? "Conta"),
            type: mapAccountType(acc.type as string),
            balance,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "connection_id,external_id" }
        )
        .select("id, external_id")
        .single();
      if (inserted?.id) accountMap.set(inserted.external_id, inserted.id);
    }

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    const dateToStr = dateTo.toISOString().slice(0, 10);

    const belvoTransactions = (await client.transactions.retrieve(
      linkId,
      dateFromStr,
      { dateTo: dateToStr }
    )) as Array<{
      id?: string;
      account?: string;
      account_id?: string;
      date?: string;
      description?: string;
      description_original?: string;
      amount?: number;
      type?: string;
      category?: string;
      [k: string]: unknown;
    }>;

    for (const t of belvoTransactions ?? []) {
      const accId = t.account ?? t.account_id;
      const ourAccountId = accId ? accountMap.get(accId) : undefined;
      if (!ourAccountId) continue;

      const amount = Number(t.amount ?? 0);
      const type =
        String(t.type ?? "").toLowerCase() === "credit" ? "credit" : "debit";
      const date = t.date?.slice(0, 10) ?? dateToStr;
      const externalId = t.id ?? `${ourAccountId}-${date}-${t.description ?? ""}-${amount}`;

      await supabase.from("transactions").upsert(
        {
          account_id: ourAccountId,
          external_id: externalId,
          date,
          description: String(t.description ?? t.description_original ?? "—"),
          raw_description:
            t.description_original != null
              ? String(t.description_original)
              : null,
          amount: type === "debit" ? -Math.abs(amount) : Math.abs(amount),
          type,
          category: t.category ? String(t.category) : null,
        },
        { onConflict: "account_id,external_id" }
      );
    }

    return NextResponse.json({ ok: true, connectionId });
  } catch (err) {
    console.error("Belvo register-link error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao registrar conexão",
      },
      { status: 500 }
    );
  }
}

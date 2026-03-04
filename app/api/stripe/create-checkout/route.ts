import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userEmail, successUrl, cancelUrl } = body as {
      userId?: string;
      userEmail?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    const priceId = env.stripe.proPriceId();
    if (!priceId) {
      return NextResponse.json(
        { error: "STRIPE_PRO_PRICE_ID não configurado. Crie um preço no Stripe Dashboard." },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl ?? `${request.headers.get("origin") ?? ""}/?success=1`,
      cancel_url: cancelUrl ?? `${request.headers.get("origin") ?? ""}/conectar`,
      ...(userEmail && { customer_email: userEmail }),
      ...(userId && { client_reference_id: userId }),
      subscription_data: {
        metadata: userId ? { user_id: userId } : undefined,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao criar sessão" },
      { status: 500 }
    );
  }
}

import Stripe from "stripe";
import { env } from "./env";

let stripeClient: Stripe | null = null;

/**
 * Cliente Stripe para uso no server (API routes, Server Actions).
 * Chave secreta vem de env: STRIPE_SECRET_KEY.
 */
export function getStripe(): Stripe {
  if (!stripeClient) {
    const secretKey = env.stripe.secretKey();
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

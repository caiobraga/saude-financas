import Client from "belvo";
import { env } from "./env";

let belvoClient: Client | null = null;

/**
 * Cliente Belvo para uso no server (API routes, Server Actions).
 * Credenciais vêm de env: BELVO_SECRET_KEY, BELVO_SECRET_PASSWORD, BELVO_ENV.
 */
export function getBelvoClient(): Client {
  if (!belvoClient) {
    const secretKey = env.belvo.secretKey();
    const secretPassword = env.belvo.secretPassword();
    const belvoEnv = env.belvo.env() as "sandbox" | "production";
    belvoClient = new Client(secretKey, secretPassword, belvoEnv);
  }
  return belvoClient;
}

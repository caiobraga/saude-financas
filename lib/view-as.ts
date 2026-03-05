import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

const COOKIE_USER_ID = "view_as_user_id";
const COOKIE_USER_NAME = "view_as_user_name";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export type ViewAsContext = { userId: string; userName: string };

export function getViewAsFromCookies(
  cookieStore: ReadonlyRequestCookies,
  isAdmin: boolean
): ViewAsContext | null {
  if (!isAdmin) return null;
  const userId = cookieStore.get(COOKIE_USER_ID)?.value;
  const userName = cookieStore.get(COOKIE_USER_NAME)?.value ?? "Usuário";
  if (!userId) return null;
  return { userId, userName };
}

export function setViewAsCookies(
  response: { cookies: { set: (name: string, value: string, options?: { path?: string; maxAge?: number }) => void } },
  userId: string,
  userName: string
) {
  response.cookies.set(COOKIE_USER_ID, userId, { path: "/", maxAge: COOKIE_MAX_AGE });
  response.cookies.set(COOKIE_USER_NAME, userName, { path: "/", maxAge: COOKIE_MAX_AGE });
}

export function clearViewAsCookies(
  response: { cookies: { set: (name: string, value: string, options?: { path?: string; maxAge?: number }) => void } }
) {
  response.cookies.set(COOKIE_USER_ID, "", { path: "/", maxAge: 0 });
  response.cookies.set(COOKIE_USER_NAME, "", { path: "/", maxAge: 0 });
}

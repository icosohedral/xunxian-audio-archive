import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, messages, resolveLocale } from "./i18n";

/** The request's locale (saved choice, else the browser language), for server components and metadata. */
export async function getLocale() {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}

export async function getMessages() {
  return messages[await getLocale()];
}

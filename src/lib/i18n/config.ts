export const SUPPORTED_LOCALES = ["es", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

function resolveLocale(value?: string | null): Locale {
  if (!value) return DEFAULT_LOCALE;
  const normalized = value.toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as Locale)
    : DEFAULT_LOCALE;
}

const configuredLocale =
  process.env.NEXT_PUBLIC_APP_LOCALE ?? process.env.APP_LOCALE ?? DEFAULT_LOCALE;

export const APP_LOCALE: Locale = resolveLocale(configuredLocale);

export function getLocale(): Locale {
  return APP_LOCALE;
}

export function getLocaleTag(locale: Locale = APP_LOCALE): string {
  return locale === "es" ? "es-ES" : "en-US";
}

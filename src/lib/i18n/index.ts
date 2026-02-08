import { en } from "./translations/en";
import { es } from "./translations/es";
import { APP_LOCALE, DEFAULT_LOCALE, type Locale, getLocale, getLocaleTag } from "./config";

type Dictionary = typeof en;

const translations = {
  en,
  es,
} as const satisfies Record<Locale, Dictionary>;

export type TranslationKey = keyof Dictionary;

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

export function t(key: TranslationKey, vars?: Record<string, string | number>, locale?: Locale): string {
  const resolvedLocale = locale ?? APP_LOCALE;
  const dictionary = translations[resolvedLocale] ?? translations[DEFAULT_LOCALE];
  const fallbackDictionary = translations[DEFAULT_LOCALE];
  const template = dictionary[key] ?? fallbackDictionary[key] ?? key;
  return format(template, vars);
}

if (process.env.NODE_ENV !== "production") {
  const baseKeys = Object.keys(en);
  const locales = Object.keys(translations) as Locale[];
  for (const locale of locales) {
    const dictKeys = Object.keys(translations[locale]);
    for (const key of baseKeys) {
      if (!dictKeys.includes(key)) {
        console.warn(`[i18n] Missing key "${key}" for locale "${locale}"`);
      }
    }
  }
}

export { getLocale, getLocaleTag };

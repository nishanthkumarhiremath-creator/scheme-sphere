export const locales = ["en", "hi", "kn", "ta", "te"] as const;
export const defaultLocale = "en";

export type AppLocale = (typeof locales)[number];

export function isAppLocale(locale: string): locale is AppLocale {
  return locales.includes(locale as AppLocale);
}

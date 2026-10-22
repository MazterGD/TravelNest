import { getRequestConfig } from "next-intl/server";

// Supported locales
const locales = ["en", "si", "ta"] as const;
type Locale = (typeof locales)[number];

type Messages = { [key: string]: unknown };

const isPlainObject = (value: unknown): value is Messages =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// next-intl ignores i18next-style `defaultValue`, so a key missing from a
// translation would render as its raw path. Fall back to English instead.
const mergeMessages = (fallback: Messages, primary: Messages): Messages => {
  const merged: Messages = { ...fallback };
  for (const [key, value] of Object.entries(primary)) {
    const base = merged[key];
    merged[key] =
      isPlainObject(value) && isPlainObject(base)
        ? mergeMessages(base, value)
        : value;
  }
  return merged;
};

export default getRequestConfig(async ({ requestLocale }) => {
  // Get the locale from the request
  let locale = await requestLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!locale || !locales.includes(locale as Locale)) {
    locale = "en";
  }

  const messages = (await import(`./locales/${locale}/common.json`))
    .default as Messages;
  if (locale === "en") {
    return { locale, messages };
  }

  const english = (await import("./locales/en/common.json")).default as Messages;
  return {
    locale,
    messages: mergeMessages(english, messages),
  };
});

import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import Backend from "i18next-http-backend"
import { format as formatDate, formatDistance, formatRelative } from "date-fns"
import { enUS, es, fr, de, ja, zhCN } from "date-fns/locale"
import type { Locale } from "date-fns"

// Define supported languages and their date-fns locales
const dateLocales: { [key: string]: Locale } = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  ja: ja,
  "zh-CN": zhCN,
}

// Initialize i18next
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "es", "fr", "de", "ja", "zh-CN"],
    debug: process.env.NODE_ENV === "development",
    interpolation: {
      escapeValue: false, // React already escapes values
      format: (value, format, lng) => {
        if (value instanceof Date) {
          const locale = lng ? dateLocales[lng] || enUS : enUS

          if (format === "relative") {
            return formatRelative(value, new Date(), { locale })
          }

          if (format === "distance") {
            return formatDistance(value, new Date(), {
              locale,
              addSuffix: true,
            })
          }

          return formatDate(value, format || "PPpp", { locale })
        }
        return value
      },
    },
    detection: {
      order: ["cookie", "localStorage", "navigator"],
      caches: ["cookie", "localStorage"],
    },
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    react: {
      useSuspense: false,
    },
  })

export default i18n

// Helper function to change language
export const changeLanguage = async (language: string): Promise<void> => {
  await i18n.changeLanguage(language)

  // Store the language preference
  if (typeof window !== "undefined") {
    localStorage.setItem("i18nextLng", language)
    document.documentElement.lang = language
  }
}

// Get current language
export const getCurrentLanguage = (): string => {
  return i18n.language || "en"
}

// Get supported languages
export const getSupportedLanguages = (): { code: string; name: string }[] => {
  return [
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "ja", name: "日本語" },
    { code: "zh-CN", name: "简体中文" },
  ]
}

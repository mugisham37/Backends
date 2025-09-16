import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import Backend from "i18next-http-backend"
import { format as formatDate, formatDistance, formatRelative } from "date-fns"
import { enUS, es, fr, de, ja, zhCN, ar, type Locale } from "date-fns/locale"

// Import translations
import enTranslations from "./locales/en.json"
import esTranslations from "./locales/es.json"
import frTranslations from "./locales/fr.json"
import deTranslations from "./locales/de.json"
import jaTranslations from "./locales/ja.json"
import zhTranslations from "./locales/zh.json"
import arTranslations from "./locales/ar.json"

// Map of date-fns locales
const dateLocales: { [key: string]: Locale } = {
  en: enUS,
  es: es,
  fr: fr,
  de: de,
  ja: ja,
  zh: zhCN,
  ar: ar,
}

// Define available languages
export const languages = [
  { code: "en", name: "English", flag: "🇺🇸", dir: "ltr" },
  { code: "es", name: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "fr", name: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "de", name: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "ja", name: "日本語", flag: "🇯🇵", dir: "ltr" },
  { code: "zh", name: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "ar", name: "العربية", flag: "🇸🇦", dir: "rtl" },
]

// Resources object for i18next
const resources = {
  en: { translation: enTranslations },
  es: { translation: esTranslations },
  fr: { translation: frTranslations },
  de: { translation: deTranslations },
  ja: { translation: jaTranslations },
  zh: { translation: zhTranslations },
  ar: { translation: arTranslations },
}

// Initialize i18next
i18n
  .use(Backend) // Load translations from server (optional)
  .use(LanguageDetector) // Detect user language
  .use(initReactI18next) // Pass i18n down to react-i18next
  .init({
    resources,
    fallbackLng: "en",
    debug: process.env.NODE_ENV === "development",

    interpolation: {
      escapeValue: false, // React already escapes values
      format: (value, format, lng) => {
        if (value instanceof Date) {
          const locale = lng ? dateLocales[lng.split("-")[0]] || dateLocales.en : dateLocales.en

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

    // React settings
    react: {
      useSuspense: false, // Disable Suspense
    },
  })

// Function to get the current language direction
export const getLanguageDirection = (languageCode: string): "ltr" | "rtl" => {
  const language = languages.find((lang) => lang.code === languageCode)
  return language?.dir || "ltr"
}

// Function to set the HTML dir attribute based on language
export const setLanguageDirection = (languageCode: string): void => {
  const dir = getLanguageDirection(languageCode)
  document.documentElement.setAttribute("dir", dir)

  // Add language-specific class to body
  document.documentElement.classList.forEach((cls) => {
    if (cls.startsWith("lang-")) {
      document.documentElement.classList.remove(cls)
    }
  })
  document.documentElement.classList.add(`lang-${languageCode}`)
}

// Listen for language changes
i18n.on("languageChanged", (lng) => {
  setLanguageDirection(lng)
})

export default i18n

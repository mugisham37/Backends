import i18next from "i18next";
import Backend from "i18next-fs-backend";
import path from "path";
import fs from "fs";
import logger from "./logger";

// Define supported languages
export const supportedLanguages = ["en", "es", "fr", "de", "zh"];

// Define default language
export const defaultLanguage = "en";

// Initialize i18next
i18next
  .use(Backend)
  .init({
    backend: {
      loadPath: path.join(process.cwd(), "src/locales/{{lng}}/{{ns}}.json"),
    },
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    ns: ["common", "errors", "validation", "emails"],
    defaultNS: "common",
    preload: supportedLanguages,
    interpolation: {
      escapeValue: false,
    },
  })
  .then(() => {
    logger.info(`i18next initialized with languages: ${supportedLanguages.join(", ")}`);
  })
  .catch((error) => {
    logger.error(`Error initializing i18next: ${error.message}`);
  });

// Create locales directory and default files if they don't exist
export const initLocales = (): void => {
  const localesDir = path.join(process.cwd(), "src/locales");

  // Create locales directory if it doesn't exist
  if (!fs.existsSync(localesDir)) {
    fs.mkdirSync(localesDir, { recursive: true });
    logger.info(`Created locales directory: ${localesDir}`);
  }

  // Create language directories and default files
  supportedLanguages.forEach((lang) => {
    const langDir = path.join(localesDir, lang);
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true });
      logger.info(`Created language directory: ${langDir}`);
    }

    // Create default files for each namespace
    const namespaces = ["common", "errors", "validation", "emails"];
    namespaces.forEach((ns) => {
      const filePath = path.join(langDir, `${ns}.json`);
      if (!fs.existsSync(filePath)) {
        // Create empty JSON file
        fs.writeFileSync(filePath, "{}");
        logger.info(`Created empty translation file: ${filePath}`);
      }
    });
  });
};

// Initialize locales
initLocales();

export default i18next;

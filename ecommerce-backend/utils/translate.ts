import i18next from "../config/i18n"
import { defaultLanguage } from "../config/i18n"

/**
 * Translate a key
 * @param key Translation key
 * @param options Translation options
 * @param language Language code
 * @returns Translated string
 */
export const t = (key: string, options?: Record<string, any>, language?: string): string => {
  return i18next.t(key, { lng: language || defaultLanguage, ...options })
}

/**
 * Translate an error message
 * @param key Error key
 * @param options Translation options
 * @param language Language code
 * @returns Translated error message
 */
export const translateError = (key: string, options?: Record<string, any>, language?: string): string => {
  return i18next.t(`errors:${key}`, { lng: language || defaultLanguage, ...options })
}

/**
 * Translate a validation message
 * @param key Validation key
 * @param options Translation options
 * @param language Language code
 * @returns Translated validation message
 */
export const translateValidation = (key: string, options?: Record<string, any>, language?: string): string => {
  return i18next.t(`validation:${key}`, { lng: language || defaultLanguage, ...options })
}

/**
 * Translate an email template
 * @param key Email template key
 * @param options Translation options
 * @param language Language code
 * @returns Translated email template
 */
export const translateEmail = (key: string, options?: Record<string, any>, language?: string): string => {
  return i18next.t(`emails:${key}`, { lng: language || defaultLanguage, ...options })
}

import { TranslationModel, type ITranslation } from "../db/models/i18n.model"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"
import fs from "fs"
import path from "path"
import { promisify } from "util"

const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const mkdir = promisify(fs.mkdir)

export class I18nService {
  private localesDir: string
  private cache: Map<string, Record<string, string>> = new Map()
  private defaultLocale = "en"

  constructor(localesDir?: string) {
    this.localesDir = localesDir || path.join(process.cwd(), "locales")
    // Ensure locales directory exists
    if (!fs.existsSync(this.localesDir)) {
      fs.mkdirSync(this.localesDir, { recursive: true })
    }
  }

  /**
   * Initialize i18n service
   */
  public async initialize(): Promise<void> {
    try {
      logger.info("Initializing i18n service...")

      // Load translations from database into cache
      await this.loadTranslationsToCache()

      // Load translations from files if database is empty
      const count = await TranslationModel.countDocuments({})
      if (count === 0) {
        await this.loadDefaultTranslations()
      }

      logger.info("i18n service initialized")
    } catch (error) {
      logger.error("Error initializing i18n service:", error)
      throw error
    }
  }

  /**
   * Load default translations from files
   */
  private async loadDefaultTranslations(): Promise<void> {
    try {
      logger.info("Loading default translations...")

      // Default translations for English
      const enCommon = {
        welcome: "Welcome to the CMS",
        login: "Log in",
        logout: "Log out",
        email: "Email",
        password: "Password",
        forgotPassword: "Forgot password?",
        resetPassword: "Reset password",
        register: "Register",
        dashboard: "Dashboard",
        settings: "Settings",
        profile: "Profile",
        users: "Users",
        content: "Content",
        media: "Media",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        edit: "Edit",
        create: "Create",
        search: "Search",
        filter: "Filter",
        sort: "Sort",
        actions: "Actions",
        status: "Status",
        createdAt: "Created at",
        updatedAt: "Updated at",
        name: "Name",
        description: "Description",
        title: "Title",
        slug: "Slug",
        type: "Type",
        category: "Category",
        tags: "Tags",
        author: "Author",
        publishedAt: "Published at",
        draft: "Draft",
        published: "Published",
        archived: "Archived",
        active: "Active",
        inactive: "Inactive",
        error: "Error",
        success: "Success",
        warning: "Warning",
        info: "Info",
        loading: "Loading...",
        noResults: "No results found",
        noData: "No data available",
        required: "This field is required",
        invalidEmail: "Invalid email address",
        invalidPassword: "Invalid password",
        passwordMismatch: "Passwords do not match",
        minLength: "Must be at least {min} characters",
        maxLength: "Cannot exceed {max} characters",
        invalidFormat: "Invalid format",
        confirmDelete: "Are you sure you want to delete this?",
        confirmAction: "Are you sure you want to perform this action?",
        yes: "Yes",
        no: "No",
        ok: "OK",
        back: "Back",
        next: "Next",
        previous: "Previous",
        first: "First",
        last: "Last",
        page: "Page",
        of: "of",
        perPage: "per page",
        all: "All",
        none: "None",
        select: "Select",
        selectAll: "Select all",
        deselectAll: "Deselect all",
        upload: "Upload",
        download: "Download",
        import: "Import",
        export: "Export",
        preview: "Preview",
        close: "Close",
        apply: "Apply",
        reset: "Reset",
        clear: "Clear",
        add: "Add",
        remove: "Remove",
        update: "Update",
        refresh: "Refresh",
        more: "More",
        less: "Less",
        show: "Show",
        hide: "Hide",
        enable: "Enable",
        disable: "Disable",
        enabled: "Enabled",
        disabled: "Disabled",
        on: "On",
        off: "Off",
        ascending: "Ascending",
        descending: "Descending",
        asc: "Asc",
        desc: "Desc",
        today: "Today",
        yesterday: "Yesterday",
        thisWeek: "This week",
        lastWeek: "Last week",
        thisMonth: "This month",
        lastMonth: "Last month",
        thisYear: "This year",
        lastYear: "Last year",
        custom: "Custom",
        dateRange: "Date range",
        startDate: "Start date",
        endDate: "End date",
        from: "From",
        to: "To",
        date: "Date",
        time: "Time",
        datetime: "Date and time",
        timezone: "Timezone",
        language: "Language",
        theme: "Theme",
        light: "Light",
        dark: "Dark",
        system: "System",
        auto: "Auto",
        manual: "Manual",
        default: "Default",
        custom: "Custom",
        general: "General",
        advanced: "Advanced",
        security: "Security",
        privacy: "Privacy",
        notifications: "Notifications",
        appearance: "Appearance",
        accessibility: "Accessibility",
        help: "Help",
        support: "Support",
        feedback: "Feedback",
        about: "About",
        version: "Version",
        copyright: "Copyright",
        termsOfService: "Terms of Service",
        privacyPolicy: "Privacy Policy",
        cookiePolicy: "Cookie Policy",
        contactUs: "Contact us",
        followUs: "Follow us",
        shareThis: "Share this",
        poweredBy: "Powered by",
        madeWith: "Made with",
        by: "by",
        in: "in",
        and: "and",
        or: "or",
        not: "not",
        for: "for",
        with: "with",
        without: "without",
        at: "at",
        on: "on",
        error404: "404 - Page not found",
        error500: "500 - Server error",
        errorUnknown: "Unknown error",
        errorNetwork: "Network error",
        errorTimeout: "Request timeout",
        errorUnauthorized: "Unauthorized",
        errorForbidden: "Forbidden",
        errorNotFound: "Not found",
        errorBadRequest: "Bad request",
        errorConflict: "Conflict",
        errorValidation: "Validation error",
        errorServer: "Server error",
      }

      // Default translations for Spanish
      const esCommon = {
        welcome: "Bienvenido al CMS",
        login: "Iniciar sesión",
        logout: "Cerrar sesión",
        email: "Correo electrónico",
        password: "Contraseña",
        forgotPassword: "¿Olvidó su contraseña?",
        resetPassword: "Restablecer contraseña",
        register: "Registrarse",
        dashboard: "Panel de control",
        settings: "Configuración",
        profile: "Perfil",
        users: "Usuarios",
        content: "Contenido",
        media: "Medios",
        save: "Guardar",
        cancel: "Cancelar",
        delete: "Eliminar",
        edit: "Editar",
        create: "Crear",
        search: "Buscar",
        filter: "Filtrar",
        sort: "Ordenar",
        actions: "Acciones",
        status: "Estado",
        createdAt: "Creado el",
        updatedAt: "Actualizado el",
        name: "Nombre",
        description: "Descripción",
        title: "Título",
        slug: "Slug",
        type: "Tipo",
        category: "Categoría",
        tags: "Etiquetas",
        author: "Autor",
        publishedAt: "Publicado el",
        draft: "Borrador",
        published: "Publicado",
        archived: "Archivado",
        active: "Activo",
        inactive: "Inactivo",
        error: "Error",
        success: "Éxito",
        warning: "Advertencia",
        info: "Información",
        loading: "Cargando...",
        noResults: "No se encontraron resultados",
        noData: "No hay datos disponibles",
        required: "Este campo es obligatorio",
        invalidEmail: "Dirección de correo electrónico inválida",
        invalidPassword: "Contraseña inválida",
        passwordMismatch: "Las contraseñas no coinciden",
        minLength: "Debe tener al menos {min} caracteres",
        maxLength: "No puede exceder {max} caracteres",
        invalidFormat: "Formato inválido",
        confirmDelete: "¿Está seguro de que desea eliminar esto?",
        confirmAction: "¿Está seguro de que desea realizar esta acción?",
        yes: "Sí",
        no: "No",
        ok: "Aceptar",
        back: "Atrás",
        next: "Siguiente",
        previous: "Anterior",
        first: "Primero",
        last: "Último",
        page: "Página",
        of: "de",
        perPage: "por página",
        all: "Todos",
        none: "Ninguno",
        select: "Seleccionar",
        selectAll: "Seleccionar todo",
        deselectAll: "Deseleccionar todo",
        upload: "Subir",
        download: "Descargar",
        import: "Importar",
        export: "Exportar",
        preview: "Vista previa",
        close: "Cerrar",
        apply: "Aplicar",
        reset: "Restablecer",
        clear: "Limpiar",
        add: "Añadir",
        remove: "Eliminar",
        update: "Actualizar",
        refresh: "Refrescar",
        more: "Más",
        less: "Menos",
        show: "Mostrar",
        hide: "Ocultar",
        enable: "Habilitar",
        disable: "Deshabilitar",
        enabled: "Habilitado",
        disabled: "Deshabilitado",
        on: "Activado",
        off: "Desactivado",
        ascending: "Ascendente",
        descending: "Descendente",
        asc: "Asc",
        desc: "Desc",
        today: "Hoy",
        yesterday: "Ayer",
        thisWeek: "Esta semana",
        lastWeek: "Semana pasada",
        thisMonth: "Este mes",
        lastMonth: "Mes pasado",
        thisYear: "Este año",
        lastYear: "Año pasado",
        custom: "Personalizado",
        dateRange: "Rango de fechas",
        startDate: "Fecha de inicio",
        endDate: "Fecha de fin",
        from: "Desde",
        to: "Hasta",
        date: "Fecha",
        time: "Hora",
        datetime: "Fecha y hora",
        timezone: "Zona horaria",
        language: "Idioma",
        theme: "Tema",
        light: "Claro",
        dark: "Oscuro",
        system: "Sistema",
        auto: "Automático",
        manual: "Manual",
        default: "Predeterminado",
        custom: "Personalizado",
        general: "General",
        advanced: "Avanzado",
        security: "Seguridad",
        privacy: "Privacidad",
        notifications: "Notificaciones",
        appearance: "Apariencia",
        accessibility: "Accesibilidad",
        help: "Ayuda",
        support: "Soporte",
        feedback: "Comentarios",
        about: "Acerca de",
        version: "Versión",
        copyright: "Derechos de autor",
        termsOfService: "Términos de servicio",
        privacyPolicy: "Política de privacidad",
        cookiePolicy: "Política de cookies",
        contactUs: "Contáctenos",
        followUs: "Síganos",
        shareThis: "Compartir esto",
        poweredBy: "Desarrollado por",
        madeWith: "Hecho con",
        by: "por",
        in: "en",
        and: "y",
        or: "o",
        not: "no",
        for: "para",
        with: "con",
        without: "sin",
        at: "en",
        on: "en",
        error404: "404 - Página no encontrada",
        error500: "500 - Error del servidor",
        errorUnknown: "Error desconocido",
        errorNetwork: "Error de red",
        errorTimeout: "Tiempo de espera agotado",
        errorUnauthorized: "No autorizado",
        errorForbidden: "Prohibido",
        errorNotFound: "No encontrado",
        errorBadRequest: "Solicitud incorrecta",
        errorConflict: "Conflicto",
        errorValidation: "Error de validación",
        errorServer: "Error del servidor",
      }

      // Import default translations
      await this.importTranslations({
        locale: "en",
        namespace: "common",
        translations: enCommon,
      })

      await this.importTranslations({
        locale: "es",
        namespace: "common",
        translations: esCommon,
      })

      logger.info("Default translations loaded")
    } catch (error) {
      logger.error("Error loading default translations:", error)
      throw error
    }
  }

  /**
   * Load translations from database into cache
   */
  private async loadTranslationsToCache(): Promise<void> {
    try {
      // Clear cache
      this.cache.clear()

      // Get all translations
      const translations = await TranslationModel.find({})

      // Group translations by locale and namespace
      for (const translation of translations) {
        const cacheKey = this.getCacheKey(translation.locale, translation.namespace, translation.tenantId?.toString())

        if (!this.cache.has(cacheKey)) {
          this.cache.set(cacheKey, {})
        }

        const localeCache = this.cache.get(cacheKey)!
        localeCache[translation.key] = translation.value
      }

      logger.info(`Loaded ${translations.length} translations into cache`)
    } catch (error) {
      logger.error("Error loading translations to cache:", error)
      throw error
    }
  }

  /**
   * Get cache key
   */
  private getCacheKey(locale: string, namespace: string, tenantId?: string): string {
    return tenantId ? `${locale}:${namespace}:${tenantId}` : `${locale}:${namespace}`
  }

  /**
   * Create or update a translation
   */
  public async upsertTranslation(data: {
    locale: string
    namespace: string
    key: string
    value: string
    tenantId?: string
  }): Promise<ITranslation> {
    try {
      const { locale, namespace, key, value, tenantId } = data

      // Find existing translation
      const existingTranslation = await TranslationModel.findOne({
        locale,
        namespace,
        key,
        ...(tenantId ? { tenantId } : { tenantId: { $exists: false } }),
      })

      if (existingTranslation) {
        // Update existing translation
        existingTranslation.value = value
        await existingTranslation.save()

        // Update cache
        const cacheKey = this.getCacheKey(locale, namespace, tenantId)
        if (this.cache.has(cacheKey)) {
          const localeCache = this.cache.get(cacheKey)!
          localeCache[key] = value
        }

        logger.info(`Translation updated: ${locale}:${namespace}:${key}`)

        return existingTranslation
      } else {
        // Create new translation
        const translation = new TranslationModel({
          locale,
          namespace,
          key,
          value,
          ...(tenantId && { tenantId }),
        })

        await translation.save()

        // Update cache
        const cacheKey = this.getCacheKey(locale, namespace, tenantId)
        if (!this.cache.has(cacheKey)) {
          this.cache.set(cacheKey, {})
        }
        const localeCache = this.cache.get(cacheKey)!
        localeCache[key] = value

        logger.info(`Translation created: ${locale}:${namespace}:${key}`)

        return translation
      }
    } catch (error) {
      logger.error("Error upserting translation:", error)
      throw error
    }
  }

  /**
   * Delete a translation
   */
  public async deleteTranslation(id: string): Promise<void> {
    try {
      const translation = await TranslationModel.findById(id)

      if (!translation) {
        throw ApiError.notFound("Translation not found")
      }

      await TranslationModel.findByIdAndDelete(id)

      // Update cache
      const cacheKey = this.getCacheKey(translation.locale, translation.namespace, translation.tenantId?.toString())
      if (this.cache.has(cacheKey)) {
        const localeCache = this.cache.get(cacheKey)!
        delete localeCache[translation.key]
      }

      logger.info(`Translation deleted: ${translation.locale}:${translation.namespace}:${translation.key}`)
    } catch (error) {
      logger.error(`Error deleting translation ${id}:`, error)
      throw error
    }
  }

  /**
   * Get translations by locale and namespace
   */
  public async getTranslations(options: {
    locale: string
    namespace?: string
    tenantId?: string
  }): Promise<Record<string, string>> {
    try {
      const { locale, namespace = "common", tenantId } = options

      // Try to get from cache first
      const cacheKey = this.getCacheKey(locale, namespace, tenantId)
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey)!
      }

      // If not in cache, get from database
      const query: any = {
        locale,
        namespace,
      }

      if (tenantId) {
        query.tenantId = tenantId
      } else {
        query.tenantId = { $exists: false }
      }

      const translations = await TranslationModel.find(query)

      // Convert to key-value object
      const result: Record<string, string> = {}
      for (const translation of translations) {
        result[translation.key] = translation.value
      }

      // Update cache
      this.cache.set(cacheKey, result)

      return result
    } catch (error) {
      logger.error(`Error getting translations for ${options.locale}:${options.namespace}:`, error)
      throw error
    }
  }

  /**
   * Get all locales
   */
  public async getLocales(tenantId?: string): Promise<string[]> {
    try {
      const query: any = {}
      if (tenantId) {
        query.tenantId = tenantId
      } else {
        query.tenantId = { $exists: false }
      }

      const locales = await TranslationModel.distinct("locale", query)
      return locales
    } catch (error) {
      logger.error("Error getting locales:", error)
      throw error
    }
  }

  /**
   * Get all namespaces
   */
  public async getNamespaces(options: { locale?: string; tenantId?: string } = {}): Promise<string[]> {
    try {
      const { locale, tenantId } = options
      const query: any = {}

      if (locale) {
        query.locale = locale
      }

      if (tenantId) {
        query.tenantId = tenantId
      } else {
        query.tenantId = { $exists: false }
      }

      const namespaces = await TranslationModel.distinct("namespace", query)
      return namespaces
    } catch (error) {
      logger.error("Error getting namespaces:", error)
      throw error
    }
  }

  /**
   * Import translations from JSON file
   */
  public async importTranslationsFromFile(options: {
    locale: string
    namespace: string
    filePath: string
    tenantId?: string
    overwrite?: boolean
  }): Promise<number> {
    try {
      const { locale, namespace, filePath, tenantId, overwrite = false } = options

      // Read file
      const fileContent = await readFile(filePath, "utf8")
      const translations = JSON.parse(fileContent)

      return this.importTranslations({
        locale,
        namespace,
        translations,
        tenantId,
        overwrite,
      })
    } catch (error) {
      logger.error("Error importing translations from file:", error)
      throw error
    }
  }

  /**
   * Import translations from object
   */
  public async importTranslations(options: {
    locale: string
    namespace: string
    translations: Record<string, string>
    tenantId?: string
    overwrite?: boolean
  }): Promise<number> {
    try {
      const { locale, namespace, translations, tenantId, overwrite = false } = options

      let importedCount = 0

      // Process each translation
      for (const [key, value] of Object.entries(translations)) {
        // Skip empty values
        if (!value) continue

        // Check if translation already exists
        const existingTranslation = await TranslationModel.findOne({
          locale,
          namespace,
          key,
          ...(tenantId ? { tenantId } : { tenantId: { $exists: false } }),
        })

        if (existingTranslation) {
          if (overwrite) {
            // Update existing translation
            existingTranslation.value = value
            await existingTranslation.save()
            importedCount++
          }
        } else {
          // Create new translation
          await TranslationModel.create({
            locale,
            namespace,
            key,
            value,
            ...(tenantId && { tenantId }),
          })
          importedCount++
        }
      }

      // Update cache
      await this.loadTranslationsToCache()

      logger.info(`Imported ${importedCount} translations for ${locale}:${namespace}`)

      return importedCount
    } catch (error) {
      logger.error("Error importing translations:", error)
      throw error
    }
  }

  /**
   * Export translations to JSON file
   */
  public async exportTranslationsToFile(options: {
    locale: string
    namespace: string
    filePath: string
    tenantId?: string
  }): Promise<void> {
    try {
      const { locale, namespace, filePath, tenantId } = options

      // Get translations
      const translations = await this.getTranslations({
        locale,
        namespace,
        tenantId,
      })

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath)
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true })
      }

      // Write to file
      await writeFile(filePath, JSON.stringify(translations, null, 2), "utf8")

      logger.info(`Exported translations for ${locale}:${namespace} to ${filePath}`)
    } catch (error) {
      logger.error("Error exporting translations to file:", error)
      throw error
    }
  }

  /**
   * Translate a key
   */
  public async translate(options: {
    locale: string
    namespace: string
    key: string
    defaultValue?: string
    params?: Record<string, string | number>
    tenantId?: string
  }): Promise<string> {
    try {
      const { locale, namespace, key, defaultValue, params, tenantId } = options

      // Get translations for locale and namespace
      const translations = await this.getTranslations({
        locale,
        namespace,
        tenantId,
      })

      // Check if key exists
      if (translations[key]) {
        let value = translations[key]

        // Replace parameters
        if (params) {
          for (const [paramKey, paramValue] of Object.entries(params)) {
            value = value.replace(new RegExp(`{${paramKey}}`, "g"), String(paramValue))
          }
        }

        return value
      }

      // If key not found in requested locale, try default locale
      if (locale !== this.defaultLocale) {
        const defaultTranslations = await this.getTranslations({
          locale: this.defaultLocale,
          namespace,
          tenantId,
        })

        if (defaultTranslations[key]) {
          let value = defaultTranslations[key]

          // Replace parameters
          if (params) {
            for (const [paramKey, paramValue] of Object.entries(params)) {
              value = value.replace(new RegExp(`{${paramKey}}`, "g"), String(paramValue))
            }
          }

          return value
        }
      }

      // Return default value or key if not found
      return defaultValue || key
    } catch (error) {
      logger.error(`Error translating key ${options.key}:`, error)
      return options.defaultValue || options.key
    }
  }

  /**
   * Set default locale
   */
  public setDefaultLocale(locale: string): void {
    this.defaultLocale = locale
    logger.info(`Default locale set to ${locale}`)
  }

  /**
   * Get default locale
   */
  public getDefaultLocale(): string {
    return this.defaultLocale
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear()
    logger.info("Translation cache cleared")
  }
}

// Export singleton instance
export const i18nService = new I18nService()

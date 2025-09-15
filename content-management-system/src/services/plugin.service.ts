import { PluginModel, PluginStatus, type IPlugin } from "../db/models/plugin.model"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"
import fs from "fs/promises"
import path from "path"
import { createHash } from "crypto"

export interface PluginHook {
  name: string
  handler: Function
}

export class PluginService {
  private hooks: Map<string, PluginHook[]> = new Map()
  private pluginsDir: string

  constructor() {
    this.pluginsDir = path.resolve(process.cwd(), "plugins")
    this.ensurePluginsDirectory()
  }

  /**
   * Ensure plugins directory exists
   */
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.pluginsDir, { recursive: true })
    } catch (error) {
      logger.error("Failed to create plugins directory:", error)
      throw new ApiError(500, "Failed to create plugins directory")
    }
  }

  /**
   * Get all plugins
   */
  public async getAllPlugins(tenantId?: string): Promise<IPlugin[]> {
    try {
      const query = tenantId ? { tenantId } : {}
      return await PluginModel.find(query).sort({ name: 1 })
    } catch (error) {
      logger.error("Failed to get plugins:", error)
      throw new ApiError(500, "Failed to get plugins")
    }
  }

  /**
   * Get plugin by ID
   */
  public async getPluginById(id: string): Promise<IPlugin> {
    try {
      const plugin = await PluginModel.findById(id)
      if (!plugin) {
        throw new ApiError(404, "Plugin not found")
      }
      return plugin
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to get plugin:", error)
      throw new ApiError(500, "Failed to get plugin")
    }
  }

  /**
   * Install a plugin
   */
  public async installPlugin(
    name: string,
    version: string,
    description: string,
    entryPoint: string,
    author: string,
    repository?: string,
    tenantId?: string,
  ): Promise<IPlugin> {
    try {
      // Check if plugin already exists
      const existingPlugin = await PluginModel.findOne({ name, ...(tenantId && { tenantId }) })
      if (existingPlugin) {
        throw new ApiError(409, "Plugin already exists")
      }

      // Create plugin directory
      const pluginDir = path.join(this.pluginsDir, this.sanitizePluginName(name))
      await fs.mkdir(pluginDir, { recursive: true })

      // Create plugin entry point file
      const entryPointPath = path.join(pluginDir, "index.js")
      await fs.writeFile(entryPointPath, "// Plugin entry point")

      // Calculate checksum
      const checksum = await this.calculateChecksum(entryPointPath)

      // Create plugin in database
      const plugin = new PluginModel({
        name,
        version,
        description,
        entryPoint,
        author,
        repository,
        status: PluginStatus.INSTALLED,
        checksum,
        ...(tenantId && { tenantId }),
      })

      await plugin.save()
      return plugin
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to install plugin:", error)
      throw new ApiError(500, "Failed to install plugin")
    }
  }

  /**
   * Uninstall a plugin
   */
  public async uninstallPlugin(id: string): Promise<void> {
    try {
      const plugin = await this.getPluginById(id)

      // Remove plugin directory
      const pluginDir = path.join(this.pluginsDir, this.sanitizePluginName(plugin.name))
      await fs.rm(pluginDir, { recursive: true, force: true })

      // Remove plugin from database
      await PluginModel.findByIdAndDelete(id)
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to uninstall plugin:", error)
      throw new ApiError(500, "Failed to uninstall plugin")
    }
  }

  /**
   * Enable a plugin
   */
  public async enablePlugin(id: string): Promise<IPlugin> {
    try {
      const plugin = await this.getPluginById(id)

      if (plugin.status === PluginStatus.ENABLED) {
        throw new ApiError(400, "Plugin is already enabled")
      }

      plugin.status = PluginStatus.ENABLED
      await plugin.save()

      // Load plugin hooks
      await this.loadPluginHooks(plugin)

      return plugin
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to enable plugin:", error)
      throw new ApiError(500, "Failed to enable plugin")
    }
  }

  /**
   * Disable a plugin
   */
  public async disablePlugin(id: string): Promise<IPlugin> {
    try {
      const plugin = await this.getPluginById(id)

      if (plugin.status === PluginStatus.DISABLED) {
        throw new ApiError(400, "Plugin is already disabled")
      }

      plugin.status = PluginStatus.DISABLED
      await plugin.save()

      // Unload plugin hooks
      this.unloadPluginHooks(plugin.name)

      return plugin
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to disable plugin:", error)
      throw new ApiError(500, "Failed to disable plugin")
    }
  }

  /**
   * Update a plugin
   */
  public async updatePlugin(id: string, version: string, description?: string): Promise<IPlugin> {
    try {
      const plugin = await this.getPluginById(id)

      plugin.version = version
      if (description) {
        plugin.description = description
      }

      // Recalculate checksum
      const entryPointPath = path.join(this.pluginsDir, this.sanitizePluginName(plugin.name), "index.js")
      plugin.checksum = await this.calculateChecksum(entryPointPath)

      await plugin.save()
      return plugin
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to update plugin:", error)
      throw new ApiError(500, "Failed to update plugin")
    }
  }

  /**
   * Register a hook
   */
  public registerHook(pluginName: string, hookName: string, handler: Function): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, [])
    }

    const hooks = this.hooks.get(hookName)!
    hooks.push({ name: pluginName, handler })
  }

  /**
   * Execute a hook
   */
  public async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    if (!this.hooks.has(hookName)) {
      return []
    }

    const hooks = this.hooks.get(hookName)!
    const results = []

    for (const hook of hooks) {
      try {
        const result = await hook.handler(...args)
        results.push(result)
      } catch (error) {
        logger.error(`Error executing hook ${hookName} from plugin ${hook.name}:`, error)
      }
    }

    return results
  }

  /**
   * Load all enabled plugins
   */
  public async loadAllPlugins(): Promise<void> {
    try {
      const enabledPlugins = await PluginModel.find({ status: PluginStatus.ENABLED })

      for (const plugin of enabledPlugins) {
        await this.loadPluginHooks(plugin)
      }

      logger.info(`Loaded ${enabledPlugins.length} plugins`)
    } catch (error) {
      logger.error("Failed to load plugins:", error)
      throw new ApiError(500, "Failed to load plugins")
    }
  }

  /**
   * Load plugin hooks
   */
  private async loadPluginHooks(plugin: IPlugin): Promise<void> {
    try {
      const pluginDir = path.join(this.pluginsDir, this.sanitizePluginName(plugin.name))
      const entryPointPath = path.join(pluginDir, "index.js")

      // Check if plugin file exists
      try {
        await fs.access(entryPointPath)
      } catch {
        logger.warn(`Plugin ${plugin.name} entry point not found at ${entryPointPath}`)
        return
      }

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(entryPointPath)
      if (currentChecksum !== plugin.checksum) {
        logger.warn(`Plugin ${plugin.name} checksum mismatch, not loading`)
        return
      }

      // Load plugin
      try {
        // In a real implementation, this would dynamically load the plugin
        // For this example, we'll just simulate it
        logger.info(`Loaded plugin ${plugin.name}`)
      } catch (error) {
        logger.error(`Failed to load plugin ${plugin.name}:`, error)
      }
    } catch (error) {
      logger.error(`Failed to load hooks for plugin ${plugin.name}:`, error)
    }
  }

  /**
   * Unload plugin hooks
   */
  private unloadPluginHooks(pluginName: string): void {
    for (const [hookName, hooks] of this.hooks.entries()) {
      this.hooks.set(
        hookName,
        hooks.filter((hook) => hook.name !== pluginName),
      )
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const fileContent = await fs.readFile(filePath)
      return createHash("sha256").update(fileContent).digest("hex")
    } catch (error) {
      logger.error(`Failed to calculate checksum for ${filePath}:`, error)
      throw new ApiError(500, "Failed to calculate checksum")
    }
  }

  /**
   * Sanitize plugin name for filesystem
   */
  private sanitizePluginName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase()
  }
}

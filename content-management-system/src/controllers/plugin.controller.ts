import type { Request, Response, NextFunction } from "express"
import { PluginService } from "../services/plugin.service"
import type { PluginStatus } from "../db/models/plugin.model"

export class PluginController {
  private pluginService: PluginService

  constructor() {
    this.pluginService = new PluginService()
  }

  /**
   * Install a plugin
   */
  public installPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, source, version, config } = req.body

      const plugin = await this.pluginService.installPlugin({
        name,
        source,
        version,
        config,
      })

      res.status(201).json({
        status: "success",
        data: {
          plugin,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Uninstall a plugin
   */
  public uninstallPlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      await this.pluginService.uninstallPlugin(id)

      res.status(200).json({
        status: "success",
        message: "Plugin uninstalled successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Enable a plugin
   */
  public enablePlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const plugin = await this.pluginService.enablePlugin(id)

      res.status(200).json({
        status: "success",
        data: {
          plugin,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Disable a plugin
   */
  public disablePlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const plugin = await this.pluginService.disablePlugin(id)

      res.status(200).json({
        status: "success",
        data: {
          plugin,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update plugin
   */
  public updatePlugin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { version, config } = req.body

      const plugin = await this.pluginService.updatePlugin(id, {
        version,
        config,
      })

      res.status(200).json({
        status: "success",
        data: {
          plugin,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get plugin by ID
   */
  public getPluginById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const plugin = await this.pluginService.getPluginById(id)

      res.status(200).json({
        status: "success",
        data: {
          plugin,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * List plugins
   */
  public listPlugins = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, search, isSystem } = req.query

      const result = await this.pluginService.listPlugins({
        page: page ? Number.parseInt(page as string, 10) : undefined,
        limit: limit ? Number.parseInt(limit as string, 10) : undefined,
        status: status as PluginStatus,
        search: search as string,
        isSystem: isSystem ? isSystem === "true" : undefined,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Execute plugin hook
   */
  public executeHook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hook } = req.params
      const context = req.body

      const results = await this.pluginService.executeHook(hook, context)

      res.status(200).json({
        status: "success",
        data: {
          results,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

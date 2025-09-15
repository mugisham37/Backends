import type { Request, Response, NextFunction } from "express"
import { UserService } from "../services/user.service"
import { parsePaginationParams, parseSortParams } from "../utils/helpers"

export class UserController {
  private userService: UserService

  constructor() {
    this.userService = new UserService()
  }

  /**
   * Get all users
   */
  public getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query)
      const { field, direction } = parseSortParams(req.query, "createdAt", "desc")

      // Build filter
      const filter: any = {}
      if (req.query.search) filter.search = req.query.search as string
      if (req.query.role) filter.role = req.query.role as string
      if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true"

      // Get users
      const result = await this.userService.getAllUsers(filter, { field, direction }, { page, limit })

      res.status(200).json({
        status: "success",
        data: {
          users: result.users,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user by ID
   */
  public getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const user = await this.userService.getUserById(id)

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create user
   */
  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.createUser(req.body)

      res.status(201).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update user
   */
  public updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const user = await this.userService.updateUser(id, req.body)

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete user
   */
  public deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      await this.userService.deleteUser(id)

      res.status(200).json({
        status: "success",
        data: null,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Change password
   */
  public changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body
      const userId = (req as any).user._id

      await this.userService.changePassword(userId, currentPassword, newPassword)

      res.status(200).json({
        status: "success",
        message: "Password changed successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Activate user
   */
  public activateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const user = await this.userService.activateUser(id)

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Deactivate user
   */
  public deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const user = await this.userService.deactivateUser(id)

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Change user role
   */
  public changeRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { role } = req.body

      const user = await this.userService.changeRole(id, role)

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Search users
   */
  public searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = req.query

      if (!query || typeof query !== "string") {
        throw new Error("Search query is required")
      }

      const users = await this.userService.searchUsers(query)

      res.status(200).json({
        status: "success",
        data: {
          users,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

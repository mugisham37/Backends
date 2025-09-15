import { UserService } from "../../../services/user.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"
import { UserRole } from "../../../db/models/user.model"

const userService = new UserService()

export const userResolvers = {
  Query: {
    users: async (_: any, args: any, context: any) => {
      const { filter = {}, sort = {}, pagination = {} } = args
      const { first, after, last, before } = pagination
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can list all users)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to list users")
      }

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.search) serviceFilter.search = filter.search
      if (filter.role) serviceFilter.role = filter.role
      if (filter.isActive !== undefined) serviceFilter.isActive = filter.isActive

      // Convert GraphQL sort to service sort
      const serviceSort: any = {}
      if (sort?.field) {
        serviceSort.field = sort.field
        serviceSort.direction = sort.direction.toLowerCase()
      }

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await userService.getAllUsers(
        serviceFilter,
        serviceSort,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const users = result.users.slice(0, limit)
      const hasNextPage = result.users.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = users.map((user) => ({
        cursor: generateCursor(user._id.toString()),
        node: user,
      }))

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount: result.totalCount,
      }
    },

    user: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can view any user, others can only view themselves)
      if (user.role !== "admin" && user._id.toString() !== id) {
        throw ApiError.forbidden("You do not have permission to view this user")
      }

      return userService.getUserById(id)
    },

    me: async (_: any, args: any, context: any) => {
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      return user
    },
  },

  Mutation: {
    createUser: async (_: any, args: any, context: any) => {
      const { input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can create users)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to create users")
      }

      return userService.createUser(input)
    },

    updateUser: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can update any user, others can only update themselves)
      if (user.role !== "admin" && user._id.toString() !== id) {
        throw ApiError.forbidden("You do not have permission to update this user")
      }

      // Additional check: non-admins cannot change their own role
      if (user.role !== "admin" && user._id.toString() === id && input.role && input.role !== user.role) {
        throw ApiError.forbidden("You do not have permission to change your role")
      }

      return userService.updateUser(id, input)
    },

    deleteUser: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can delete users)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to delete users")
      }

      // Prevent deleting yourself
      if (user._id.toString() === id) {
        throw ApiError.forbidden("You cannot delete your own account")
      }

      await userService.deleteUser(id)
      return true
    },

    changePassword: async (_: any, args: any, context: any) => {
      const { currentPassword, newPassword } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      await userService.changePassword(user._id, currentPassword, newPassword)
      return true
    },
  },

  User: {
    id: (parent: any) => parent._id || parent.id,
    fullName: (parent: any) => {
      if (parent.fullName) {
        return parent.fullName
      }
      return `${parent.firstName} ${parent.lastName}`
    },
  },

  UserRole: {
    admin: UserRole.ADMIN,
    editor: UserRole.EDITOR,
    author: UserRole.AUTHOR,
    viewer: UserRole.VIEWER,
  },
}

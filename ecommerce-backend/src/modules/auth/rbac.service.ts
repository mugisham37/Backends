/**
 * Role-Based Access Control (RBAC) Service
 * Handles role and permission management, authorization checks
 */

import { eq, and, inArray } from "drizzle-orm";
import { AppError } from "../../core/errors/app-error.js";
import {
  roles,
  permissions,
  rolePermissions,
  userRoles,
  type Role,
  type Permission,
  type NewRole,
  type NewPermission,
} from "../../core/database/schema/roles.js";
import type { DrizzleDB } from "../../core/database/connection.js";

export interface UserPermissions {
  userId: string;
  roles: Role[];
  permissions: Permission[];
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export class RBACService {
  constructor(private readonly db: DrizzleDB) {}

  /**
   * Get all user permissions (from all assigned roles)
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    // Get user roles with their permissions
    const userRolesWithPermissions = await this.db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(userRoles.userId, userId), eq(roles.isActive, true)));

    // Organize data
    const userRolesList: Role[] = [];
    const userPermissionsList: Permission[] = [];
    const seenRoles = new Set<string>();
    const seenPermissions = new Set<string>();

    for (const row of userRolesWithPermissions) {
      if (!seenRoles.has(row.role.id)) {
        userRolesList.push(row.role);
        seenRoles.add(row.role.id);
      }
      if (!seenPermissions.has(row.permission.id)) {
        userPermissionsList.push(row.permission);
        seenPermissions.add(row.permission.id);
      }
    }

    return {
      userId,
      roles: userRolesList,
      permissions: userPermissionsList,
    };
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const result = await this.db
      .select({ count: permissions.id })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.isActive, true),
          eq(permissions.resource, resource),
          eq(permissions.action, action)
        )
      )
      .limit(1);

    return result.length > 0;
  }  /**
  
 * Check if user has any of the specified roles
   */
  async hasRole(userId: string, roleNames: string[]): Promise<boolean> {
    const result = await this.db
      .select({ count: roles.id })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.isActive, true),
          inArray(roles.name, roleNames)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(
    userId: string,
    roleName: string,
    assignedBy?: string
  ): Promise<void> {
    // Get role by name
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.name, roleName), eq(roles.isActive, true)))
      .limit(1);

    if (!role) {
      throw new AppError(`Role '${roleName}' not found`, 404, "ROLE_NOT_FOUND");
    }

    // Check if user already has this role
    const [existingUserRole] = await this.db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)))
      .limit(1);

    if (existingUserRole) {
      throw new AppError(
        `User already has role '${roleName}'`,
        409,
        "ROLE_ALREADY_ASSIGNED"
      );
    }

    // Assign role
    await this.db.insert(userRoles).values({
      userId,
      roleId: role.id,
      assignedBy,
    });
  }

  /**
   * Remove role from user
   */
  async removeRoleFromUser(userId: string, roleName: string): Promise<void> {
    // Get role by name
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new AppError(`Role '${roleName}' not found`, 404, "ROLE_NOT_FOUND");
    }

    // Remove role assignment
    const result = await this.db
      .delete(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, role.id)));

    if (result.rowCount === 0) {
      throw new AppError(
        `User does not have role '${roleName}'`,
        404,
        "ROLE_NOT_ASSIGNED"
      );
    }
  } 
 /**
   * Create a new role
   */
  async createRole(roleData: NewRole): Promise<Role> {
    // Check if role already exists
    const [existingRole] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, roleData.name))
      .limit(1);

    if (existingRole) {
      throw new AppError(
        `Role '${roleData.name}' already exists`,
        409,
        "ROLE_EXISTS"
      );
    }

    const [newRole] = await this.db.insert(roles).values(roleData).returning();
    return newRole;
  }

  /**
   * Create a new permission
   */
  async createPermission(permissionData: NewPermission): Promise<Permission> {
    // Check if permission already exists
    const [existingPermission] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.name, permissionData.name))
      .limit(1);

    if (existingPermission) {
      throw new AppError(
        `Permission '${permissionData.name}' already exists`,
        409,
        "PERMISSION_EXISTS"
      );
    }

    const [newPermission] = await this.db
      .insert(permissions)
      .values(permissionData)
      .returning();
    return newPermission;
  }

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(
    roleName: string,
    permissionName: string
  ): Promise<void> {
    // Get role and permission
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    const [permission] = await this.db
      .select()
      .from(permissions)
      .where(eq(permissions.name, permissionName))
      .limit(1);

    if (!role) {
      throw new AppError(`Role '${roleName}' not found`, 404, "ROLE_NOT_FOUND");
    }

    if (!permission) {
      throw new AppError(
        `Permission '${permissionName}' not found`,
        404,
        "PERMISSION_NOT_FOUND"
      );
    }

    // Check if already assigned
    const [existing] = await this.db
      .select()
      .from(rolePermissions)
      .where(
        and(
          eq(rolePermissions.roleId, role.id),
          eq(rolePermissions.permissionId, permission.id)
        )
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        `Permission '${permissionName}' already assigned to role '${roleName}'`,
        409,
        "PERMISSION_ALREADY_ASSIGNED"
      );
    }

    // Assign permission to role
    await this.db.insert(rolePermissions).values({
      roleId: role.id,
      permissionId: permission.id,
    });
  }  /
**
   * Get all roles with their permissions
   */
  async getAllRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const rolesWithPermissions = await this.db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(roles.isActive, true));

    // Group permissions by role
    const roleMap = new Map<string, RoleWithPermissions>();

    for (const row of rolesWithPermissions) {
      const roleId = row.role.id;
      
      if (!roleMap.has(roleId)) {
        roleMap.set(roleId, {
          ...row.role,
          permissions: [],
        });
      }

      if (row.permission) {
        roleMap.get(roleId)!.permissions.push(row.permission);
      }
    }

    return Array.from(roleMap.values());
  }

  /**
   * Get role by name with permissions
   */
  async getRoleWithPermissions(roleName: string): Promise<RoleWithPermissions | null> {
    const roleWithPermissions = await this.db
      .select({
        role: roles,
        permission: permissions,
      })
      .from(roles)
      .leftJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(and(eq(roles.name, roleName), eq(roles.isActive, true)));

    if (roleWithPermissions.length === 0) {
      return null;
    }

    const role = roleWithPermissions[0].role;
    const permissions = roleWithPermissions
      .filter(row => row.permission !== null)
      .map(row => row.permission!);

    return {
      ...role,
      permissions,
    };
  }

  /**
   * Delete role (only non-system roles)
   */
  async deleteRole(roleName: string): Promise<void> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, roleName))
      .limit(1);

    if (!role) {
      throw new AppError(`Role '${roleName}' not found`, 404, "ROLE_NOT_FOUND");
    }

    if (role.isSystem) {
      throw new AppError(
        `Cannot delete system role '${roleName}'`,
        400,
        "CANNOT_DELETE_SYSTEM_ROLE"
      );
    }

    // Soft delete by setting isActive to false
    await this.db
      .update(roles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(roles.id, role.id));
  }
}
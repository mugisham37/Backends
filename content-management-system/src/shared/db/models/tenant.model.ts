// Legacy types for backward compatibility - redirected to actual schema types

export type TenantUserRole = "owner" | "admin" | "member" | "viewer";

/**
 * @deprecated Use the actual tenant schema from core/database/schema instead
 * This interface is kept for backward compatibility only
 */
export interface TenantModel {
  _id: string;
  id: string;
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Export actual schema types for new code
export type { Tenant } from "../../../core/database/schema/tenant.schema";

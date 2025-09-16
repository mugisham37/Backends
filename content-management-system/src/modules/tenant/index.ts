export { TenantService } from "./tenant.service";
export { TenantController } from "./tenant.controller";
export * from "./tenant.schemas";
// Re-export types with explicit names to avoid conflicts
export type {
  CreateTenantData,
  UpdateTenantData,
  TenantSettings,
  TenantBranding,
  TenantStatus,
} from "./tenant.types";
// Re-export database types as primary types
export type {
  Tenant,
  NewTenant,
  TenantMetadata,
} from "../../core/database/schema/tenant.schema";
// Export specific types from tenant.types with different names if needed
export type { TenantUser } from "./tenant.types";

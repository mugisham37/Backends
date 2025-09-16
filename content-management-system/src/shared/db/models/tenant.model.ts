// Legacy Tenant model for backward compatibility

export type TenantUserRole = "owner" | "admin" | "member" | "viewer";

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

// Mock TenantModel class for legacy compatibility
export class TenantModel {
  static async findById(id: string): Promise<TenantModel | null> {
    console.warn("TenantModel.findById called with legacy interface:", id);
    return null;
  }

  static async findOne(query: any): Promise<TenantModel | null> {
    console.warn("TenantModel.findOne called with legacy interface:", query);
    return null;
  }

  static async findBySlug(slug: string): Promise<TenantModel | null> {
    console.warn("TenantModel.findBySlug called with legacy interface:", slug);
    return null;
  }

  static async findByDomain(domain: string): Promise<TenantModel | null> {
    console.warn(
      "TenantModel.findByDomain called with legacy interface:",
      domain
    );
    return null;
  }
}

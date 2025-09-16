export interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: TenantSettings;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantData {
  name: string;
  slug: string;
  settings?: Partial<TenantSettings>;
}

export interface UpdateTenantData {
  name?: string;
  slug?: string;
  settings?: Partial<TenantSettings>;
  status?: TenantStatus;
}

export interface TenantSettings {
  maxUsers: number;
  maxStorage: number;
  features: string[];
  customDomain?: string;
  branding?: TenantBranding;
}

export interface TenantBranding {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customCss?: string;
}

export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  INACTIVE = "inactive",
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

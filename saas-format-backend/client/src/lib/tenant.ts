import { apiGet, apiPost, apiPut, apiDelete } from "./api"

export interface Tenant {
  id: string
  name: string
  slug: string
  domain?: string
  plan: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  settings?: TenantSettings
}

export interface TenantSettings {
  id: string
  tenantId: string
  logoUrl?: string
  primaryColor?: string
  allowSignup: boolean
  maxUsers: number
  maxProjects: number
  maxStorage: number
  createdAt: string
  updatedAt: string
}

export interface CreateTenantDto {
  name: string
  slug: string
  domain?: string
  plan?: string
}

export interface UpdateTenantDto {
  name?: string
  domain?: string
  plan?: string
  isActive?: boolean
}

export interface UpdateTenantSettingsDto {
  logoUrl?: string
  primaryColor?: string
  allowSignup?: boolean
  maxUsers?: number
  maxProjects?: number
  maxStorage?: number
}

// Get current tenant
export const getCurrentTenant = async (): Promise<Tenant> => {
  return await apiGet<Tenant>("/tenants/current")
}

// Create tenant
export const createTenant = async (data: CreateTenantDto): Promise<Tenant> => {
  return await apiPost<Tenant>("/tenants", data)
}

// Update tenant
export const updateTenant = async (id: string, data: UpdateTenantDto): Promise<Tenant> => {
  return await apiPut<Tenant>(`/tenants/${id}`, data)
}

// Delete tenant
export const deleteTenant = async (id: string): Promise<void> => {
  await apiDelete(`/tenants/${id}`)
}

// Get tenant settings
export const getTenantSettings = async (id: string): Promise<TenantSettings> => {
  return await apiGet<TenantSettings>(`/tenants/${id}/settings`)
}

// Update tenant settings
export const updateTenantSettings = async (id: string, data: UpdateTenantSettingsDto): Promise<TenantSettings> => {
  return await apiPut<TenantSettings>(`/tenants/${id}/settings`, data)
}

// Lookup tenant by identifier (slug or domain)
export const lookupTenant = async (identifier: string): Promise<Tenant> => {
  return await apiGet<Tenant>(`/tenants/lookup/${identifier}`)
}

// Get all tenants (admin only)
export const getAllTenants = async (): Promise<Tenant[]> => {
  return await apiGet<Tenant[]>("/tenants")
}

// Create tenant database
export const createTenantDatabase = async (id: string, connectionString: string, type = "postgres"): Promise<any> => {
  return await apiPost(`/tenants/${id}/databases`, { connectionString, type })
}

// Get tenant databases
export const getTenantDatabases = async (id: string): Promise<any[]> => {
  return await apiGet<any[]>(`/tenants/${id}/databases`)
}

// Update tenant database
export const updateTenantDatabase = async (id: string, dbId: string, data: any): Promise<any> => {
  return await apiPut<any>(`/tenants/${id}/databases/${dbId}`, data)
}

// Delete tenant database
export const deleteTenantDatabase = async (id: string, dbId: string): Promise<void> => {
  await apiDelete(`/tenants/${id}/databases/${dbId}`)
}

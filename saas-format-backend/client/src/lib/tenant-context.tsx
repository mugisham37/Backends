"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import Cookies from "js-cookie"
import { useAppStore } from "@/lib/state/store"
import { apiGet } from "@/lib/api"

interface TenantContextType {
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  isLoading: boolean
  error: string | null
  setTenant: (id: string, name: string, slug: string) => void
  clearTenant: () => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setTenant: setStoreTenant } = useAppStore()

  const [state, setState] = useState<{
    tenantId: string | null
    tenantName: string | null
    tenantSlug: string | null
    isLoading: boolean
    error: string | null
  }>({
    tenantId: null,
    tenantName: null,
    tenantSlug: null,
    isLoading: true,
    error: null,
  })

  // Function to set tenant information
  const setTenant = (id: string, name: string, slug: string) => {
    setState((prev) => ({
      ...prev,
      tenantId: id,
      tenantName: name,
      tenantSlug: slug,
      isLoading: false,
      error: null,
    }))

    // Update global store
    setStoreTenant(id, name, slug)

    // Set cookie for API requests
    Cookies.set("tenantId", id, { secure: true, sameSite: "strict" })
  }

  // Function to clear tenant information
  const clearTenant = () => {
    setState((prev) => ({
      ...prev,
      tenantId: null,
      tenantName: null,
      tenantSlug: null,
      isLoading: false,
      error: null,
    }))

    // Update global store
    setStoreTenant(null, null, null)

    // Remove cookie
    Cookies.remove("tenantId")
  }

  // Detect tenant from URL or cookie on initial load
  useEffect(() => {
    const detectTenant = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))

        // First check if we have a tenant ID in cookies
        const cookieTenantId = Cookies.get("tenantId")

        if (cookieTenantId) {
          // Fetch tenant details from API
          try {
            const tenant = await apiGet(`/tenants/${cookieTenantId}`)
            setTenant(tenant.id, tenant.name, tenant.slug)
            return
          } catch (error) {
            console.error("Error fetching tenant from cookie ID:", error)
            // If tenant fetch fails, continue with URL detection
          }
        }

        // Check if we're on a tenant-specific path
        // Example: /t/tenant-slug/dashboard
        const pathParts = pathname?.split("/") || []
        if (pathParts.length >= 3 && pathParts[1] === "t") {
          const slugFromUrl = pathParts[2]

          if (slugFromUrl) {
            try {
              // Fetch tenant by slug
              const tenant = await apiGet(`/tenants/by-slug/${slugFromUrl}`)
              setTenant(tenant.id, tenant.name, tenant.slug)
              return
            } catch (error) {
              console.error("Error fetching tenant from slug:", error)
              setState((prev) => ({
                ...prev,
                isLoading: false,
                error: "Tenant not found",
              }))

              // Redirect to tenant selection if tenant not found
              router.push("/select-tenant")
              return
            }
          }
        }

        // Check if we're on a tenant subdomain
        // Example: tenant-slug.saas-platform.com
        if (typeof window !== "undefined") {
          const hostname = window.location.hostname
          const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1"

          if (!isLocalhost) {
            const hostParts = hostname.split(".")

            // If we have a subdomain (e.g., tenant.saas-platform.com)
            if (hostParts.length > 2) {
              const subdomain = hostParts[0]

              try {
                // Fetch tenant by subdomain
                const tenant = await apiGet(`/tenants/by-subdomain/${subdomain}`)
                setTenant(tenant.id, tenant.name, tenant.slug)
                return
              } catch (error) {
                console.error("Error fetching tenant from subdomain:", error)
                setState((prev) => ({
                  ...prev,
                  isLoading: false,
                  error: "Tenant not found",
                }))

                // Redirect to main domain if tenant not found
                window.location.href = `https://${hostParts.slice(1).join(".")}`
                return
              }
            }
          }
        }

        // If we reach here, no tenant was detected
        setState((prev) => ({
          ...prev,
          isLoading: false,
          tenantId: null,
          tenantName: null,
          tenantSlug: null,
        }))

        // If we're on a page that requires a tenant, redirect to tenant selection
        if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/app")) {
          router.push("/select-tenant")
        }
      } catch (error) {
        console.error("Error in tenant detection:", error)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to detect tenant",
        }))
      }
    }

    detectTenant()
  }, [pathname])

  const value = {
    ...state,
    setTenant,
    clearTenant,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenantContext() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error("useTenantContext must be used within a TenantProvider")
  }
  return context
}

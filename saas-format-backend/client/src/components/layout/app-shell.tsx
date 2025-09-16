"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { useAppStore } from "@/lib/state/store"
import { useTenantContext } from "@/lib/tenant-context"
import { useCurrentUser } from "@/lib/state/api-hooks"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useAppStore((state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    toggleSidebar: state.toggleSidebar,
  }))

  const { tenantId, tenantName, isLoading: tenantLoading, error: tenantError } = useTenantContext()
  const { data: user, isLoading: userLoading, error: userError } = useCurrentUser()

  const [mounted, setMounted] = useState(false)

  // Set mounted state to true after component mounts
  useEffect(() => {
    setMounted(true)
  }, [])

  // Determine if the current route is a dashboard route
  const isDashboardRoute = pathname?.startsWith("/dashboard")

  // Show loading state
  if (!mounted || userLoading || tenantLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="h-16 border-b px-4 flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="flex flex-1">
          <div className="hidden md:block w-64 border-r p-4">
            <Skeleton className="h-8 w-32 mb-6" />
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="h-8 w-64 mb-6" />
            <div className="grid gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (tenantError || userError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {tenantError || userError?.message || "An error occurred. Please try again."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // For non-dashboard routes, only render the children
  if (!isDashboardRoute) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user} tenantName={tenantName} sidebarCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar collapsed={sidebarCollapsed} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Footer />
    </div>
  )
}

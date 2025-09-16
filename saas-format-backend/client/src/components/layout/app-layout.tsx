"use client"
import type { ReactNode } from "react"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "react-hot-toast"
import { AppHeader } from "./app-header"
import { SidebarNav } from "./sidebar-nav"
import { isAuthenticated } from "@/lib/auth"
import { useRouter } from "next/navigation"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Check authentication on mount and route change
  useEffect(() => {
    if (!isAuthenticated() && !pathname.startsWith("/auth/")) {
      router.push("/auth/login")
    }
  }, [pathname, router])

  // Close sidebar on mobile when route changes
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [pathname])

  // Skip rendering if on auth pages
  if (pathname.startsWith("/auth/")) {
    return (
      <>
        {children}
        <Toaster position="top-right" />
      </>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <AppHeader onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">{children}</main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}

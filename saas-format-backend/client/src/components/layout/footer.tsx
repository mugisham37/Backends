"use client"

import Link from "next/link"
import { useAppStore } from "@/lib/state/store"

export function Footer() {
  const { sidebarCollapsed } = useAppStore()

  return (
    <footer className="border-t py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 px-4">
        <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-muted-foreground">
          <span>© 2025 SaaS Platform. All rights reserved.</span>
          <div className="hidden md:flex">
            <span className="mx-2">•</span>
            <Link href="/legal/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <span className="mx-2">•</span>
            <Link href="/legal/terms" className="hover:underline">
              Terms of Service
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/help" className="text-sm text-muted-foreground hover:underline">
            Help Center
          </Link>
          <Link href="/dashboard/status" className="text-sm text-muted-foreground hover:underline">
            System Status
          </Link>
        </div>
      </div>
    </footer>
  )
}

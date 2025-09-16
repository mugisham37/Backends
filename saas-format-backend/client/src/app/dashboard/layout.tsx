import type React from "react"
import { AppShell } from "@/components/layout/app-shell"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "SaaS Platform Dashboard",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppShell>{children}</AppShell>
}

"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import {
  Home,
  LayoutDashboard,
  Users,
  Settings,
  FileText,
  CheckSquare,
  CreditCard,
  Flag,
  BarChart,
  Menu,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { hasRole } from "@/lib/auth"

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
  roles?: string[]
}

export function SidebarNav() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Projects",
      href: "/projects",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: "Tasks",
      href: "/tasks",
      icon: <CheckSquare className="h-5 w-5" />,
    },
    {
      title: "Users",
      href: "/users",
      icon: <Users className="h-5 w-5" />,
      roles: ["admin", "owner"],
    },
    {
      title: "Billing",
      href: "/billing",
      icon: <CreditCard className="h-5 w-5" />,
      roles: ["admin", "owner"],
    },
    {
      title: "Feature Flags",
      href: "/feature-flags",
      icon: <Flag className="h-5 w-5" />,
      roles: ["admin", "owner"],
    },
    {
      title: "Analytics",
      href: "/analytics",
      icon: <BarChart className="h-5 w-5" />,
      roles: ["admin", "owner"],
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ]

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <Link href="/" className="flex items-center space-x-2">
              <Home className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-xl">SaaS Platform</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                // Skip items that require specific roles
                if (item.roles && !hasRole(item.roles)) {
                  return null
                }

                const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                        isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      {item.icon}
                      <span>{item.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="text-xs text-gray-500">
              <p>© {new Date().getFullYear()} SaaS Platform</p>
              <p>Version 1.0.0</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

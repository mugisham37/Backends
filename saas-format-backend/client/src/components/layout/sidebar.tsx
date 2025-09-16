"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FeatureFlag } from "@/lib/feature-flags"
import { BarChart3, CreditCard, Flag, LayoutDashboard, LifeBuoy, Package, Settings, Users } from "lucide-react"

interface SidebarProps {
  collapsed: boolean
}

interface SidebarItem {
  title: string
  href: string
  icon: React.ReactNode
  featureFlag?: string
  submenu?: SidebarItem[]
}

export function Sidebar({ collapsed }: SidebarProps) {
  const pathname = usePathname()
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)

  // Define sidebar items
  const sidebarItems: SidebarItem[] = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Projects",
      href: "/dashboard/projects",
      icon: <Package className="h-5 w-5" />,
      submenu: [
        {
          title: "All Projects",
          href: "/dashboard/projects",
          icon: <Package className="h-4 w-4" />,
        },
        {
          title: "Create New",
          href: "/dashboard/projects/create",
          icon: <Package className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Team",
      href: "/dashboard/team",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Analytics",
      href: "/dashboard/analytics",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      title: "Feature Flags",
      href: "/dashboard/feature-flags",
      icon: <Flag className="h-5 w-5" />,
      featureFlag: "feature_flags_enabled",
    },
    {
      title: "Billing",
      href: "/dashboard/billing",
      icon: <CreditCard className="h-5 w-5" />,
    },
    {
      title: "Settings",
      href: "/dashboard/settings",
      icon: <Settings className="h-5 w-5" />,
      submenu: [
        {
          title: "General",
          href: "/dashboard/settings",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          title: "Security",
          href: "/dashboard/settings/security",
          icon: <Settings className="h-4 w-4" />,
        },
        {
          title: "Notifications",
          href: "/dashboard/settings/notifications",
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
    {
      title: "Help",
      href: "/dashboard/help",
      icon: <LifeBuoy className="h-5 w-5" />,
    },
  ]

  // Close submenu when pathname changes
  useEffect(() => {
    setOpenSubmenu(null)
  }, [pathname])

  // Toggle submenu
  const toggleSubmenu = (title: string) => {
    setOpenSubmenu(openSubmenu === title ? null : title)
  }

  // Check if a menu item is active
  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") {
      return true
    }
    return pathname !== "/dashboard" && pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "border-r bg-background h-[calc(100vh-4rem)] overflow-hidden transition-all duration-300",
        collapsed ? "w-[70px]" : "w-64",
      )}
    >
      <ScrollArea className="h-full py-4">
        <nav className="flex flex-col gap-1 px-2">
          <TooltipProvider delayDuration={0}>
            {sidebarItems.map((item) => (
              <div key={item.title}>
                {item.featureFlag ? (
                  <FeatureFlag flag={item.featureFlag}>
                    <SidebarNavItem
                      item={item}
                      collapsed={collapsed}
                      isActive={isActive(item.href)}
                      hasSubmenu={!!item.submenu}
                      isSubmenuOpen={openSubmenu === item.title}
                      toggleSubmenu={() => toggleSubmenu(item.title)}
                    />
                  </FeatureFlag>
                ) : (
                  <SidebarNavItem
                    item={item}
                    collapsed={collapsed}
                    isActive={isActive(item.href)}
                    hasSubmenu={!!item.submenu}
                    isSubmenuOpen={openSubmenu === item.title}
                    toggleSubmenu={() => toggleSubmenu(item.title)}
                  />
                )}

                {/* Render submenu if open */}
                {!collapsed && item.submenu && openSubmenu === item.title && (
                  <div className="ml-4 mt-1 space-y-1 border-l pl-2">
                    {item.submenu.map((subitem) => (
                      <Button
                        key={subitem.title}
                        variant={isActive(subitem.href) ? "secondary" : "ghost"}
                        size="sm"
                        className={cn("w-full justify-start", isActive(subitem.href) ? "font-medium" : "font-normal")}
                        asChild
                      >
                        <Link href={subitem.href}>
                          {subitem.icon && <span className="mr-2">{subitem.icon}</span>}
                          {subitem.title}
                        </Link>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </TooltipProvider>
        </nav>

        <Separator className="my-4" />

        <div className="px-4">
          <p
            className={cn(
              "text-xs text-muted-foreground mb-2 transition-opacity",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          >
            © 2025 SaaS Platform
          </p>
          <div
            className={cn("text-xs text-muted-foreground transition-opacity", collapsed ? "opacity-0" : "opacity-100")}
          >
            <p>Version 1.0.0</p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

interface SidebarNavItemProps {
  item: SidebarItem
  collapsed: boolean
  isActive: boolean
  hasSubmenu: boolean
  isSubmenuOpen: boolean
  toggleSubmenu: () => void
}

function SidebarNavItem({ item, collapsed, isActive, hasSubmenu, isSubmenuOpen, toggleSubmenu }: SidebarNavItemProps) {
  const buttonContent = (
    <>
      {item.icon && <span className="mr-2">{item.icon}</span>}
      {!collapsed && <span>{item.title}</span>}
      {!collapsed && hasSubmenu && (
        <span className="ml-auto">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-4 w-4 transition-transform", isSubmenuOpen ? "rotate-180" : "rotate-0")}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      )}
    </>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={isActive ? "secondary" : "ghost"}
            size="icon"
            className="w-full h-10 justify-start"
            onClick={hasSubmenu ? toggleSubmenu : undefined}
            asChild={!hasSubmenu}
          >
            {hasSubmenu ? <div>{item.icon}</div> : <Link href={item.href}>{item.icon}</Link>}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-4">
          {item.title}
        </TooltipContent>
      </Tooltip>
    )
  }

  if (hasSubmenu) {
    return (
      <Button
        variant={isActive ? "secondary" : "ghost"}
        size="sm"
        className="w-full justify-start"
        onClick={toggleSubmenu}
      >
        {buttonContent}
      </Button>
    )
  }

  return (
    <Button variant={isActive ? "secondary" : "ghost"} size="sm" className="w-full justify-start" asChild>
      <Link href={item.href}>{buttonContent}</Link>
    </Button>
  )
}

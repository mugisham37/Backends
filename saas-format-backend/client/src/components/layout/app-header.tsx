"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Bell, User, LogOut, Settings, ChevronDown } from "lucide-react"
import { logout, getCurrentUser } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export function AppHeader() {
  const router = useRouter()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const user = getCurrentUser()

  const handleLogout = async () => {
    await logout()
    router.push("/auth/login")
  }

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen)
    if (isNotificationsOpen) setIsNotificationsOpen(false)
  }

  const toggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen)
    if (isUserMenuOpen) setIsUserMenuOpen(false)
  }

  return (
    <header className="bg-white border-b sticky top-0 z-30">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center lg:hidden">
          {/* Mobile logo - shown when sidebar is hidden */}
          <Link href="/dashboard" className="font-bold text-lg">
            SaaS Platform
          </Link>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNotifications}
              aria-label="Notifications"
              className="relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>

            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg overflow-hidden z-50 border">
                <div className="p-3 border-b">
                  <h3 className="font-medium">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="p-4 border-b hover:bg-gray-50">
                    <p className="text-sm font-medium">New task assigned</p>
                    <p className="text-xs text-gray-500">2 minutes ago</p>
                  </div>
                  <div className="p-4 border-b hover:bg-gray-50">
                    <p className="text-sm font-medium">Project status updated</p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                  </div>
                  <div className="p-4 hover:bg-gray-50">
                    <p className="text-sm font-medium">Comment on your task</p>
                    <p className="text-xs text-gray-500">Yesterday</p>
                  </div>
                </div>
                <div className="p-2 border-t text-center">
                  <Link href="/notifications" className="text-sm text-blue-600 hover:text-blue-800">
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <Button
              variant="ghost"
              onClick={toggleUserMenu}
              className="flex items-center space-x-2 hover:bg-gray-100 rounded-md"
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl || "/placeholder.svg"}
                    alt={user.firstName}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <User className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <span className="hidden md:inline-block">{user?.firstName || "User"}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg overflow-hidden z-50 border">
                <div className="p-3 border-b">
                  <p className="font-medium">{`${user?.firstName || ""} ${user?.lastName || ""}`}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
                <div>
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 hover:bg-gray-100 space-x-2"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                  <Link
                    href="/settings"
                    className="flex items-center px-4 py-2 hover:bg-gray-100 space-x-2"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center px-4 py-2 hover:bg-gray-100 space-x-2 w-full text-left text-red-600"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

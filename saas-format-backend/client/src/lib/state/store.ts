import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createJSONStorage } from "zustand/middleware"
import type { User, UserPreferences } from "@/lib/auth"

// Define the store state interface
interface AppState {
  // User and authentication state
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Tenant state
  tenantId: string | null
  tenantName: string | null
  tenantSlug: string | null
  tenantTheme: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logoUrl: string | null
    darkMode: boolean
  }

  // UI state
  sidebarCollapsed: boolean
  currentView: string
  notifications: Notification[]
  unreadNotificationsCount: number

  // User preferences
  preferences: UserPreferences

  // Actions
  setUser: (user: User | null) => void
  setAuthenticated: (isAuthenticated: boolean) => void
  setLoading: (isLoading: boolean) => void
  setTenant: (tenantId: string | null, tenantName: string | null, tenantSlug: string | null) => void
  setTenantTheme: (theme: Partial<AppState["tenantTheme"]>) => void
  toggleSidebar: () => void
  setCurrentView: (view: string) => void
  addNotification: (notification: Notification) => void
  markNotificationAsRead: (id: string) => void
  clearNotifications: () => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  resetState: () => void
}

// Define notification interface
interface Notification {
  id: string
  title: string
  message: string
  type: "info" | "success" | "warning" | "error"
  read: boolean
  createdAt: string
  link?: string
}

// Initial state
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tenantId: null,
  tenantName: null,
  tenantSlug: null,
  tenantTheme: {
    primaryColor: "#0ea5e9", // Default brand color
    secondaryColor: "#64748b",
    accentColor: "#f59e0b",
    logoUrl: null,
    darkMode: false,
  },
  sidebarCollapsed: false,
  currentView: "dashboard",
  notifications: [],
  unreadNotificationsCount: 0,
  preferences: {
    theme: "system",
    language: "en",
    emailNotifications: true,
    pushNotifications: true,
    timezone: "UTC",
  },
}

// Create the store with persistence
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // User actions
      setUser: (user) => set({ user }),

      setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

      setLoading: (isLoading) => set({ isLoading }),

      // Tenant actions
      setTenant: (tenantId, tenantName, tenantSlug) => set({ tenantId, tenantName, tenantSlug }),

      setTenantTheme: (theme) =>
        set((state) => ({
          tenantTheme: { ...state.tenantTheme, ...theme },
        })),

      // UI actions
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setCurrentView: (view) => set({ currentView: view }),

      // Notification actions
      addNotification: (notification) =>
        set((state) => {
          const notifications = [notification, ...state.notifications].slice(0, 100) // Limit to 100 notifications
          const unreadNotificationsCount = notifications.filter((n) => !n.read).length
          return { notifications, unreadNotificationsCount }
        }),

      markNotificationAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
          const unreadNotificationsCount = notifications.filter((n) => !n.read).length
          return { notifications, unreadNotificationsCount }
        }),

      clearNotifications: () => set({ notifications: [], unreadNotificationsCount: 0 }),

      // Preferences actions
      updatePreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      // Reset state (for logout)
      resetState: () =>
        set({
          ...initialState,
          preferences: get().preferences, // Preserve preferences on logout
        }),
    }),
    {
      name: "saas-platform-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        sidebarCollapsed: state.sidebarCollapsed,
        preferences: state.preferences,
        tenantTheme: state.tenantTheme,
      }),
    },
  ),
)

// Selector hooks for better performance
export const useUser = () => useAppStore((state) => state.user)
export const useAuthentication = () =>
  useAppStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
  }))
export const useTenant = () =>
  useAppStore((state) => ({
    tenantId: state.tenantId,
    tenantName: state.tenantName,
    tenantSlug: state.tenantSlug,
  }))
export const useTenantTheme = () => useAppStore((state) => state.tenantTheme)
export const useUIState = () =>
  useAppStore((state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    currentView: state.currentView,
  }))
export const useNotifications = () =>
  useAppStore((state) => ({
    notifications: state.notifications,
    unreadNotificationsCount: state.unreadNotificationsCount,
  }))
export const usePreferences = () => useAppStore((state) => state.preferences)

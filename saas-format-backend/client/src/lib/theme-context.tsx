"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { useAppStore } from "@/lib/state/store"
import { useTenantContext } from "@/lib/tenant-context"
import { apiGet } from "@/lib/api"

interface ThemeContextType {
  theme: {
    primaryColor: string
    secondaryColor: string
    accentColor: string
    logoUrl: string | null
    darkMode: boolean
  }
  setTheme: (theme: Partial<ThemeContextType["theme"]>) => void
  toggleDarkMode: () => void
  applyThemeToDocument: () => void
}

const defaultTheme = {
  primaryColor: "#0ea5e9", // Default brand color
  secondaryColor: "#64748b",
  accentColor: "#f59e0b",
  logoUrl: null,
  darkMode: false,
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tenantId } = useTenantContext()
  const { tenantTheme, setTenantTheme } = useAppStore()
  const [theme, setThemeState] = useState(tenantTheme || defaultTheme)

  // Fetch tenant theme when tenant changes
  useEffect(() => {
    const fetchTenantTheme = async () => {
      if (!tenantId) {
        setThemeState(defaultTheme)
        return
      }

      try {
        const tenantData = await apiGet(`/tenants/${tenantId}/theme`)

        if (tenantData && tenantData.theme) {
          const newTheme = {
            primaryColor: tenantData.theme.primaryColor || defaultTheme.primaryColor,
            secondaryColor: tenantData.theme.secondaryColor || defaultTheme.secondaryColor,
            accentColor: tenantData.theme.accentColor || defaultTheme.accentColor,
            logoUrl: tenantData.theme.logoUrl || defaultTheme.logoUrl,
            darkMode: theme.darkMode, // Preserve user's dark mode preference
          }

          setThemeState(newTheme)
          setTenantTheme(newTheme)
        }
      } catch (error) {
        console.error("Error fetching tenant theme:", error)
      }
    }

    fetchTenantTheme()
  }, [tenantId])

  // Update theme state and store
  const setTheme = (newTheme: Partial<ThemeContextType["theme"]>) => {
    setThemeState((prev) => {
      const updatedTheme = { ...prev, ...newTheme }
      setTenantTheme(updatedTheme)
      return updatedTheme
    })
  }

  // Toggle dark mode
  const toggleDarkMode = () => {
    setTheme({ darkMode: !theme.darkMode })
  }

  // Apply theme to document
  const applyThemeToDocument = () => {
    if (typeof document === "undefined") return

    // Apply CSS variables
    document.documentElement.style.setProperty("--color-primary", theme.primaryColor)
    document.documentElement.style.setProperty("--color-secondary", theme.secondaryColor)
    document.documentElement.style.setProperty("--color-accent", theme.accentColor)

    // Apply dark mode
    if (theme.darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }

  // Apply theme when it changes
  useEffect(() => {
    applyThemeToDocument()
  }, [theme])

  const value = {
    theme,
    setTheme,
    toggleDarkMode,
    applyThemeToDocument,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeContext() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useThemeContext must be used within a ThemeProvider")
  }
  return context
}

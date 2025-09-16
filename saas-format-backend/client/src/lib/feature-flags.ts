"use client"

import type React from "react"

import { useApiQuery } from "@/lib/state/api-hooks"
import { useTenantContext } from "@/lib/tenant-context"
import { useUser } from "@/lib/state/store"

// Feature flag types
export interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string
  enabled: boolean
  tenantId?: string
  rules?: FeatureFlagRule[]
  createdAt: string
  updatedAt: string
}

export interface FeatureFlagRule {
  id: string
  featureFlagId: string
  type: "user" | "tenant" | "percentage" | "date" | "custom"
  value: string
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than"
  createdAt: string
  updatedAt: string
}

// Hook to fetch all feature flags
export function useFeatureFlags() {
  const { tenantId } = useTenantContext()

  return useApiQuery<FeatureFlag[]>(
    ["featureFlags", tenantId || "global"],
    tenantId ? `/feature-flags?tenantId=${tenantId}` : "/feature-flags",
    {
      enabled: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  )
}

// Hook to check if a specific feature flag is enabled
export function useFeatureFlag(key: string) {
  const { tenantId } = useTenantContext()
  const user = useUser()

  const { data: featureFlags, isLoading, error } = useFeatureFlags()

  // Find the feature flag by key
  const featureFlag = featureFlags?.find((flag) => flag.key === key)

  // Evaluate if the feature flag is enabled
  const isEnabled = evaluateFeatureFlag(featureFlag, user, tenantId)

  return {
    isEnabled,
    isLoading,
    error,
    featureFlag,
  }
}

// Function to evaluate if a feature flag is enabled based on rules
function evaluateFeatureFlag(featureFlag: FeatureFlag | undefined, user: any | null, tenantId: string | null): boolean {
  // If feature flag doesn't exist or is explicitly disabled, return false
  if (!featureFlag || !featureFlag.enabled) {
    return false
  }

  // If there are no rules, the flag is enabled for everyone
  if (!featureFlag.rules || featureFlag.rules.length === 0) {
    return true
  }

  // Check each rule
  for (const rule of featureFlag.rules) {
    switch (rule.type) {
      case "user":
        if (!user) continue

        if (rule.operator === "equals" && user.id === rule.value) {
          return true
        }
        if (rule.operator === "not_equals" && user.id !== rule.value) {
          return true
        }
        if (rule.operator === "contains" && rule.value.split(",").includes(user.id)) {
          return true
        }
        break

      case "tenant":
        if (!tenantId) continue

        if (rule.operator === "equals" && tenantId === rule.value) {
          return true
        }
        if (rule.operator === "not_equals" && tenantId !== rule.value) {
          return true
        }
        if (rule.operator === "contains" && rule.value.split(",").includes(tenantId)) {
          return true
        }
        break

      case "percentage":
        const percentage = Number.parseInt(rule.value, 10)
        if (isNaN(percentage)) continue

        // Generate a deterministic hash based on user ID or tenant ID
        const id = user?.id || tenantId || "anonymous"
        const hash = hashString(id + featureFlag.key) % 100

        if (hash < percentage) {
          return true
        }
        break

      case "date":
        const now = new Date()
        const date = new Date(rule.value)

        if (rule.operator === "greater_than" && now > date) {
          return true
        }
        if (rule.operator === "less_than" && now < date) {
          return true
        }
        break

      case "custom":
        // Custom rules would be implemented based on specific business logic
        break
    }
  }

  // If no rules matched, the flag is disabled
  return false
}

// Simple hash function for deterministic percentage rollouts
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

// Component to conditionally render based on feature flag
export function FeatureFlag({
  flag,
  children,
  fallback = null,
}: {
  flag: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { isEnabled, isLoading } = useFeatureFlag(flag)

  if (isLoading) {
    // You could return a loading state or null
    return null
  }

  return isEnabled ? <>{children}</> : <>{fallback}</>
}

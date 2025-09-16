"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getFeatureFlags, toggleFeatureFlag } from "@/lib/feature-flags"
import { toast } from "react-hot-toast"
import { Plus, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { FeatureFlagItem } from "./feature-flag-item"
import Link from "next/link"
import type { FeatureFlag } from "@/lib/feature-flags"

export function FeatureFlagList() {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchFeatureFlags = async () => {
      try {
        const data = await getFeatureFlags()
        setFeatureFlags(data)
      } catch (error) {
        toast.error("Failed to load feature flags")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeatureFlags()
  }, [])

  // Filter feature flags based on search term
  const filteredFeatureFlags = featureFlags.filter((flag) => {
    return (
      flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (flag.description && flag.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
  })

  const handleToggle = async (id: string) => {
    try {
      const updatedFlag = await toggleFeatureFlag(id)
      setFeatureFlags(featureFlags.map((flag) => (flag.id === id ? updatedFlag : flag)))
      toast.success(`Feature flag ${updatedFlag.isEnabled ? "enabled" : "disabled"}`)
    } catch (error) {
      toast.error("Failed to toggle feature flag")
      console.error(error)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <CardTitle>Feature Flags</CardTitle>
        <Link href="/feature-flags/new" passHref>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Feature Flag
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search feature flags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filteredFeatureFlags.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900">No feature flags found</h3>
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm
                ? "Try adjusting your search to find what you're looking for."
                : "Get started by creating a new feature flag."}
            </p>
            {!searchTerm && (
              <div className="mt-6">
                <Link href="/feature-flags/new" passHref>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    New Feature Flag
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFeatureFlags.map((flag) => (
              <FeatureFlagItem key={flag.id} featureFlag={flag} onToggle={() => handleToggle(flag.id)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

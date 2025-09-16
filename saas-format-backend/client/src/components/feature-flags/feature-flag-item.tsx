"use client"

import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { Flag, ChevronRight } from "lucide-react"
import Link from "next/link"
import type { FeatureFlag } from "@/lib/feature-flags"

interface FeatureFlagItemProps {
  featureFlag: FeatureFlag
  onToggle: () => void
}

export function FeatureFlagItem({ featureFlag, onToggle }: FeatureFlagItemProps) {
  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  // Get type badge color
  const getTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "boolean":
        return "bg-blue-100 text-blue-800"
      case "string":
        return "bg-green-100 text-green-800"
      case "number":
        return "bg-purple-100 text-purple-800"
      case "json":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Link href={`/feature-flags/${featureFlag.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full ${featureFlag.isEnabled ? "bg-green-100" : "bg-gray-100"}`}>
                <Flag className={`h-5 w-5 ${featureFlag.isEnabled ? "text-green-600" : "text-gray-500"}`} />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">{featureFlag.name}</h3>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <code className="bg-gray-100 px-1 py-0.5 rounded">{featureFlag.key}</code>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded-full ${getTypeBadgeColor(featureFlag.type)}`}>
                    {featureFlag.type}
                  </span>
                  <span>•</span>
                  <span>Updated {formatDate(featureFlag.updatedAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Switch
                checked={featureFlag.isEnabled}
                onCheckedChange={(e) => {
                  e.stopPropagation()
                  onToggle()
                }}
                onClick={(e) => e.stopPropagation()}
              />
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          {featureFlag.description && <p className="mt-2 text-sm text-gray-600 ml-10">{featureFlag.description}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

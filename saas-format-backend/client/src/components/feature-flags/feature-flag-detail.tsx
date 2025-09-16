"use client"

import { useState } from "react"
import { useRouter } from "next/router"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { deleteFeatureFlag, toggleFeatureFlag } from "@/lib/feature-flags"
import { toast } from "react-hot-toast"
import { Edit, Trash2, AlertCircle, Settings, Users, Code } from "lucide-react"
import Link from "next/link"
import type { FeatureFlag } from "@/lib/feature-flags"

interface FeatureFlagDetailProps {
  featureFlag: FeatureFlag
  isLoading?: boolean
}

export function FeatureFlagDetail({ featureFlag, isLoading = false }: FeatureFlagDetailProps) {
  const router = useRouter()
  const [flag, setFlag] = useState<FeatureFlag>(featureFlag)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Format date to readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const handleToggle = async () => {
    setIsToggling(true)
    try {
      const updatedFlag = await toggleFeatureFlag(flag.id)
      setFlag(updatedFlag)
      toast.success(`Feature flag ${updatedFlag.isEnabled ? "enabled" : "disabled"}`)
    } catch (error) {
      toast.error("Failed to toggle feature flag")
      console.error(error)
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteFeatureFlag(flag.id)
      toast.success("Feature flag deleted successfully")
      router.push("/feature-flags")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
        <div className="h-32 bg-gray-200 rounded animate-pulse mt-6"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{flag.name}</h1>
            <div className="flex items-center space-x-2">
              <Switch checked={flag.isEnabled} onCheckedChange={handleToggle} disabled={isToggling} />
              <span className={`text-sm ${flag.isEnabled ? "text-green-600" : "text-gray-500"}`}>
                {flag.isEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 mt-1">
            <code className="bg-gray-100 px-2 py-1 rounded text-sm">{flag.key}</code>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-500">Updated {formatDate(flag.updatedAt)}</span>
          </div>
        </div>
        <div className="flex space-x-2">
          <Link href={`/feature-flags/${flag.id}/edit`} passHref>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-800">Delete Feature Flag</h3>
                <p className="mt-1 text-sm text-red-700">
                  Are you sure you want to delete this feature flag? This action cannot be undone and may affect your
                  application's behavior.
                </p>
                <div className="mt-4 flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isDeleting ? "Deleting..." : "Delete Feature Flag"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">{flag.description || "No description provided."}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Type</h4>
              <p className="mt-1 font-medium">{flag.type}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Default Value</h4>
              <p className="mt-1 font-medium">{flag.defaultValue}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Created At</h4>
              <p className="mt-1">{formatDate(flag.createdAt)}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Updated At</h4>
              <p className="mt-1">{formatDate(flag.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          <Tabs defaultValue="rules">
            <TabsList className="mb-4">
              <TabsTrigger value="rules" className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Rules
              </TabsTrigger>
              <TabsTrigger value="segments" className="flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Segments
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center">
                <Code className="h-4 w-4 mr-2" />
                Implementation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500 py-8">
                    {Object.keys(flag.rules || {}).length === 0
                      ? "No rules configured for this feature flag."
                      : "Rules configuration coming soon."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="segments">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500 py-8">Segment targeting coming soon.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="code">
              <Card>
                <CardHeader>
                  <CardTitle>Implementation Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium mb-2">React Example</h3>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      {`import { useFeatureFlag } from '@/lib/feature-flags';

function MyComponent() {
  const isFeatureEnabled = useFeatureFlag('${flag.key}', ${flag.defaultValue});
  
  return (
    <div>
      {isFeatureEnabled ? (
        <p>New feature is enabled!</p>
      ) : (
        <p>New feature is disabled.</p>
      )}
    </div>
  );
}`}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">API Example</h3>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      {`// Evaluate a specific feature flag
const response = await fetch('/api/features/evaluation/${flag.key}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: 'user-123',
    tenantId: 'tenant-456',
    attributes: {
      // Additional context for evaluation
      country: 'US',
      userRole: 'admin'
    }
  })
});

const result = await response.json();
// result will contain the evaluated value of the feature flag`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

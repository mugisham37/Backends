"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/router"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createFeatureFlag, updateFeatureFlag } from "@/lib/feature-flags"
import { toast } from "react-hot-toast"
import type { FeatureFlag, CreateFeatureFlagDto, UpdateFeatureFlagDto } from "@/lib/feature-flags"

interface FeatureFlagFormProps {
  featureFlag?: FeatureFlag
  isEdit?: boolean
}

export function FeatureFlagForm({ featureFlag, isEdit = false }: FeatureFlagFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<CreateFeatureFlagDto | UpdateFeatureFlagDto>({
    key: featureFlag?.key || "",
    name: featureFlag?.name || "",
    description: featureFlag?.description || "",
    isEnabled: featureFlag?.isEnabled || false,
    type: featureFlag?.type || "boolean",
    defaultValue: featureFlag?.defaultValue || "false",
    rules: featureFlag?.rules || {},
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, isEnabled: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isEdit && featureFlag) {
        await updateFeatureFlag(featureFlag.id, formData as UpdateFeatureFlagDto)
        toast.success("Feature flag updated successfully")
      } else {
        await createFeatureFlag(formData as CreateFeatureFlagDto)
        toast.success("Feature flag created successfully")
      }
      router.push("/feature-flags")
    } catch (error: any) {
      toast.error(error.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Feature Flag" : "Create New Feature Flag"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-red-500">*</span>
            </label>
            <Input id="name" name="name" value={formData.name} onChange={handleChange} required disabled={isLoading} />
          </div>

          <div className="space-y-2">
            <label htmlFor="key" className="text-sm font-medium">
              Key <span className="text-red-500">*</span>
            </label>
            <Input
              id="key"
              name="key"
              value={formData.key}
              onChange={handleChange}
              required
              disabled={isLoading || isEdit}
              placeholder="feature_key"
            />
            <p className="text-xs text-gray-500">Unique identifier for the feature flag. Use snake_case format.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="type" className="text-sm font-medium">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full h-10 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading || isEdit}
              required
            >
              <option value="boolean">Boolean</option>
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="json">JSON</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="defaultValue" className="text-sm font-medium">
              Default Value <span className="text-red-500">*</span>
            </label>
            <Input
              id="defaultValue"
              name="defaultValue"
              value={formData.defaultValue}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder={formData.type === "boolean" ? "true/false" : "Default value"}
            />
            <p className="text-xs text-gray-500">
              The default value when no rules match. For boolean, use "true" or "false".
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isEnabled"
              checked={formData.isEnabled as boolean}
              onCheckedChange={handleSwitchChange}
              disabled={isLoading}
            />
            <label htmlFor="isEnabled" className="text-sm font-medium">
              Enabled
            </label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading
              ? isEdit
                ? "Updating..."
                : "Creating..."
              : isEdit
                ? "Update Feature Flag"
                : "Create Feature Flag"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

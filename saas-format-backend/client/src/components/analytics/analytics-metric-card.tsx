import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnalyticsMetricCardProps {
  title: string
  value: number | string
  description?: string
  trend?: number
  trendLabel?: string
  icon?: React.ReactNode
  formatter?: (value: number | string) => string
}

export default function AnalyticsMetricCard({
  title,
  value,
  description,
  trend,
  trendLabel,
  icon,
  formatter = (val) => (typeof val === "number" ? val.toLocaleString() : val),
}: AnalyticsMetricCardProps) {
  const formattedValue = formatter(value)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formattedValue}</div>
        {description && <CardDescription>{description}</CardDescription>}

        {typeof trend === "number" && (
          <div className="flex items-center space-x-1 mt-2">
            <span
              className={cn(
                "text-xs font-medium flex items-center",
                trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-500",
              )}
            >
              {trend > 0 ? (
                <ArrowUpIcon className="h-3 w-3 mr-1" />
              ) : trend < 0 ? (
                <ArrowDownIcon className="h-3 w-3 mr-1" />
              ) : null}
              {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="text-xs text-gray-500">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

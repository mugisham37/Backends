"use client"

import { useEffect, useState } from "react"
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { format, parseISO } from "date-fns"

interface AnalyticsChartProps {
  data: any[]
  xKey: string
  yKey: string
  height?: number
  type?: "line" | "bar" | "area" | "composed"
  additionalSeries?: Array<{
    key: string
    type: "line" | "bar" | "area"
    color?: string
    name?: string
  }>
  loading?: boolean
  error?: string | null
  dateFormat?: string
}

export default function AnalyticsChart({
  data,
  xKey,
  yKey,
  height = 300,
  type = "line",
  additionalSeries = [],
  loading = false,
  error = null,
  dateFormat = "MMM d",
}: AnalyticsChartProps) {
  const [formattedData, setFormattedData] = useState<any[]>([])

  useEffect(() => {
    if (data && data.length > 0) {
      // Format dates if the xKey contains date-like strings
      const formatted = data.map((item) => {
        const newItem = { ...item }

        // Check if the xKey value is a date string
        if (typeof newItem[xKey] === "string" && newItem[xKey].match(/^\d{4}-\d{2}-\d{2}/)) {
          try {
            const date = parseISO(newItem[xKey])
            newItem[`${xKey}Formatted`] = format(date, dateFormat)
          } catch (e) {
            newItem[`${xKey}Formatted`] = newItem[xKey]
          }
        } else {
          newItem[`${xKey}Formatted`] = newItem[xKey]
        }

        return newItem
      })

      setFormattedData(formatted)
    } else {
      setFormattedData([])
    }
  }, [data, xKey, dateFormat])

  if (loading) {
    return <Skeleton className={`w-full h-[${height}px]`} />
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-[200px] text-red-500">Error loading chart: {error}</div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center h-[200px] text-gray-500">No data available</div>
  }

  const renderChart = () => {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey={`${xKey}Formatted`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "#E5E7EB" }}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#E5E7EB" }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              borderRadius: "0.375rem",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              border: "1px solid #E5E7EB",
            }}
          />
          <Legend />

          {type === "line" && <Line type="monotone" dataKey={yKey} stroke="#3B82F6" strokeWidth={2} dot={false} />}
          {type === "bar" && <Bar dataKey={yKey} fill="#3B82F6" radius={[4, 4, 0, 0]} />}
          {type === "area" && (
            <Area type="monotone" dataKey={yKey} stroke="#3B82F6" fill="#93C5FD" fillOpacity={0.3} strokeWidth={2} />
          )}

          {additionalSeries.map((series, index) => {
            if (series.type === "line") {
              return (
                <Line
                  key={index}
                  type="monotone"
                  dataKey={series.key}
                  name={series.name || series.key}
                  stroke={series.color || "#10B981"}
                  strokeWidth={2}
                  dot={false}
                />
              )
            }
            if (series.type === "bar") {
              return (
                <Bar
                  key={index}
                  dataKey={series.key}
                  name={series.name || series.key}
                  fill={series.color || "#10B981"}
                  radius={[4, 4, 0, 0]}
                />
              )
            }
            if (series.type === "area") {
              return (
                <Area
                  key={index}
                  type="monotone"
                  dataKey={series.key}
                  name={series.name || series.key}
                  stroke={series.color || "#10B981"}
                  fill={series.color || "#10B981"}
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              )
            }
            return null
          })}
        </ComposedChart>
      </ResponsiveContainer>
    )
  }

  return renderChart()
}

"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getReport, generateReportData, updateReport } from "@/lib/analytics"
import type { AnalyticsReport } from "@/lib/analytics"

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [timeRange, setTimeRange] = useState("30d")
  const [activeTab, setActiveTab] = useState("view")
  const [saving, setSaving] = useState(false)

  // Fetch report
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await getReport(params.id)
        setReport(data)
        
        // Generate initial report data
        fetchReportData(data)
      } catch (error) {
        console.error("Failed to fetch report:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [params.id])

  // Fetch report data
  const fetchReportData = async (reportData: AnalyticsReport) => {
    setLoadingData(true)
    try {
      const data = await generateReportData(reportData.id, { timeRange })
      setReportData(data)
    } catch (error) {
      console.error("Failed to generate report data:", error)
    } finally {
      setLoadingData(false)
    }
  }

  // Handle time range change
  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value)
    if (report) {
      fetchReportData(report)
    }
  }

  // Handle report update
  const handleUpdateReport = async () => {
    if (!report) return

    setSaving(true)
    try {
      const updatedReport = await updateReport(report.id, {
        name: report.name,
        description:\

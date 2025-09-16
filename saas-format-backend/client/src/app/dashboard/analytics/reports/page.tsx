"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, BarChart, LineChart, PieChart, TableIcon } from "lucide-react"
import { getReports, createReport, deleteReport } from "@/lib/analytics"
import type { AnalyticsReport } from "@/lib/analytics"

export default function ReportsPage() {
  const router = useRouter()
  const [reports, setReports] = useState<AnalyticsReport[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [newReportName, setNewReportName] = useState("")
  const [newReportType, setNewReportType] = useState("line")
  const [newReportDescription, setNewReportDescription] = useState("")
  const [creatingReport, setCreatingReport] = useState(false)

  // Fetch reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const data = await getReports()
        setReports(data)
      } catch (error) {
        console.error("Failed to fetch reports:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  // Filter reports based on active tab
  const filteredReports = reports.filter((report) => {
    if (activeTab === "all") return true
    return report.type.includes(activeTab)
  })

  // Create new report
  const handleCreateReport = async () => {
    if (!newReportName || !newReportType) return

    setCreatingReport(true)
    try {
      // Create default config based on report type
      let config = {}

      switch (newReportType) {
        case "line":
          config = {
            metrics: ["users"],
            timeRange: "30d",
            aggregation: "day",
          }
          break
        case "bar":
          config = {
            metrics: ["tasks"],
            timeRange: "30d",
            aggregation: "day",
          }
          break
        case "pie":
          config = {
            metrics: ["storage"],
            breakdown: "type",
          }
          break
        case "table":
          config = {
            metrics: ["api_calls"],
            timeRange: "7d",
            aggregation: "day",
            columns: ["date", "count", "avg_response_time", "error_rate"],
          }
          break
      }

      const newReport = await createReport({
        name: newReportName,
        description: newReportDescription,
        type: newReportType,
        config,
      })

      setReports([...reports, newReport])
      setNewReportName("")
      setNewReportDescription("")
      setNewReportType("line")
    } catch (error) {
      console.error("Failed to create report:", error)
    } finally {
      setCreatingReport(false)
    }
  }

  // Delete report
  const handleDeleteReport = async (id: string) => {
    if (!confirm("Are you sure you want to delete this report?")) return

    try {
      await deleteReport(id)
      setReports(reports.filter((report) => report.id !== id))
    } catch (error) {
      console.error("Failed to delete report:", error)
    }
  }

  // View report details
  const handleViewReport = (id: string) => {
    router.push(`/dashboard/analytics/reports/${id}`)
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Reports</h1>
          <p className="text-muted-foreground">Create and manage custom analytics reports</p>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="all">All Reports</TabsTrigger>
            <TabsTrigger value="line">Line Charts</TabsTrigger>
            <TabsTrigger value="bar">Bar Charts</TabsTrigger>
            <TabsTrigger value="pie">Pie Charts</TabsTrigger>
            <TabsTrigger value="table">Tables</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Report</CardTitle>
              <CardDescription>
                Configure a new analytics report to track metrics important to your business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="report-name">Report Name</Label>
                  <Input
                    id="report-name"
                    placeholder="Enter report name"
                    value={newReportName}
                    onChange={(e) => setNewReportName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-type">Report Type</Label>
                  <Select value={newReportType} onValueChange={setNewReportType}>
                    <SelectTrigger id="report-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line Chart</SelectItem>
                      <SelectItem value="bar">Bar Chart</SelectItem>
                      <SelectItem value="pie">Pie Chart</SelectItem>
                      <SelectItem value="table">Table</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 flex items-end">
                  <Button
                    className="w-full"
                    onClick={handleCreateReport}
                    disabled={!newReportName || !newReportType || creatingReport}
                  >
                    {creatingReport ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Report
                      </>
                    )}
                  </Button>
                </div>
                <div className="space-y-2 sm:col-span-4">
                  <Label htmlFor="report-description">Description (Optional)</Label>
                  <Input
                    id="report-description"
                    placeholder="Enter report description"
                    value={newReportDescription}
                    onChange={(e) => setNewReportDescription(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredReports.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <p className="text-muted-foreground text-center">
                  No reports found. Create your first report to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReports.map((report) => (
                <Card key={report.id} className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{report.name}</CardTitle>
                      {report.type.includes("line") && <LineChart className="h-5 w-5 text-muted-foreground" />}
                      {report.type.includes("bar") && <BarChart className="h-5 w-5 text-muted-foreground" />}
                      {report.type.includes("pie") && <PieChart className="h-5 w-5 text-muted-foreground" />}
                      {report.type.includes("table") && <TableIcon className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <CardDescription className="line-clamp-2">
                      {report.description || "No description provided"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      <p>Created: {new Date(report.createdAt).toLocaleDateString()}</p>
                      <p>Last updated: {new Date(report.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline" size="sm" onClick={() => handleViewReport(report.id)}>
                      View Report
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteReport(report.id)}>
                      Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

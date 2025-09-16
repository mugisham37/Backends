import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your SaaS platform dashboard</p>
      </div>

      <DashboardSkeleton />
    </div>
  )
}

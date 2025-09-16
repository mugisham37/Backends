"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { trackError } from "@/lib/analytics"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to analytics
    if (typeof window !== "undefined") {
      trackError("global_error", error.message, error.stack)
    }

    // Log to console in development
    console.error("Global error:", error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground">
          <div className="max-w-md w-full space-y-6 text-center">
            <h1 className="text-4xl font-bold">Something went wrong</h1>
            <p className="text-lg text-muted-foreground">
              We apologize for the inconvenience. A critical error has occurred.
            </p>

            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[200px] text-left">
              <p className="text-sm font-mono">{error.message}</p>
              {error.digest && <p className="text-xs text-muted-foreground mt-2">Error ID: {error.digest}</p>}
            </div>

            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => (window.location.href = "/")}>
                Go to Home
              </Button>
              <Button onClick={reset}>Try Again</Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}

"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { apiPost } from "@/lib/api"
import { useTenantContext } from "@/lib/tenant-context"
import { useUser } from "@/lib/state/store"

// Track page view
export function trackPageView(url: string) {
  try {
    apiPost("/analytics/events", {
      name: "page_view",
      properties: {
        url,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString(),
      },
    }).catch((err) => console.error("Failed to track page view:", err))
  } catch (error) {
    console.error("Error tracking page view:", error)
  }
}

// Track custom event
export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  try {
    apiPost("/analytics/events", {
      name: eventName,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
      },
    }).catch((err) => console.error(`Failed to track event ${eventName}:`, err))
  } catch (error) {
    console.error(`Error tracking event ${eventName}:`, error)
  }
}

// Track error
export function trackError(errorType: string, errorMessage: string, errorDetails?: string) {
  try {
    apiPost("/analytics/events", {
      name: "error",
      properties: {
        errorType,
        errorMessage,
        errorDetails,
        url: typeof window !== "undefined" ? window.location.href : "",
        timestamp: new Date().toISOString(),
      },
    }).catch((err) => console.error("Failed to track error:", err))
  } catch (error) {
    console.error("Error tracking error event:", error)
  }
}

// Hook to automatically track page views
export function usePageViewTracking() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { tenantId } = useTenantContext()
  const user = useUser()

  useEffect(() => {
    if (!pathname) return

    // Construct full URL including search params
    const url = searchParams?.size ? `${pathname}?${searchParams.toString()}` : pathname

    // Track page view
    trackPageView(url)

    // Track additional user and tenant context if available
    if (user || tenantId) {
      apiPost("/analytics/context", {
        userId: user?.id,
        tenantId,
        url,
        timestamp: new Date().toISOString(),
      }).catch((err) => console.error("Failed to track context:", err))
    }
  }, [pathname, searchParams])
}

// Hook to track feature usage
export function useFeatureTracking(featureName: string) {
  const trackFeatureUsage = (action: string, properties: Record<string, any> = {}) => {
    trackEvent(`feature_${featureName}_${action}`, properties)
  }

  return { trackFeatureUsage }
}

// Performance tracking
export function trackPerformance() {
  if (typeof window === "undefined" || !("performance" in window)) return

  try {
    // Wait for the page to fully load
    window.addEventListener("load", () => {
      // Use requestIdleCallback to not block the main thread
      if ("requestIdleCallback" in window) {
        ;(window as any).requestIdleCallback(() => {
          const perfEntries = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming

          if (perfEntries) {
            const metrics = {
              // Navigation timing
              dnsLookup: perfEntries.domainLookupEnd - perfEntries.domainLookupStart,
              tcpConnection: perfEntries.connectEnd - perfEntries.connectStart,
              serverResponse: perfEntries.responseStart - perfEntries.requestStart,
              contentDownload: perfEntries.responseEnd - perfEntries.responseStart,
              domProcessing: perfEntries.domComplete - perfEntries.responseEnd,
              domInteractive: perfEntries.domInteractive - perfEntries.navigationStart,
              loadEvent: perfEntries.loadEventEnd - perfEntries.loadEventStart,
              // Total times
              timeToFirstByte: perfEntries.responseStart - perfEntries.navigationStart,
              domContentLoaded: perfEntries.domContentLoadedEventEnd - perfEntries.navigationStart,
              totalPageLoad: perfEntries.loadEventEnd - perfEntries.navigationStart,
            }

            // Track performance metrics
            apiPost("/analytics/performance", {
              url: window.location.href,
              metrics,
              timestamp: new Date().toISOString(),
            }).catch((err) => console.error("Failed to track performance:", err))
          }
        })
      }
    })
  } catch (error) {
    console.error("Error setting up performance tracking:", error)
  }
}

// Initialize analytics
export function initAnalytics() {
  if (typeof window === "undefined") return

  // Track performance
  trackPerformance()

  // Track errors
  window.addEventListener("error", (event) => {
    trackError("unhandled_error", event.message, `${event.filename}:${event.lineno}:${event.colno}`)
  })

  // Track unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    trackError("unhandled_promise_rejection", String(event.reason), event.reason?.stack)
  })
}

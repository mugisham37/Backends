"use client"

/**
 * Accessibility Utilities
 *
 * This module provides utilities for improving accessibility in the application.
 */

import { useEffect, useRef, useState } from "react"

/**
 * Focus trap hook for modal dialogs and other focus-trapping components
 * @param active Whether the focus trap is active
 * @returns Ref to attach to the container element
 */
export function useFocusTrap(active = true) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    // Find all focusable elements
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )

    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus the first element
    firstElement.focus()

    // Handle tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return

      // Shift + Tab
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      }
      // Tab
      else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    // Save active element to restore focus later
    const previousActiveElement = document.activeElement as HTMLElement

    // Add event listener
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      // Remove event listener
      document.removeEventListener("keydown", handleKeyDown)

      // Restore focus
      if (previousActiveElement) {
        previousActiveElement.focus()
      }
    }
  }, [active])

  return containerRef
}

/**
 * Skip to content link component props
 */
export interface SkipToContentProps {
  contentId: string
  className?: string
}

/**
 * Skip to content link component
 * @param props Component props
 * @returns Skip to content link component
 */
export function SkipToContent({ contentId, className = "" }: SkipToContentProps) {
  return (
    <a
      href={`#${contentId}`}
      className={`sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:p-4 focus:bg-background focus:border focus:rounded-md ${className}`}
    >
      Skip to content
    </a>
  )
}

/**
 * Announce messages to screen readers
 * @param message Message to announce
 * @param politeness Politeness level (assertive for important messages, polite for less important)
 */
export function announceToScreenReader(message: string, politeness: "assertive" | "polite" = "polite") {
  // Create or get the live region element
  let liveRegion = document.getElementById(`sr-live-region-${politeness}`)

  if (!liveRegion) {
    liveRegion = document.createElement("div")
    liveRegion.id = `sr-live-region-${politeness}`
    liveRegion.setAttribute("aria-live", politeness)
    liveRegion.setAttribute("role", politeness === "assertive" ? "alert" : "status")
    liveRegion.style.position = "absolute"
    liveRegion.style.width = "1px"
    liveRegion.style.height = "1px"
    liveRegion.style.padding = "0"
    liveRegion.style.margin = "-1px"
    liveRegion.style.overflow = "hidden"
    liveRegion.style.clip = "rect(0, 0, 0, 0)"
    liveRegion.style.whiteSpace = "nowrap"
    liveRegion.style.border = "0"
    document.body.appendChild(liveRegion)
  }

  // Update the live region
  liveRegion.textContent = ""

  // Use setTimeout to ensure the update is announced
  setTimeout(() => {
    liveRegion!.textContent = message
  }, 50)
}

/**
 * Hook to announce messages to screen readers
 * @returns Function to announce messages
 */
export function useAnnounce() {
  return {
    announce: announceToScreenReader,
  }
}

/**
 * Hook to detect reduced motion preference
 * @returns Whether reduced motion is preferred
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return prefersReducedMotion
}

/**
 * Hook to detect high contrast preference
 * @returns Whether high contrast is preferred
 */
export function useHighContrast() {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)")
    setPrefersHighContrast(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches)
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  return prefersHighContrast
}

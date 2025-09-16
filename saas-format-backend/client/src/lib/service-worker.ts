"use client"

import React from "react"

/**
 * Service Worker Registration and Management
 *
 * This module handles the registration and management of the service worker
 * for offline capabilities, caching, and background sync.
 */

// Check if service workers are supported
export const isServiceWorkerSupported = (): boolean => {
  return "serviceWorker" in navigator
}

/**
 * Register the service worker
 * @returns Promise that resolves when the service worker is registered
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!isServiceWorkerSupported()) {
    console.warn("Service workers are not supported in this browser")
    return undefined
  }

  try {
    const registration = await navigator.serviceWorker.register("/service-worker.js")
    console.log("Service Worker registered with scope:", registration.scope)
    return registration
  } catch (error) {
    console.error("Service Worker registration failed:", error)
    return undefined
  }
}

/**
 * Unregister the service worker
 * @returns Promise that resolves when the service worker is unregistered
 */
export const unregisterServiceWorker = async (): Promise<boolean> => {
  if (!isServiceWorkerSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      const success = await registration.unregister()
      console.log("Service Worker unregistered:", success)
      return success
    }
    return false
  } catch (error) {
    console.error("Service Worker unregistration failed:", error)
    return false
  }
}

/**
 * Check if the service worker is registered
 * @returns Promise that resolves with a boolean indicating if the service worker is registered
 */
export const isServiceWorkerRegistered = async (): Promise<boolean> => {
  if (!isServiceWorkerSupported()) {
    return false
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return !!registration
  } catch (error) {
    console.error("Error checking Service Worker registration:", error)
    return false
  }
}

/**
 * Update the service worker
 * @returns Promise that resolves when the service worker is updated
 */
export const updateServiceWorker = async (): Promise<void> => {
  if (!isServiceWorkerSupported()) {
    return
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration) {
      await registration.update()
      console.log("Service Worker updated")
    }
  } catch (error) {
    console.error("Service Worker update failed:", error)
  }
}

/**
 * Listen for service worker updates
 * @param callback Function to call when an update is available
 */
export const listenForServiceWorkerUpdates = (callback: () => void): void => {
  if (!isServiceWorkerSupported()) {
    return
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    callback()
  })
}

/**
 * React hook to use the service worker
 * @returns Object containing service worker status and functions
 */
export const useServiceWorker = () => {
  const [isRegistered, setIsRegistered] = React.useState<boolean>(false)
  const [isUpdateAvailable, setIsUpdateAvailable] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Check if service worker is registered
    const checkRegistration = async () => {
      const registered = await isServiceWorkerRegistered()
      setIsRegistered(registered)
    }

    checkRegistration()

    // Listen for service worker updates
    if (isServiceWorkerSupported() && navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setIsUpdateAvailable(true)
      })
    }
  }, [])

  // Register service worker
  const register = async () => {
    const registration = await registerServiceWorker()
    setIsRegistered(!!registration)
    return registration
  }

  // Unregister service worker
  const unregister = async () => {
    const success = await unregisterServiceWorker()
    setIsRegistered(!success)
    return success
  }

  // Update service worker
  const update = async () => {
    await updateServiceWorker()
    setIsUpdateAvailable(false)
  }

  return {
    isSupported: isServiceWorkerSupported(),
    isRegistered,
    isUpdateAvailable,
    register,
    unregister,
    update,
  }
}

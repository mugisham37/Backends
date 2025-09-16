"use client"

import React from "react"

/**
 * Offline Storage Module
 *
 * This module provides utilities for storing and retrieving data offline
 * using IndexedDB and localStorage with automatic synchronization when online.
 */

import { openDB, type IDBPDatabase } from "idb"
import { apiPost, apiPut, apiDelete } from "@/lib/api"
import { trackError } from "@/lib/analytics"

// Database name and version
const DB_NAME = "saas-platform-offline-db"
const DB_VERSION = 1

// Store names
const STORES = {
  OFFLINE_ACTIONS: "offline-actions",
  CACHE: "cache",
  USER_DATA: "user-data",
  PROJECTS: "projects",
  TASKS: "tasks",
  COMMENTS: "comments",
}

// Action types
export enum OfflineActionType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

// Interface for offline actions
export interface OfflineAction {
  id?: number
  type: OfflineActionType
  endpoint: string
  payload: any
  timestamp: number
  retryCount: number
  lastRetry?: number
  conflictResolution?: "client-wins" | "server-wins" | "manual"
}

// Interface for cached data
export interface CachedData {
  key: string
  data: any
  timestamp: number
  expiresAt?: number
}

/**
 * Initialize the IndexedDB database
 * @returns Promise that resolves with the database instance
 */
export const initDB = async (): Promise<IDBPDatabase> => {
  try {
    return await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create stores if they don't exist
        if (!db.objectStoreNames.contains(STORES.OFFLINE_ACTIONS)) {
          db.createObjectStore(STORES.OFFLINE_ACTIONS, { keyPath: "id", autoIncrement: true })
        }

        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          db.createObjectStore(STORES.CACHE, { keyPath: "key" })
        }

        if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
          db.createObjectStore(STORES.USER_DATA, { keyPath: "id" })
        }

        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projectsStore = db.createObjectStore(STORES.PROJECTS, { keyPath: "id" })
          projectsStore.createIndex("tenantId", "tenantId", { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const tasksStore = db.createObjectStore(STORES.TASKS, { keyPath: "id" })
          tasksStore.createIndex("projectId", "projectId", { unique: false })
        }

        if (!db.objectStoreNames.contains(STORES.COMMENTS)) {
          const commentsStore = db.createObjectStore(STORES.COMMENTS, { keyPath: "id" })
          commentsStore.createIndex("taskId", "taskId", { unique: false })
        }
      },
    })
  } catch (error) {
    console.error("Failed to initialize IndexedDB:", error)
    trackError("indexeddb_init_error", error.message)
    throw error
  }
}

/**
 * Queue an action to be performed when online
 * @param type Action type (CREATE, UPDATE, DELETE)
 * @param endpoint API endpoint
 * @param payload Data payload
 * @param conflictResolution Conflict resolution strategy
 * @returns Promise that resolves with the queued action ID
 */
export const queueOfflineAction = async (
  type: OfflineActionType,
  endpoint: string,
  payload: any,
  conflictResolution: "client-wins" | "server-wins" | "manual" = "client-wins",
): Promise<number> => {
  try {
    const db = await initDB()

    const action: OfflineAction = {
      type,
      endpoint,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      conflictResolution,
    }

    const id = await db.add(STORES.OFFLINE_ACTIONS, action)

    // Try to sync immediately if online
    if (navigator.onLine) {
      syncOfflineActions().catch(console.error)
    }

    return id
  } catch (error) {
    console.error("Failed to queue offline action:", error)
    trackError("offline_queue_error", error.message)
    throw error
  }
}

/**
 * Synchronize offline actions with the server
 * @returns Promise that resolves when synchronization is complete
 */
export const syncOfflineActions = async (): Promise<void> => {
  if (!navigator.onLine) {
    return
  }

  try {
    const db = await initDB()
    const actions = await db.getAll(STORES.OFFLINE_ACTIONS)

    // Sort actions by timestamp (oldest first)
    actions.sort((a, b) => a.timestamp - b.timestamp)

    for (const action of actions) {
      try {
        let response

        switch (action.type) {
          case OfflineActionType.CREATE:
            response = await apiPost(action.endpoint, action.payload)
            break
          case OfflineActionType.UPDATE:
            response = await apiPut(action.endpoint, action.payload)
            break
          case OfflineActionType.DELETE:
            response = await apiDelete(action.endpoint)
            break
        }

        // If successful, remove the action from the queue
        await db.delete(STORES.OFFLINE_ACTIONS, action.id!)

        // If this was a CREATE or UPDATE, update the local cache
        if (action.type === OfflineActionType.CREATE || action.type === OfflineActionType.UPDATE) {
          const cacheKey = `${action.endpoint}${action.payload.id ? `/${action.payload.id}` : ""}`
          await cacheData(cacheKey, response)
        }
      } catch (error) {
        console.error(`Failed to sync offline action ${action.id}:`, error)

        // Update retry count and last retry timestamp
        await db.put(STORES.OFFLINE_ACTIONS, {
          ...action,
          retryCount: action.retryCount + 1,
          lastRetry: Date.now(),
        })

        // If we've retried too many times, we might want to notify the user
        if (action.retryCount >= 5) {
          // This could trigger a notification to the user
          console.warn(`Action ${action.id} has failed ${action.retryCount} times`)
        }
      }
    }
  } catch (error) {
    console.error("Failed to sync offline actions:", error)
    trackError("offline_sync_error", error.message)
  }
}

/**
 * Cache data for offline use
 * @param key Cache key
 * @param data Data to cache
 * @param ttl Time to live in milliseconds (optional)
 * @returns Promise that resolves when data is cached
 */
export const cacheData = async (key: string, data: any, ttl?: number): Promise<void> => {
  try {
    const db = await initDB()

    const cacheEntry: CachedData = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : undefined,
    }

    await db.put(STORES.CACHE, cacheEntry)
  } catch (error) {
    console.error("Failed to cache data:", error)
    trackError("cache_data_error", error.message)
  }
}

/**
 * Get cached data
 * @param key Cache key
 * @returns Promise that resolves with the cached data or null if not found or expired
 */
export const getCachedData = async (key: string): Promise<any | null> => {
  try {
    const db = await initDB()
    const cacheEntry = await db.get(STORES.CACHE, key)

    if (!cacheEntry) {
      return null
    }

    // Check if expired
    if (cacheEntry.expiresAt && cacheEntry.expiresAt < Date.now()) {
      await db.delete(STORES.CACHE, key)
      return null
    }

    return cacheEntry.data
  } catch (error) {
    console.error("Failed to get cached data:", error)
    trackError("get_cache_error", error.message)
    return null
  }
}

/**
 * Clear expired cache entries
 * @returns Promise that resolves when expired entries are cleared
 */
export const clearExpiredCache = async (): Promise<void> => {
  try {
    const db = await initDB()
    const cacheEntries = await db.getAll(STORES.CACHE)
    const now = Date.now()

    for (const entry of cacheEntries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        await db.delete(STORES.CACHE, entry.key)
      }
    }
  } catch (error) {
    console.error("Failed to clear expired cache:", error)
    trackError("clear_cache_error", error.message)
  }
}

/**
 * Store user data for offline use
 * @param userData User data to store
 * @returns Promise that resolves when data is stored
 */
export const storeUserData = async (userData: any): Promise<void> => {
  try {
    const db = await initDB()
    await db.put(STORES.USER_DATA, userData)
  } catch (error) {
    console.error("Failed to store user data:", error)
    trackError("store_user_data_error", error.message)
  }
}

/**
 * Get stored user data
 * @param userId User ID
 * @returns Promise that resolves with the user data or null if not found
 */
export const getUserData = async (userId: string): Promise<any | null> => {
  try {
    const db = await initDB()
    return await db.get(STORES.USER_DATA, userId)
  } catch (error) {
    console.error("Failed to get user data:", error)
    trackError("get_user_data_error", error.message)
    return null
  }
}

/**
 * Store projects for offline use
 * @param projects Projects to store
 * @returns Promise that resolves when projects are stored
 */
export const storeProjects = async (projects: any[]): Promise<void> => {
  try {
    const db = await initDB()
    const tx = db.transaction(STORES.PROJECTS, "readwrite")

    for (const project of projects) {
      await tx.store.put(project)
    }

    await tx.done
  } catch (error) {
    console.error("Failed to store projects:", error)
    trackError("store_projects_error", error.message)
  }
}

/**
 * Get stored projects
 * @param tenantId Tenant ID (optional)
 * @returns Promise that resolves with the projects
 */
export const getProjects = async (tenantId?: string): Promise<any[]> => {
  try {
    const db = await initDB()

    if (tenantId) {
      return await db.getAllFromIndex(STORES.PROJECTS, "tenantId", tenantId)
    }

    return await db.getAll(STORES.PROJECTS)
  } catch (error) {
    console.error("Failed to get projects:", error)
    trackError("get_projects_error", error.message)
    return []
  }
}

/**
 * Store tasks for offline use
 * @param tasks Tasks to store
 * @returns Promise that resolves when tasks are stored
 */
export const storeTasks = async (tasks: any[]): Promise<void> => {
  try {
    const db = await initDB()
    const tx = db.transaction(STORES.TASKS, "readwrite")

    for (const task of tasks) {
      await tx.store.put(task)
    }

    await tx.done
  } catch (error) {
    console.error("Failed to store tasks:", error)
    trackError("store_tasks_error", error.message)
  }
}

/**
 * Get stored tasks
 * @param projectId Project ID (optional)
 * @returns Promise that resolves with the tasks
 */
export const getTasks = async (projectId?: string): Promise<any[]> => {
  try {
    const db = await initDB()

    if (projectId) {
      return await db.getAllFromIndex(STORES.TASKS, "projectId", projectId)
    }

    return await db.getAll(STORES.TASKS)
  } catch (error) {
    console.error("Failed to get tasks:", error)
    trackError("get_tasks_error", error.message)
    return []
  }
}

/**
 * Initialize offline storage listeners
 */
export const initOfflineStorageListeners = (): void => {
  // Sync when coming back online
  window.addEventListener("online", () => {
    console.log("Back online, syncing offline actions...")
    syncOfflineActions().catch(console.error)
  })

  // Clear expired cache periodically
  setInterval(
    () => {
      clearExpiredCache().catch(console.error)
    },
    60 * 60 * 1000,
  ) // Every hour
}

/**
 * React hook to use offline storage
 * @returns Object containing offline storage functions
 */
export const useOfflineStorage = () => {
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine)
  const [pendingActions, setPendingActions] = React.useState<number>(0)

  React.useEffect(() => {
    // Update online status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Count pending actions
    const countPendingActions = async () => {
      try {
        const db = await initDB()
        const actions = await db.getAll(STORES.OFFLINE_ACTIONS)
        setPendingActions(actions.length)
      } catch (error) {
        console.error("Failed to count pending actions:", error)
      }
    }

    countPendingActions()

    // Set up interval to recount pending actions
    const interval = setInterval(countPendingActions, 5000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  return {
    isOnline,
    pendingActions,
    queueOfflineAction,
    syncOfflineActions,
    cacheData,
    getCachedData,
    storeUserData,
    getUserData,
    storeProjects,
    getProjects,
    storeTasks,
    getTasks,
  }
}

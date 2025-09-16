// Service Worker for SaaS Platform
// This service worker provides offline capabilities, caching, and background sync

const CACHE_NAME = "saas-platform-cache-v1"
const OFFLINE_PAGE = "/offline.html"
const OFFLINE_FALLBACK_IMAGE = "/images/offline-image.svg"
const OFFLINE_FALLBACK_FONT = "/fonts/inter-var-latin.woff2"

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/images/offline-image.svg",
  "/fonts/inter-var-latin.woff2",
  "/favicon.ico",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
]

// API routes to cache with network-first strategy
const API_ROUTES = ["/api/users/me", "/api/tenants/current", "/api/projects", "/api/feature-flags"]

// Routes to cache with stale-while-revalidate strategy
const STALE_WHILE_REVALIDATE_ROUTES = [
  "/dashboard",
  "/dashboard/projects",
  "/dashboard/team",
  "/dashboard/analytics",
  "/dashboard/settings",
]

// Install event - precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache")
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => self.skipWaiting()),
  )
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => self.clients.claim()),
  )
})

// Fetch event - handle different caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return
  }

  // Skip non-GET requests
  if (request.method !== "GET") {
    // For POST requests, try to add to background sync if offline
    if (request.method === "POST" && !navigator.onLine) {
      event.respondWith(handleOfflinePost(request))
      return
    }
    return
  }

  // API routes - network first, fallback to cache
  if (API_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // Stale-while-revalidate for specific routes
  if (STALE_WHILE_REVALIDATE_ROUTES.some((route) => url.pathname.startsWith(route))) {
    event.respondWith(staleWhileRevalidateStrategy(request))
    return
  }

  // Cache-first for static assets (images, CSS, JS)
  if (
    url.pathname.match(/\.(jpe?g|png|gif|svg|css|js|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith("/images/") ||
    url.pathname.startsWith("/static/")
  ) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  // Network-first for HTML pages
  if (request.headers.get("Accept").includes("text/html")) {
    event.respondWith(networkFirstWithOfflineFallback(request))
    return
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache a copy of the response
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone)
        })
        return response
      })
      .catch(() => caches.match(request)),
  )
})

// Background sync for offline form submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-forms") {
    event.waitUntil(syncFormData())
  }
})

// Push notification event
self.addEventListener("push", (event) => {
  const data = event.data.json()

  const options = {
    body: data.body,
    icon: "/logo192.png",
    badge: "/badge.png",
    data: {
      url: data.url || "/",
    },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Notification click event
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const url = event.notification.data.url

      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === url && "focus" in client) {
          return client.focus()
        }
      }

      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})

// Network-first strategy
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request)
    // Cache the response for future use
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    // If network fails, try to get from cache
    const cachedResponse = await caches.match(request)
    return cachedResponse || Promise.reject("No network and no cache")
  }
}

// Cache-first strategy
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    // Return cached response and update cache in background
    fetch(request)
      .then((response) => {
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, response)
        })
      })
      .catch(() => {})
    return cachedResponse
  }

  // If not in cache, fetch from network and cache
  try {
    const networkResponse = await fetch(request)
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    // For images, return a fallback
    if (request.url.match(/\.(jpe?g|png|gif|svg)$/)) {
      return caches.match(OFFLINE_FALLBACK_IMAGE)
    }
    // For fonts, return a fallback
    if (request.url.match(/\.(woff2?|ttf|eot)$/)) {
      return caches.match(OFFLINE_FALLBACK_FONT)
    }
    return Promise.reject("No network and no cache")
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request)

  // Fetch from network and update cache regardless of cache hit
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, networkResponse.clone())
      })
      return networkResponse
    })
    .catch((error) => {
      console.error("Fetch failed in stale-while-revalidate:", error)
      // If we have a cached response, we'll already return it
      // If not, this error will be handled by the outer catch
      throw error
    })

  // Return cached response immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise
}

// Network-first with offline fallback for HTML pages
async function networkFirstWithOfflineFallback(request) {
  try {
    const networkResponse = await fetch(request)
    // Cache the response for future use
    const cache = await caches.open(CACHE_NAME)
    cache.put(request, networkResponse.clone())
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    // If no cache, return the offline page
    return caches.match(OFFLINE_PAGE)
  }
}

// Handle offline POST requests
async function handleOfflinePost(request) {
  try {
    // Clone the request to store in IndexedDB
    const requestClone = await request.clone()
    const body = await requestClone.json()

    // Store in IndexedDB for later sync
    await storeRequestForSync(request.url, body)

    // Register for background sync
    await self.registration.sync.register("sync-forms")

    // Return a custom response
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        message: "Your request has been saved and will be sent when you are back online.",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Error handling offline POST:", error)
    return new Response(
      JSON.stringify({
        success: false,
        message: "Failed to save your request for offline use.",
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}

// Store request data for later sync
async function storeRequestForSync(url, body) {
  // Open or create IndexedDB
  const db = await openDB("offline-requests", 1, {
    upgrade(db) {
      db.createObjectStore("requests", { keyPath: "id", autoIncrement: true })
    },
  })

  // Store the request
  await db.add("requests", {
    url,
    body,
    timestamp: Date.now(),
  })
}

// Sync stored form data when back online
async function syncFormData() {
  const db = await openDB("offline-requests", 1)
  const requests = await db.getAll("requests")

  // Process each stored request
  for (const request of requests) {
    try {
      await fetch(request.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request.body),
      })

      // If successful, remove from IndexedDB
      await db.delete("requests", request.id)
    } catch (error) {
      console.error("Failed to sync request:", error)
      // Keep in IndexedDB to try again later
    }
  }
}

// Helper function to open IndexedDB
function openDB(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    if (upgradeCallback) {
      request.onupgradeneeded = (event) => upgradeCallback(request.result, event)
    }
  })
}

import { Router } from "express"
import { SearchController } from "../../../controllers/search.controller"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const searchController = new SearchController()

// Search content
router.get("/content", authMiddleware, requireAuth, searchController.searchContent)

// Search users
router.get("/users", authMiddleware, requireAuth, searchController.searchUsers)

// Search media
router.get("/media", authMiddleware, requireAuth, searchController.searchMedia)

// Reindex content (admin only)
router.post("/reindex/content", authMiddleware, requireRoles(["admin"]), searchController.reindexContent)

// Reindex users (admin only)
router.post("/reindex/users", authMiddleware, requireRoles(["admin"]), searchController.reindexUsers)

// Reindex media (admin only)
router.post("/reindex/media", authMiddleware, requireRoles(["admin"]), searchController.reindexMedia)

export const searchRoutes = router

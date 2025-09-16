import express from "express"
import * as advancedSearchController from "../controllers/advanced-search.controller"

const router = express.Router()

// Public routes
router.get("/advanced", advancedSearchController.advancedSearch)
router.get("/suggestions", advancedSearchController.getProductSuggestions)
router.get("/popular", advancedSearchController.getPopularSearches)

export default router

import { Router } from "express"
import * as searchController from "../controllers/search.controller"

const router = Router()

// Search products
router.get("/", searchController.searchProducts)

// Get product suggestions
router.get("/suggestions", searchController.getProductSuggestions)

export default router

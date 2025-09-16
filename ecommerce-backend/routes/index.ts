import express from "express"
import authRoutes from "./auth.routes"
import userRoutes from "./user.routes"
import productRoutes from "./product.routes"
import categoryRoutes from "./category.routes"
import orderRoutes from "./order.routes"
import reviewRoutes from "./review.routes"
import cartRoutes from "./cart.routes"
import paymentRoutes from "./payment.routes"
import webhookRoutes from "./webhook.routes"
import adminRoutes from "./admin.routes"
import swaggerRoutes from "./swagger.routes"
import exportRoutes from "./export.routes"
import recommendationRoutes from "./recommendation.routes"
import emailRoutes from "./email.routes"
import schedulerRoutes from "./scheduler.routes"
import analyticsRoutes from "./analytics.routes"
import abTestRoutes from "./ab-test.routes"
import vendorRoutes from "./vendor.routes"
import searchRoutes from "./search.routes"
import advancedSearchRoutes from "./advanced-search.routes"
import loyaltyRoutes from "./loyalty.routes"
import adminLoyaltyRoutes from "./admin-loyalty.routes"

const router = express.Router()

// API Routes
router.use("/auth", authRoutes)
router.use("/users", userRoutes)
router.use("/products", productRoutes)
router.use("/categories", categoryRoutes)
router.use("/orders", orderRoutes)
router.use("/reviews", reviewRoutes)
router.use("/cart", cartRoutes)
router.use("/payment", paymentRoutes)
router.use("/webhooks", webhookRoutes)
router.use("/admin", adminRoutes)
router.use("/docs", swaggerRoutes)
router.use("/export", exportRoutes)
router.use("/recommendations", recommendationRoutes)
router.use("/email", emailRoutes)
router.use("/scheduler", schedulerRoutes)
router.use("/analytics", analyticsRoutes)
router.use("/ab-test", abTestRoutes)
router.use("/vendors", vendorRoutes)
router.use("/search", searchRoutes)
router.use("/advanced-search", advancedSearchRoutes)
router.use("/loyalty", loyaltyRoutes)
router.use("/admin/loyalty", adminLoyaltyRoutes)

export default router

import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import * as swaggerController from "../controllers/swagger.controller";
import swaggerSpec from "../config/swagger";

const router = Router();

// Serve swagger docs
router.use("/", swaggerUi.serve);
router.get(
  "/",
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "E-Commerce Platform API Documentation",
  })
);

// Serve swagger spec as JSON
router.get("/swagger.json", swaggerController.getSwaggerSpec);

export default router;

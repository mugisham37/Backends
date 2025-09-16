import { type Application, Router } from "express";
import { analyticsRoutes } from "./v1/analytics.routes";
import { apiGatewayRoutes } from "./v1/api-gateway.routes";
import { apiKeyRoutes } from "./v1/api-key.routes";
import { auditRoutes } from "./v1/audit.routes";
import { authRoutes } from "./v1/auth.routes";
import { contentTypeRoutes } from "./v1/content-type.routes";
import { contentRoutes } from "./v1/content.routes";
import { i18nRoutes } from "./v1/i18n.routes";
import { mediaRoutes } from "./v1/media.routes";
import { migrationRoutes } from "./v1/migration.routes";
import { monitoringRoutes } from "./v1/monitoring.routes";
import { notificationRoutes } from "./v1/notification.routes";
import { pluginRoutes } from "./v1/plugin.routes";
import { schedulerRoutes } from "./v1/scheduler.routes";
import { searchRoutes } from "./v1/search.routes";
import { tenantRoutes } from "./v1/tenant.routes";
import { userRoutes } from "./v1/user.routes";
import { versioningRoutes } from "./v1/versioning.routes";
import { webhookRoutes } from "./v1/webhook.routes";
import { workflowRoutes } from "./v1/workflow.routes";

export const setupRestApi = (app: Application): void => {
  const apiRouter = Router();
  const v1Router = Router();

  // API version 1 routes
  v1Router.use("/auth", authRoutes);
  v1Router.use("/users", userRoutes);
  v1Router.use("/content-types", contentTypeRoutes);
  v1Router.use("/content", contentRoutes);
  v1Router.use("/media", mediaRoutes);
  v1Router.use("/webhooks", webhookRoutes);
  v1Router.use("/workflows", workflowRoutes);
  v1Router.use("/analytics", analyticsRoutes);
  v1Router.use("/migrations", migrationRoutes);
  v1Router.use("/audit", auditRoutes);
  v1Router.use("/versions", versioningRoutes);
  v1Router.use("/monitoring", monitoringRoutes);
  v1Router.use("/scheduler", schedulerRoutes);
  v1Router.use("/search", searchRoutes);
  v1Router.use("/notifications", notificationRoutes);
  v1Router.use("/api-gateway", apiGatewayRoutes);
  v1Router.use("/i18n", i18nRoutes);
  v1Router.use("/tenants", tenantRoutes);
  v1Router.use("/plugins", pluginRoutes);
  v1Router.use("/api-keys", apiKeyRoutes);

  // Mount v1 router
  apiRouter.use("/v1", v1Router);

  // Mount API router
  app.use("/api", apiRouter);
};

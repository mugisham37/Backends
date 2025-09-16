/**
 * API versioning middleware
 * Handles API version routing and compatibility
 */

import { Request, Response, NextFunction } from "express";
import { ResponseBuilder, HTTP_STATUS } from "../utils/response.utils";

export interface ApiVersionConfig {
  defaultVersion: string;
  supportedVersions: string[];
  deprecatedVersions: string[];
}

const DEFAULT_CONFIG: ApiVersionConfig = {
  defaultVersion: "v1",
  supportedVersions: ["v1"],
  deprecatedVersions: [],
};

export const apiVersionMiddleware = (
  config: ApiVersionConfig = DEFAULT_CONFIG
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Extract version from URL path, header, or query parameter
    let version =
      extractVersionFromPath(req.path) ||
      (req.headers["api-version"] as string) ||
      (req.query.version as string) ||
      config.defaultVersion;

    // Normalize version format
    version = normalizeVersion(version);

    // Check if version is supported
    if (!config.supportedVersions.includes(version)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        ResponseBuilder.error(
          `API version ${version} is not supported. Supported versions: ${config.supportedVersions.join(
            ", "
          )}`,
          "UNSUPPORTED_API_VERSION",
          {
            requestedVersion: version,
            supportedVersions: config.supportedVersions,
          },
          { requestId: req.id }
        )
      );
      return;
    }

    // Add deprecation warning for deprecated versions
    if (config.deprecatedVersions.includes(version)) {
      res.setHeader(
        "X-API-Deprecation-Warning",
        `API version ${version} is deprecated`
      );
      res.setHeader(
        "X-API-Supported-Versions",
        config.supportedVersions.join(", ")
      );
    }

    // Set version headers
    res.setHeader("X-API-Version", version);
    res.setHeader(
      "X-API-Supported-Versions",
      config.supportedVersions.join(", ")
    );

    // Add version to request object
    (req as any).apiVersion = version;

    next();
  };
};

function extractVersionFromPath(path: string): string | null {
  const versionMatch = path.match(/^\/api\/(v\d+)/);
  return versionMatch ? versionMatch[1] : null;
}

function normalizeVersion(version: string): string {
  // Ensure version starts with 'v'
  if (!version.startsWith("v")) {
    version = `v${version}`;
  }
  return version.toLowerCase();
}

// Middleware for handling version-specific logic
export const versionHandler = (
  handlers: Record<
    string,
    (req: Request, res: Response, next: NextFunction) => void
  >
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const version = (req as any).apiVersion || "v1";
    const handler = handlers[version] || handlers["default"];

    if (!handler) {
      res
        .status(HTTP_STATUS.NOT_IMPLEMENTED)
        .json(
          ResponseBuilder.error(
            `Handler for API version ${version} not implemented`,
            "VERSION_HANDLER_NOT_FOUND",
            undefined,
            { requestId: req.id }
          )
        );
      return;
    }

    handler(req, res, next);
  };
};

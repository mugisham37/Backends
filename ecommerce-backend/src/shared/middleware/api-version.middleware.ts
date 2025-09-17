/**
 * API versioning middleware
 * Handles API version routing and compatibility
 */

import type { FastifyRequest, FastifyReply } from "fastify";
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

export const createApiVersionMiddleware = (
  config: ApiVersionConfig = DEFAULT_CONFIG
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    // Extract version from URL path, header, or query parameter
    let version =
      extractVersionFromPath(request.url) ||
      (request.headers["api-version"] as string) ||
      (request.query as any)?.version ||
      config.defaultVersion;

    // Normalize version format
    version = normalizeVersion(version);

    // Check if version is supported
    if (!config.supportedVersions.includes(version)) {
      return reply.status(HTTP_STATUS.BAD_REQUEST).send(
        ResponseBuilder.error(
          `API version ${version} is not supported. Supported versions: ${config.supportedVersions.join(
            ", "
          )}`,
          "UNSUPPORTED_API_VERSION",
          {
            requestedVersion: version,
            supportedVersions: config.supportedVersions,
          },
          { requestId: (request as any).id }
        )
      );
    }

    // Add deprecation warning for deprecated versions
    if (config.deprecatedVersions.includes(version)) {
      reply.header(
        "X-API-Deprecation-Warning",
        `API version ${version} is deprecated`
      );
      reply.header(
        "X-API-Supported-Versions",
        config.supportedVersions.join(", ")
      );
    }

    // Set version headers
    reply.header("X-API-Version", version);
    reply.header(
      "X-API-Supported-Versions",
      config.supportedVersions.join(", ")
    );

    // Add version to request object
    (request as any).apiVersion = version;
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
export const createVersionHandler = (
  handlers: Record<
    string,
    (request: FastifyRequest, reply: FastifyReply) => Promise<void> | void
  >
) => {
  return async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    const version = (request as any).apiVersion || "v1";
    const handler = handlers[version] || handlers["default"];

    if (!handler) {
      return reply
        .status(HTTP_STATUS.NOT_IMPLEMENTED)
        .send(
          ResponseBuilder.error(
            `Handler for API version ${version} not implemented`,
            "VERSION_HANDLER_NOT_FOUND",
            undefined,
            { requestId: (request as any).id }
          )
        );
    }

    await handler(request, reply);
  };
};

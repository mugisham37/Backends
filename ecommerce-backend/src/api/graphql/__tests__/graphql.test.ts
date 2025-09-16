/**
 * GraphQL Integration Tests
 * Tests GraphQL server setup and basic functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createGraphQLServer } from "../index.js";
import { ApolloServer } from "@apollo/server";

describe("GraphQL Server", () => {
  let server: ApolloServer;

  beforeAll(async () => {
    server = createGraphQLServer();
    await server.start();
  });

  afterAll(async () => {
    await server?.stop();
  });

  it("should create GraphQL server successfully", () => {
    expect(server).toBeDefined();
  });

  it("should execute health check query", async () => {
    const query = `
      query {
        health
      }
    `;

    const response = await server.executeOperation({
      query,
    });

    expect(response.body.kind).toBe("single");
    if (response.body.kind === "single") {
      expect(response.body.singleResult.errors).toBeUndefined();
      expect(response.body.singleResult.data?.health).toBe(
        "GraphQL server is running!"
      );
    }
  });

  it("should have proper schema structure", async () => {
    const introspectionQuery = `
      query {
        __schema {
          types {
            name
            kind
          }
        }
      }
    `;

    const response = await server.executeOperation({
      query: introspectionQuery,
    });

    expect(response.body.kind).toBe("single");
    if (response.body.kind === "single") {
      expect(response.body.singleResult.errors).toBeUndefined();
      expect(response.body.singleResult.data?.__schema).toBeDefined();

      const types = response.body.singleResult.data?.__schema.types;
      const typeNames = types.map((type: any) => type.name);

      // Check that our custom types are present
      expect(typeNames).toContain("User");
      expect(typeNames).toContain("Vendor");
      expect(typeNames).toContain("Product");
      expect(typeNames).toContain("Order");
    }
  });

  it("should handle authentication errors properly", async () => {
    const query = `
      query {
        me {
          id
          email
        }
      }
    `;

    const response = await server.executeOperation({
      query,
    });

    expect(response.body.kind).toBe("single");
    if (response.body.kind === "single") {
      expect(response.body.singleResult.errors).toBeDefined();
      expect(response.body.singleResult.errors?.[0].message).toContain(
        "Authentication required"
      );
    }
  });
});

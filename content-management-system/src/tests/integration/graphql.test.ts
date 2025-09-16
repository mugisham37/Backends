import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../../app";
import { resetDatabase, seedTestData } from "../setup";

describe("GraphQL API Integration Tests", () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUser: any;
  let testTenant: any;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase();
    const seedData = await seedTestData();
    testUser = seedData.user;
    testTenant = seedData.tenant;
    authToken = seedData.authToken;
  });

  describe("Authentication Queries and Mutations", () => {
    it("should login user via GraphQL", async () => {
      const query = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            user {
              id
              email
              role
            }
            accessToken
            refreshToken
            expiresIn
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          "content-type": "application/json",
        },
        payload: {
          query,
          variables: {
            input: {
              email: testUser.email,
              password: "password123",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.login).toBeDefined();
      expect(result.data.login.user.email).toBe(testUser.email);
      expect(result.data.login.accessToken).toBeDefined();
    });

    it("should get current user via me query", async () => {
      const query = `
        query Me {
          me {
            id
            email
            role
            tenant {
              id
              name
              slug
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.me).toBeDefined();
      expect(result.data.me.email).toBe(testUser.email);
      expect(result.data.me.tenant).toBeDefined();
    });

    it("should refresh token via GraphQL", async () => {
      // First login to get refresh token
      const loginQuery = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            refreshToken
          }
        }
      `;

      const loginResponse = await app.inject({
        method: "POST",
        url: "/graphql",
        payload: {
          query: loginQuery,
          variables: {
            input: {
              email: testUser.email,
              password: "password123",
            },
          },
        },
      });

      const loginResult = JSON.parse(loginResponse.payload);
      const refreshToken = loginResult.data.login.refreshToken;

      // Now refresh the token
      const refreshQuery = `
        mutation RefreshToken($refreshToken: String!) {
          refreshToken(refreshToken: $refreshToken) {
            accessToken
            refreshToken
            expiresIn
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        payload: {
          query: refreshQuery,
          variables: {
            refreshToken,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.refreshToken.accessToken).toBeDefined();
    });
  });

  describe("Content Management Queries and Mutations", () => {
    it("should create content via GraphQL", async () => {
      const mutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
            title
            slug
            body
            status
            version
            author {
              id
              email
            }
            tenant {
              id
              name
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: mutation,
          variables: {
            input: {
              title: "Test GraphQL Content",
              slug: "test-graphql-content",
              body: "This is test content created via GraphQL",
              status: "DRAFT",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.createContent).toBeDefined();
      expect(result.data.createContent.title).toBe("Test GraphQL Content");
      expect(result.data.createContent.author.email).toBe(testUser.email);
    });

    it("should query content with relationships", async () => {
      // First create content
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      const createResponse = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: createMutation,
          variables: {
            input: {
              title: "Test Content for Query",
              slug: "test-content-query",
              body: "Content for testing queries",
            },
          },
        },
      });

      const createResult = JSON.parse(createResponse.payload);
      const contentId = createResult.data.createContent.id;

      // Now query the content with relationships
      const query = `
        query GetContent($id: ID!) {
          content(id: $id) {
            id
            title
            slug
            body
            status
            version
            author {
              id
              email
              role
            }
            tenant {
              id
              name
              slug
            }
            versions {
              id
              version
              title
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
          variables: {
            id: contentId,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.content).toBeDefined();
      expect(result.data.content.author).toBeDefined();
      expect(result.data.content.tenant).toBeDefined();
    });

    it("should update content via GraphQL", async () => {
      // First create content
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      const createResponse = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: createMutation,
          variables: {
            input: {
              title: "Original Title",
              slug: "original-slug",
              body: "Original content",
            },
          },
        },
      });

      const createResult = JSON.parse(createResponse.payload);
      const contentId = createResult.data.createContent.id;

      // Now update the content
      const updateMutation = `
        mutation UpdateContent($id: ID!, $input: UpdateContentInput!) {
          updateContent(id: $id, input: $input) {
            id
            title
            slug
            body
            version
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: updateMutation,
          variables: {
            id: contentId,
            input: {
              title: "Updated Title",
              body: "Updated content body",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.updateContent.title).toBe("Updated Title");
      expect(result.data.updateContent.body).toBe("Updated content body");
    });

    it("should publish content via GraphQL", async () => {
      // First create content
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      const createResponse = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: createMutation,
          variables: {
            input: {
              title: "Content to Publish",
              slug: "content-to-publish",
              body: "This content will be published",
            },
          },
        },
      });

      const createResult = JSON.parse(createResponse.payload);
      const contentId = createResult.data.createContent.id;

      // Now publish the content
      const publishMutation = `
        mutation PublishContent($id: ID!) {
          publishContent(id: $id) {
            id
            status
            publishedAt
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: publishMutation,
          variables: {
            id: contentId,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.publishContent.status).toBe("PUBLISHED");
      expect(result.data.publishContent.publishedAt).toBeDefined();
    });

    it("should list contents with pagination", async () => {
      // Create multiple contents first
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      for (let i = 1; i <= 3; i++) {
        await app.inject({
          method: "POST",
          url: "/graphql",
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            query: createMutation,
            variables: {
              input: {
                title: `Test Content ${i}`,
                slug: `test-content-${i}`,
                body: `Content body ${i}`,
              },
            },
          },
        });
      }

      // Now query contents with pagination
      const query = `
        query GetContents($page: Int, $limit: Int) {
          contents(page: $page, limit: $limit) {
            id
            title
            slug
            status
            author {
              email
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
          variables: {
            page: 1,
            limit: 2,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.contents).toBeDefined();
      expect(Array.isArray(result.data.contents)).toBe(true);
      expect(result.data.contents.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Media Management Queries and Mutations", () => {
    it("should query media files", async () => {
      const query = `
        query GetMediaFiles($page: Int, $limit: Int) {
          mediaFiles(page: $page, limit: $limit) {
            id
            filename
            originalName
            mimeType
            size
            url
            uploader {
              email
            }
            tenant {
              name
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
          variables: {
            page: 1,
            limit: 10,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.mediaFiles).toBeDefined();
      expect(Array.isArray(result.data.mediaFiles)).toBe(true);
    });
  });

  describe("Search Functionality", () => {
    it("should perform search via GraphQL", async () => {
      // First create some content to search
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: createMutation,
          variables: {
            input: {
              title: "Searchable Content",
              slug: "searchable-content",
              body: "This content contains searchable keywords",
            },
          },
        },
      });

      // Now search for the content
      const searchQuery = `
        query Search($input: SearchInput!) {
          search(input: $input) {
            items {
              ... on Content {
                id
                title
                body
              }
            }
            total
            page
            limit
            hasMore
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: searchQuery,
          variables: {
            input: {
              query: "searchable",
              page: 1,
              limit: 10,
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.search).toBeDefined();
      expect(result.data.search.items).toBeDefined();
      expect(result.data.search.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Tenant Management", () => {
    it("should query tenant information", async () => {
      const query = `
        query GetTenant($id: ID!) {
          tenant(id: $id) {
            id
            name
            slug
            settings
            users {
              id
              email
            }
            contents {
              id
              title
            }
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
          variables: {
            id: testTenant.id,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.tenant).toBeDefined();
      expect(result.data.tenant.name).toBe(testTenant.name);
    });

    it("should create new tenant", async () => {
      const mutation = `
        mutation CreateTenant($input: CreateTenantInput!) {
          createTenant(input: $input) {
            id
            name
            slug
            settings
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: mutation,
          variables: {
            input: {
              name: "New Test Tenant",
              slug: "new-test-tenant",
              settings: {
                theme: "dark",
                language: "en",
              },
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.createTenant).toBeDefined();
      expect(result.data.createTenant.name).toBe("New Test Tenant");
      expect(result.data.createTenant.slug).toBe("new-test-tenant");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      const query = `
        query Me {
          me {
            id
            email
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        payload: {
          query,
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain("Authentication required");
    });

    it("should handle validation errors", async () => {
      const mutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query: mutation,
          variables: {
            input: {
              title: "", // Invalid empty title
              slug: "test-slug",
            },
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.errors).toBeDefined();
    });

    it("should handle not found errors", async () => {
      const query = `
        query GetContent($id: ID!) {
          content(id: $id) {
            id
            title
          }
        }
      `;

      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
          variables: {
            id: "non-existent-id",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.errors).toBeDefined();
    });
  });

  describe("Performance and DataLoader Tests", () => {
    it("should efficiently load related data using DataLoaders", async () => {
      // Create multiple contents to test N+1 prevention
      const createMutation = `
        mutation CreateContent($input: CreateContentInput!) {
          createContent(input: $input) {
            id
          }
        }
      `;

      const contentIds = [];
      for (let i = 1; i <= 5; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/graphql",
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            query: createMutation,
            variables: {
              input: {
                title: `Performance Test Content ${i}`,
                slug: `performance-test-${i}`,
                body: `Content ${i} for performance testing`,
              },
            },
          },
        });
        const result = JSON.parse(response.payload);
        contentIds.push(result.data.createContent.id);
      }

      // Query all contents with their authors and tenants
      const query = `
        query GetContents {
          contents(limit: 10) {
            id
            title
            author {
              id
              email
              tenant {
                id
                name
              }
            }
            tenant {
              id
              name
            }
          }
        }
      `;

      const startTime = Date.now();
      const response = await app.inject({
        method: "POST",
        url: "/graphql",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          query,
        },
      });
      const endTime = Date.now();

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.data.contents).toBeDefined();
      expect(Array.isArray(result.data.contents)).toBe(true);

      // Should complete reasonably fast with DataLoaders
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});

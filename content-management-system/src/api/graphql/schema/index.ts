/**
 * GraphQL Schema Builder
 *
 * Builds the complete GraphQL schema with all types, queries, mutations,
 * and subscriptions for the Content Management System.
 */

export const buildSchema = (): string => {
  return `
    # Scalar types
    scalar DateTime
    scalar JSON
    scalar Upload

    # User types
    type User {
      id: ID!
      email: String!
      role: String!
      tenantId: ID
      tenant: Tenant
      createdAt: DateTime!
      updatedAt: DateTime!
    }

    type AuthPayload {
      user: User!
      accessToken: String!
      refreshToken: String!
      expiresIn: Int!
    }

    # Tenant types
    type Tenant {
      id: ID!
      name: String!
      slug: String!
      settings: JSON
      users: [User!]!
      contents: [Content!]!
      createdAt: DateTime!
      updatedAt: DateTime!
    }

    # Content types
    type Content {
      id: ID!
      title: String!
      slug: String!
      body: String
      status: ContentStatus!
      version: Int!
      tenantId: ID!
      tenant: Tenant!
      authorId: ID!
      author: User!
      versions: [ContentVersion!]!
      createdAt: DateTime!
      updatedAt: DateTime!
      publishedAt: DateTime
    }

    type ContentVersion {
      id: ID!
      contentId: ID!
      content: Content!
      version: Int!
      title: String!
      body: String
      changes: JSON
      createdAt: DateTime!
    }

    enum ContentStatus {
      DRAFT
      PUBLISHED
      ARCHIVED
    }

    # Media types
    type Media {
      id: ID!
      filename: String!
      originalName: String!
      mimeType: String!
      size: Int!
      url: String!
      cdnUrl: String
      metadata: JSON
      tenantId: ID!
      tenant: Tenant!
      uploadedBy: ID!
      uploader: User!
      createdAt: DateTime!
      updatedAt: DateTime!
    }

    # Search types
    type SearchResult {
      items: [SearchItem!]!
      total: Int!
      page: Int!
      limit: Int!
      hasMore: Boolean!
    }

    union SearchItem = Content | Media | User

    # Input types
    input LoginInput {
      email: String!
      password: String!
    }

    input CreateTenantInput {
      name: String!
      slug: String!
      settings: JSON
    }

    input UpdateTenantInput {
      name: String
      settings: JSON
    }

    input CreateContentInput {
      title: String!
      slug: String!
      body: String
      status: ContentStatus = DRAFT
    }

    input UpdateContentInput {
      title: String
      slug: String
      body: String
      status: ContentStatus
    }

    input SearchInput {
      query: String!
      type: String
      filters: JSON
      page: Int = 1
      limit: Int = 20
    }

    # Root types
    type Query {
      # Authentication
      me: User

      # Tenants
      tenant(id: ID!): Tenant
      tenants(page: Int = 1, limit: Int = 20): [Tenant!]!

      # Content
      content(id: ID!, version: Int): Content
      contents(
        page: Int = 1
        limit: Int = 20
        status: ContentStatus
        authorId: ID
      ): [Content!]!
      contentVersions(contentId: ID!): [ContentVersion!]!

      # Media
      media(id: ID!): Media
      mediaFiles(
        page: Int = 1
        limit: Int = 20
        mimeType: String
      ): [Media!]!

      # Search
      search(input: SearchInput!): SearchResult!
    }

    type Mutation {
      # Authentication
      login(input: LoginInput!): AuthPayload!
      logout: Boolean!
      refreshToken(refreshToken: String!): AuthPayload!

      # Tenants
      createTenant(input: CreateTenantInput!): Tenant!
      updateTenant(id: ID!, input: UpdateTenantInput!): Tenant!
      deleteTenant(id: ID!): Boolean!

      # Content
      createContent(input: CreateContentInput!): Content!
      updateContent(id: ID!, input: UpdateContentInput!): Content!
      deleteContent(id: ID!): Boolean!
      publishContent(id: ID!): Content!
      unpublishContent(id: ID!): Content!

      # Media
      uploadMedia(file: Upload!, metadata: JSON): Media!
      deleteMedia(id: ID!): Boolean!
    }

    type Subscription {
      # Content subscriptions
      contentCreated(tenantId: ID): Content!
      contentUpdated(contentId: ID): Content!
      contentPublished(tenantId: ID): Content!

      # Media subscriptions
      mediaUploaded(tenantId: ID): Media!
    }
  `;
};

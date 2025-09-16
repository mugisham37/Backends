import { gql } from "graphql-tag";

export const contentTypeDefs = gql`
  enum ContentStatus {
    draft
    published
    archived
  }

  type ContentVersion {
    id: ID!
    version: Int!
    data: JSON!
    createdAt: DateTime!
    createdBy: User
    comment: String
  }

  type Content implements Node {
    id: ID!
    contentType: ContentType!
    data: JSON!
    status: ContentStatus!
    locale: String!
    slug: String
    publishedAt: DateTime
    publishedBy: User
    createdAt: DateTime!
    createdBy: User
    updatedAt: DateTime!
    updatedBy: User
    versions: [ContentVersion!]!
  }

  type ContentEdge implements Edge {
    cursor: String!
    node: Content!
  }

  type ContentConnection implements Connection {
    edges: [ContentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateContentInput {
    contentTypeId: ID!
    data: JSON!
    status: ContentStatus
    locale: String
    slug: String
  }

  input UpdateContentInput {
    data: JSON
    status: ContentStatus
    slug: String
    comment: String
  }

  input ContentFilterInput {
    contentTypeId: ID
    status: ContentStatus
    locale: String
    search: String
    createdBy: ID
    updatedBy: ID
    publishedBy: ID
    createdAt: DateRangeInput
    updatedAt: DateRangeInput
    publishedAt: DateRangeInput
  }

  input DateRangeInput {
    from: DateTime
    to: DateTime
  }

  input ContentSortInput {
    field: String!
    direction: SortDirection!
  }

  extend type Query {
    contents(
      filter: ContentFilterInput
      sort: ContentSortInput
      pagination: PaginationInput
    ): ContentConnection!
    
    content(id: ID!): Content
    
    contentBySlug(contentTypeId: ID!, slug: String!, locale: String): Content
    
    contentVersion(contentId: ID!, versionId: ID!): ContentVersion
  }

  extend type Mutation {
    createContent(input: CreateContentInput!): Content!
    
    updateContent(id: ID!, input: UpdateContentInput!): Content!
    
    deleteContent(id: ID!): Boolean!
    
    publishContent(id: ID!, scheduledAt: DateTime): Content!
    
    unpublishContent(id: ID!): Content!
    
    archiveContent(id: ID!): Content!
    
    restoreVersion(contentId: ID!, versionId: ID!): Content!
  }
`;

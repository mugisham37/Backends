import { gql } from "graphql-tag";

export const mediaTypeDefs = gql`
  enum MediaType {
    image
    video
    document
    audio
    other
  }

  type MediaMetadata {
    width: Int
    height: Int
    size: Int
    duration: Float
    format: String
    pages: Int
  }

  type Media implements Node {
    id: ID!
    filename: String!
    originalFilename: String!
    mimeType: String!
    type: MediaType!
    size: Int!
    url: String!
    thumbnailUrl: String
    metadata: MediaMetadata
    alt: String
    title: String
    description: String
    tags: [String!]
    folder: String
    createdAt: DateTime!
    createdBy: User
    updatedAt: DateTime!
  }

  type MediaEdge implements Edge {
    cursor: String!
    node: Media!
  }

  type MediaConnection implements Connection {
    edges: [MediaEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input MediaFilterInput {
    type: MediaType
    search: String
    mimeType: String
    folder: String
    tags: [String!]
    createdBy: ID
    createdAt: DateRangeInput
  }

  input MediaSortInput {
    field: String!
    direction: SortDirection!
  }

  input UpdateMediaInput {
    alt: String
    title: String
    description: String
    tags: [String!]
    folder: String
  }

  extend type Query {
    media(
      filter: MediaFilterInput
      sort: MediaSortInput
      pagination: PaginationInput
    ): MediaConnection!
    
    mediaItem(id: ID!): Media
  }

  extend type Mutation {
    uploadMedia(file: Upload!, folder: String, metadata: JSON): Media!
    
    updateMedia(id: ID!, input: UpdateMediaInput!): Media!
    
    deleteMedia(id: ID!): Boolean!
    
    createFolder(name: String!, parentFolder: String): String!
    
    deleteFolder(path: String!): Boolean!
  }
`;

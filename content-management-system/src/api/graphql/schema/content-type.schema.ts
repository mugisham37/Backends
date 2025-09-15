import { gql } from "graphql-tag"

export const contentTypeTypeDefs = gql`
  enum FieldType {
    string
    text
    richText
    number
    boolean
    date
    datetime
    email
    url
    image
    file
    reference
    json
    array
  }

  type FieldValidation {
    required: Boolean
    unique: Boolean
    min: Float
    max: Float
    minLength: Int
    maxLength: Int
    pattern: String
    enum: [String!]
  }

  type Field {
    id: ID!
    name: String!
    displayName: String!
    type: FieldType!
    description: String
    validation: FieldValidation
    defaultValue: JSON
    isSystem: Boolean!
    isLocalized: Boolean!
    settings: JSON
  }

  type ContentType implements Node {
    id: ID!
    name: String!
    displayName: String!
    description: String
    fields: [Field!]!
    isSystem: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ContentTypeEdge implements Edge {
    cursor: String!
    node: ContentType!
  }

  type ContentTypeConnection implements Connection {
    edges: [ContentTypeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input FieldValidationInput {
    required: Boolean
    unique: Boolean
    min: Float
    max: Float
    minLength: Int
    maxLength: Int
    pattern: String
    enum: [String!]
  }

  input FieldInput {
    name: String!
    displayName: String!
    type: FieldType!
    description: String
    validation: FieldValidationInput
    defaultValue: JSON
    isLocalized: Boolean
    settings: JSON
  }

  input CreateContentTypeInput {
    name: String!
    displayName: String!
    description: String
    fields: [FieldInput!]!
  }

  input UpdateContentTypeInput {
    displayName: String
    description: String
    fields: [FieldInput!]
  }

  input ContentTypeFilterInput {
    search: String
    isSystem: Boolean
  }

  input ContentTypeSortInput {
    field: String!
    direction: SortDirection!
  }

  extend type Query {
    contentTypes(
      filter: ContentTypeFilterInput
      sort: ContentTypeSortInput
      pagination: PaginationInput
    ): ContentTypeConnection!
    
    contentType(id: ID!): ContentType
  }

  extend type Mutation {
    createContentType(input: CreateContentTypeInput!): ContentType!
    
    updateContentType(id: ID!, input: UpdateContentTypeInput!): ContentType!
    
    deleteContentType(id: ID!): Boolean!
    
    addField(contentTypeId: ID!, field: FieldInput!): ContentType!
    
    updateField(contentTypeId: ID!, fieldId: ID!, field: FieldInput!): ContentType!
    
    removeField(contentTypeId: ID!, fieldId: ID!): ContentType!
  }
`

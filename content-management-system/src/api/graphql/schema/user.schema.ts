import { gql } from "graphql-tag";

export const userTypeDefs = gql`
  enum UserRole {
    admin
    editor
    author
    viewer
  }

  type User implements Node {
    id: ID!
    email: String!
    firstName: String!
    lastName: String!
    fullName: String!
    role: UserRole!
    isActive: Boolean!
    lastLogin: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type UserEdge implements Edge {
    cursor: String!
    node: User!
  }

  type UserConnection implements Connection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateUserInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    role: UserRole
  }

  input UpdateUserInput {
    email: String
    firstName: String
    lastName: String
    role: UserRole
    isActive: Boolean
  }

  input UserFilterInput {
    search: String
    role: UserRole
    isActive: Boolean
  }

  input UserSortInput {
    field: String!
    direction: SortDirection!
  }

  extend type Query {
    users(
      filter: UserFilterInput
      sort: UserSortInput
      pagination: PaginationInput
    ): UserConnection!
    
    user(id: ID!): User
    
    me: User
  }

  extend type Mutation {
    createUser(input: CreateUserInput!): User!
    
    updateUser(id: ID!, input: UpdateUserInput!): User!
    
    deleteUser(id: ID!): Boolean!
    
    changePassword(currentPassword: String!, newPassword: String!): Boolean!
  }
`;

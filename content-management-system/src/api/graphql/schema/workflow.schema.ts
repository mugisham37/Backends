import { gql } from "graphql-tag"

export const workflowTypeDefs = gql`
  enum WorkflowStepType {
    review
    approval
    custom
  }

  type WorkflowStep {
    id: ID!
    name: String!
    description: String
    type: WorkflowStepType!
    roles: [UserRole!]!
    isRequired: Boolean!
    order: Int!
  }

  type Workflow implements Node {
    id: ID!
    name: String!
    description: String
    contentTypes: [ContentType!]!
    steps: [WorkflowStep!]!
    isDefault: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WorkflowEdge implements Edge {
    cursor: String!
    node: Workflow!
  }

  type WorkflowConnection implements Connection {
    edges: [WorkflowEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  enum WorkflowEntryStatus {
    inProgress
    approved
    rejected
    canceled
  }

  type WorkflowStepEntry {
    id: ID!
    step: WorkflowStep!
    status: WorkflowEntryStatus!
    assignedTo: [User!]
    completedBy: User
    completedAt: DateTime
    comments: String
    createdAt: DateTime!
  }

  type WorkflowEntry implements Node {
    id: ID!
    workflow: Workflow!
    content: Content!
    status: WorkflowEntryStatus!
    currentStep: WorkflowStep
    steps: [WorkflowStepEntry!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WorkflowEntryEdge implements Edge {
    cursor: String!
    node: WorkflowEntry!
  }

  type WorkflowEntryConnection implements Connection {
    edges: [WorkflowEntryEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input WorkflowStepInput {
    name: String!
    description: String
    type: WorkflowStepType!
    roles: [UserRole!]!
    isRequired: Boolean!
    order: Int!
  }

  input CreateWorkflowInput {
    name: String!
    description: String
    contentTypeIds: [ID!]!
    steps: [WorkflowStepInput!]!
    isDefault: Boolean
  }

  input UpdateWorkflowInput {
    name: String
    description: String
    contentTypeIds: [ID!]
    steps: [WorkflowStepInput!]
    isDefault: Boolean
  }

  input WorkflowFilterInput {
    search: String
    contentTypeId: ID
    isDefault: Boolean
  }

  input WorkflowEntryFilterInput {
    workflowId: ID
    contentId: ID
    status: WorkflowEntryStatus
    assignedTo: ID
  }

  extend type Query {
    workflows(
      filter: WorkflowFilterInput
      pagination: PaginationInput
    ): WorkflowConnection!
    
    workflow(id: ID!): Workflow
    
    workflowEntries(
      filter: WorkflowEntryFilterInput
      pagination: PaginationInput
    ): WorkflowEntryConnection!
    
    workflowEntry(id: ID!): WorkflowEntry
  }

  extend type Mutation {
    createWorkflow(input: CreateWorkflowInput!): Workflow!
    
    updateWorkflow(id: ID!, input: UpdateWorkflowInput!): Workflow!
    
    deleteWorkflow(id: ID!): Boolean!
    
    startWorkflow(contentId: ID!, workflowId: ID): WorkflowEntry!
    
    completeWorkflowStep(
      entryId: ID!,
      stepId: ID!,
      approve: Boolean!,
      comments: String
    ): WorkflowEntry!
    
    assignWorkflowStep(
      entryId: ID!,
      stepId: ID!,
      userIds: [ID!]!
    ): WorkflowEntry!
    
    cancelWorkflow(entryId: ID!): WorkflowEntry!
  }
`

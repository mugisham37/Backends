import { gql } from "graphql-tag";

export const webhookTypeDefs = gql`
  enum WebhookEvent {
    content_created
    content_updated
    content_deleted
    content_published
    content_unpublished
    content_archived
    media_uploaded
    media_updated
    media_deleted
    user_created
    user_updated
    user_deleted
    workflow_started
    workflow_completed
    workflow_step_completed
  }

  enum WebhookStatus {
    active
    inactive
  }

  type WebhookDelivery {
    id: ID!
    timestamp: DateTime!
    success: Boolean!
    statusCode: Int
    request: String!
    response: String
    error: String
  }

  type Webhook implements Node {
    id: ID!
    name: String!
    url: String!
    secret: String
    events: [WebhookEvent!]!
    status: WebhookStatus!
    contentTypeIds: [ID!]
    deliveries(last: Int): [WebhookDelivery!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type WebhookEdge implements Edge {
    cursor: String!
    node: Webhook!
  }

  type WebhookConnection implements Connection {
    edges: [WebhookEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input CreateWebhookInput {
    name: String!
    url: String!
    secret: String
    events: [WebhookEvent!]!
    contentTypeIds: [ID!]
    status: WebhookStatus
  }

  input UpdateWebhookInput {
    name: String
    url: String
    secret: String
    events: [WebhookEvent!]
    contentTypeIds: [ID!]
    status: WebhookStatus
  }

  input WebhookFilterInput {
    search: String
    event: WebhookEvent
    status: WebhookStatus
    contentTypeId: ID
  }

  extend type Query {
    webhooks(
      filter: WebhookFilterInput
      pagination: PaginationInput
    ): WebhookConnection!
    
    webhook(id: ID!): Webhook
    
    webhookDeliveries(webhookId: ID!, last: Int): [WebhookDelivery!]!
  }

  extend type Mutation {
    createWebhook(input: CreateWebhookInput!): Webhook!
    
    updateWebhook(id: ID!, input: UpdateWebhookInput!): Webhook!
    
    deleteWebhook(id: ID!): Boolean!
    
    testWebhook(id: ID!): WebhookDelivery!
    
    retryWebhookDelivery(deliveryId: ID!): WebhookDelivery!
  }
`;

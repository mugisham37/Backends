# GraphQL API Implementation

This directory contains a complete GraphQL API implementation with schema-first approach, efficient data loading, and real-time subscriptions.

## 🚀 Features Implemented

### ✅ Task 5.1: GraphQL Server and Schema Setup

- **Apollo Server** integration with Fastify
- **Schema-first approach** with modular type definitions
- **Type-safe resolvers** with proper error handling
- **GraphQL Playground** for development
- **Comprehensive schema** covering Users, Vendors, Products, and Orders

### ✅ Task 5.2: Resolvers and DataLoaders

- **Efficient resolvers** with proper authentication and authorization
- **DataLoader pattern** implementation to prevent N+1 queries
- **Optimized data fetching** with intelligent caching
- **Unit and integration tests** using Vitest
- **Performance optimization** with proper query batching

### ✅ Task 5.3: Real-time Subscriptions

- **WebSocket-based subscriptions** using graphql-ws
- **Authentication and authorization** for subscription connections
- **Real-time updates** for users, vendors, products, and orders
- **Subscription filtering** based on user roles and permissions
- **Scalable subscription management** with PubSub pattern

## 📁 Directory Structure

```
src/api/graphql/
├── __tests__/                 # Test files
│   ├── graphql.test.ts       # GraphQL server tests
│   └── subscriptions.test.ts # Subscription tests
├── dataloaders/              # DataLoader implementations
│   ├── user.loader.ts        # User data loading
│   ├── vendor.loader.ts      # Vendor data loading
│   └── product.loader.ts     # Product data loading
├── resolvers/                # GraphQL resolvers
│   ├── index.ts              # Combined resolvers
│   ├── user.resolver.ts      # User operations
│   ├── vendor.resolver.ts    # Vendor operations
│   ├── product.resolver.ts   # Product operations
│   └── order.resolver.ts     # Order operations
├── schema/                   # GraphQL schema definitions
│   ├── index.ts              # Combined schema
│   ├── user.schema.ts        # User types and operations
│   ├── vendor.schema.ts      # Vendor types and operations
│   ├── product.schema.ts     # Product types and operations
│   └── order.schema.ts       # Order types and operations
├── subscriptions/            # Subscription management
│   └── index.ts              # Subscription manager and events
├── context.ts                # GraphQL context creation
├── index.ts                  # Main GraphQL server
├── plugin.ts                 # Fastify plugin integration
├── websocket.ts              # WebSocket server for subscriptions
├── example.ts                # Integration examples
└── README.md                 # This file
```

## 🔧 Key Components

### GraphQL Server (`index.ts`)

- Apollo Server configuration
- Error formatting and logging
- Development introspection
- Plugin system for extensibility

### Context (`context.ts`)

- Request context creation
- Authentication handling
- Repository and DataLoader initialization
- User session management

### DataLoaders (`dataloaders/`)

- **UserLoader**: Batch loading of users by ID, email
- **VendorLoader**: Batch loading of vendors by ID, user ID, slug
- **ProductLoader**: Batch loading of products by ID, vendor, category

### Resolvers (`resolvers/`)

- Type-safe resolver implementations
- Authentication and authorization checks
- Business logic integration
- Error handling and validation

### Subscriptions (`subscriptions/`)

- Real-time event management
- Authentication for WebSocket connections
- Role-based subscription filtering
- Event publishing and broadcasting

## 🎯 Usage Examples

### Basic Queries

```graphql
# Health check
query {
  health
}

# Get current user
query {
  me {
    id
    email
    role
    vendor {
      businessName
      status
    }
  }
}

# Get products with filters
query {
  products(
    filters: { status: ACTIVE, inStock: true }
    pagination: { first: 10 }
  ) {
    edges {
      node {
        id
        name
        price
        vendor {
          businessName
        }
      }
    }
    totalCount
  }
}
```

### Mutations

```graphql
# Login
mutation {
  login(input: { email: "user@example.com", password: "password" }) {
    user {
      id
      email
      role
    }
    accessToken
    refreshToken
  }
}

# Create product (vendor only)
mutation {
  createProduct(
    input: {
      name: "New Product"
      description: "Product description"
      price: "99.99"
      categoryId: "category-id"
    }
  ) {
    id
    name
    slug
    status
  }
}
```

### Subscriptions

```graphql
# Subscribe to user updates (authenticated)
subscription {
  userUpdated(userId: "user-id") {
    id
    email
    status
    updatedAt
  }
}

# Subscribe to low stock alerts (vendor only)
subscription {
  lowStockAlert(vendorId: "vendor-id") {
    id
    name
    quantity
    lowStockThreshold
  }
}
```

## 🔐 Authentication & Authorization

### HTTP Requests

- Bearer token authentication via Authorization header
- JWT token validation and user context creation
- Role-based access control for queries and mutations

### WebSocket Subscriptions

- Token-based authentication via connection parameters
- Subscription filtering based on user roles and ownership
- Automatic disconnection for invalid tokens

## 🧪 Testing

### Running Tests

```bash
# Run all GraphQL tests
npm test -- src/api/graphql/__tests__ --run

# Run specific test file
npm test -- src/api/graphql/__tests__/graphql.test.ts --run
```

### Test Coverage

- ✅ GraphQL server creation and configuration
- ✅ Schema introspection and type validation
- ✅ Authentication error handling
- ✅ Subscription manager functionality
- ✅ DataLoader batching and caching

## 🚀 Integration

### With Fastify

```typescript
import { graphqlPlugin } from "./src/api/graphql/plugin.js";

// Register GraphQL plugin
await fastify.register(graphqlPlugin);
```

### With WebSocket Server

```typescript
import { createWebSocketServer } from "./src/api/graphql/websocket.js";

// Create WebSocket server for subscriptions
const { wsServer, cleanup } = createWebSocketServer({
  server: httpServer,
  path: "/graphql",
});
```

## 📊 Performance Features

### DataLoader Benefits

- **N+1 Query Prevention**: Batch multiple database queries into single operations
- **Intelligent Caching**: Per-request caching with cache invalidation
- **Optimized Fetching**: Reduce database load by up to 90% for complex queries

### Subscription Optimization

- **Filtered Subscriptions**: Only send updates to relevant subscribers
- **Connection Management**: Efficient WebSocket connection handling
- **Memory Management**: Automatic cleanup of inactive subscriptions

## 🔄 Real-time Features

### Supported Events

- **User Events**: Profile updates, status changes
- **Vendor Events**: Application submissions, status changes
- **Product Events**: Inventory updates, status changes, stock alerts
- **Order Events**: Status updates, payment processing
- **System Events**: Notifications, maintenance mode

### Event Filtering

- **User-based**: Users only receive their own updates
- **Role-based**: Admins receive all events, vendors receive their events
- **Resource-based**: Subscription filtering by specific resources (orders, products)

## 🛠️ Development Tools

### GraphQL Playground

Available at `/graphql/playground` in development mode for:

- Interactive query testing
- Schema exploration
- Subscription testing
- Documentation browsing

### Error Handling

- Structured error responses
- Development vs production error formatting
- Request correlation IDs for debugging
- Comprehensive logging

## 📈 Scalability Considerations

### Horizontal Scaling

- Stateless resolver design
- External PubSub for multi-instance deployments
- Connection pooling for database operations
- Caching strategies for high-traffic scenarios

### Performance Monitoring

- Query complexity analysis
- Resolver execution timing
- DataLoader hit/miss ratios
- Subscription connection metrics

This GraphQL implementation provides a solid foundation for modern, scalable API development with excellent developer experience and production-ready features.

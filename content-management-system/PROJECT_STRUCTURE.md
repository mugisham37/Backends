# Content Management System - Detailed Project Structure

## Project Overview

This is a **modern, high-performance content management system** built with senior-level architecture and best practices. The project implements a comprehensive backend solution with dual API support (REST and GraphQL), multi-tenancy, caching, background jobs, and real-time capabilities.

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Fastify (3x better performance than Express)
- **Language**: TypeScript (strict mode with 100% type coverage)
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis with Bull Queue
- **Testing**: Vitest with coverage
- **Linting**: Biome (replaces ESLint + Prettier)
- **Validation**: Zod for runtime type safety
- **DI Container**: tsyringe
- **API**: REST + GraphQL with Mercurius

## Complete Project Structure

```
content-management-system/
├── 📄 .env                          # Environment variables (local)
├── 📄 .env.example                  # Environment variables template
├── 📄 .gitignore                    # Git ignore rules
├── 📄 biome.json                    # Biome configuration (linting & formatting)
├── 📄 cspell.json                   # Spell checker configuration
├── 📄 drizzle.config.ts             # Drizzle ORM configuration
├── 📄 package.json                  # Project dependencies and scripts
├── 📄 package-lock.json             # Lockfile for exact dependency versions
├── 📄 README.md                     # Project documentation
├── 📄 tsconfig.json                 # TypeScript configuration
├── 📄 vitest.config.ts              # Test configuration
│
├── 📁 dist/                         # Compiled JavaScript output (build artifacts)
│   ├── 📄 app.d.ts                  # Type declarations for app
│   ├── 📄 app.d.ts.map              # Source map for app declarations
│   ├── 📄 app.js                    # Compiled app JavaScript
│   ├── 📄 app.js.map                # Source map for app
│   ├── 📄 server.d.ts               # Type declarations for server
│   ├── 📄 server.d.ts.map           # Source map for server declarations
│   ├── 📄 server.js                 # Compiled server JavaScript
│   ├── 📄 server.js.map             # Source map for server
│   ├── 📁 api/                      # Compiled API modules
│   ├── 📁 core/                     # Compiled core modules
│   ├── 📁 modules/                  # Compiled feature modules
│   └── 📁 shared/                   # Compiled shared modules
│
├── 📁 node_modules/                 # Dependencies (excluded from documentation)
│
├── 📁 scripts/                      # Utility scripts
│   ├── 📄 migrate.ts                # Database migration script
│   └── 📄 optimize-performance.ts   # Performance optimization script
│
└── 📁 src/                          # Source code
    ├── 📄 app.ts                    # Main application setup
    ├── 📄 server.ts                 # Server entry point
    │
    ├── 📁 api/                      # API layer
    │   ├── 📄 gateway.ts             # API gateway configuration
    │   │
    │   ├── 📁 graphql/              # GraphQL API implementation
    │   │   ├── 📄 context.ts        # GraphQL context setup
    │   │   ├── 📄 index.ts          # GraphQL module exports
    │   │   ├── 📄 plugin.ts         # GraphQL Fastify plugin
    │   │   │
    │   │   ├── 📁 dataloaders/      # DataLoader implementations
    │   │   │   └── 📄 index.ts      # DataLoader exports
    │   │   │
    │   │   ├── 📁 resolvers/        # GraphQL resolvers
    │   │   │   ├── 📄 index.ts      # Resolver exports
    │   │   │   ├── 📄 auth.resolvers.ts          # Authentication resolvers
    │   │   │   ├── 📄 content.resolvers.ts       # Content resolvers
    │   │   │   ├── 📄 content-type.resolvers.ts  # Content type resolvers
    │   │   │   ├── 📄 media.resolvers.ts         # Media resolvers
    │   │   │   ├── 📄 search.resolvers.ts        # Search resolvers
    │   │   │   ├── 📄 tenant.resolvers.ts        # Tenant resolvers
    │   │   │   ├── 📄 user.resolvers.ts          # User resolvers
    │   │   │   ├── 📄 webhook.resolvers.ts       # Webhook resolvers
    │   │   │   └── 📄 workflow.resolvers.ts      # Workflow resolvers
    │   │   │
    │   │   └── 📁 schema/           # GraphQL schemas
    │   │       ├── 📄 index.ts      # Schema exports
    │   │       ├── 📄 content.schema.ts          # Content schema
    │   │       ├── 📄 content-type.schema.ts     # Content type schema
    │   │       ├── 📄 media.schema.ts            # Media schema
    │   │       ├── 📄 user.schema.ts             # User schema
    │   │       ├── 📄 webhook.schema.ts          # Webhook schema
    │   │       └── 📄 workflow.schema.ts         # Workflow schema
    │   │
    │   └── 📁 rest/                 # REST API implementation
    │       ├── 📄 index.ts          # REST module exports
    │       ├── 📄 plugin.ts         # REST Fastify plugin
    │       │
    │       └── 📁 routes/           # REST route definitions
    │           ├── 📄 audit.routes.ts         # Audit trail routes
    │           ├── 📄 auth.routes.ts          # Authentication routes
    │           ├── 📄 content.routes.ts       # Content management routes
    │           ├── 📄 health.routes.ts        # Health check routes
    │           ├── 📄 media.routes.ts         # Media management routes
    │           ├── 📄 performance.routes.ts   # Performance monitoring routes
    │           ├── 📄 search.routes.ts        # Search functionality routes
    │           ├── 📄 tenant.routes.ts        # Multi-tenant routes
    │           └── 📄 webhook.routes.ts       # Webhook management routes
    │
    ├── 📁 core/                     # Core system components
    │   │
    │   ├── 📁 container/            # Dependency injection container
    │   │   ├── 📄 bootstrap.ts      # Container bootstrapping
    │   │   ├── 📄 decorators.ts     # DI decorators
    │   │   ├── 📄 index.ts          # Container exports
    │   │   ├── 📄 registry.ts       # Service registry
    │   │   └── 📄 test-container.ts # Test container setup
    │   │
    │   ├── 📁 database/             # Database layer
    │   │   ├── 📄 connection.ts     # Database connection setup
    │   │   ├── 📄 index.ts          # Database exports
    │   │   ├── 📄 migrator.ts       # Migration management
    │   │   ├── 📄 query-optimizer.ts # Query optimization
    │   │   ├── 📄 setup.ts          # Database setup
    │   │   │
    │   │   ├── 📁 migrations/       # Database migrations
    │   │   │   ├── 📄 0000_loving_puck.sql                # Initial migration
    │   │   │   ├── 📄 0001_performance_optimization.sql   # Performance optimization
    │   │   │   │
    │   │   │   └── 📁 meta/         # Migration metadata
    │   │   │       ├── 📄 0000_snapshot.json  # Migration snapshot
    │   │   │       └── 📄 _journal.json       # Migration journal
    │   │   │
    │   │   └── 📁 schema/           # Database schemas
    │   │       ├── 📄 index.ts      # Schema exports
    │   │       ├── 📄 auth.schema.ts     # Authentication schema
    │   │       ├── 📄 content.schema.ts  # Content schema
    │   │       ├── 📄 media.schema.ts    # Media schema
    │   │       └── 📄 tenant.schema.ts   # Tenant schema
    │   │
    │   ├── 📁 decorators/           # System decorators
    │   │   ├── 📄 auth.decorator.ts      # Authentication decorator
    │   │   ├── 📄 cache.decorator.ts     # Caching decorator
    │   │   ├── 📄 index.ts               # Decorator exports
    │   │   └── 📄 validate.decorator.ts  # Validation decorator
    │   │
    │   ├── 📁 errors/               # Error handling
    │   │   ├── 📄 auth.error.ts          # Authentication errors
    │   │   ├── 📄 base.error.ts          # Base error class
    │   │   ├── 📄 business.error.ts      # Business logic errors
    │   │   ├── 📄 database.error.ts      # Database errors
    │   │   ├── 📄 index.ts               # Error exports
    │   │   ├── 📄 not-found.error.ts     # Not found errors
    │   │   └── 📄 validation.error.ts    # Validation errors
    │   │
    │   ├── 📁 repositories/         # Repository pattern implementation
    │   │   ├── 📄 base.repository.ts           # Base repository class
    │   │   ├── 📄 index.ts                     # Repository exports
    │   │   ├── 📄 repository.registry.ts      # Repository registry
    │   │   ├── 📄 soft-delete-base.repository.ts  # Soft delete repository
    │   │   └── 📄 tenant-base.repository.ts    # Tenant-aware repository
    │   │
    │   └── 📁 types/                # Core type definitions
    │       ├── 📄 api.types.ts       # API type definitions
    │       ├── 📄 database.types.ts  # Database type definitions
    │       ├── 📄 index.ts           # Type exports
    │       ├── 📄 result.types.ts    # Result type definitions
    │       └── 📄 service.types.ts   # Service type definitions
    │
    ├── 📁 modules/                  # Feature modules
    │   ├── 📄 index.ts              # Module exports
    │   │
    │   ├── 📁 audit/                # Audit trail module
    │   │   ├── 📄 audit.controller.ts  # Audit HTTP controller
    │   │   ├── 📄 audit.service.ts     # Audit business logic
    │   │   ├── 📄 audit.types.ts       # Audit type definitions
    │   │   └── 📄 index.ts              # Audit module exports
    │   │
    │   ├── 📁 auth/                 # Authentication module
    │   │   ├── 📄 auth.controller.ts  # Auth HTTP controller
    │   │   ├── 📄 auth.repository.ts  # Auth data access
    │   │   ├── 📄 auth.schemas.ts     # Auth validation schemas
    │   │   ├── 📄 auth.service.ts     # Auth business logic
    │   │   ├── 📄 auth.types.ts       # Auth type definitions
    │   │   ├── 📄 index.ts            # Auth module exports
    │   │   └── 📄 user.schemas.ts     # User validation schemas
    │   │
    │   ├── 📁 cache/                # Caching module
    │   │   ├── 📄 cache.service.ts   # Cache management service
    │   │   ├── 📄 cache.types.ts     # Cache type definitions
    │   │   └── 📄 index.ts           # Cache module exports
    │   │
    │   ├── 📁 content/              # Content management module
    │   │   ├── 📄 content.controller.ts  # Content HTTP controller
    │   │   ├── 📄 content.repository.ts  # Content data access
    │   │   ├── 📄 content.schemas.ts     # Content validation schemas
    │   │   ├── 📄 content.service.ts     # Content business logic
    │   │   ├── 📄 content.types.ts       # Content type definitions
    │   │   └── 📄 index.ts               # Content module exports
    │   │
    │   ├── 📁 media/                # Media management module
    │   │   ├── 📄 index.ts              # Media module exports
    │   │   ├── 📄 media.controller.ts   # Media HTTP controller
    │   │   ├── 📄 media.repository.ts   # Media data access
    │   │   ├── 📄 media.schemas.ts      # Media validation schemas
    │   │   ├── 📄 media.service.ts      # Media business logic
    │   │   └── 📄 media.types.ts        # Media type definitions
    │   │
    │   ├── 📁 search/               # Search functionality module
    │   │   ├── 📄 index.ts              # Search module exports
    │   │   ├── 📄 search.controller.ts  # Search HTTP controller
    │   │   ├── 📄 search.service.ts     # Search business logic
    │   │   └── 📄 search.types.ts       # Search type definitions
    │   │
    │   ├── 📁 tenant/               # Multi-tenancy module
    │   │   ├── 📄 index.ts              # Tenant module exports
    │   │   ├── 📄 tenant.controller.ts  # Tenant HTTP controller
    │   │   ├── 📄 tenant.repository.ts  # Tenant data access
    │   │   ├── 📄 tenant.schemas.ts     # Tenant validation schemas
    │   │   ├── 📄 tenant.service.ts     # Tenant business logic
    │   │   └── 📄 tenant.types.ts       # Tenant type definitions
    │   │
    │   └── 📁 webhook/              # Webhook management module
    │       ├── 📄 index.ts              # Webhook module exports
    │       ├── 📄 webhook.controller.ts # Webhook HTTP controller
    │       ├── 📄 webhook.schemas.ts    # Webhook validation schemas
    │       ├── 📄 webhook.service.ts    # Webhook business logic
    │       └── 📄 webhook.types.ts      # Webhook type definitions
    │
    └── 📁 shared/                   # Shared utilities and components
        ├── 📄 index.ts              # Shared exports
        │
        ├── 📁 config/               # Configuration management
        │   └── 📄 index.ts          # Config exports
        │
        ├── 📁 middleware/           # Fastify middleware
        │   ├── 📄 api-key.middleware.ts      # API key authentication
        │   ├── 📄 audit.middleware.ts        # Audit logging middleware
        │   ├── 📄 auth.ts                    # Authentication middleware
        │   ├── 📄 compression-security.ts   # Compression & security
        │   ├── 📄 error-handler.ts          # Error handling middleware
        │   ├── 📄 fastify-auth.ts           # Fastify auth integration
        │   ├── 📄 monitoring.middleware.ts  # Monitoring middleware
        │   ├── 📄 rate-limit.ts             # Rate limiting middleware
        │   ├── 📄 tenant.middleware.ts      # Tenant resolution middleware
        │   ├── 📄 validate-request.ts       # Request validation
        │   ├── 📄 validation.ts             # Input validation
        │   └── 📄 zod-validation.ts         # Zod validation integration
        │
        ├── 📁 utils/                # Utility functions
        │   ├── 📄 errors.ts         # Error utilities
        │   └── 📄 logger.ts         # Logging utilities
        │
        └── 📁 validators/           # Validation schemas
            ├── 📄 common.schemas.ts # Common validation schemas
            └── 📄 index.ts          # Validator exports
```

## Architectural Analysis

### 🏗️ Architecture Patterns

1. **Clean Architecture**: Clear separation of concerns with core, modules, and shared layers
2. **Repository Pattern**: Data access abstraction in `core/repositories`
3. **Dependency Injection**: Using tsyringe for IoC container management
4. **Module Pattern**: Feature-based organization in `modules/`
5. **Middleware Chain**: Comprehensive middleware stack for cross-cutting concerns

### 🔧 Core Components

#### Database Layer (`core/database/`)
- **Drizzle ORM**: Type-safe database operations
- **Migration System**: Version-controlled schema changes
- **Query Optimization**: Performance optimization utilities
- **Multi-tenant Support**: Tenant-aware database operations

#### Error Handling (`core/errors/`)
- **Hierarchical Errors**: Structured error inheritance
- **Business Logic Errors**: Domain-specific error handling
- **Validation Errors**: Input validation error management

#### Repository Layer (`core/repositories/`)
- **Base Repository**: Common CRUD operations
- **Soft Delete**: Logical deletion support
- **Tenant Isolation**: Multi-tenant data separation

### 🚀 API Layer (`api/`)

#### Dual API Support
- **REST API**: Traditional HTTP endpoints with route-based organization
- **GraphQL API**: Query-based API with resolvers and schemas
- **API Gateway**: Unified entry point for both APIs

#### Features
- **Authentication**: JWT-based auth with middleware
- **Rate Limiting**: Request throttling and abuse prevention
- **Validation**: Input validation using Zod schemas
- **Documentation**: Auto-generated API documentation

### 📦 Feature Modules (`modules/`)

Each module follows a consistent structure:
- **Controller**: HTTP request handling
- **Service**: Business logic implementation
- **Repository**: Data access layer
- **Types**: TypeScript type definitions
- **Schemas**: Validation schemas

#### Key Modules
1. **Auth**: User authentication and authorization
2. **Content**: Content management and publishing
3. **Media**: File upload and media management
4. **Tenant**: Multi-tenancy support
5. **Webhook**: Event-driven integrations
6. **Search**: Full-text search capabilities
7. **Audit**: Activity logging and compliance
8. **Cache**: Redis-based caching layer

### 🛠️ Development Tools

#### Code Quality
- **Biome**: Lightning-fast linting and formatting (replaces ESLint + Prettier)
- **TypeScript**: Strict mode with comprehensive type checking
- **Vitest**: Modern testing framework with coverage

#### Database Tools
- **Drizzle Kit**: Schema generation and migration tools
- **Migration Scripts**: Custom migration utilities

#### Performance
- **Query Optimization**: Database performance tuning
- **Caching Strategy**: Multi-layer caching implementation
- **Monitoring**: Performance monitoring and metrics

### 🔐 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: DDoS protection
- **Input Validation**: Comprehensive input sanitization
- **API Key Management**: Secure API access
- **Tenant Isolation**: Multi-tenant security

### 📊 Key Metrics

- **Total Files**: 270+ TypeScript files
- **Modules**: 8 feature modules
- **API Endpoints**: REST + GraphQL coverage
- **Test Coverage**: 95% requirement
- **Type Safety**: 100% TypeScript coverage

### 🚦 Getting Started

#### Available Scripts
```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage

# Code Quality
npm run lint         # Check code quality
npm run lint:fix     # Fix linting issues
npm run format       # Format code
npm run typecheck    # Check TypeScript types

# Database
npm run db:generate  # Generate database schema
npm run db:migrate   # Run migrations
npm run db:studio    # Open database studio

# Migration Management
npm run migrate      # Run custom migration script
npm run migrate:up   # Apply migrations
npm run migrate:status # Check migration status
npm run migrate:reset  # Reset database
npm run migrate:validate # Validate migrations

# Performance
npm run optimize     # Run performance optimization
npm run performance:check # Check performance metrics
npm run db:optimize  # Optimize database
```

### 📈 Performance Characteristics

- **Framework**: Fastify (3x faster than Express)
- **Database**: PostgreSQL with optimized queries
- **Caching**: Redis for session and data caching
- **TypeScript**: Compiled JavaScript for production
- **Monitoring**: Built-in performance monitoring

This content management system represents a production-ready, enterprise-grade backend solution with modern architectural patterns, comprehensive testing, and scalable design principles.
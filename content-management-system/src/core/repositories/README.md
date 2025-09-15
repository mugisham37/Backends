# Repository Pattern Implementation

This directory contains the repository pattern implementation using Drizzle ORM for type-safe database operations.

## Architecture

The repository pattern provides a clean abstraction layer between the business logic and data access layer. Our implementation includes:

### Base Repository Classes

1. **BaseRepository** - Core CRUD operations for all entities
2. **TenantBaseRepository** - Extends BaseRepository with tenant-scoped operations
3. **SoftDeleteBaseRepository** - Extends BaseRepository with soft delete functionality

### Specific Repository Implementations

1. **UserRepository** - User management with authentication methods
2. **TenantRepository** - Multi-tenancy management
3. **ContentRepository** - Content management with versioning
4. **MediaRepository** - File management and processing

## Features

### Type Safety

- Full TypeScript support with Drizzle ORM
- Compile-time type checking for all database operations
- Inferred types from database schema

### Error Handling

- Result pattern for type-safe error handling
- Custom error classes for different error types
- Comprehensive error messages

### Advanced Querying

- Filtering with complex conditions (\_and, \_or, \_not operators)
- Sorting and pagination support
- Full-text search capabilities
- Tag-based filtering

### Multi-tenancy Support

- Tenant-scoped operations
- Automatic tenant isolation
- Tenant-aware queries

### Soft Delete Support

- Soft delete functionality for content and media
- Restore capabilities
- Separate queries for deleted records

## Usage Examples

### Basic CRUD Operations

```typescript
import { UserRepository } from "./repositories";
import { container } from "tsyringe";

const userRepository = container.resolve(UserRepository);

// Create a user
const createResult = await userRepository.create({
  email: "user@example.com",
  passwordHash: "hashedpassword",
  tenantId: "tenant-1",
});

if (createResult.success) {
  console.log("User created:", createResult.data);
} else {
  console.error("Error:", createResult.error.message);
}

// Find user by ID
const findResult = await userRepository.findById("user-id");

// Update user
const updateResult = await userRepository.update("user-id", {
  email: "newemail@example.com",
});

// Delete user
const deleteResult = await userRepository.delete("user-id");
```

### Advanced Querying

```typescript
// Find with complex filters
const usersResult = await userRepository.findMany({
  where: {
    _and: [
      { tenantId: "tenant-1" },
      { isActive: true },
      {
        _or: [{ role: "admin" }, { role: "editor" }],
      },
    ],
  },
  orderBy: [{ field: "createdAt", direction: "desc" }],
  pagination: {
    page: 1,
    limit: 20,
  },
});

// Search users
const searchResult = await userRepository.searchUsers("john", "tenant-1", 10);
```

### Tenant-Scoped Operations

```typescript
const contentRepository = container.resolve(ContentRepository);

// Find content within tenant
const contentResult = await contentRepository.findByTenant("tenant-1", {
  where: { status: "published" },
  orderBy: [{ field: "publishedAt", direction: "desc" }],
});

// Find content by slug within tenant
const slugResult = await contentRepository.findBySlug("my-article", "tenant-1");
```

### Soft Delete Operations

```typescript
// Soft delete content
const softDeleteResult = await contentRepository.softDelete("content-id");

// Restore content
const restoreResult = await contentRepository.restore("content-id");

// Find deleted content
const deletedResult = await contentRepository.findDeleted();

// Permanent delete
const permanentDeleteResult = await contentRepository.permanentDelete(
  "content-id"
);
```

### Pagination

```typescript
// Paginated results
const paginatedResult = await userRepository.findManyPaginated({
  where: { tenantId: "tenant-1" },
  pagination: { page: 1, limit: 20 },
});

if (paginatedResult.success) {
  const { data, pagination } = paginatedResult.data;
  console.log("Users:", data);
  console.log("Pagination:", pagination);
  // {
  //   page: 1,
  //   limit: 20,
  //   total: 100,
  //   totalPages: 5,
  //   hasNext: true,
  //   hasPrev: false
  // }
}
```

## Dependency Injection Setup

```typescript
import { registerRepositories } from "./repositories";

// Register all repositories
registerRepositories();

// Or get all repositories at once
import { getRepositories } from "./repositories";

const { userRepository, tenantRepository, contentRepository, mediaRepository } =
  getRepositories();
```

## Testing

The repositories include comprehensive test coverage:

```bash
# Run repository tests
npm test src/core/repositories/

# Run specific repository tests
npm test src/core/repositories/base.repository.test.ts
```

## Error Handling

All repository methods return a `Result<T, Error>` type for type-safe error handling:

```typescript
const result = await userRepository.findById("user-id");

if (result.success) {
  // result.data is of type User | null
  const user = result.data;
} else {
  // result.error is of type Error
  console.error(result.error.message);
}
```

## Performance Considerations

- Connection pooling is handled at the database layer
- Queries are optimized with proper indexes
- Pagination prevents large result sets
- Soft delete queries exclude deleted records by default
- Type-safe query building prevents SQL injection

## Best Practices

1. Always use the Result pattern for error handling
2. Use tenant-scoped operations for multi-tenant data
3. Implement proper pagination for large datasets
4. Use soft delete for user-facing content
5. Leverage TypeScript for compile-time safety
6. Write comprehensive tests for custom repository methods

# Authentication and Security System

## Overview

This module implements a comprehensive authentication and security system with JWT tokens, role-based access control (RBAC), rate limiting, and security middleware.

## Components Implemented

### 1. JWT Authentication (`jwt.service.ts`)

- ✅ JWT token generation with access and refresh tokens
- ✅ Token validation and verification
- ✅ Refresh token mechanism for security
- ✅ Token extraction from Authorization headers
- ✅ Token expiration checking
- ✅ Configurable token expiry times

### 2. Authentication Service (`auth.service.ts`)

- ✅ User registration with password hashing
- ✅ User login with credential validation
- ✅ Password change functionality
- ✅ Token refresh mechanism
- ✅ User profile retrieval
- ✅ Email verification support
- ✅ Account deactivation

### 3. Authentication Controller (`auth.controller.ts`)

- ✅ Clean Fastify-based REST endpoints
- ✅ Input validation with Zod schemas
- ✅ Proper error handling
- ✅ Registration endpoint
- ✅ Login endpoint
- ✅ Token refresh endpoint
- ✅ Profile retrieval endpoint
- ✅ Password change endpoint
- ✅ Logout endpoint

### 4. Authentication Middleware (`auth.middleware.ts`)

- ✅ JWT token validation middleware
- ✅ Optional authentication support
- ✅ User context injection into requests
- ✅ Role-based authorization helpers
- ✅ Ownership verification utilities

### 5. RBAC System (`rbac.service.ts`, `rbac.middleware.ts`)

- ✅ Role and permission management
- ✅ User role assignment
- ✅ Permission checking
- ✅ Role-based middleware
- ✅ Permission-based middleware
- ✅ Resource ownership validation
- ✅ System role protection

### 6. Rate Limiting (`rate-limit.middleware.ts`)

- ✅ Redis-based rate limiting
- ✅ Per-endpoint rate limiting
- ✅ Brute force protection
- ✅ Configurable rate limits
- ✅ IP-based and user-based limiting
- ✅ Exponential backoff for failed attempts

### 7. Security Middleware (`security.middleware.ts`)

- ✅ Security headers (CSP, HSTS, X-Frame-Options, etc.)
- ✅ Input sanitization and validation
- ✅ CORS configuration
- ✅ Request size limiting
- ✅ IP filtering (whitelist/blacklist)
- ✅ XSS protection
- ✅ Content type validation

### 8. Database Schema (`roles.ts`)

- ✅ Roles table with system role protection
- ✅ Permissions table with resource/action structure
- ✅ Role-permission junction table
- ✅ User-role junction table
- ✅ Proper foreign key relationships

### 9. Security Configuration (`security.config.ts`)

- ✅ Centralized security setup
- ✅ Environment-based configurations
- ✅ Default RBAC setup
- ✅ Security presets for different environments
- ✅ Middleware factory functions

### 10. API Routes (`auth.routes.ts`)

- ✅ Fastify-based route definitions
- ✅ Schema validation
- ✅ Rate limiting integration
- ✅ Security middleware integration
- ✅ Proper HTTP status codes

## Security Features

### Authentication

- JWT with access and refresh tokens
- Secure password hashing with bcrypt
- Token expiration and rotation
- Brute force protection

### Authorization

- Role-based access control (RBAC)
- Permission-based access control
- Resource ownership validation
- Admin privilege escalation

### Rate Limiting

- Global and endpoint-specific limits
- Redis-based storage for scalability
- Exponential backoff for failed attempts
- IP and user-based tracking

### Security Headers

- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer Policy

### Input Protection

- Request sanitization
- Size limiting
- XSS prevention
- SQL injection protection (via Drizzle ORM)

## Usage Examples

### Basic Authentication

```typescript
// Apply authentication to routes
fastify.register(async function (fastify) {
  fastify.addHook("preHandler", authMiddleware.authenticate);

  fastify.get("/profile", async (request, reply) => {
    return { user: request.user };
  });
});
```

### Role-Based Protection

```typescript
// Require admin role
fastify.addHook("preHandler", rbacMiddleware.requireRoles(["admin"]));

// Require specific permissions
fastify.addHook(
  "preHandler",
  rbacMiddleware.requirePermissions([{ resource: "users", action: "create" }])
);
```

### Rate Limiting

```typescript
// Apply rate limiting to auth endpoints
const authRateLimit = rateLimitMiddleware.createRateLimit({
  max: 5,
  window: 15 * 60 * 1000, // 15 minutes
});

fastify.addHook("preHandler", authRateLimit);
```

## Environment Variables

Required environment variables for security:

```env
JWT_ACCESS_SECRET=your-access-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
REDIS_URL=redis://localhost:6379
BCRYPT_ROUNDS=12
```

## Testing

The authentication system includes:

- ✅ Unit tests for JWT service
- ✅ Integration tests for token flow
- ✅ Security validation tests
- ✅ Error handling tests

Run tests with:

```bash
npm test src/modules/auth/__tests__/
```

## Security Compliance

This implementation follows security best practices:

- OWASP security guidelines
- JWT best practices
- Rate limiting recommendations
- Input validation standards
- CORS security policies
- CSP implementation
- Secure password handling

## Performance

- Redis-based caching for rate limiting
- Efficient JWT token validation
- Optimized database queries for RBAC
- Connection pooling for database access
- Minimal middleware overhead

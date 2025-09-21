# Content Management System Backend

🚀 **Enterprise-grade Content Management System** built with modern technologies and senior-level architecture patterns. Features comprehensive API ecosystem, multi-tenancy, advanced security, and production-ready infrastructure.

## ✨ Key Features

### 🏗️ Architecture & Design

- **Clean Architecture**: Domain-driven design with clear separation of concerns
- **Dependency Injection**: TSyringe-based IoC container for loose coupling
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Modular Design**: Plugin-based architecture for extensibility

### 🛡️ Security & Authentication

- **JWT Authentication**: Access & refresh tokens with configurable expiration
- **Multi-tenancy**: Built-in tenant isolation and management
- **RBAC**: Role-based access control with granular permissions
- **Security Headers**: Comprehensive security middleware (Helmet, CORS, Rate Limiting)
- **Input Validation**: Zod-based schema validation for all endpoints

### 📊 Database & Performance

- **PostgreSQL**: Production-ready relational database
- **Drizzle ORM**: Type-safe database operations with migrations
- **Connection Pooling**: Optimized database connections
- **Query Optimization**: Built-in query performance monitoring
- **Caching**: Redis-based caching for improved performance

### 🔍 Monitoring & Observability

- **Health Checks**: Comprehensive health monitoring endpoints
- **Metrics**: Performance metrics and system monitoring
- **Audit Logging**: Complete audit trail for all operations
- **Structured Logging**: JSON-based logging with correlation IDs
- **Error Tracking**: Sophisticated error handling and reporting

### 📚 API & Documentation

- **REST API**: RESTful endpoints with OpenAPI specification
- **GraphQL**: Optional GraphQL endpoint for flexible queries
- **Auto Documentation**: Swagger UI with interactive API explorer
- **Webhooks**: Event-driven webhook system
- **Versioning**: API versioning support

## 🛠️ Tech Stack

| Category               | Technology                  |
| ---------------------- | --------------------------- |
| **Runtime**            | Node.js 18+                 |
| **Framework**          | Fastify 4.x                 |
| **Language**           | TypeScript 5.x              |
| **Database**           | PostgreSQL 14+              |
| **ORM**                | Drizzle ORM                 |
| **Authentication**     | JWT + Refresh Tokens        |
| **Validation**         | Zod                         |
| **Testing**            | Vitest + Coverage           |
| **Documentation**      | Swagger/OpenAPI 3.0         |
| **Process Management** | PM2                         |
| **Containerization**   | Docker + Multi-stage builds |
| **Code Quality**       | Biome (ESLint + Prettier)   |

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **PostgreSQL** 14.0 or higher
- **Redis** 6.0 or higher (optional, for caching)
- **npm** or **pnpm** package manager

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd content-management-system

# Install dependencies
npm install
# or with pnpm (recommended)
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
# Required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET
```

### 3. Database Setup

```bash
# Generate database schema
npm run db:generate

# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### 4. Development Server

```bash
# Start development server with hot reload
npm run dev

# Or with debug mode
npm run dev:debug

# Or with verbose logging
npm run dev:verbose
```

🎉 **Server running at**: `http://localhost:3000`

## 📋 Available Scripts

### 🔧 Development Commands

```bash
npm run dev              # Start development server with hot reload
npm run dev:debug        # Start with Node.js debugging enabled
npm run dev:verbose      # Start with debug-level logging
npm run dev:clean        # Clean build and start fresh
```

### 🏗️ Building Commands

```bash
npm run build            # Build for production
npm run build:production # Build with production optimizations
npm run build:staging    # Build for staging environment
npm run build:analyze    # Build and analyze bundle size
npm run typecheck        # Run TypeScript type checking
```

### 🚀 Production Commands

```bash
npm start                # Start production server
npm run start:production # Start with production environment
npm run start:cluster    # Start in cluster mode
npm run pm2:start        # Start with PM2 process manager
npm run pm2:stop         # Stop PM2 processes
npm run pm2:restart      # Restart PM2 processes
npm run pm2:logs         # View PM2 logs
```

### 🧪 Testing Commands

```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:ui          # Run tests with UI interface
npm run test:e2e         # Run end-to-end tests
npm run test:integration # Run integration tests
npm run test:unit        # Run unit tests only
npm run test:smoke       # Run smoke tests
npm run test:all         # Run comprehensive test suite
```

### 🗄️ Database Commands

```bash
npm run db:generate      # Generate database migrations
npm run db:migrate       # Run database migrations
npm run db:migrate:up    # Run specific migration up
npm run db:migrate:down  # Run specific migration down
npm run db:migrate:status # Check migration status
npm run db:migrate:reset # Reset database
npm run db:studio        # Open Drizzle Studio
npm run db:seed          # Seed database with initial data
npm run db:backup        # Backup database
npm run db:restore       # Restore database from backup
```

### 🔍 Code Quality Commands

```bash
npm run lint             # Run linter
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run format:check     # Check code formatting
npm run quality          # Run full quality check (lint + typecheck + test)
```

### 🛡️ Security Commands

```bash
npm run security:audit   # Run security audit
npm run security:fix     # Fix security vulnerabilities
npm run security:check   # Check for security issues
npm run security:deps    # Check dependencies
npm run security:outdated # Check for outdated packages
```

### 🚢 Deployment Commands

```bash
npm run deploy:staging   # Deploy to staging
npm run deploy:production # Deploy to production
npm run deploy:docker    # Build and run Docker container
npm run deploy:verify    # Verify deployment health
```

### 📊 Monitoring Commands

```bash
npm run health:check     # Check application health
npm run health:ready     # Check readiness status
npm run health:metrics   # View performance metrics
npm run logs:tail        # Tail application logs
npm run logs:error       # View error logs
```

## 🌐 API Endpoints

Once the server is running, access these endpoints:

| Endpoint                         | Description                          |
| -------------------------------- | ------------------------------------ |
| `http://localhost:3000/api/docs` | 📚 **Interactive API Documentation** |
| `http://localhost:3000/health`   | 💚 **Health Check**                  |
| `http://localhost:3000/ready`    | ⚡ **Readiness Check**               |
| `http://localhost:3000/metrics`  | 📊 **Performance Metrics**           |
| `http://localhost:3000/version`  | 📋 **Version Information**           |
| `http://localhost:3000/services` | 🔍 **Service Status**                |
| `http://localhost:3000/api/v1/*` | 🌐 **REST API Endpoints**            |

### 🔑 Authentication Endpoints

```bash
POST /api/v1/auth/login     # User login
POST /api/v1/auth/register  # User registration
POST /api/v1/auth/refresh   # Refresh access token
POST /api/v1/auth/logout    # User logout
```

### 📝 Content Management Endpoints

```bash
GET    /api/v1/content      # List content
POST   /api/v1/content      # Create content
GET    /api/v1/content/:id  # Get content by ID
PUT    /api/v1/content/:id  # Update content
DELETE /api/v1/content/:id  # Delete content
```

## 🐳 Docker Deployment

### Development

```bash
# Build development image
docker build -t cms-api:dev .

# Run with development environment
docker run -p 3000:3000 --env-file .env cms-api:dev
```

### Production

```bash
# Build production image
docker build -t cms-api:prod --target runner .

# Run with production environment
docker run -p 3000:3000 --env-file .env.production cms-api:prod
```

### Docker Compose

```bash
# Start all services (app + database + redis)
docker-compose up -d

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

## ⚙️ Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cms_db

# JWT Secrets (minimum 32 characters)
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-here

# Server
PORT=3000
NODE_ENV=development
```

### Optional Environment Variables

```bash
# Redis (for caching)
REDIS_URI=redis://localhost:6379

# Logging
LOG_LEVEL=info

# Features
ENABLE_GRAPHQL=true
ENABLE_WEBHOOKS=true
ENABLE_MULTI_TENANCY=true
ENABLE_AUDIT_LOGS=true

# Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_MIME_TYPES=image/jpeg,image/png,application/pdf
```

## 🔧 PM2 Process Management

### Start Application

```bash
# Start with PM2
npm run pm2:start

# Start in specific environment
pm2 start ecosystem.config.js --env production
pm2 start ecosystem.config.js --env staging
```

### Monitor & Manage

```bash
# View status
pm2 status

# View logs
pm2 logs cms-api

# Restart application
pm2 restart cms-api

# Stop application
pm2 stop cms-api

# Delete from PM2
pm2 delete cms-api
```

## 🧪 Testing

### Test Structure

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data and fixtures
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="user"
```

## 📈 Performance Optimization

### Built-in Optimizations

- **Connection Pooling**: Optimized database connections
- **Query Optimization**: Automatic query performance monitoring
- **Compression**: Gzip compression for responses
- **Caching**: Redis-based caching layer
- **Rate Limiting**: Prevent abuse and ensure fair usage

### Performance Monitoring

```bash
# Check performance metrics
npm run performance:check

# Profile application
npm run performance:profile

# Analyze performance
npm run performance:analyze
```

## 🛡️ Security Features

### Authentication & Authorization

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Multi-tenant data isolation
- API key authentication for service-to-service communication

### Security Middleware

- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Security Best Practices

- Environment-based configuration
- Secrets management
- Audit logging
- Error sanitization in production
- Secure session management

## 📊 Monitoring & Observability

### Health Checks

- Application health status
- Database connectivity
- External service dependencies
- Memory and CPU usage

### Metrics & Analytics

- Request/response metrics
- Performance monitoring
- Error tracking
- Business metrics

### Logging

- Structured JSON logging
- Correlation ID tracking
- Log levels and filtering
- Centralized log aggregation ready

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Add** tests for new functionality
5. **Run** the test suite (`npm run quality`)
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### Code Quality Standards

- **TypeScript**: Strict type checking enabled
- **Testing**: Minimum 80% code coverage
- **Linting**: Biome configuration enforced
- **Documentation**: JSDoc comments for public APIs
- **Commits**: Conventional commit messages

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm run setup

# Manual quality check
npm run quality
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Documentation

### Getting Help

- 📚 **API Documentation**: `/api/docs` endpoint
- 🐛 **Issues**: GitHub Issues for bug reports
- 💡 **Feature Requests**: GitHub Discussions
- 📧 **Support**: Create an issue with the `support` label

### Additional Resources

- [Fastify Documentation](https://www.fastify.io/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**Built with ❤️ using modern technologies and enterprise-grade architecture patterns.**

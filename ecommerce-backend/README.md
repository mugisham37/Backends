# E-commerce Backend

A modern, scalable e-commerce backend built with TypeScript, PostgreSQL, Drizzle ORM, and clean architecture principles.

## Features

- 🚀 **Modern Stack**: TypeScript, PostgreSQL, Drizzle ORM, Fastify
- 🏗️ **Clean Architecture**: Modular design with clear separation of concerns
- 📊 **Dual APIs**: Both REST and GraphQL endpoints
- 🔒 **Security**: JWT authentication, rate limiting, input validation
- ⚡ **Performance**: Redis caching, connection pooling, optimized queries
- 🧪 **Testing**: Comprehensive test suite with Vitest
- 📝 **Type Safety**: 100% TypeScript coverage
- 🔧 **Developer Experience**: Hot reload, auto-formatting, linting

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Set up the database:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
5. Start development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Drizzle Studio

## Project Structure

```
src/
├── api/           # API layer (REST & GraphQL)
├── core/          # Core system components
├── modules/       # Feature modules
└── shared/        # Shared utilities
```

## API Documentation

- REST API: `http://localhost:3000/docs`
- GraphQL Playground: `http://localhost:3000/graphql`

## License

MIT

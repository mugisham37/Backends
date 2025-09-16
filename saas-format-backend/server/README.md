# Multi-tenant SaaS Platform Backend

This is a comprehensive backend system for a multi-tenant SaaS platform built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- **Multi-tenancy**: Complete tenant isolation with separate database schemas
- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **Project Management**: Sample application with projects, tasks, and team members
- **API Security**: Rate limiting, CORS, Helmet security headers
- **Error Handling**: Centralized error handling with proper status codes
- **Logging**: Structured logging with Winston
- **Validation**: Request validation with Zod
- **Database**: PostgreSQL with Prisma ORM

## Project Structure

\`\`\`
server/
├── prisma/                  # Database schema and migrations
├── src/
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Express middleware
│   ├── routes/              # API routes
│   ├── utils/               # Utility functions
│   └── index.ts             # Application entry point
├── .env.example             # Environment variables example
├── .eslintrc.js             # ESLint configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # Project documentation
\`\`\`

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Copy `.env.example` to `.env` and update the values
4. Set up the database:
   \`\`\`bash
   npx prisma migrate dev
   \`\`\`
5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## API Endpoints

### Tenant Management

- `POST /api/tenants` - Create a new tenant
- `GET /api/tenants` - Get all tenants (admin only)
- `GET /api/tenants/:id` - Get tenant by ID
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant
- `GET /api/tenants/:id/settings` - Get tenant settings
- `PUT /api/tenants/:id/settings` - Update tenant settings

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/forgot-password` - Forgot password
- `POST /api/auth/reset-password` - Reset password

### User Management

- `GET /api/users` - Get all users (tenant admin only)
- `POST /api/users` - Create a new user (tenant admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (tenant admin only)

### Project Management

- `GET /api/projects` - Get all projects
- `POST /api/projects` - Create a new project
- `GET /api/projects/:id` - Get project by ID
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/:id/members` - Get project members
- `POST /api/projects/:id/members` - Add project member
- `DELETE /api/projects/:id/members/:userId` - Remove project member

### Task Management

- `GET /api/projects/:id/tasks` - Get tasks by project
- `POST /api/projects/:id/tasks` - Create task
- `GET /api/projects/:id/tasks/:taskId` - Get task by ID
- `PUT /api/projects/:id/tasks/:taskId` - Update task
- `DELETE /api/projects/:id/tasks/:taskId` - Delete task

## Authentication

The API uses JWT (JSON Web Token) for authentication. To access protected endpoints, include the token in the Authorization header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

## Multi-tenancy

The API supports multi-tenancy through the `x-tenant-id` header or tenant identification in the URL path. Each tenant has its own isolated data.

## Error Handling

The API returns consistent error responses with appropriate HTTP status codes:

\`\`\`json
{
  "status": "error",
  "statusCode": 400,
  "message": "Validation Error",
  "errors": [...]
}
\`\`\`

## License

MIT

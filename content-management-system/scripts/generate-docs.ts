#!/usr/bin/env tsx

/**
 * Documentation generation script
 * Generates API documentation and project documentation
 */

import fs from "node:fs";
import path from "node:path";
import { config } from "../src/shared/config/env.config";

console.log("📖 Generating project documentation...\n");

const docsDir = path.resolve(process.cwd(), "docs");

// Ensure docs directory exists
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const apiDoc = `# CMS API Documentation

## Overview
Content Management System API built with Fastify, TypeScript, and Drizzle ORM.

## Environment: ${config.nodeEnv}
- **Base URL**: ${config.urls.api}
- **Version**: ${process.env.npm_package_version || "1.0.0"}
- **Port**: ${config.port}

## Authentication
The API uses JWT tokens for authentication.

### Endpoints

#### Health Check
- **GET** \`/health\` - System health status
- **GET** \`/ready\` - Readiness probe
- **GET** \`/metrics\` - Prometheus metrics (if enabled)

#### Authentication
- **POST** \`/api/auth/login\` - User login
- **POST** \`/api/auth/refresh\` - Refresh token
- **POST** \`/api/auth/logout\` - User logout

#### Content Management
- **GET** \`/api/content\` - List content
- **POST** \`/api/content\` - Create content
- **GET** \`/api/content/:id\` - Get content by ID
- **PUT** \`/api/content/:id\` - Update content
- **DELETE** \`/api/content/:id\` - Delete content

#### Media Management
- **GET** \`/api/media\` - List media files
- **POST** \`/api/media/upload\` - Upload media
- **GET** \`/api/media/:id\` - Get media by ID
- **DELETE** \`/api/media/:id\` - Delete media

#### User Management
- **GET** \`/api/users\` - List users (admin only)
- **POST** \`/api/users\` - Create user (admin only)
- **GET** \`/api/users/:id\` - Get user by ID
- **PUT** \`/api/users/:id\` - Update user
- **DELETE** \`/api/users/:id\` - Delete user (admin only)

## Configuration

### Environment Variables
See \`.env.example\` files for complete configuration options.

### Required Variables
- \`DATABASE_URL\` - PostgreSQL connection string
- \`JWT_SECRET\` - JWT signing secret (min 32 chars)
- \`SESSION_SECRET\` - Session secret (min 32 chars)

### Optional Variables
- \`REDIS_URI\` - Redis connection for caching
- \`CORS_ORIGIN\` - Allowed CORS origins
- \`LOG_LEVEL\` - Logging level (debug, info, warn, error)

## Development

### Getting Started
\`\`\`bash
# Install dependencies
npm install

# Copy environment file
cp .env.development.example .env.development

# Generate database schema
npm run db:generate

# Run migrations
npm run db:migrate

# Start development server
npm run dev
\`\`\`

### Available Scripts
- \`npm run dev\` - Start development server with hot reload
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run test\` - Run tests
- \`npm run lint\` - Lint code
- \`npm run db:migrate\` - Run database migrations
- \`npm run db:studio\` - Open database studio

## Deployment

### Docker
\`\`\`bash
# Build image
docker build -t cms-api .

# Run container
docker run -p 3000:3000 --env-file .env.production cms-api
\`\`\`

### Docker Compose
\`\`\`bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up
\`\`\`

### PM2
\`\`\`bash
# Start with PM2
npm run pm2:start

# Production deployment
npm run deploy:production
\`\`\`

## Monitoring

### Health Endpoints
- \`/health\` - Basic health check
- \`/ready\` - Readiness probe for K8s
- \`/metrics\` - Prometheus metrics

### Logging
Logs are written to:
- \`logs/app.log\` - Application logs
- \`logs/error.log\` - Error logs
- \`logs/access.log\` - Access logs

## Security

### Features
- JWT authentication
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- SQL injection prevention

### Best Practices
- Use environment variables for secrets
- Enable SSL in production
- Regular security updates
- Monitor for vulnerabilities

## Database

### Schema
The database schema is managed with Drizzle ORM.

### Migrations
\`\`\`bash
# Generate migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Reset database (development only)
npm run db:migrate:reset
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License
MIT License
`;

const deploymentDoc = `# Deployment Guide

## Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for caching)
- Docker (optional)

## Environment Setup

### Development
1. Copy \`.env.development.example\` to \`.env.development\`
2. Update database and other settings
3. Run \`npm run setup\`

### Production
1. Copy \`.env.production.example\` to \`.env.production\`
2. Generate secure secrets for JWT and session
3. Configure production database
4. Set up SSL certificates
5. Configure reverse proxy (nginx)

## Deployment Options

### 1. Traditional Server
\`\`\`bash
# Build application
npm run build:production

# Start with PM2
npm run pm2:start
\`\`\`

### 2. Docker
\`\`\`bash
# Build and run
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

### 3. Cloud Platforms
The application can be deployed to:
- AWS (ECS, Lambda, Elastic Beanstalk)
- Google Cloud (Cloud Run, App Engine)
- Azure (Container Instances, App Service)
- DigitalOcean (App Platform)
- Heroku

## Monitoring Setup

### Application Monitoring
- Health checks: \`/health\`, \`/ready\`
- Metrics: \`/metrics\` (Prometheus format)
- Logs: JSON structured logging

### Infrastructure Monitoring
- Use Prometheus + Grafana for metrics
- Set up log aggregation (ELK stack)
- Configure alerting (PagerDuty, Slack)

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure JWT secrets
- [ ] Enable database SSL
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities

## Performance Optimization

- [ ] Enable compression
- [ ] Use Redis for caching
- [ ] Optimize database queries
- [ ] Set up CDN for static assets
- [ ] Monitor performance metrics
- [ ] Scale horizontally with clusters

## Backup Strategy

- [ ] Daily database backups
- [ ] File system backups
- [ ] Test restore procedures
- [ ] Offsite backup storage
- [ ] Backup monitoring

## Troubleshooting

### Common Issues
1. **Database connection issues**: Check DATABASE_URL and network
2. **JWT errors**: Verify JWT_SECRET length and format
3. **CORS errors**: Check CORS_ORIGIN configuration
4. **File upload issues**: Verify upload permissions and disk space

### Logs
Check logs in the following order:
1. Application logs (\`logs/app.log\`)
2. Error logs (\`logs/error.log\`)
3. System logs (\`journalctl\` or \`/var/log\`)
4. Container logs (\`docker logs\`)

### Health Checks
\`\`\`bash
# Check application health
curl http://localhost:3000/health

# Check readiness
curl http://localhost:3000/ready

# Check metrics
curl http://localhost:3000/metrics
\`\`\`
`;

// Write documentation files
fs.writeFileSync(path.join(docsDir, "API.md"), apiDoc);
fs.writeFileSync(path.join(docsDir, "DEPLOYMENT.md"), deploymentDoc);

console.log("✅ Generated API.md");
console.log("✅ Generated DEPLOYMENT.md");

// Generate README with project overview
const readmeContent = fs.readFileSync(
  path.resolve(process.cwd(), "README.md"),
  "utf-8"
);
if (!readmeContent.includes("## Quick Start")) {
  const quickStart = `

## Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.development.example .env.development

# 3. Set up database
npm run db:generate
npm run db:migrate

# 4. Start development server
npm run dev
\`\`\`

## Documentation
- [API Documentation](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Scripts
- \`npm run dev\` - Development server
- \`npm run build\` - Build for production  
- \`npm run start\` - Start production server
- \`npm run test\` - Run tests
- \`npm run lint\` - Lint code
- \`npm run db:studio\` - Database admin UI

## Features
- 🚀 Fast Fastify server
- 🔒 JWT authentication
- 📊 PostgreSQL with Drizzle ORM
- 🔍 TypeScript throughout
- 🐳 Docker ready
- 📈 Monitoring & health checks
- 🛡️ Security best practices
`;

  fs.writeFileSync(
    path.resolve(process.cwd(), "README.md"),
    readmeContent + quickStart
  );
  console.log("✅ Updated README.md with quick start guide");
}

console.log("\n📖 Documentation generated successfully!");

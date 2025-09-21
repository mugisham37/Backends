#!/usr/bin/env tsx

/**
 * Project Setup Script
 * Automated setup for the Content Management System Backend
 */

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../src/shared/utils/logger.js";

interface SetupOptions {
  skipDependencies?: boolean;
  skipDatabase?: boolean;
  skipEnv?: boolean;
  development?: boolean;
  verbose?: boolean;
}

class ProjectSetup {
  private options: SetupOptions;
  private startTime: number;

  constructor(options: SetupOptions = {}) {
    this.options = options;
    this.startTime = Date.now();
  }

  /**
   * Run the complete setup process
   */
  async run(): Promise<void> {
    try {
      logger.info("🚀 Starting Content Management System Backend setup...");

      await this.checkPrerequisites();
      await this.setupEnvironment();
      await this.installDependencies();
      await this.setupDatabase();
      await this.createDirectories();
      await this.setupDevelopmentTools();
      await this.verifySetup();

      const duration = Date.now() - this.startTime;
      logger.info(`✅ Setup completed successfully in ${duration}ms!`);
      this.printNextSteps();
    } catch (error) {
      logger.error("❌ Setup failed:", error);
      process.exit(1);
    }
  }

  /**
   * Check system prerequisites
   */
  private async checkPrerequisites(): Promise<void> {
    logger.info("🔍 Checking prerequisites...");

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required, found ${nodeVersion}`);
    }
    logger.info(`✅ Node.js ${nodeVersion} detected`);

    // Check for required tools
    const requiredTools = ["npm", "git"];

    for (const tool of requiredTools) {
      try {
        execSync(`${tool} --version`, { stdio: "ignore" });
        logger.info(`✅ ${tool} is available`);
      } catch {
        throw new Error(`${tool} is required but not found in PATH`);
      }
    }

    // Check for optional tools
    const optionalTools = ["pnpm", "docker", "psql"];

    for (const tool of optionalTools) {
      try {
        execSync(`${tool} --version`, { stdio: "ignore" });
        logger.info(`✅ ${tool} is available (optional)`);
      } catch {
        logger.warn(`⚠️ ${tool} not found (optional)`);
      }
    }
  }

  /**
   * Setup environment variables
   */
  private async setupEnvironment(): Promise<void> {
    if (this.options.skipEnv) {
      logger.info("⏭️ Skipping environment setup");
      return;
    }

    logger.info("⚙️ Setting up environment variables...");

    const envFile = ".env";
    const envExampleFile = ".env.example";

    if (!existsSync(envFile)) {
      if (existsSync(envExampleFile)) {
        copyFileSync(envExampleFile, envFile);
        logger.info("✅ Created .env from .env.example");
      } else {
        // Create a basic .env file
        const basicEnv = this.generateBasicEnv();
        writeFileSync(envFile, basicEnv);
        logger.info("✅ Created basic .env file");
      }
    } else {
      logger.info("✅ .env file already exists");
    }

    // Create environment-specific files if they don't exist
    const envFiles = [
      ".env.development.example",
      ".env.production.example",
      ".env.staging.example",
    ];

    for (const file of envFiles) {
      if (!existsSync(file)) {
        const content = this.generateEnvTemplate(file);
        writeFileSync(file, content);
        logger.info(`✅ Created ${file}`);
      }
    }
  }

  /**
   * Install project dependencies
   */
  private async installDependencies(): Promise<void> {
    if (this.options.skipDependencies) {
      logger.info("⏭️ Skipping dependency installation");
      return;
    }

    logger.info("📦 Installing dependencies...");

    try {
      // Check if pnpm is available and use it, otherwise use npm
      let packageManager = "npm";
      try {
        execSync("pnpm --version", { stdio: "ignore" });
        packageManager = "pnpm";
        logger.info("🚀 Using pnpm for faster installation");
      } catch {
        logger.info("📦 Using npm for installation");
      }

      const installCommand =
        packageManager === "pnpm" ? "pnpm install --frozen-lockfile" : "npm ci";

      execSync(installCommand, {
        stdio: this.options.verbose ? "inherit" : "pipe",
        cwd: process.cwd(),
      });

      logger.info("✅ Dependencies installed successfully");
    } catch (error) {
      logger.error("❌ Failed to install dependencies:", error);
      throw error;
    }
  }

  /**
   * Setup database
   */
  private async setupDatabase(): Promise<void> {
    if (this.options.skipDatabase) {
      logger.info("⏭️ Skipping database setup");
      return;
    }

    logger.info("🗄️ Setting up database...");

    try {
      // Generate database schema
      logger.info("📋 Generating database schema...");
      execSync("npm run db:generate", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });

      // Run migrations
      logger.info("🔄 Running database migrations...");
      execSync("npm run db:migrate", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });

      logger.info("✅ Database setup completed");
    } catch (_error) {
      logger.warn(
        "⚠️ Database setup failed - you may need to configure DATABASE_URL in .env"
      );
      logger.info(
        "💡 Make sure PostgreSQL is running and DATABASE_URL is correct"
      );
    }
  }

  /**
   * Create necessary directories
   */
  private async createDirectories(): Promise<void> {
    logger.info("📁 Creating project directories...");

    const directories = [
      "logs",
      "uploads",
      "temp",
      "coverage",
      "dist",
      "docs",
      "tests/fixtures",
      "tests/unit",
      "tests/integration",
      "tests/e2e",
    ];

    for (const dir of directories) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        logger.info(`✅ Created directory: ${dir}`);
      }
    }

    // Create .gitkeep files for empty directories
    const gitkeepDirs = ["logs", "uploads", "temp"];
    for (const dir of gitkeepDirs) {
      const gitkeepFile = join(dir, ".gitkeep");
      if (!existsSync(gitkeepFile)) {
        writeFileSync(gitkeepFile, "");
      }
    }
  }

  /**
   * Setup development tools
   */
  private async setupDevelopmentTools(): Promise<void> {
    if (!this.options.development) {
      return;
    }

    logger.info("🛠️ Setting up development tools...");

    try {
      // Run type checking
      logger.info("🔍 Running type check...");
      execSync("npm run typecheck", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });

      // Run linting
      logger.info("🧹 Running linter...");
      execSync("npm run lint", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });

      logger.info("✅ Development tools setup completed");
    } catch (_error) {
      logger.warn(
        "⚠️ Some development tools setup failed - this is usually not critical"
      );
    }
  }

  /**
   * Verify the setup
   */
  private async verifySetup(): Promise<void> {
    logger.info("🔍 Verifying setup...");

    const checks = [
      { name: "package.json", path: "package.json" },
      { name: ".env file", path: ".env" },
      { name: "node_modules", path: "node_modules" },
      { name: "TypeScript config", path: "tsconfig.json" },
    ];

    for (const check of checks) {
      if (existsSync(check.path)) {
        logger.info(`✅ ${check.name} exists`);
      } else {
        logger.warn(`⚠️ ${check.name} missing`);
      }
    }

    // Try to build the project
    try {
      logger.info("🏗️ Testing build process...");
      execSync("npm run build", {
        stdio: this.options.verbose ? "inherit" : "pipe",
      });
      logger.info("✅ Build test successful");
    } catch (_error) {
      logger.warn("⚠️ Build test failed - check your configuration");
    }
  }

  /**
   * Generate basic .env content
   */
  private generateBasicEnv(): string {
    return `# Content Management System Backend Environment Configuration
# Generated by setup script

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration (Update with your PostgreSQL credentials)
DATABASE_URL=postgresql://postgres:password@localhost:5432/cms_dev
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cms_dev
DB_USER=postgres
DB_PASSWORD=password
DB_SSL=false

# JWT Configuration (CHANGE THESE IN PRODUCTION!)
JWT_SECRET=your-super-secure-jwt-secret-key-minimum-32-characters-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key-minimum-32-characters-long
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis Configuration (Optional)
REDIS_URI=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Logging
LOG_LEVEL=debug

# Features
ENABLE_GRAPHQL=true
ENABLE_WEBHOOKS=true
ENABLE_MULTI_TENANCY=true
ENABLE_AUDIT_LOGS=true
ENABLE_MEDIA_PROCESSING=true

# Security
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Monitoring
ENABLE_MONITORING=true
HEALTH_CHECK_INTERVAL=30000
`;
  }

  /**
   * Generate environment template
   */
  private generateEnvTemplate(filename: string): string {
    const env = filename.includes("production")
      ? "production"
      : filename.includes("staging")
        ? "staging"
        : "development";

    return `# ${env.toUpperCase()} Environment Configuration
NODE_ENV=${env}
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cms_${env}

# JWT Secrets (MUST be different for each environment)
JWT_SECRET=change-this-in-${env}
JWT_REFRESH_SECRET=change-this-in-${env}

# Redis
REDIS_URI=redis://localhost:6379

# Logging
LOG_LEVEL=${
      env === "production" ? "warn" : env === "staging" ? "info" : "debug"
    }

# Features
ENABLE_GRAPHQL=${env !== "production"}
ENABLE_WEBHOOKS=true
ENABLE_MULTI_TENANCY=true
ENABLE_AUDIT_LOGS=true

# Security
CORS_ORIGIN=${
      env === "production" ? "https://yourdomain.com" : "http://localhost:3000"
    }
RATE_LIMIT_MAX=${env === "production" ? "60" : "100"}
`;
  }

  /**
   * Print next steps for the user
   */
  private printNextSteps(): void {
    logger.info("\n🎉 Setup completed! Here are your next steps:\n");

    logger.info("1. 📝 Configure your environment:");
    logger.info("   • Edit .env file with your database credentials");
    logger.info("   • Update JWT secrets with secure random strings");
    logger.info("   • Configure Redis connection if using caching\n");

    logger.info("2. 🗄️ Setup your database:");
    logger.info("   • Make sure PostgreSQL is running");
    logger.info("   • Create your database: createdb cms_dev");
    logger.info("   • Run: npm run db:migrate\n");

    logger.info("3. 🚀 Start development:");
    logger.info("   • npm run dev (start development server)");
    logger.info("   • npm run dev:debug (start with debugging)");
    logger.info("   • npm run test (run tests)\n");

    logger.info("4. 📚 Explore the API:");
    logger.info("   • http://localhost:3000/api/docs (API documentation)");
    logger.info("   • http://localhost:3000/health (health check)");
    logger.info("   • http://localhost:3000/metrics (performance metrics)\n");

    logger.info("5. 🛠️ Development tools:");
    logger.info("   • npm run lint (code linting)");
    logger.info("   • npm run typecheck (type checking)");
    logger.info("   • npm run test:coverage (test coverage)\n");

    logger.info("📖 For more information, check the README.md file");
    logger.info(
      "🐛 If you encounter issues, check the troubleshooting section"
    );
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: SetupOptions = {
    skipDependencies: args.includes("--skip-deps"),
    skipDatabase: args.includes("--skip-db"),
    skipEnv: args.includes("--skip-env"),
    development: !args.includes("--no-dev"),
    verbose: args.includes("--verbose") || args.includes("-v"),
  };

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Content Management System Backend Setup

Usage: npm run setup [options]

Options:
  --skip-deps     Skip dependency installation
  --skip-db       Skip database setup
  --skip-env      Skip environment setup
  --no-dev        Skip development tools setup
  --verbose, -v   Verbose output
  --help, -h      Show this help message

Examples:
  npm run setup                    # Full setup
  npm run setup --skip-db          # Setup without database
  npm run setup --verbose          # Setup with verbose output
`);
    process.exit(0);
  }

  const setup = new ProjectSetup(options);
  await setup.run();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error("Setup failed:", error);
    process.exit(1);
  });
}

export { ProjectSetup };

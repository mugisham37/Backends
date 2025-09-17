import type { Config } from "drizzle-kit";

export default {
  schema: "./src/core/database/schema/*",
  out: "./src/core/database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:moses@localhost:5432/ecommerce-node-backend",
  },
  verbose: true,
  strict: true,
} satisfies Config;

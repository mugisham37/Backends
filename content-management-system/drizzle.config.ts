import type { Config } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

export default {
  schema: "./src/core/database/schema/*.schema.ts",
  out: "./src/core/database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:password@localhost:5432/cms_dev",
  },
  verbose: process.env.NODE_ENV === "development",
  strict: true,
} satisfies Config;

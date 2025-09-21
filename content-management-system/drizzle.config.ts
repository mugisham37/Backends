import type { Config } from "drizzle-kit";
import { config } from "./src/shared/config/env.config";

export default ({
  schema: "./src/core/database/schema/*.ts",
  out: "./src/core/database/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: config.database.url,
  },
  verbose: config.isDevelopment,
  strict: true,
  breakpoints: true,
} satisfies Config);

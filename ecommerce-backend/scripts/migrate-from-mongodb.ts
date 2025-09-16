#!/usr/bin/env tsx

/**
 * MongoDB to PostgreSQL migration script
 * Migrates existing data from MongoDB collections to PostgreSQL tables
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { config } from "../src/shared/config/env.config";
import {
  users,
  vendors,
  categories,
  products,
  orders,
  orderItems,
  type NewUser,
  type NewVendor,
  type NewCategory,
  type NewProduct,
  type NewOrder,
  type NewOrderItem,
} from "../src/core/database/schema/index";

// MongoDB connection would be here in a real migration
// import { MongoClient } from 'mongodb';

interface MongoUser {
  _id: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  status?: string;
  phoneNumber?: string;
  avatar?: string;
  emailVerified?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoVendor {
  _id: string;
  userId: string;
  businessName: string;
  slug: string;
  description?: string;
  email: string;
  phoneNumber?: string;
  status?: string;
  commissionRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MongoProduct {
  _id: string;
  vendorId: string;
  categoryId?: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  sku?: string;
  quantity?: number;
  status?: string;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
}

async function migrateFromMongoDB() {
  console.log("🔄 Starting MongoDB to PostgreSQL migration...");
  console.log(
    `📍 Target Database: ${config.database.url.replace(/\/\/.*@/, "//***@")}`
  );

  let pgConnection: postgres.Sql | null = null;

  try {
    // Connect to PostgreSQL
    pgConnection = postgres(config.database.url);
    const db = drizzle(pgConnection, {
      schema: { users, vendors, categories, products, orders, orderItems },
    });

    console.log("🔍 Testing PostgreSQL connection...");
    await pgConnection`SELECT 1`;
    console.log("✅ PostgreSQL connection successful");

    // Check if PostgreSQL already has data
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("⚠️  PostgreSQL database already contains data.");
      console.log("   Please ensure the database is empty before migration.");
      return;
    }

    // In a real migration, you would connect to MongoDB here
    console.log("📝 Note: This is a template migration script.");
    console.log("   To use this script:");
    console.log("   1. Install MongoDB driver: npm install mongodb");
    console.log("   2. Add MongoDB connection string to environment");
    console.log("   3. Uncomment and configure MongoDB connection code");
    console.log("   4. Implement the actual data migration logic below");

    // Example migration logic (commented out as it requires MongoDB setup):
    /*
    
    // Connect to MongoDB
    const mongoClient = new MongoClient(process.env.MONGODB_URI!);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();

    console.log("👤 Migrating users...");
    const mongoUsers = await mongoDb.collection<MongoUser>('users').find({}).toArray();
    
    const pgUsers: NewUser[] = mongoUsers.map(user => ({
      email: user.email,
      password: user.password, // Already hashed
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      role: (user.role as any) || 'customer',
      status: (user.status as any) || 'active',
      phoneNumber: user.phoneNumber || null,
      avatar: user.avatar || null,
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    const migratedUsers = await db.insert(users).values(pgUsers).returning();
    console.log(`   ✅ Migrated ${migratedUsers.length} users`);

    // Create ID mapping for foreign key relationships
    const userIdMap = new Map<string, string>();
    mongoUsers.forEach((mongoUser, index) => {
      userIdMap.set(mongoUser._id, migratedUsers[index].id);
    });

    console.log("🏪 Migrating vendors...");
    const mongoVendors = await mongoDb.collection<MongoVendor>('vendors').find({}).toArray();
    
    const pgVendors: NewVendor[] = mongoVendors.map(vendor => ({
      userId: userIdMap.get(vendor.userId)!,
      businessName: vendor.businessName,
      slug: vendor.slug,
      description: vendor.description || null,
      email: vendor.email,
      phoneNumber: vendor.phoneNumber || null,
      status: (vendor.status as any) || 'pending',
      commissionRate: vendor.commissionRate?.toString() || '10.00',
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    }));

    const migratedVendors = await db.insert(vendors).values(pgVendors).returning();
    console.log(`   ✅ Migrated ${migratedVendors.length} vendors`);

    // Continue with categories, products, orders, etc...
    
    await mongoClient.close();
    
    */

    console.log("✅ Migration template ready!");
    console.log(
      "   Uncomment and customize the migration logic above to migrate your data."
    );
  } catch (error) {
    console.error("❌ Migration failed:");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack}`);
      }
    } else {
      console.error("   Unknown error:", error);
    }

    process.exit(1);
  } finally {
    if (pgConnection) {
      console.log("🔌 Closing PostgreSQL connection...");
      await pgConnection.end();
    }
  }
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Migration interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Migration terminated");
  process.exit(1);
});

migrateFromMongoDB();

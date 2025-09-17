#!/usr/bin/env tsx

/**
 * Database seeding script
 * Populates the database with sample data for development and testing
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { hashPassword } from "../src/shared/utils/crypto.utils";
import { config } from "../src/shared/config/env.config";
import {
  users,
  vendors,
  categories,
  products,
  type NewUser,
  type NewVendor,
  type NewCategory,
  type NewProduct,
} from "../src/core/database/schema/index";

async function seedDatabase() {
  console.log("🌱 Seeding database with sample data...");
  console.log(
    `📍 Database: ${config.database.url.replace(/\/\/.*@/, "//***@")}`
  );

  let connection: postgres.Sql | null = null;

  try {
    connection = postgres(config.database.url);
    const db = drizzle(connection, {
      schema: { users, vendors, categories, products },
    });

    // Test connection
    console.log("🔍 Testing database connection...");
    await connection`SELECT 1`;
    console.log("✅ Database connection successful");

    // Check if data already exists
    const existingUsers = await db.select().from(users).limit(1);
    if (existingUsers.length > 0) {
      console.log("⚠️  Database already contains data. Skipping seeding.");
      console.log("   Use --force flag to override (not implemented yet)");
      return;
    }

    console.log("👤 Creating sample users...");

    // Create admin user
    const adminUser: NewUser = {
      email: "admin@ecommerce.dev",
      password: await hashPassword("admin123"),
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      status: "active",
      emailVerified: true,
    };

    // Create vendor user
    const vendorUser: NewUser = {
      email: "vendor@ecommerce.dev",
      password: await hashPassword("vendor123"),
      firstName: "John",
      lastName: "Vendor",
      role: "vendor",
      status: "active",
      emailVerified: true,
    };

    // Create customer user
    const customerUser: NewUser = {
      email: "customer@ecommerce.dev",
      password: await hashPassword("customer123"),
      firstName: "Jane",
      lastName: "Customer",
      role: "customer",
      status: "active",
      emailVerified: true,
    };

    const [admin, vendorUserRecord, customer] = await db
      .insert(users)
      .values([adminUser, vendorUser, customerUser])
      .returning();

    console.log(`   ✅ Created ${3} users`);

    console.log("🏪 Creating sample vendor...");

    const sampleVendor: NewVendor = {
      userId: vendorUserRecord.id,
      businessName: "Tech Gadgets Store",
      slug: "tech-gadgets-store",
      description:
        "Your one-stop shop for the latest tech gadgets and accessories",
      businessType: "Electronics Retail",
      email: "business@techgadgets.dev",
      phoneNumber: "+1-555-0123",
      website: "https://techgadgets.dev",
      status: "approved",
      verificationStatus: "verified",
      commissionRate: "8.50",
      autoApproveProducts: true,
      metadata: {
        socialMedia: {
          twitter: "@techgadgets",
          instagram: "@techgadgetsstore",
        },
        businessHours: {
          monday: { open: "09:00", close: "18:00", closed: false },
          tuesday: { open: "09:00", close: "18:00", closed: false },
          wednesday: { open: "09:00", close: "18:00", closed: false },
          thursday: { open: "09:00", close: "18:00", closed: false },
          friday: { open: "09:00", close: "18:00", closed: false },
          saturday: { open: "10:00", close: "16:00", closed: false },
          sunday: { open: "12:00", close: "16:00", closed: false },
        },
      },
      approvedAt: new Date(),
    };

    const [vendor] = await db
      .insert(vendors)
      .values([sampleVendor])
      .returning();
    console.log("   ✅ Created sample vendor");

    console.log("📂 Creating sample categories...");

    const sampleCategories: NewCategory[] = [
      {
        name: "Electronics",
        slug: "electronics",
        description: "Electronic devices and gadgets",
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Smartphones",
        slug: "smartphones",
        description: "Mobile phones and accessories",
        isActive: true,
        sortOrder: 1,
      },
      {
        name: "Laptops",
        slug: "laptops",
        description: "Laptops and computer accessories",
        isActive: true,
        sortOrder: 2,
      },
    ];

    const createdCategories = await db
      .insert(categories)
      .values(sampleCategories)
      .returning();

    console.log(`   ✅ Created ${createdCategories.length} categories`);

    console.log("📦 Creating sample products...");

    const sampleProducts: NewProduct[] = [
      {
        vendorId: vendor.id,
        categoryId: createdCategories[1].id, // Smartphones
        name: "iPhone 15 Pro",
        slug: "iphone-15-pro",
        description:
          "The latest iPhone with advanced camera system and A17 Pro chip",
        shortDescription: "Latest iPhone with pro features",
        price: "999.00",
        compareAtPrice: "1099.00",
        sku: "IPHONE15PRO-128",
        trackQuantity: true,
        quantity: 50,
        status: "active",
        condition: "new",
        featured: true,
        images: ["/images/iphone-15-pro-1.jpg", "/images/iphone-15-pro-2.jpg"],
        attributes: {
          brand: "Apple",
          storage: "128GB",
          color: "Natural Titanium",
          warranty: "1 year",
        },
        requiresShipping: true,
        taxable: true,
        publishedAt: new Date(),
      },
      {
        vendorId: vendor.id,
        categoryId: createdCategories[2].id, // Laptops
        name: "MacBook Pro 14-inch",
        slug: "macbook-pro-14-inch",
        description: "Powerful laptop with M3 chip for professional work",
        shortDescription: "Professional laptop with M3 chip",
        price: "1999.00",
        sku: "MBP14-M3-512",
        trackQuantity: true,
        quantity: 25,
        status: "active",
        condition: "new",
        featured: true,
        images: ["/images/macbook-pro-14-1.jpg"],
        attributes: {
          brand: "Apple",
          processor: "M3",
          storage: "512GB SSD",
          memory: "16GB",
          screen: "14-inch Liquid Retina XDR",
        },
        requiresShipping: true,
        taxable: true,
        publishedAt: new Date(),
      },
    ];

    const createdProducts = await db
      .insert(products)
      .values(sampleProducts)
      .returning();

    console.log(`   ✅ Created ${createdProducts.length} products`);

    console.log("✅ Database seeded successfully!");
    console.log("\n📊 Summary:");
    console.log(`   👤 Users: 3 (1 admin, 1 vendor, 1 customer)`);
    console.log(`   🏪 Vendors: 1`);
    console.log(`   📂 Categories: ${createdCategories.length}`);
    console.log(`   📦 Products: ${createdProducts.length}`);
    console.log("\n🔑 Login credentials:");
    console.log("   Admin: admin@ecommerce.dev / admin123");
    console.log("   Vendor: vendor@ecommerce.dev / vendor123");
    console.log("   Customer: customer@ecommerce.dev / customer123");
  } catch (error) {
    console.error("❌ Seeding failed:");

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
    if (connection) {
      console.log("🔌 Closing database connection...");
      await connection.end();
    }
  }
}

// Handle process signals
process.on("SIGINT", () => {
  console.log("\n⚠️  Seeding interrupted by user");
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Seeding terminated");
  process.exit(1);
});

seedDatabase();

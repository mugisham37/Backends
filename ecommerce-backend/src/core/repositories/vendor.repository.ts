/**
 * Vendor repository
 * Handles all database operations for vendors
 */

import { eq, and, ilike, or, sql, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/connection";
import {
  vendors,
  Vendor,
  NewVendor,
  vendorStatusEnum,
  verificationStatusEnum,
  users,
  products,
} from "../database/schema";

// Vendor-specific types
export interface VendorFilters {
  status?: (typeof vendorStatusEnum.enumValues)[number];
  verificationStatus?: (typeof verificationStatusEnum.enumValues)[number];
  businessType?: string;
  search?: string; // Search in business name, email
  userId?: string;
}

export interface CreateVendorData
  extends Omit<NewVendor, "id" | "createdAt" | "updatedAt"> {}

export interface UpdateVendorData
  extends Partial<Omit<Vendor, "id" | "createdAt" | "updatedAt">> {}

export interface VendorWithUser extends Vendor {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface VendorStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalRevenue: string;
}

export class VendorRepository extends BaseRepository<
  Vendor,
  NewVendor,
  UpdateVendorData
> {
  protected table = vendors;
  protected idColumn = vendors.id;

  constructor(db: Database) {
    super(db);
  }

  // Find vendor by slug
  async findBySlug(slug: string): Promise<Vendor | null> {
    const result = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.slug, slug))
      .limit(1);

    return result[0] || null;
  }

  // Find vendor by user ID
  async findByUserId(userId: string): Promise<Vendor | null> {
    const result = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  // Find vendor by email
  async findByEmail(email: string): Promise<Vendor | null> {
    const result = await this.db
      .select()
      .from(vendors)
      .where(eq(vendors.email, email))
      .limit(1);

    return result[0] || null;
  }

  // Find vendors by status
  async findByStatus(
    status: (typeof vendorStatusEnum.enumValues)[number]
  ): Promise<Vendor[]> {
    return this.db
      .select()
      .from(vendors)
      .where(eq(vendors.status, status))
      .orderBy(desc(vendors.createdAt));
  }

  // Find vendors with user information
  async findWithUser(id: string): Promise<VendorWithUser | null> {
    const result = await this.db
      .select({
        // Vendor fields
        id: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        slug: vendors.slug,
        description: vendors.description,
        businessType: vendors.businessType,
        email: vendors.email,
        phoneNumber: vendors.phoneNumber,
        website: vendors.website,
        taxId: vendors.taxId,
        businessLicense: vendors.businessLicense,
        status: vendors.status,
        verificationStatus: vendors.verificationStatus,
        commissionRate: vendors.commissionRate,
        autoApproveProducts: vendors.autoApproveProducts,
        allowReviews: vendors.allowReviews,
        metadata: vendors.metadata,
        approvedAt: vendors.approvedAt,
        createdAt: vendors.createdAt,
        updatedAt: vendors.updatedAt,
        // User fields
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(vendors.id, id))
      .limit(1);

    return result[0] || null;
  }

  // Search vendors with filters
  async findWithFilters(filters: VendorFilters): Promise<Vendor[]> {
    let query = this.db.select().from(vendors);

    const conditions = [];

    if (filters.status) {
      conditions.push(eq(vendors.status, filters.status));
    }

    if (filters.verificationStatus) {
      conditions.push(
        eq(vendors.verificationStatus, filters.verificationStatus)
      );
    }

    if (filters.businessType) {
      conditions.push(eq(vendors.businessType, filters.businessType));
    }

    if (filters.userId) {
      conditions.push(eq(vendors.userId, filters.userId));
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(vendors.businessName, searchTerm),
          ilike(vendors.email, searchTerm),
          ilike(vendors.description, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(vendors.createdAt));
  }

  // Check if slug exists
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.slug, slug));

    if (excludeId) {
      query = query.where(
        and(eq(vendors.slug, slug), sql`${vendors.id} != ${excludeId}`)
      );
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Check if email exists
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .select({ id: vendors.id })
      .from(vendors)
      .where(eq(vendors.email, email));

    if (excludeId) {
      query = query.where(
        and(eq(vendors.email, email), sql`${vendors.id} != ${excludeId}`)
      );
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Update vendor status
  async updateStatus(
    id: string,
    status: (typeof vendorStatusEnum.enumValues)[number]
  ): Promise<Vendor | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Set approvedAt timestamp when approving
    if (status === "approved") {
      updateData.approvedAt = new Date();
    }

    const result = await this.db
      .update(vendors)
      .set(updateData)
      .where(eq(vendors.id, id))
      .returning();

    return result[0] || null;
  }

  // Update verification status
  async updateVerificationStatus(
    id: string,
    verificationStatus: (typeof verificationStatusEnum.enumValues)[number]
  ): Promise<Vendor | null> {
    const result = await this.db
      .update(vendors)
      .set({
        verificationStatus,
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, id))
      .returning();

    return result[0] || null;
  }

  // Get vendor statistics
  async getVendorStats(vendorId: string): Promise<VendorStats> {
    const [productStats, orderStats] = await Promise.all([
      // Product statistics
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(case when status = 'active' then 1 end)::int`,
        })
        .from(products)
        .where(eq(products.vendorId, vendorId)),

      // Order statistics (would need order items table)
      // For now, return placeholder values
      Promise.resolve([{ totalOrders: 0, totalRevenue: "0.00" }]),
    ]);

    return {
      totalProducts: productStats[0]?.total || 0,
      activeProducts: productStats[0]?.active || 0,
      totalOrders: orderStats[0]?.totalOrders || 0,
      totalRevenue: orderStats[0]?.totalRevenue || "0.00",
    };
  }

  // Get vendor statistics summary
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byVerificationStatus: Record<string, number>;
    approved: number;
    pending: number;
  }> {
    const [totalResult, statusStats, verificationStats] = await Promise.all([
      this.count(),
      this.db
        .select({
          status: vendors.status,
          count: sql<number>`count(*)::int`,
        })
        .from(vendors)
        .groupBy(vendors.status),
      this.db
        .select({
          verificationStatus: vendors.verificationStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(vendors)
        .groupBy(vendors.verificationStatus),
    ]);

    const byStatus: Record<string, number> = {};
    statusStats.forEach((stat) => {
      byStatus[stat.status] = stat.count;
    });

    const byVerificationStatus: Record<string, number> = {};
    verificationStats.forEach((stat) => {
      byVerificationStatus[stat.verificationStatus] = stat.count;
    });

    return {
      total: totalResult,
      byStatus,
      byVerificationStatus,
      approved: byStatus.approved || 0,
      pending: byStatus.pending || 0,
    };
  }

  // Get recently created vendors
  async getRecentVendors(limit: number = 10): Promise<Vendor[]> {
    return this.db
      .select()
      .from(vendors)
      .orderBy(desc(vendors.createdAt))
      .limit(limit);
  }

  // Get top vendors by product count
  async getTopVendorsByProducts(
    limit: number = 10
  ): Promise<Array<Vendor & { productCount: number }>> {
    const result = await this.db
      .select({
        ...vendors,
        productCount: sql<number>`count(${products.id})::int`,
      })
      .from(vendors)
      .leftJoin(products, eq(vendors.id, products.vendorId))
      .groupBy(vendors.id)
      .orderBy(desc(sql`count(${products.id})`))
      .limit(limit);

    return result;
  }
}

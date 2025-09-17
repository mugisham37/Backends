/**
 * Vendor DataLoader
 * Prevents N+1 queries when fetching vendors
 */

import DataLoader from "dataloader";
import { VendorRepository } from "../../../core/repositories/vendor.repository.js";
import { Vendor } from "../../../core/database/schema/index.js";

export class VendorLoader {
  private vendorRepository: VendorRepository;
  private byIdLoader: DataLoader<string, Vendor | null>;
  private byUserIdLoader: DataLoader<string, Vendor | null>;
  private bySlugLoader: DataLoader<string, Vendor | null>;

  constructor(vendorRepository: VendorRepository) {
    this.vendorRepository = vendorRepository;

    // Loader for vendors by ID
    this.byIdLoader = new DataLoader<string, Vendor | null>(
      async (ids: readonly string[]) => {
        try {
          const vendors = await this.vendorRepository.findByIds([...ids]);
          const vendorMap = new Map(
            vendors.map((vendor) => [vendor.id, vendor])
          );

          return ids.map((id) => vendorMap.get(id) || null);
        } catch (error) {
          return ids.map(() => error as Error);
        }
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );

    // Loader for vendors by user ID
    this.byUserIdLoader = new DataLoader<string, Vendor | null>(
      async (userIds: readonly string[]) => {
        try {
          const vendors = await this.vendorRepository.findByUserIds([
            ...userIds,
          ]);
          const vendorMap = new Map(
            vendors.map((vendor) => [vendor.userId, vendor])
          );

          return userIds.map((userId) => vendorMap.get(userId) || null);
        } catch (error) {
          return userIds.map(() => error as Error);
        }
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );

    // Loader for vendors by slug
    this.bySlugLoader = new DataLoader<string, Vendor | null>(
      async (slugs: readonly string[]) => {
        try {
          const vendors = await this.vendorRepository.findBySlugs([...slugs]);
          const vendorMap = new Map(
            vendors.map((vendor) => [vendor.slug, vendor])
          );

          return slugs.map((slug) => vendorMap.get(slug) || null);
        } catch (error) {
          return slugs.map(() => error as Error);
        }
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );
  }

  // Load vendor by ID
  async loadById(id: string): Promise<Vendor | null> {
    return this.byIdLoader.load(id);
  }

  // Load multiple vendors by IDs
  async loadManyByIds(ids: string[]): Promise<(Vendor | null | Error)[]> {
    return this.byIdLoader.loadMany(ids);
  }

  // Load vendor by user ID
  async loadByUserId(userId: string): Promise<Vendor | null> {
    return this.byUserIdLoader.load(userId);
  }

  // Load multiple vendors by user IDs
  async loadManyByUserIds(
    userIds: string[]
  ): Promise<(Vendor | null | Error)[]> {
    return this.byUserIdLoader.loadMany(userIds);
  }

  // Load vendor by slug
  async loadBySlug(slug: string): Promise<Vendor | null> {
    return this.bySlugLoader.load(slug);
  }

  // Load multiple vendors by slugs
  async loadManyBySlugs(slugs: string[]): Promise<(Vendor | null | Error)[]> {
    return this.bySlugLoader.loadMany(slugs);
  }

  // Clear cache for specific vendor
  clearVendor(id: string): void {
    this.byIdLoader.clear(id);
  }

  // Clear cache for specific user
  clearVendorByUserId(userId: string): void {
    this.byUserIdLoader.clear(userId);
  }

  // Clear cache for specific slug
  clearVendorBySlug(slug: string): void {
    this.bySlugLoader.clear(slug);
  }

  // Clear all caches
  clearAll(): void {
    this.byIdLoader.clearAll();
    this.byUserIdLoader.clearAll();
    this.bySlugLoader.clearAll();
  }

  // Prime cache with vendor data
  prime(vendor: Vendor): void {
    this.byIdLoader.prime(vendor.id, vendor);
    this.byUserIdLoader.prime(vendor.userId, vendor);
    this.bySlugLoader.prime(vendor.slug, vendor);
  }
}

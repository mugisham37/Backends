/**
 * Cart repository
 * Enhanced repository for cart management with shopping cart specific operations
 */

import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sql,
  gte,
  lte,
  isNull,
  isNotNull,
} from "drizzle-orm";
import {
  BaseRepository,
  QueryOptions,
  PaginatedResult,
} from "./base.repository";
import {
  carts,
  cartItems,
  cartSavedItems,
  Cart,
  NewCart,
  CartItem,
  NewCartItem,
  CartSavedItem,
  NewCartSavedItem,
  cartStatusEnum,
} from "../database/schema/cart";
import { products, productVariants } from "../database/schema/products";
import { vendors } from "../database/schema/vendors";
import type { Database } from "../database/connection";

// Cart specific filter interfaces
export interface CartFilters {
  userId?: string;
  sessionId?: string;
  status?: "active" | "abandoned" | "converted" | "expired";
  type?: "shopping" | "wishlist" | "saved_for_later";
  hasItems?: boolean;
  minTotal?: number;
  maxTotal?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  lastActivityAfter?: Date;
  lastActivityBefore?: Date;
}

export interface CartItemFilters {
  cartId?: string;
  productId?: string;
  vendorId?: string;
  priceRange?: {
    min: number;
    max: number;
  };
}

export interface CartWithItems extends Cart {
  items: Array<
    CartItem & {
      product?: any;
      variant?: any;
      vendor?: any;
    }
  >;
  savedItems?: Array<CartSavedItem>;
  itemCount: number;
  totalQuantity: number;
}

export interface CartSummary {
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  convertedCarts: number;
  totalValue: number;
  averageCartValue: number;
  averageItemsPerCart: number;
}

export class CartRepository extends BaseRepository<Cart, NewCart> {
  protected table = carts;
  protected idColumn = carts.id;
  protected tableName = "carts";

  constructor(db: Database) {
    super(db);
  }

  // Cart-specific methods
  async findByUserId(
    userId: string,
    options: QueryOptions = {}
  ): Promise<Cart[]> {
    const result = await this.db
      .select()
      .from(carts)
      .where(eq(carts.userId, userId))
      .orderBy(desc(carts.updatedAt));

    return result;
  }

  async findActiveCartByUser(userId: string): Promise<Cart | null> {
    const result = await this.db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.userId, userId),
          eq(carts.status, "active"),
          eq(carts.type, "shopping")
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async findActiveCartBySession(sessionId: string): Promise<Cart | null> {
    const result = await this.db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.sessionId, sessionId),
          eq(carts.status, "active"),
          eq(carts.type, "shopping")
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async findCartWithItems(cartId: string): Promise<CartWithItems | null> {
    // Get cart
    const cart = await this.findById(cartId);
    if (!cart) return null;

    // Get cart items with product, variant, and vendor info
    const items = await this.db
      .select({
        id: cartItems.id,
        cartId: cartItems.cartId,
        productId: cartItems.productId,
        variantId: cartItems.variantId,
        vendorId: cartItems.vendorId,
        productName: cartItems.productName,
        productSlug: cartItems.productSlug,
        productSku: cartItems.productSku,
        variantTitle: cartItems.variantTitle,
        productImage: cartItems.productImage,
        price: cartItems.price,
        compareAtPrice: cartItems.compareAtPrice,
        quantity: cartItems.quantity,
        subtotal: cartItems.subtotal,
        selectedAttributes: cartItems.selectedAttributes,
        customizations: cartItems.customizations,
        productSnapshot: cartItems.productSnapshot,
        notes: cartItems.notes,
        addedAt: cartItems.addedAt,
        updatedAt: cartItems.updatedAt,
        // Product info
        product: {
          name: products.name,
          slug: products.slug,
          status: products.status,
          images: products.images,
        },
        // Variant info
        variant: {
          title: productVariants.title,
          options: productVariants.options,
          isActive: productVariants.isActive,
        },
        // Vendor info
        vendor: {
          businessName: vendors.businessName,
          status: vendors.status,
        },
      })
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .leftJoin(productVariants, eq(cartItems.variantId, productVariants.id))
      .leftJoin(vendors, eq(cartItems.vendorId, vendors.id))
      .where(eq(cartItems.cartId, cartId))
      .orderBy(desc(cartItems.addedAt));

    // Get saved items
    const savedItems = await this.db
      .select()
      .from(cartSavedItems)
      .where(eq(cartSavedItems.cartId, cartId))
      .orderBy(desc(cartSavedItems.savedAt));

    // Calculate aggregates
    const itemCount = items.length;
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cart,
      items,
      savedItems,
      itemCount,
      totalQuantity,
    };
  }

  async createCartWithUser(
    userId: string,
    type: "shopping" | "wishlist" = "shopping"
  ): Promise<Cart> {
    // Check if user already has an active cart of this type
    const existingCart = await this.db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.userId, userId),
          eq(carts.status, "active"),
          eq(carts.type, type)
        )
      )
      .limit(1);

    if (existingCart[0]) {
      return existingCart[0];
    }

    // Create new cart
    const cartData: NewCart = {
      userId,
      type,
      status: "active",
      currency: "USD",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };

    return await this.create(cartData);
  }

  async createGuestCart(sessionId: string): Promise<Cart> {
    const cartData: NewCart = {
      sessionId,
      type: "shopping",
      status: "active",
      currency: "USD",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days for guest
    };

    return await this.create(cartData);
  }

  async addItemToCart(
    cartId: string,
    itemData: Omit<NewCartItem, "cartId">
  ): Promise<CartItem> {
    // Check if item already exists in cart
    const existingItem = await this.db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.productId, itemData.productId),
          itemData.variantId
            ? eq(cartItems.variantId, itemData.variantId)
            : isNull(cartItems.variantId)
        )
      )
      .limit(1);

    if (existingItem[0]) {
      // Update quantity of existing item
      const itemQuantity = itemData.quantity ?? 1;
      const newQuantity = existingItem[0].quantity + itemQuantity;
      const newSubtotal = parseFloat(itemData.price) * newQuantity;

      const updatedItem = await this.db
        .update(cartItems)
        .set({
          quantity: newQuantity,
          subtotal: newSubtotal.toString(),
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, existingItem[0].id))
        .returning();

      await this.updateCartTotals(cartId);
      return updatedItem[0];
    }

    // Create new cart item
    const itemQuantity = itemData.quantity ?? 1;
    const newItem = await this.db
      .insert(cartItems)
      .values({
        cartId,
        ...itemData,
        quantity: itemQuantity,
        subtotal: (parseFloat(itemData.price) * itemQuantity).toString(),
      })
      .returning();

    await this.updateCartTotals(cartId);
    return newItem[0];
  }

  async findCartItemById(itemId: string): Promise<CartItem | null> {
    const result = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.id, itemId))
      .limit(1);

    return result[0] || null;
  }

  async updateCartItem(
    itemId: string,
    updates: Partial<CartItem>
  ): Promise<CartItem | null> {
    if (updates.quantity !== undefined && updates.price !== undefined) {
      updates.subtotal = (
        parseFloat(updates.price) * updates.quantity
      ).toString();
    }

    const updatedItem = await this.db
      .update(cartItems)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, itemId))
      .returning();

    if (updatedItem[0]) {
      await this.updateCartTotals(updatedItem[0].cartId);
      return updatedItem[0];
    }

    return null;
  }

  async removeCartItem(itemId: string): Promise<boolean> {
    const item = await this.db
      .select({ cartId: cartItems.cartId })
      .from(cartItems)
      .where(eq(cartItems.id, itemId))
      .limit(1);

    if (!item[0]) return false;

    const result = await this.db
      .delete(cartItems)
      .where(eq(cartItems.id, itemId))
      .returning();

    if (result.length > 0) {
      await this.updateCartTotals(item[0].cartId);
      return true;
    }

    return false;
  }

  async clearCart(cartId: string): Promise<boolean> {
    await this.db.delete(cartItems).where(eq(cartItems.cartId, cartId));
    await this.db
      .delete(cartSavedItems)
      .where(eq(cartSavedItems.cartId, cartId));

    // Reset cart totals
    await this.db
      .update(carts)
      .set({
        subtotal: "0.00",
        taxAmount: "0.00",
        discountAmount: "0.00",
        shippingAmount: "0.00",
        total: "0.00",
        appliedCoupons: [],
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cartId));

    return true;
  }

  async saveItemForLater(
    itemId: string,
    reason?: string
  ): Promise<CartSavedItem | null> {
    // Get the cart item
    const item = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.id, itemId))
      .limit(1);

    if (!item[0]) return null;

    // Create saved item
    const savedItemData: NewCartSavedItem = {
      cartId: item[0].cartId,
      originalCartItemId: itemId,
      productId: item[0].productId,
      variantId: item[0].variantId,
      vendorId: item[0].vendorId,
      productName: item[0].productName,
      productSlug: item[0].productSlug,
      productSku: item[0].productSku,
      variantTitle: item[0].variantTitle,
      productImage: item[0].productImage,
      price: item[0].price,
      quantity: item[0].quantity,
      selectedAttributes: item[0].selectedAttributes,
      productSnapshot: item[0].productSnapshot,
      savedReason: reason,
    };

    const savedItem = await this.db
      .insert(cartSavedItems)
      .values(savedItemData)
      .returning();

    // Remove from cart
    await this.removeCartItem(itemId);

    return savedItem[0];
  }

  async restoreItemFromSaved(savedItemId: string): Promise<CartItem | null> {
    // Get the saved item
    const savedItem = await this.db
      .select()
      .from(cartSavedItems)
      .where(eq(cartSavedItems.id, savedItemId))
      .limit(1);

    if (!savedItem[0]) return null;

    // Add back to cart
    const cartItemData: Omit<NewCartItem, "cartId"> = {
      productId: savedItem[0].productId,
      variantId: savedItem[0].variantId,
      vendorId: savedItem[0].vendorId,
      productName: savedItem[0].productName,
      productSlug: savedItem[0].productSlug,
      productSku: savedItem[0].productSku,
      variantTitle: savedItem[0].variantTitle,
      productImage: savedItem[0].productImage,
      price: savedItem[0].price,
      quantity: savedItem[0].quantity,
      subtotal: (
        parseFloat(savedItem[0].price) * savedItem[0].quantity
      ).toString(),
      selectedAttributes: savedItem[0].selectedAttributes,
      productSnapshot:
        savedItem[0].productSnapshot &&
        typeof savedItem[0].productSnapshot === "object" &&
        "name" in savedItem[0].productSnapshot
          ? (savedItem[0].productSnapshot as {
              name: string;
              description?: string;
              image?: string;
              attributes?: { [key: string]: any };
              vendor?: {
                id: string;
                name: string;
                businessName: string;
              };
              availability?: {
                inStock: boolean;
                quantity: number;
                lowStockThreshold: number;
              };
            })
          : undefined,
    };

    const restoredItem = await this.addItemToCart(
      savedItem[0].cartId,
      cartItemData
    );

    // Remove from saved items
    await this.db
      .delete(cartSavedItems)
      .where(eq(cartSavedItems.id, savedItemId));

    return restoredItem;
  }

  async updateCartTotals(cartId: string): Promise<void> {
    // Calculate totals from cart items
    const totals = await this.db
      .select({
        subtotal: sql<number>`COALESCE(SUM(${cartItems.subtotal}::numeric), 0)`,
        itemCount: count(cartItems.id),
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cartId));

    const subtotal = totals[0]?.subtotal || 0;

    // Get current cart for tax and shipping
    const cart = await this.findById(cartId);
    if (!cart) return;

    const taxAmount = parseFloat(cart.taxAmount || "0");
    const shippingAmount = parseFloat(cart.shippingAmount || "0");
    const discountAmount = parseFloat(cart.discountAmount || "0");
    const total = subtotal + taxAmount + shippingAmount - discountAmount;

    // Update cart
    await this.db
      .update(carts)
      .set({
        subtotal: subtotal.toString(),
        total: total.toString(),
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cartId));
  }

  async markCartAsConverted(cartId: string, orderId: string): Promise<void> {
    await this.db
      .update(carts)
      .set({
        status: "converted",
        convertedOrderId: orderId,
        convertedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cartId));
  }

  async markCartAsAbandoned(cartId: string): Promise<void> {
    await this.db
      .update(carts)
      .set({
        status: "abandoned",
        updatedAt: new Date(),
      })
      .where(eq(carts.id, cartId));
  }

  async findAbandonedCarts(olderThanDays: number = 1): Promise<Cart[]> {
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );

    const result = await this.db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.status, "active"),
          lte(carts.lastActivityAt, cutoffDate),
          isNotNull(carts.userId) // Only user carts, not guest carts
        )
      )
      .orderBy(asc(carts.lastActivityAt));

    return result;
  }

  async findExpiredCarts(): Promise<Cart[]> {
    const now = new Date();

    const result = await this.db
      .select()
      .from(carts)
      .where(and(eq(carts.status, "active"), lte(carts.expiresAt, now)))
      .orderBy(asc(carts.expiresAt));

    return result;
  }

  async getCartSummary(filters: CartFilters = {}): Promise<CartSummary> {
    const whereClause = this.buildCartWhereClause(filters);

    const summary = await this.db
      .select({
        totalCarts: count(carts.id),
        totalValue: sql<number>`COALESCE(SUM(${carts.total}::numeric), 0)`,
      })
      .from(carts)
      .where(whereClause);

    const statusCounts = await this.db
      .select({
        status: carts.status,
        count: count(carts.id),
      })
      .from(carts)
      .where(whereClause)
      .groupBy(carts.status);

    const itemStats = await this.db
      .select({
        avgItems: sql<number>`COALESCE(AVG(item_counts.item_count), 0)`,
      })
      .from(
        this.db
          .select({
            cartId: cartItems.cartId,
            itemCount: count(cartItems.id).as("item_count"),
          })
          .from(cartItems)
          .groupBy(cartItems.cartId)
          .as("item_counts")
      );

    const totalCarts = summary[0]?.totalCarts || 0;
    const totalValue = summary[0]?.totalValue || 0;

    const activeCarts =
      statusCounts.find((s) => s.status === "active")?.count || 0;
    const abandonedCarts =
      statusCounts.find((s) => s.status === "abandoned")?.count || 0;
    const convertedCarts =
      statusCounts.find((s) => s.status === "converted")?.count || 0;

    return {
      totalCarts,
      activeCarts,
      abandonedCarts,
      convertedCarts,
      totalValue,
      averageCartValue: totalCarts > 0 ? totalValue / totalCarts : 0,
      averageItemsPerCart: itemStats[0]?.avgItems || 0,
    };
  }

  private buildCartWhereClause(filters: CartFilters) {
    const conditions = [];

    if (filters.userId) {
      conditions.push(eq(carts.userId, filters.userId));
    }

    if (filters.sessionId) {
      conditions.push(eq(carts.sessionId, filters.sessionId));
    }

    if (filters.status) {
      conditions.push(eq(carts.status, filters.status));
    }

    if (filters.type) {
      conditions.push(eq(carts.type, filters.type));
    }

    if (filters.minTotal !== undefined) {
      conditions.push(gte(sql`${carts.total}::numeric`, filters.minTotal));
    }

    if (filters.maxTotal !== undefined) {
      conditions.push(lte(sql`${carts.total}::numeric`, filters.maxTotal));
    }

    if (filters.createdAfter) {
      conditions.push(gte(carts.createdAt, filters.createdAfter));
    }

    if (filters.createdBefore) {
      conditions.push(lte(carts.createdAt, filters.createdBefore));
    }

    if (filters.lastActivityAfter) {
      conditions.push(gte(carts.lastActivityAt, filters.lastActivityAfter));
    }

    if (filters.lastActivityBefore) {
      conditions.push(lte(carts.lastActivityAt, filters.lastActivityBefore));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

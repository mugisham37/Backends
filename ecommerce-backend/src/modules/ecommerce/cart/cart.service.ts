/**
 * Cart service
 * Clean business logic for cart management with product validation and integrations
 */

import {
  CartRepository,
  CartWithItems,
} from "../../../core/repositories/cart.repository";
import { ProductRepository } from "../../../core/repositories/product.repository";
import { UserRepository } from "../../../core/repositories/user.repository";
import { VendorRepository } from "../../../core/repositories/vendor.repository";
import {
  Cart,
  NewCart,
  CartItem,
  NewCartItem,
} from "../../../core/database/schema/cart";
import {
  AddCartItemInput,
  UpdateCartItemInput,
  UpdateCartInput,
  ApplyCouponInput,
  SaveForLaterInput,
  ConvertCartInput,
  CartOutput,
  CartItemOutput,
  SavedItemOutput,
  CartSummaryOutput,
  CartAnalytics,
  CartListFilters,
  CartError,
  CartErrorCodes,
} from "./cart.types";
import { NotificationService } from "../../notifications/notification.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import { CacheService } from "../../cache/cache.service";

export class CartService {
  constructor(
    private cartRepo: CartRepository,
    private productRepo: ProductRepository,
    private userRepo: UserRepository,
    private vendorRepo: VendorRepository,
    private notificationService?: NotificationService,
    private analyticsService?: AnalyticsService,
    private cacheService?: CacheService
  ) {}

  // ========== CART MANAGEMENT ==========

  async getOrCreateCart(
    userId?: string,
    sessionId?: string,
    type: "shopping" | "wishlist" = "shopping"
  ): Promise<CartOutput> {
    let cart: Cart | null = null;

    // Try to find existing cart
    if (userId) {
      cart = await this.cartRepo.findActiveCartByUser(userId);
    } else if (sessionId) {
      cart = await this.cartRepo.findActiveCartBySession(sessionId);
    }

    // Create new cart if none found
    if (!cart) {
      if (userId) {
        cart = await this.cartRepo.createCartWithUser(userId, type);
      } else if (sessionId) {
        cart = await this.cartRepo.createGuestCart(sessionId);
      } else {
        throw new Error("Either userId or sessionId must be provided");
      }
    }

    // Get cart with items and return formatted output
    const cartWithItems = await this.cartRepo.findCartWithItems(cart.id);
    if (!cartWithItems) {
      throw new Error("Failed to retrieve cart after creation");
    }

    return await this.formatCartOutput(cartWithItems);
  }

  async getCart(cartId: string): Promise<CartOutput | null> {
    const cartWithItems = await this.cartRepo.findCartWithItems(cartId);
    if (!cartWithItems) return null;

    return await this.formatCartOutput(cartWithItems);
  }

  async updateCart(
    cartId: string,
    updates: UpdateCartInput
  ): Promise<CartOutput> {
    // Verify cart exists and is active
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw this.createError(CartErrorCodes.CART_NOT_FOUND, "Cart not found");
    }

    if (cart.status === "converted") {
      throw this.createError(
        CartErrorCodes.CART_ALREADY_CONVERTED,
        "Cart has already been converted to order"
      );
    }

    // Update cart
    const updatedCart = await this.cartRepo.update(cartId, {
      customerEmail: updates.customerEmail,
      customerPhone: updates.customerPhone,
      shippingAddress: updates.shippingAddress,
      shippingMethod: updates.shippingMethod,
      notes: updates.notes,
      metadata: updates.metadata,
      lastActivityAt: new Date(),
    });

    if (!updatedCart) {
      throw new Error("Failed to update cart");
    }

    // Get updated cart with items
    const cartWithItems = await this.cartRepo.findCartWithItems(cartId);
    if (!cartWithItems) {
      throw new Error("Failed to retrieve updated cart");
    }

    // Track analytics
    await this.trackCartEvent("cart_updated", cartWithItems);

    return await this.formatCartOutput(cartWithItems);
  }

  async clearCart(cartId: string): Promise<boolean> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw this.createError(CartErrorCodes.CART_NOT_FOUND, "Cart not found");
    }

    const success = await this.cartRepo.clearCart(cartId);

    if (success) {
      // Track analytics
      await this.trackCartEvent("cart_cleared", {
        ...cart,
        items: [],
        savedItems: [],
        itemCount: 0,
        totalQuantity: 0,
      });

      // Clear cache
      await this.clearCartCache(cartId);
    }

    return success;
  }

  async deleteCart(cartId: string): Promise<boolean> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) return false;

    // Track analytics before deletion
    const cartWithItems = await this.cartRepo.findCartWithItems(cartId);
    if (cartWithItems) {
      await this.trackCartEvent("cart_deleted", cartWithItems);
    }

    const success = await this.cartRepo.delete(cartId);

    if (success) {
      await this.clearCartCache(cartId);
    }

    return success;
  }

  // ========== CART ITEMS MANAGEMENT ==========

  async addItemToCart(
    cartId: string,
    input: AddCartItemInput
  ): Promise<CartItemOutput> {
    // Verify cart exists and is active
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw this.createError(CartErrorCodes.CART_NOT_FOUND, "Cart not found");
    }

    if (cart.status !== "active") {
      throw this.createError(
        CartErrorCodes.CART_EXPIRED,
        "Cart is no longer active"
      );
    }

    // Validate product and variant
    const { product, variant, vendor } = await this.validateProductForCart(
      input.productId,
      input.variantId,
      input.quantity
    );

    // Calculate pricing
    const price = variant
      ? parseFloat(variant.price || product.price)
      : parseFloat(product.price);
    const compareAtPrice = variant?.compareAtPrice || product.compareAtPrice;

    // Create cart item data
    const itemData: Omit<NewCartItem, "cartId"> = {
      productId: input.productId,
      variantId: input.variantId,
      vendorId: product.vendorId,
      productName: product.name,
      productSlug: product.slug,
      productSku: variant?.sku || product.sku,
      variantTitle: variant?.title,
      productImage: variant?.image || product.images?.[0],
      price: price.toString(),
      compareAtPrice: compareAtPrice?.toString(),
      quantity: input.quantity,
      subtotal: (price * input.quantity).toString(),
      selectedAttributes: input.selectedAttributes,
      customizations: input.customizations,
      notes: input.notes,
      productSnapshot: {
        name: product.name,
        description: product.description,
        image: variant?.image || product.images?.[0],
        vendor: {
          id: vendor.id,
          name: vendor.businessName,
          businessName: vendor.businessName,
        },
        availability: {
          inStock: product.quantity > 0,
          quantity: product.quantity,
          lowStockThreshold: product.lowStockThreshold,
        },
      },
    };

    // Add item to cart
    const cartItem = await this.cartRepo.addItemToCart(cartId, itemData);

    // Clear cache and track analytics
    await this.clearCartCache(cartId);
    await this.trackCartEvent("item_added", cart, {
      productId: input.productId,
      variantId: input.variantId,
      quantity: input.quantity,
      price,
    });

    // Format and return cart item
    return this.formatCartItemOutput(cartItem, product, variant, vendor);
  }

  async updateCartItem(
    itemId: string,
    updates: UpdateCartItemInput
  ): Promise<CartItemOutput> {
    // Get current cart item
    const currentItem = await this.cartRepo.findCartItemById(itemId);

    if (!currentItem) {
      throw this.createError(
        CartErrorCodes.ITEM_NOT_FOUND,
        "Cart item not found"
      );
    }

    // If quantity is being updated, validate stock
    if (updates.quantity !== undefined) {
      await this.validateProductForCart(
        currentItem.productId,
        currentItem.variantId || undefined,
        updates.quantity
      );
    }

    // Update cart item
    const updatedItem = await this.cartRepo.updateCartItem(itemId, updates);
    if (!updatedItem) {
      throw new Error("Failed to update cart item");
    }

    // Clear cache and track analytics
    await this.clearCartCache(currentItem.cartId);
    await this.trackCartEvent(
      "item_updated",
      { id: currentItem.cartId },
      {
        itemId,
        updates,
      }
    );

    // Get product details for formatting
    const { product, variant, vendor } = await this.getProductDetails(
      currentItem.productId,
      currentItem.variantId || undefined
    );

    return this.formatCartItemOutput(updatedItem, product, variant, vendor);
  }

  async removeCartItem(itemId: string): Promise<boolean> {
    // Get cart item first to track analytics
    const currentItem = await this.cartRepo.findCartItemById(itemId);

    if (!currentItem) {
      throw this.createError(
        CartErrorCodes.ITEM_NOT_FOUND,
        "Cart item not found"
      );
    }

    const success = await this.cartRepo.removeCartItem(itemId);

    if (success) {
      // Clear cache and track analytics
      await this.clearCartCache(currentItem.cartId);
      await this.trackCartEvent(
        "item_removed",
        { id: currentItem.cartId },
        {
          itemId,
          productId: currentItem.productId,
          quantity: currentItem.quantity,
        }
      );
    }

    return success;
  }

  // ========== SAVE FOR LATER ==========

  async saveItemForLater(input: SaveForLaterInput): Promise<SavedItemOutput> {
    const savedItem = await this.cartRepo.saveItemForLater(
      input.itemId,
      input.reason
    );
    if (!savedItem) {
      throw this.createError(
        CartErrorCodes.ITEM_NOT_FOUND,
        "Cart item not found"
      );
    }

    // Clear cache and track analytics
    await this.clearCartCache(savedItem.cartId);
    await this.trackCartEvent(
      "item_saved_for_later",
      { id: savedItem.cartId },
      {
        itemId: input.itemId,
        reason: input.reason,
      }
    );

    return this.formatSavedItemOutput(savedItem);
  }

  async restoreItemFromSaved(savedItemId: string): Promise<CartItemOutput> {
    const restoredItem = await this.cartRepo.restoreItemFromSaved(savedItemId);
    if (!restoredItem) {
      throw this.createError(
        CartErrorCodes.ITEM_NOT_FOUND,
        "Saved item not found"
      );
    }

    // Clear cache and track analytics
    await this.clearCartCache(restoredItem.cartId);
    await this.trackCartEvent(
      "item_restored",
      { id: restoredItem.cartId },
      {
        savedItemId,
        productId: restoredItem.productId,
      }
    );

    // Get product details for formatting
    const { product, variant, vendor } = await this.getProductDetails(
      restoredItem.productId,
      restoredItem.variantId || undefined
    );

    return this.formatCartItemOutput(restoredItem, product, variant, vendor);
  }

  // ========== COUPON MANAGEMENT ==========

  async applyCoupon(
    cartId: string,
    input: ApplyCouponInput
  ): Promise<CartOutput> {
    // Note: This is a simplified implementation
    // In a real system, you'd have a coupon service to validate and calculate discounts

    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw this.createError(CartErrorCodes.CART_NOT_FOUND, "Cart not found");
    }

    // Check if coupon is already applied
    const appliedCoupons = cart.appliedCoupons || [];
    if (appliedCoupons.some((c) => c.code === input.couponCode)) {
      throw this.createError(
        CartErrorCodes.COUPON_ALREADY_APPLIED,
        "Coupon already applied"
      );
    }

    // Validate coupon (simplified - in real system, call coupon service)
    const couponDiscount = await this.validateAndCalculateCoupon(
      input.couponCode,
      cart
    );

    // Add coupon to applied coupons
    const newAppliedCoupons = [
      ...appliedCoupons,
      {
        code: input.couponCode,
        discountAmount: couponDiscount.amount,
        discountType: couponDiscount.type,
        appliedAt: new Date().toISOString(),
      },
    ];

    // Update cart with new discount
    const updatedCart = await this.cartRepo.update(cartId, {
      appliedCoupons: newAppliedCoupons,
      discountAmount: (
        parseFloat(cart.discountAmount || "0") + couponDiscount.amount
      ).toString(),
    });

    if (!updatedCart) {
      throw new Error("Failed to apply coupon");
    }

    // Clear cache and track analytics
    await this.clearCartCache(cartId);
    await this.trackCartEvent("coupon_applied", updatedCart, {
      couponCode: input.couponCode,
      discountAmount: couponDiscount.amount,
    });

    // Recalculate totals
    await this.cartRepo.updateCartTotals(cartId);

    // Get updated cart with items
    const cartWithItems = await this.cartRepo.findCartWithItems(cartId);
    if (!cartWithItems) {
      throw new Error("Failed to retrieve updated cart");
    }

    return await this.formatCartOutput(cartWithItems);
  }

  async removeCoupon(cartId: string, couponCode: string): Promise<CartOutput> {
    const cart = await this.cartRepo.findById(cartId);
    if (!cart) {
      throw this.createError(CartErrorCodes.CART_NOT_FOUND, "Cart not found");
    }

    const appliedCoupons = cart.appliedCoupons || [];
    const couponIndex = appliedCoupons.findIndex((c) => c.code === couponCode);

    if (couponIndex === -1) {
      throw this.createError(
        CartErrorCodes.COUPON_INVALID,
        "Coupon not found in cart"
      );
    }

    // Remove coupon and update discount
    const removedCoupon = appliedCoupons[couponIndex];
    const newAppliedCoupons = appliedCoupons.filter(
      (_, index) => index !== couponIndex
    );
    const newDiscountAmount =
      parseFloat(cart.discountAmount || "0") - removedCoupon.discountAmount;

    const updatedCart = await this.cartRepo.update(cartId, {
      appliedCoupons: newAppliedCoupons,
      discountAmount: Math.max(0, newDiscountAmount).toString(),
    });

    if (!updatedCart) {
      throw new Error("Failed to remove coupon");
    }

    // Clear cache and track analytics
    await this.clearCartCache(cartId);
    await this.trackCartEvent("coupon_removed", updatedCart, { couponCode });

    // Recalculate totals
    await this.cartRepo.updateCartTotals(cartId);

    // Get updated cart with items
    const cartWithItems = await this.cartRepo.findCartWithItems(cartId);
    if (!cartWithItems) {
      throw new Error("Failed to retrieve updated cart");
    }

    return await this.formatCartOutput(cartWithItems);
  }

  // ========== CART CONVERSION ==========

  async convertCartToOrder(input: ConvertCartInput): Promise<void> {
    await this.cartRepo.markCartAsConverted(input.cartId, input.orderId);

    // Clear cache
    await this.clearCartCache(input.cartId);

    // Track analytics
    await this.trackCartEvent(
      "cart_converted",
      { id: input.cartId },
      {
        orderId: input.orderId,
      }
    );
  }

  // ========== CART ANALYTICS ==========

  async getCartAnalytics(
    filters: CartListFilters = {}
  ): Promise<CartAnalytics> {
    // Convert CartListFilters to CartFilters for repository compatibility
    const repoFilters = {
      userId: filters.userId,
      sessionId: filters.sessionId,
      status: Array.isArray(filters.status)
        ? filters.status[0]
        : filters.status,
      type: Array.isArray(filters.type) ? filters.type[0] : filters.type,
      hasItems: filters.hasItems,
      minTotal: filters.valueRange?.min,
      maxTotal: filters.valueRange?.max,
      createdAfter: filters.dateRange?.start,
      createdBefore: filters.dateRange?.end,
      lastActivityAfter: filters.lastActivityRange?.start,
      lastActivityBefore: filters.lastActivityRange?.end,
    };

    const summary = await this.cartRepo.getCartSummary(repoFilters);

    // Calculate additional metrics
    const conversionRate =
      summary.totalCarts > 0
        ? (summary.convertedCarts / summary.totalCarts) * 100
        : 0;
    const abandonmentRate =
      summary.totalCarts > 0
        ? (summary.abandonedCarts / summary.totalCarts) * 100
        : 0;

    return {
      totalCarts: summary.totalCarts,
      activeCarts: summary.activeCarts,
      abandonedCarts: summary.abandonedCarts,
      convertedCarts: summary.convertedCarts,
      totalValue: summary.totalValue,
      averageCartValue: summary.averageCartValue,
      averageItemsPerCart: summary.averageItemsPerCart,
      conversionRate,
      abandonmentRate,
      averageTimeInCart: 0, // Would need additional tracking
      topProducts: [], // Would need additional queries
      bySource: [], // Would need additional queries
    };
  }

  // ========== ABANDONED CART RECOVERY ==========

  async findAbandonedCarts(olderThanDays: number = 1): Promise<CartOutput[]> {
    const abandonedCarts = await this.cartRepo.findAbandonedCarts(
      olderThanDays
    );
    const formattedCarts: CartOutput[] = [];

    for (const cart of abandonedCarts) {
      const cartWithItems = await this.cartRepo.findCartWithItems(cart.id);
      if (cartWithItems) {
        formattedCarts.push(await this.formatCartOutput(cartWithItems));
      }
    }

    return formattedCarts;
  }

  async markCartsAsAbandoned(olderThanDays: number = 1): Promise<number> {
    const abandonedCarts = await this.cartRepo.findAbandonedCarts(
      olderThanDays
    );
    let markedCount = 0;

    for (const cart of abandonedCarts) {
      await this.cartRepo.markCartAsAbandoned(cart.id);
      await this.clearCartCache(cart.id);
      markedCount++;
    }

    return markedCount;
  }

  // ========== HELPER METHODS ==========

  private async validateProductForCart(
    productId: string,
    variantId?: string,
    quantity: number = 1
  ): Promise<{ product: any; variant?: any; vendor: any }> {
    // Get product
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw this.createError(
        CartErrorCodes.PRODUCT_NOT_FOUND,
        "Product not found"
      );
    }

    // Check product status
    if (product.status !== "active") {
      throw this.createError(
        CartErrorCodes.PRODUCT_UNAVAILABLE,
        "Product is not available"
      );
    }

    // Get variant if specified
    let variant;
    if (variantId) {
      variant = await this.productRepo.findVariantById(variantId);
      if (!variant) {
        throw this.createError(
          CartErrorCodes.VARIANT_NOT_FOUND,
          "Product variant not found"
        );
      }
      if (!variant.isActive) {
        throw this.createError(
          CartErrorCodes.PRODUCT_UNAVAILABLE,
          "Product variant is not available"
        );
      }
    }

    // Get vendor
    const vendor = await this.vendorRepo.findById(product.vendorId);
    if (!vendor) {
      throw this.createError(
        CartErrorCodes.VENDOR_INACTIVE,
        "Vendor not found"
      );
    }

    if (vendor.status !== "approved") {
      throw this.createError(
        CartErrorCodes.VENDOR_INACTIVE,
        "Vendor is not active"
      );
    }

    // Check stock if tracking quantity
    if (product.trackQuantity) {
      const availableQuantity = variant ? variant.quantity : product.quantity;
      if (availableQuantity !== null && availableQuantity < quantity) {
        throw this.createError(
          CartErrorCodes.INSUFFICIENT_STOCK,
          `Only ${availableQuantity} items available`
        );
      }
    }

    return { product, variant, vendor };
  }

  private async getProductDetails(productId: string, variantId?: string) {
    const product = await this.productRepo.findById(productId);
    const variant = variantId
      ? await this.productRepo.findVariantById(variantId)
      : undefined;
    const vendor = product
      ? await this.vendorRepo.findById(product.vendorId)
      : undefined;

    return { product, variant, vendor };
  }

  private async validateAndCalculateCoupon(
    couponCode: string,
    cart: Cart
  ): Promise<{ amount: number; type: "percentage" | "fixed" }> {
    // Simplified coupon validation - in real system, use coupon service
    // For now, just return a mock 10% discount
    const subtotal = parseFloat(cart.subtotal || "0");

    if (couponCode === "SAVE10") {
      return { amount: subtotal * 0.1, type: "percentage" };
    }

    if (couponCode === "SAVE5") {
      return { amount: 5, type: "fixed" };
    }

    throw this.createError(
      CartErrorCodes.COUPON_INVALID,
      "Invalid coupon code"
    );
  }

  private async formatCartOutput(
    cartWithItems: CartWithItems
  ): Promise<CartOutput> {
    // Format cart items
    const formattedItems: CartItemOutput[] = [];
    for (const item of cartWithItems.items) {
      const { product, variant, vendor } = await this.getProductDetails(
        item.productId,
        item.variantId || undefined
      );
      formattedItems.push(
        this.formatCartItemOutput(item, product, variant, vendor)
      );
    }

    // Format saved items
    const formattedSavedItems: SavedItemOutput[] = [];
    if (cartWithItems.savedItems) {
      for (const savedItem of cartWithItems.savedItems) {
        formattedSavedItems.push(this.formatSavedItemOutput(savedItem));
      }
    }

    // Calculate vendor breakdown
    const vendorBreakdown = this.calculateVendorBreakdown(formattedItems);

    // Create cart summary
    const summary: CartSummaryOutput = {
      itemCount: cartWithItems.itemCount,
      totalQuantity: cartWithItems.totalQuantity,
      subtotal: cartWithItems.subtotal || "0.00",
      taxAmount: cartWithItems.taxAmount || "0.00",
      discountAmount: cartWithItems.discountAmount || "0.00",
      shippingAmount: cartWithItems.shippingAmount || "0.00",
      total: cartWithItems.total || "0.00",
      currency: cartWithItems.currency || "USD",
      appliedCoupons: cartWithItems.appliedCoupons || [],
      vendorBreakdown,
    };

    return {
      id: cartWithItems.id,
      userId: cartWithItems.userId || undefined,
      sessionId: cartWithItems.sessionId || undefined,
      type: cartWithItems.type,
      status: cartWithItems.status,
      currency: cartWithItems.currency || "USD",
      customerEmail: cartWithItems.customerEmail || undefined,
      customerPhone: cartWithItems.customerPhone || undefined,
      shippingAddress: cartWithItems.shippingAddress || undefined,
      shippingMethod: cartWithItems.shippingMethod || undefined,
      shippingRate: cartWithItems.shippingRate || undefined,
      summary,
      items: formattedItems,
      savedItems: formattedSavedItems,
      notes: cartWithItems.notes || undefined,
      metadata: cartWithItems.metadata || undefined,
      convertedOrderId: cartWithItems.convertedOrderId || undefined,
      convertedAt: cartWithItems.convertedAt || undefined,
      expiresAt: cartWithItems.expiresAt || undefined,
      lastActivityAt: cartWithItems.lastActivityAt || new Date(),
      createdAt: cartWithItems.createdAt,
      updatedAt: cartWithItems.updatedAt,
    };
  }

  private formatCartItemOutput(
    item: CartItem,
    product?: any,
    variant?: any,
    vendor?: any
  ): CartItemOutput {
    return {
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      variantId: item.variantId || undefined,
      vendorId: item.vendorId,
      productName: item.productName,
      productSlug: item.productSlug || undefined,
      productSku: item.productSku || undefined,
      variantTitle: item.variantTitle || undefined,
      productImage: item.productImage || undefined,
      price: item.price,
      compareAtPrice: item.compareAtPrice || undefined,
      quantity: item.quantity,
      subtotal: item.subtotal,
      selectedAttributes: item.selectedAttributes || undefined,
      customizations: item.customizations || undefined,
      notes: item.notes || undefined,
      product: product
        ? {
            name: product.name,
            slug: product.slug,
            status: product.status,
            images: product.images || [],
            isAvailable: product.status === "active",
            currentPrice: product.price,
            inStock: product.quantity > 0,
            stockQuantity: product.quantity,
          }
        : undefined,
      variant: variant
        ? {
            title: variant.title,
            options: variant.options || {},
            isActive: variant.isActive,
            isAvailable: variant.isActive && variant.quantity > 0,
            currentPrice: variant.price || product?.price,
          }
        : undefined,
      vendor: vendor
        ? {
            id: vendor.id,
            businessName: vendor.businessName,
            status: vendor.status,
            isActive: vendor.status === "approved",
          }
        : undefined,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
    };
  }

  private formatSavedItemOutput(savedItem: any): SavedItemOutput {
    return {
      id: savedItem.id,
      cartId: savedItem.cartId,
      originalCartItemId: savedItem.originalCartItemId,
      productId: savedItem.productId,
      variantId: savedItem.variantId,
      vendorId: savedItem.vendorId,
      productName: savedItem.productName,
      productSlug: savedItem.productSlug,
      productImage: savedItem.productImage,
      price: savedItem.price,
      quantity: savedItem.quantity,
      selectedAttributes: savedItem.selectedAttributes,
      savedReason: savedItem.savedReason,
      notes: savedItem.notes,
      savedAt: savedItem.savedAt,
      updatedAt: savedItem.updatedAt,
    };
  }

  private calculateVendorBreakdown(items: CartItemOutput[]) {
    const vendorMap = new Map();

    for (const item of items) {
      const vendorId = item.vendorId;
      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          vendorName: item.vendor?.businessName || "Unknown Vendor",
          itemCount: 0,
          subtotal: 0,
          items: [],
        });
      }

      const vendor = vendorMap.get(vendorId);
      vendor.itemCount += 1;
      vendor.subtotal += parseFloat(item.subtotal);
      vendor.items.push(item.id);
    }

    return Array.from(vendorMap.values()).map((vendor) => ({
      ...vendor,
      subtotal: vendor.subtotal.toString(),
    }));
  }

  private async trackCartEvent(
    event: string,
    cart: any,
    metadata?: any
  ): Promise<void> {
    if (this.analyticsService) {
      try {
        await this.analyticsService.trackEvent({
          eventType: "cart_action",
          eventName: event,
          userId: cart.userId,
          sessionId: cart.sessionId,
          metadata: {
            cartId: cart.id,
            ...metadata,
          },
        });
      } catch (error) {
        console.error("Failed to track cart event:", error);
      }
    }
  }

  private async clearCartCache(cartId: string): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.delete(`cart:${cartId}`);
        await this.cacheService.delete(`cart:items:${cartId}`);
      } catch (error) {
        console.error("Failed to clear cart cache:", error);
      }
    }
  }

  private createError(code: string, message: string, details?: any): CartError {
    return { code, message, details } as CartError;
  }
}

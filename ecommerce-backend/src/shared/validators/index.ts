// Export all validation schemas
export * from "./auth.validators.js";
export * from "./product.validators.js";
export * from "./vendor.validators.js";
export * from "./order.validators.js";
export * from "./common.validators.js";

// Re-export commonly used schemas with shorter names for auth
export {
  loginSchema as Login,
  registerSchema as Register,
} from "./auth.validators.js";

// Re-export product schemas
export {
  createProductSchema as CreateProduct,
  updateProductSchema as UpdateProduct,
  productFiltersSchema as ProductFilters,
} from "./product.validators.js";

// Re-export vendor schemas
export {
  createVendorSchema as CreateVendor,
  updateVendorSchema as UpdateVendor,
  vendorFiltersSchema as VendorFilters,
} from "./vendor.validators.js";

// Re-export order schemas
export {
  createOrderSchema as CreateOrder,
  updateOrderSchema as UpdateOrder,
  orderFiltersSchema as OrderFilters,
} from "./order.validators.js";

// Re-export common schemas
export {
  paginationSchema as Pagination,
  uuidSchema as UUID,
  addressSchema as Address,
  moneySchema as Money,
} from "./common.validators.js";

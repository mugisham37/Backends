// Export all validation schemas
export * from "./auth.validators.js";
export * from "./product.validators.js";
export * from "./vendor.validators.js";
export * from "./order.validators.js";
export * from "./common.validators.js";

// Re-export commonly used schemas with shorter names
export {
  loginSchema as Login,
  registerSchema as Register,
  createProductSchema as CreateProduct,
  updateProductSchema as UpdateProduct,
  createVendorSchema as CreateVendor,
  updateVendorSchema as UpdateVendor,
  createOrderSchema as CreateOrder,
  updateOrderSchema as UpdateOrder,
  paginationSchema as Pagination,
  uuidSchema as UUID,
} from "./auth.validators.js";

export {
  createProductSchema as CreateProduct,
  updateProductSchema as UpdateProduct,
  productFiltersSchema as ProductFilters,
} from "./product.validators.js";

export {
  createVendorSchema as CreateVendor,
  updateVendorSchema as UpdateVendor,
  vendorFiltersSchema as VendorFilters,
} from "./vendor.validators.js";

export {
  createOrderSchema as CreateOrder,
  updateOrderSchema as UpdateOrder,
  orderFiltersSchema as OrderFilters,
} from "./order.validators.js";

export {
  paginationSchema as Pagination,
  uuidSchema as UUID,
  addressSchema as Address,
  moneySchema as Money,
} from "./common.validators.js";

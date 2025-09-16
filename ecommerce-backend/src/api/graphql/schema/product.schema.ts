/**
 * Product GraphQL Schema
 * Defines types, queries, and mutations for product operations
 */

import { gql } from "graphql-tag";

export const productTypeDefs = gql`
  # Product enums
  enum ProductStatus {
    DRAFT
    ACTIVE
    INACTIVE
    OUT_OF_STOCK
    DISCONTINUED
  }

  enum ProductCondition {
    NEW
    USED
    REFURBISHED
  }

  # Product types
  type Product implements Node {
    id: ID!
    vendorId: ID!
    categoryId: ID

    # Basic information
    name: String!
    slug: String!
    description: String
    shortDescription: String

    # Pricing
    price: Decimal!
    compareAtPrice: Decimal
    costPrice: Decimal

    # Inventory
    sku: String
    barcode: String
    trackQuantity: Boolean!
    quantity: Int!
    lowStockThreshold: Int!

    # Physical properties
    weight: Decimal
    weightUnit: String
    dimensions: ProductDimensions

    # Status and visibility
    status: ProductStatus!
    condition: ProductCondition!
    featured: Boolean!

    # Media
    images: [String!]!

    # SEO
    metaTitle: String
    metaDescription: String

    # Product attributes
    attributes: JSON

    # Variants
    hasVariants: Boolean!
    variants: [ProductVariant!]!

    # Shipping and tax
    requiresShipping: Boolean!
    shippingClass: String
    taxable: Boolean!
    taxClass: String

    # Timestamps
    publishedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    vendor: Vendor!
    category: Category

    # Computed fields
    isInStock: Boolean!
    isLowStock: Boolean!
    displayPrice: Decimal!
    savings: Decimal
    savingsPercentage: Float
  }

  type ProductConnection {
    edges: [ProductEdge!]!
    nodes: [Product!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProductEdge {
    node: Product!
    cursor: String!
  }

  # Product dimensions
  type ProductDimensions {
    length: Float
    width: Float
    height: Float
    unit: String
  }

  input ProductDimensionsInput {
    length: Float
    width: Float
    height: Float
    unit: String = "cm"
  }

  # Product variants
  type ProductVariant implements Node {
    id: ID!
    productId: ID!
    title: String!
    sku: String
    barcode: String
    price: Decimal
    compareAtPrice: Decimal
    costPrice: Decimal
    quantity: Int!
    weight: Decimal
    options: JSON!
    image: String
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Categories
  type Category implements Node {
    id: ID!
    parentId: ID
    name: String!
    slug: String!
    description: String
    image: String
    icon: String
    color: String
    metaTitle: String
    metaDescription: String
    isActive: Boolean!
    sortOrder: Int!
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    parent: Category
    children: [Category!]!
    products: ProductConnection!

    # Computed
    productCount: Int!
  }

  # Product statistics
  type ProductStats {
    totalProducts: Int!
    activeProducts: Int!
    outOfStockProducts: Int!
    lowStockProducts: Int!
    averagePrice: Decimal!
    byStatus: JSON!
    byCategory: JSON!
  }

  # Search and autocomplete
  type ProductSearchResult {
    id: ID!
    name: String!
    slug: String!
    price: Decimal!
    image: String
    vendor: String!
  }

  # Input types
  input ProductFiltersInput {
    status: ProductStatus
    condition: ProductCondition
    vendorId: ID
    categoryId: ID
    featured: Boolean
    minPrice: Decimal
    maxPrice: Decimal
    inStock: Boolean
    search: String
  }

  input CreateProductInput {
    name: String!
    description: String
    shortDescription: String
    price: Decimal!
    compareAtPrice: Decimal
    costPrice: Decimal
    sku: String
    barcode: String
    trackQuantity: Boolean = true
    quantity: Int = 0
    lowStockThreshold: Int = 5
    weight: Decimal
    weightUnit: String = "kg"
    dimensions: ProductDimensionsInput
    condition: ProductCondition = NEW
    featured: Boolean = false
    images: [String!] = []
    metaTitle: String
    metaDescription: String
    attributes: JSON
    categoryId: ID
    requiresShipping: Boolean = true
    shippingClass: String
    taxable: Boolean = true
    taxClass: String
  }

  input UpdateProductInput {
    name: String
    description: String
    shortDescription: String
    price: Decimal
    compareAtPrice: Decimal
    costPrice: Decimal
    sku: String
    barcode: String
    trackQuantity: Boolean
    quantity: Int
    lowStockThreshold: Int
    weight: Decimal
    weightUnit: String
    dimensions: ProductDimensionsInput
    condition: ProductCondition
    featured: Boolean
    images: [String!]
    metaTitle: String
    metaDescription: String
    attributes: JSON
    categoryId: ID
    requiresShipping: Boolean
    shippingClass: String
    taxable: Boolean
    taxClass: String
  }

  input UpdateProductStatusInput {
    status: ProductStatus!
  }

  input UpdateProductInventoryInput {
    quantity: Int!
  }

  input BulkUpdateProductStatusInput {
    productIds: [ID!]!
    status: ProductStatus!
  }

  # Category inputs
  input CreateCategoryInput {
    parentId: ID
    name: String!
    description: String
    image: String
    icon: String
    color: String
    metaTitle: String
    metaDescription: String
    sortOrder: Int = 0
  }

  input UpdateCategoryInput {
    parentId: ID
    name: String
    description: String
    image: String
    icon: String
    color: String
    metaTitle: String
    metaDescription: String
    isActive: Boolean
    sortOrder: Int
  }

  # Extend root types
  extend type Query {
    # Product queries
    product(id: ID, slug: String): Product
    products(
      filters: ProductFiltersInput
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): ProductConnection!

    # Featured and special products
    featuredProducts(limit: Int = 10): [Product!]!
    lowStockProducts: [Product!]!
    outOfStockProducts: [Product!]!

    # Product search
    searchProducts(query: String!, limit: Int = 20): [ProductSearchResult!]!

    # Categories
    category(id: ID, slug: String): Category
    categories(parentId: ID): [Category!]!
    categoryTree: [Category!]!

    # Product statistics (admin/vendor only)
    productStats(vendorId: ID): ProductStats!
  }

  extend type Mutation {
    # Product management
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product!
    updateProductStatus(id: ID!, input: UpdateProductStatusInput!): Product!
    updateProductInventory(
      id: ID!
      input: UpdateProductInventoryInput!
    ): Product!
    bulkUpdateProductStatus(input: BulkUpdateProductStatusInput!): [Product!]!
    deleteProduct(id: ID!): Boolean!

    # Category management
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(id: ID!, input: UpdateCategoryInput!): Category!
    deleteCategory(id: ID!): Boolean!
  }

  extend type Subscription {
    # Product subscriptions
    productUpdated(productId: ID!): Product!
    productStatusChanged(vendorId: ID): Product!
    lowStockAlert(vendorId: ID!): Product!
    outOfStockAlert(vendorId: ID!): Product!
  }
`;

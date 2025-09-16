/**
 * GraphQL Resolvers Index
 * Combines all resolvers into a single resolver map
 */

import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language";
import { userResolvers } from "./user.resolver.js";
import { vendorResolvers } from "./vendor.resolver.js";
import { productResolvers } from "./product.resolver.js";
import { orderResolvers } from "./order.resolver.js";
import { GraphQLContext } from "../context.js";

// Custom scalar resolvers
const scalarResolvers = {
  DateTime: new GraphQLScalarType({
    name: "DateTime",
    description: "Date and time as ISO string",
    serialize: (value: any) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === "string") {
        return new Date(value).toISOString();
      }
      throw new Error("Value must be a Date or ISO string");
    },
    parseValue: (value: any) => {
      if (typeof value === "string") {
        return new Date(value);
      }
      throw new Error("Value must be an ISO string");
    },
    parseLiteral: (ast) => {
      if (ast.kind === Kind.STRING) {
        return new Date(ast.value);
      }
      throw new Error("Value must be an ISO string");
    },
  }),

  JSON: new GraphQLScalarType({
    name: "JSON",
    description: "JSON object",
    serialize: (value: any) => value,
    parseValue: (value: any) => value,
    parseLiteral: (ast) => {
      if (ast.kind === Kind.STRING) {
        try {
          return JSON.parse(ast.value);
        } catch {
          throw new Error("Invalid JSON");
        }
      }
      if (ast.kind === Kind.OBJECT) {
        return ast;
      }
      throw new Error("Value must be a JSON object");
    },
  }),

  Decimal: new GraphQLScalarType({
    name: "Decimal",
    description: "Decimal number as string for precision",
    serialize: (value: any) => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      throw new Error("Value must be a number or string");
    },
    parseValue: (value: any) => {
      if (typeof value === "string") return value;
      if (typeof value === "number") return value.toString();
      throw new Error("Value must be a number or string");
    },
    parseLiteral: (ast) => {
      if (
        ast.kind === Kind.STRING ||
        ast.kind === Kind.INT ||
        ast.kind === Kind.FLOAT
      ) {
        return ast.value;
      }
      throw new Error("Value must be a number");
    },
  }),
};

// Base resolvers
const baseResolvers = {
  Query: {
    health: () => "GraphQL server is running!",

    node: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      // Simple node resolver - in a real app, you'd decode the ID to determine type
      // For now, we'll try to find it in different repositories
      try {
        // Try user first
        const user = await context.repositories.user.findById(id);
        if (user) return { ...user, __typename: "User" };

        // Try vendor
        const vendor = await context.repositories.vendor.findById(id);
        if (vendor) return { ...vendor, __typename: "Vendor" };

        // Try product
        const product = await context.repositories.product.findById(id);
        if (product) return { ...product, __typename: "Product" };

        // Try order
        const order = await context.repositories.order.findById(id);
        if (order) return { ...order, __typename: "Order" };

        return null;
      } catch (error) {
        console.error("Error in node resolver:", error);
        return null;
      }
    },
  },

  Mutation: {
    _empty: () => null,
  },

  Subscription: {
    _empty: () => null,
  },

  // Node interface resolver
  Node: {
    __resolveType: (obj: any) => {
      // Determine type based on object properties
      if (obj.email && obj.role) return "User";
      if (obj.businessName) return "Vendor";
      if (obj.name && obj.price) return "Product";
      if (obj.orderNumber) return "Order";
      return null;
    },
  },
};

// Combine all resolvers
export const resolvers = {
  ...scalarResolvers,
  ...baseResolvers,
  Query: {
    ...baseResolvers.Query,
    ...userResolvers.Query,
    ...vendorResolvers.Query,
    ...productResolvers.Query,
    ...orderResolvers.Query,
  },
  Mutation: {
    ...baseResolvers.Mutation,
    ...userResolvers.Mutation,
    ...vendorResolvers.Mutation,
    ...productResolvers.Mutation,
    ...orderResolvers.Mutation,
  },
  Subscription: {
    ...baseResolvers.Subscription,
    ...userResolvers.Subscription,
    ...vendorResolvers.Subscription,
    ...productResolvers.Subscription,
    ...orderResolvers.Subscription,
  },
  // Type resolvers
  User: userResolvers.User,
  Vendor: vendorResolvers.Vendor,
  Product: productResolvers.Product,
  Order: orderResolvers.Order,
  OrderItem: orderResolvers.OrderItem,
  Category: productResolvers.Category,
  Payment: orderResolvers.Payment,
};

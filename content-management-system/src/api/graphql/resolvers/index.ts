import { GraphQLScalarType, Kind } from "graphql"
import { userResolvers } from "./user.resolvers"
import { contentTypeResolvers } from "./content-type.resolvers"
import { contentResolvers } from "./content.resolvers"
import { mediaResolvers } from "./media.resolvers"
import { workflowResolvers } from "./workflow.resolvers"
import { webhookResolvers } from "./webhook.resolvers"

// Define scalar resolvers
const dateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "DateTime custom scalar type",
  serialize(value) {
    return value instanceof Date ? value.toISOString() : null
  },
  parseValue(value) {
    return value ? new Date(value) : null
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value)
    }
    return null
  },
})

const jsonScalar = new GraphQLScalarType({
  name: "JSON",
  description: "JSON custom scalar type",
  serialize(value) {
    return value
  },
  parseValue(value) {
    return value
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value
      case Kind.INT:
      case Kind.FLOAT:
        return Number(ast.value)
      case Kind.OBJECT: {
        const value = Object.create(null)
        ast.fields.forEach((field) => {
          value[field.name.value] = this.parseLiteral(field.value)
        })
        return value
      }
      case Kind.LIST:
        return ast.values.map((n) => this.parseLiteral(n))
      default:
        return null
    }
  },
})

// Base resolvers
const baseResolvers = {
  DateTime: dateTimeScalar,
  JSON: jsonScalar,
  Node: {
    __resolveType(obj: any) {
      // Implement type resolution logic
      if (obj.__typename) {
        return obj.__typename
      }
      return null
    },
  },
}

// Combine all resolvers
export const resolvers = [
  baseResolvers,
  userResolvers,
  contentTypeResolvers,
  contentResolvers,
  mediaResolvers,
  workflowResolvers,
  webhookResolvers,
]

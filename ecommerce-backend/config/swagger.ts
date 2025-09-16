import swaggerJsdoc from "swagger-jsdoc"
import { version } from "../../package.json"

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "E-Commerce Platform API",
    version,
    description: "API documentation for the E-Commerce Platform",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
    contact: {
      name: "API Support",
      url: "https://example.com/support",
      email: "support@example.com",
    },
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      User: {
        type: "object",
        required: ["email", "password", "firstName", "lastName"],
        properties: {
          _id: {
            type: "string",
            description: "User ID",
            example: "60d21b4667d0d8992e610c85",
          },
          email: {
            type: "string",
            description: "User email",
            example: "user@example.com",
          },
          firstName: {
            type: "string",
            description: "User first name",
            example: "John",
          },
          lastName: {
            type: "string",
            description: "User last name",
            example: "Doe",
          },
          role: {
            type: "string",
            enum: ["customer", "admin", "superadmin"],
            description: "User role",
            example: "customer",
          },
          active: {
            type: "boolean",
            description: "User active status",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "User creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "User last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Product: {
        type: "object",
        required: ["name", "description", "price", "category"],
        properties: {
          _id: {
            type: "string",
            description: "Product ID",
            example: "60d21b4667d0d8992e610c85",
          },
          name: {
            type: "string",
            description: "Product name",
            example: "Smartphone",
          },
          description: {
            type: "string",
            description: "Product description",
            example: "A high-end smartphone with great features",
          },
          price: {
            type: "number",
            description: "Product price",
            example: 999.99,
          },
          compareAtPrice: {
            type: "number",
            description: "Product compare at price",
            example: 1099.99,
          },
          quantity: {
            type: "number",
            description: "Product quantity",
            example: 100,
          },
          category: {
            type: "string",
            description: "Product category ID",
            example: "60d21b4667d0d8992e610c85",
          },
          images: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Product images",
            example: ["image1.jpg", "image2.jpg"],
          },
          featured: {
            type: "boolean",
            description: "Product featured status",
            example: true,
          },
          active: {
            type: "boolean",
            description: "Product active status",
            example: true,
          },
          ratings: {
            type: "object",
            properties: {
              average: {
                type: "number",
                description: "Average rating",
                example: 4.5,
              },
              count: {
                type: "number",
                description: "Number of ratings",
                example: 10,
              },
            },
          },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sku: {
                  type: "string",
                  description: "Variant SKU",
                  example: "SM-BLK-128",
                },
                attributes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: {
                        type: "string",
                        description: "Attribute name",
                        example: "Color",
                      },
                      value: {
                        type: "string",
                        description: "Attribute value",
                        example: "Black",
                      },
                    },
                  },
                },
                price: {
                  type: "number",
                  description: "Variant price",
                  example: 999.99,
                },
                quantity: {
                  type: "number",
                  description: "Variant quantity",
                  example: 50,
                },
                images: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Variant images",
                  example: ["variant1.jpg", "variant2.jpg"],
                },
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Product creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Product last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Category: {
        type: "object",
        required: ["name"],
        properties: {
          _id: {
            type: "string",
            description: "Category ID",
            example: "60d21b4667d0d8992e610c85",
          },
          name: {
            type: "string",
            description: "Category name",
            example: "Electronics",
          },
          description: {
            type: "string",
            description: "Category description",
            example: "Electronic devices and accessories",
          },
          parent: {
            type: "string",
            description: "Parent category ID",
            example: "60d21b4667d0d8992e610c85",
          },
          image: {
            type: "string",
            description: "Category image",
            example: "category.jpg",
          },
          active: {
            type: "boolean",
            description: "Category active status",
            example: true,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Category creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Category last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Order: {
        type: "object",
        required: ["user", "orderItems", "shippingAddress", "paymentMethod"],
        properties: {
          _id: {
            type: "string",
            description: "Order ID",
            example: "60d21b4667d0d8992e610c85",
          },
          user: {
            type: "string",
            description: "User ID",
            example: "60d21b4667d0d8992e610c85",
          },
          orderItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product: {
                  type: "string",
                  description: "Product ID",
                  example: "60d21b4667d0d8992e610c85",
                },
                name: {
                  type: "string",
                  description: "Product name",
                  example: "Smartphone",
                },
                image: {
                  type: "string",
                  description: "Product image",
                  example: "image.jpg",
                },
                price: {
                  type: "number",
                  description: "Product price",
                  example: 999.99,
                },
                quantity: {
                  type: "number",
                  description: "Product quantity",
                  example: 1,
                },
                variant: {
                  type: "object",
                  properties: {
                    sku: {
                      type: "string",
                      description: "Variant SKU",
                      example: "SM-BLK-128",
                    },
                    attributes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "Attribute name",
                            example: "Color",
                          },
                          value: {
                            type: "string",
                            description: "Attribute value",
                            example: "Black",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          shippingAddress: {
            type: "object",
            properties: {
              street: {
                type: "string",
                description: "Street address",
                example: "123 Main St",
              },
              city: {
                type: "string",
                description: "City",
                example: "New York",
              },
              state: {
                type: "string",
                description: "State",
                example: "NY",
              },
              postalCode: {
                type: "string",
                description: "Postal code",
                example: "10001",
              },
              country: {
                type: "string",
                description: "Country",
                example: "USA",
              },
            },
          },
          paymentMethod: {
            type: "string",
            description: "Payment method",
            example: "stripe",
          },
          paymentResult: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Payment ID",
                example: "pi_1J4JXQJHBtEqH5nZYn6iL7tZ",
              },
              status: {
                type: "string",
                description: "Payment status",
                example: "succeeded",
              },
              updateTime: {
                type: "string",
                description: "Payment update time",
                example: "2021-06-23T10:00:00.000Z",
              },
              email: {
                type: "string",
                description: "Payment email",
                example: "user@example.com",
              },
            },
          },
          itemsPrice: {
            type: "number",
            description: "Items price",
            example: 999.99,
          },
          taxPrice: {
            type: "number",
            description: "Tax price",
            example: 100,
          },
          shippingPrice: {
            type: "number",
            description: "Shipping price",
            example: 10,
          },
          totalPrice: {
            type: "number",
            description: "Total price",
            example: 1109.99,
          },
          isPaid: {
            type: "boolean",
            description: "Is paid",
            example: true,
          },
          paidAt: {
            type: "string",
            format: "date-time",
            description: "Paid at",
            example: "2021-06-23T10:00:00.000Z",
          },
          isDelivered: {
            type: "boolean",
            description: "Is delivered",
            example: false,
          },
          deliveredAt: {
            type: "string",
            format: "date-time",
            description: "Delivered at",
            example: null,
          },
          status: {
            type: "string",
            enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
            description: "Order status",
            example: "processing",
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Order creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Order last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Review: {
        type: "object",
        required: ["user", "product", "rating", "comment"],
        properties: {
          _id: {
            type: "string",
            description: "Review ID",
            example: "60d21b4667d0d8992e610c85",
          },
          user: {
            type: "string",
            description: "User ID",
            example: "60d21b4667d0d8992e610c85",
          },
          product: {
            type: "string",
            description: "Product ID",
            example: "60d21b4667d0d8992e610c85",
          },
          rating: {
            type: "number",
            description: "Rating",
            example: 5,
          },
          comment: {
            type: "string",
            description: "Comment",
            example: "Great product!",
          },
          title: {
            type: "string",
            description: "Review title",
            example: "Excellent purchase",
          },
          isVerifiedPurchase: {
            type: "boolean",
            description: "Is verified purchase",
            example: true,
          },
          helpfulVotes: {
            type: "number",
            description: "Helpful votes",
            example: 10,
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Review creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Review last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Cart: {
        type: "object",
        required: ["user", "items"],
        properties: {
          _id: {
            type: "string",
            description: "Cart ID",
            example: "60d21b4667d0d8992e610c85",
          },
          user: {
            type: "string",
            description: "User ID",
            example: "60d21b4667d0d8992e610c85",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product: {
                  type: "string",
                  description: "Product ID",
                  example: "60d21b4667d0d8992e610c85",
                },
                quantity: {
                  type: "number",
                  description: "Product quantity",
                  example: 1,
                },
                variant: {
                  type: "object",
                  properties: {
                    sku: {
                      type: "string",
                      description: "Variant SKU",
                      example: "SM-BLK-128",
                    },
                    attributes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "Attribute name",
                            example: "Color",
                          },
                          value: {
                            type: "string",
                            description: "Attribute value",
                            example: "Black",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          createdAt: {
            type: "string",
            format: "date-time",
            description: "Cart creation date",
            example: "2021-06-23T10:00:00.000Z",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
            description: "Cart last update date",
            example: "2021-06-23T10:00:00.000Z",
          },
        },
      },
      Error: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "Error status",
            example: "error",
          },
          message: {
            type: "string",
            description: "Error message",
            example: "An error occurred",
          },
          error: {
            type: "object",
            description: "Error details",
            example: {
              name: "ValidationError",
              message: "Invalid input",
              stack: "ValidationError: Invalid input",
            },
          },
          requestId: {
            type: "string",
            description: "Request ID",
            example: "60d21b4667d0d8992e610c85",
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Access token is missing or invalid",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      ValidationError: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
      ServerError: {
        description: "Server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  tags: [
    {
      name: "Auth",
      description: "Authentication endpoints",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Products",
      description: "Product management endpoints",
    },
    {
      name: "Categories",
      description: "Category management endpoints",
    },
    {
      name: "Orders",
      description: "Order management endpoints",
    },
    {
      name: "Reviews",
      description: "Review management endpoints",
    },
    {
      name: "Cart",
      description: "Cart management endpoints",
    },
    {
      name: "Admin",
      description: "Admin endpoints",
    },
    {
      name: "Search",
      description: "Search endpoints",
    },
    {
      name: "Webhooks",
      description: "Webhook endpoints",
    },
    {
      name: "Export",
      description: "Export endpoints",
    },
    {
      name: "Recommendations",
      description: "Recommendation endpoints",
    },
  ],
}

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/models/*.ts"],
}

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec

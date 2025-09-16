/**
 * User REST API routes
 * Clean controller with minimal complexity
 */

import { Router, Request, Response } from "express";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils";

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  preferences?: Record<string, any>;
}

interface UpdatePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface AddAddressInput {
  type: "shipping" | "billing";
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export class UserController {
  private router = Router();

  constructor() // TODO: Inject UserService when implemented
  // private userService: UserService
  {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/profile", this.getProfile.bind(this));
    this.router.put("/profile", this.updateProfile.bind(this));
    this.router.patch("/password", this.updatePassword.bind(this));
    this.router.get("/addresses", this.getAddresses.bind(this));
    this.router.post("/addresses", this.addAddress.bind(this));
    this.router.put("/addresses/:id", this.updateAddress.bind(this));
    this.router.delete("/addresses/:id", this.deleteAddress.bind(this));
    this.router.get("/orders", this.getUserOrders.bind(this));
    this.router.get("/wishlist", this.getWishlist.bind(this));
    this.router.post("/wishlist/:productId", this.addToWishlist.bind(this));
    this.router.delete(
      "/wishlist/:productId",
      this.removeFromWishlist.bind(this)
    );

    // Admin routes
    this.router.get("/", this.getUsers.bind(this));
    this.router.get("/:id", this.getUser.bind(this));
    this.router.patch("/:id/status", this.updateUserStatus.bind(this));
    this.router.delete("/:id", this.deleteUser.bind(this));
  }

  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // const user = await this.userService.getUserProfile(userId);

      // Placeholder response
      const user = {
        id: userId,
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        phoneNumber: "+1234567890",
        dateOfBirth: "1990-01-01",
        preferences: {},
        createdAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(user, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch profile";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_PROFILE_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const input: UpdateUserInput = req.body;

      // TODO: Implement with UserService
      // const user = await this.userService.updateUserProfile(userId, input);

      // Placeholder response
      const user = {
        id: userId,
        ...input,
        updatedAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(user, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "UPDATE_PROFILE_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const { currentPassword, newPassword }: UpdatePasswordInput = req.body;

      if (!currentPassword || !newPassword) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            ResponseBuilder.error(
              "Current and new passwords are required",
              "MISSING_PASSWORDS"
            )
          );
        return;
      }

      // TODO: Implement with UserService
      // await this.userService.updatePassword(userId, currentPassword, newPassword);

      res
        .status(HTTP_STATUS.OK)
        .json(
          ResponseBuilder.success(
            { message: "Password updated successfully" },
            { requestId: req.id }
          )
        );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update password";
      const status = message.includes("incorrect")
        ? HTTP_STATUS.BAD_REQUEST
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "UPDATE_PASSWORD_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // const addresses = await this.userService.getUserAddresses(userId);

      // Placeholder response
      const addresses = [
        {
          id: "addr-1",
          type: "shipping",
          street: "123 Main St",
          city: "Anytown",
          state: "CA",
          postalCode: "12345",
          country: "US",
          isDefault: true,
        },
      ];

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(addresses, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch addresses";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_ADDRESSES_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async addAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const input: AddAddressInput = req.body;

      if (
        !input.street ||
        !input.city ||
        !input.state ||
        !input.postalCode ||
        !input.country
      ) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            ResponseBuilder.error(
              "All address fields are required",
              "MISSING_ADDRESS_FIELDS"
            )
          );
        return;
      }

      // TODO: Implement with UserService
      // const address = await this.userService.addUserAddress(userId, input);

      // Placeholder response
      const address = {
        id: "addr-new",
        userId,
        ...input,
        createdAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.CREATED)
        .json(ResponseBuilder.success(address, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add address";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "ADD_ADDRESS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const input: Partial<AddAddressInput> = req.body;

      // TODO: Implement with UserService
      // const address = await this.userService.updateUserAddress(userId, id, input);

      // Placeholder response
      const address = {
        id,
        userId,
        ...input,
        updatedAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(address, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update address";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "UPDATE_ADDRESS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // await this.userService.deleteUserAddress(userId, id);

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete address";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "DELETE_ADDRESS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getUserOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const { limit = "20", page = "1", status } = req.query;

      // TODO: Implement with OrderService
      // const orders = await this.orderService.getUserOrders(userId, { limit, page, status });

      // Placeholder response
      const orders = [
        {
          id: "order-1",
          total: 99.99,
          status: "delivered",
          createdAt: new Date().toISOString(),
        },
      ];

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(orders, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch orders";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_ORDERS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // const wishlist = await this.userService.getUserWishlist(userId);

      // Placeholder response
      const wishlist = [
        {
          id: "product-1",
          name: "Sample Product",
          price: 29.99,
          addedAt: new Date().toISOString(),
        },
      ];

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(wishlist, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch wishlist";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_WISHLIST_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async addToWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // await this.userService.addToWishlist(userId, productId);

      res
        .status(HTTP_STATUS.OK)
        .json(
          ResponseBuilder.success(
            { message: "Product added to wishlist" },
            { requestId: req.id }
          )
        );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add to wishlist";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "ADD_WISHLIST_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async removeFromWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { productId } = req.params;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // await this.userService.removeFromWishlist(userId, productId);

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove from wishlist";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "REMOVE_WISHLIST_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  // Admin routes
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === "admin";

      if (!isAdmin) {
        res
          .status(HTTP_STATUS.FORBIDDEN)
          .json(
            ResponseBuilder.error("Admin access required", "ADMIN_REQUIRED")
          );
        return;
      }

      const { limit = "20", page = "1", search, status } = req.query;

      // TODO: Implement with UserService
      // const users = await this.userService.getUsers({ limit, page, search, status });

      // Placeholder response
      const users = [
        {
          id: "user-1",
          email: "user@example.com",
          firstName: "John",
          lastName: "Doe",
          status: "active",
          createdAt: new Date().toISOString(),
        },
      ];

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(users, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch users";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_USERS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === "admin";
      const { id } = req.params;

      if (!isAdmin) {
        res
          .status(HTTP_STATUS.FORBIDDEN)
          .json(
            ResponseBuilder.error("Admin access required", "ADMIN_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // const user = await this.userService.getUserById(id);

      // Placeholder response
      const user = {
        id,
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        status: "active",
        createdAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(user, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch user";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "FETCH_USER_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === "admin";
      const { id } = req.params;
      const { status } = req.body;

      if (!isAdmin) {
        res
          .status(HTTP_STATUS.FORBIDDEN)
          .json(
            ResponseBuilder.error("Admin access required", "ADMIN_REQUIRED")
          );
        return;
      }

      if (!["active", "inactive", "suspended"].includes(status)) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(ResponseBuilder.error("Invalid status", "INVALID_STATUS"));
        return;
      }

      // TODO: Implement with UserService
      // const user = await this.userService.updateUserStatus(id, status);

      // Placeholder response
      const user = {
        id,
        status,
        updatedAt: new Date().toISOString(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(user, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update user status";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const isAdmin = req.user?.role === "admin";
      const { id } = req.params;

      if (!isAdmin) {
        res
          .status(HTTP_STATUS.FORBIDDEN)
          .json(
            ResponseBuilder.error("Admin access required", "ADMIN_REQUIRED")
          );
        return;
      }

      // TODO: Implement with UserService
      // await this.userService.deleteUser(id);

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete user";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "DELETE_USER_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

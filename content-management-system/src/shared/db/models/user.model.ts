// Legacy types for backward compatibility - redirected to actual schema types

/**
 * @deprecated Use the actual user schema from core/database/schema instead
 * This interface is kept for backward compatibility only
 */
export interface UserModel {
  _id: string;
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "admin" | "editor" | "viewer";
  tenantId?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Export actual schema types for new code
export type { User } from "../../../core/database/schema/auth.schema";

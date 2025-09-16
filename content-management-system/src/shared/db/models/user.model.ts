// Legacy User model for backward compatibility

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

// Mock UserModel class for legacy compatibility
export class UserModel {
  static async findById(id: string): Promise<UserModel | null> {
    // This would be replaced with actual database query
    console.warn("UserModel.findById called with legacy interface:", id);
    return null;
  }

  static async findOne(query: any): Promise<UserModel | null> {
    console.warn("UserModel.findOne called with legacy interface:", query);
    return null;
  }

  static async find(query: any): Promise<UserModel[]> {
    console.warn("UserModel.find called with legacy interface:", query);
    return [];
  }

  select(fields: string): UserModel {
    console.warn("UserModel.select called with legacy interface:", fields);
    return this;
  }
}

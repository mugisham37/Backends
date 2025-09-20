import { z } from "zod";
import {
  emailSchema,
  passwordSchema,
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas";

/**
 * Zod validation schemas for authentication endpoints
 */

// Authentication request schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be less than 100 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be less than 100 characters"),
  role: z.enum(["admin", "editor", "author", "viewer"]).default("viewer"),
  tenantId: uuidSchema.optional(),
  inviteToken: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
  logoutAll: z.boolean().default(false),
});

// Two-factor authentication schemas
export const enable2FASchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const verify2FASchema = z.object({
  token: z.string().length(6, "2FA token must be 6 digits"),
  code: z.string().min(1, "Backup code is required"),
});

export const disable2FASchema = z.object({
  password: z.string().min(1, "Password is required"),
  token: z.string().length(6, "2FA token must be 6 digits"),
});

// Response data schemas
export const userDataSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  tenantId: uuidSchema.nullable(),
  avatar: z.string().nullable(),
  emailVerified: z.boolean(),
  twoFactorEnabled: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tokenDataSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.string().default("Bearer"),
});

export const authDataSchema = z.object({
  user: userDataSchema,
  tokens: tokenDataSchema,
});

export const twoFactorSetupSchema = z.object({
  secret: z.string(),
  qrCode: z.string(),
  backupCodes: z.array(z.string()),
});

// Response schemas
export const authResponseSchema = successResponseSchema(authDataSchema);
export const tokenRefreshResponseSchema =
  successResponseSchema(tokenDataSchema);
export const authUserResponseSchema = successResponseSchema(userDataSchema);
export const twoFactorSetupResponseSchema =
  successResponseSchema(twoFactorSetupSchema);

// Endpoint schemas
export const loginEndpoint = {
  body: loginSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const registerEndpoint = {
  body: registerSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const refreshTokenEndpoint = {
  body: refreshTokenSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const changePasswordEndpoint = {
  body: changePasswordSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const forgotPasswordEndpoint = {
  body: forgotPasswordSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const resetPasswordEndpoint = {
  body: resetPasswordSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const verifyEmailEndpoint = {
  body: verifyEmailSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const logoutEndpoint = {
  body: logoutSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

// Type exports
export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailSchema>;
export type LogoutRequest = z.infer<typeof logoutSchema>;
export type Enable2FARequest = z.infer<typeof enable2FASchema>;
export type Verify2FARequest = z.infer<typeof verify2FASchema>;
export type Disable2FARequest = z.infer<typeof disable2FASchema>;
export type UserData = z.infer<typeof userDataSchema>;
export type TokenData = z.infer<typeof tokenDataSchema>;
export type AuthData = z.infer<typeof authDataSchema>;
export type TwoFactorSetup = z.infer<typeof twoFactorSetupSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type TokenRefreshResponse = z.infer<typeof tokenRefreshResponseSchema>;
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
export type TwoFactorSetupResponse = z.infer<
  typeof twoFactorSetupResponseSchema
>;

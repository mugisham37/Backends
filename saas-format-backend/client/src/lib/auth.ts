import Cookies from "js-cookie"
import { jwtDecode } from "jwt-decode"
import { apiPost, apiGet, apiPut, clearApiCache } from "./api"
import { toast } from "@/components/ui/use-toast"
import { trackEvent } from "./analytics"

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId: string
  isActive: boolean
  avatarUrl?: string
  lastLogin?: string
  createdAt?: string
  updatedAt?: string
  preferences?: UserPreferences
}

export interface UserPreferences {
  theme?: "light" | "dark" | "system"
  language?: string
  emailNotifications?: boolean
  pushNotifications?: boolean
  timezone?: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: User
}

export interface RegisterResponse {
  token: string
  refreshToken: string
  user: User
}

export interface DecodedToken {
  id: string
  email: string
  role: string
  tenantId: string
  exp: number
  iat: number
}

// Login user
export const login = async (email: string, password: string): Promise<User> => {
  try {
    const response = await apiPost<LoginResponse>("/auth/login", { email, password })

    // Store tokens in cookies
    Cookies.set("token", response.token, {
      secure: true,
      sameSite: "strict",
      expires: 7, // 7 days
    })
    Cookies.set("refreshToken", response.refreshToken, {
      secure: true,
      sameSite: "strict",
      expires: 30, // 30 days
    })
    Cookies.set("tenantId", response.user.tenantId, {
      secure: true,
      sameSite: "strict",
      expires: 30, // 30 days
    })

    // Track login event
    trackEvent("auth_login_success", {
      userId: response.user.id,
      email: response.user.email,
      role: response.user.role,
      timestamp: new Date().toISOString(),
    })

    return response.user
  } catch (error) {
    trackEvent("auth_login_failed", {
      email,
      timestamp: new Date().toISOString(),
      error: String(error),
    })
    throw error
  }
}

// Register user
export const register = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  tenantName: string,
  tenantSlug: string,
): Promise<User> => {
  try {
    const response = await apiPost<RegisterResponse>("/auth/register", {
      email,
      password,
      firstName,
      lastName,
      tenant: {
        name: tenantName,
        slug: tenantSlug,
      },
    })

    // Store tokens in cookies
    Cookies.set("token", response.token, {
      secure: true,
      sameSite: "strict",
      expires: 7, // 7 days
    })
    Cookies.set("refreshToken", response.refreshToken, {
      secure: true,
      sameSite: "strict",
      expires: 30, // 30 days
    })
    Cookies.set("tenantId", response.user.tenantId, {
      secure: true,
      sameSite: "strict",
      expires: 30, // 30 days
    })

    // Track registration event
    trackEvent("auth_registration_success", {
      userId: response.user.id,
      email: response.user.email,
      tenantName,
      tenantSlug,
      timestamp: new Date().toISOString(),
    })

    return response.user
  } catch (error) {
    trackEvent("auth_registration_failed", {
      email,
      tenantName,
      tenantSlug,
      timestamp: new Date().toISOString(),
      error: String(error),
    })
    throw error
  }
}

// Logout user
export const logout = async (): Promise<void> => {
  try {
    const user = getCurrentUser()

    // Call logout API to invalidate token on server
    await apiPost("/auth/logout")

    // Track logout event
    if (user) {
      trackEvent("auth_logout", {
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("Error during logout:", error)
  } finally {
    // Clear API cache
    clearApiCache()

    // Remove cookies regardless of API call success
    Cookies.remove("token")
    Cookies.remove("refreshToken")
    Cookies.remove("tenantId")

    // Redirect to login page
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login"
    }
  }
}

// Get current user from token
export const getCurrentUser = (): User | null => {
  const token = Cookies.get("token")
  if (!token) return null

  try {
    const decoded = jwtDecode<DecodedToken>(token)

    // Check if token is expired
    const currentTime = Date.now() / 1000
    if (decoded.exp < currentTime) {
      return null
    }

    return {
      id: decoded.id,
      email: decoded.email,
      firstName: "", // These fields are not in the token
      lastName: "", // These fields are not in the token
      role: decoded.role,
      tenantId: decoded.tenantId,
      isActive: true,
    }
  } catch (error) {
    console.error("Error decoding token:", error)
    return null
  }
}

// Refresh token
export const refreshToken = async (): Promise<string> => {
  const refreshToken = Cookies.get("refreshToken")
  if (!refreshToken) {
    throw new Error("No refresh token available")
  }

  try {
    const response = await apiPost<{ token: string }>("/auth/refresh-token", { refreshToken })

    // Update token in cookies
    Cookies.set("token", response.token, {
      secure: true,
      sameSite: "strict",
      expires: 7, // 7 days
    })

    return response.token
  } catch (error) {
    // If refresh fails, clear auth state
    Cookies.remove("token")
    Cookies.remove("refreshToken")
    Cookies.remove("tenantId")

    throw error
  }
}

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = Cookies.get("token")
  if (!token) return false

  try {
    const decoded = jwtDecode<DecodedToken>(token)
    const currentTime = Date.now() / 1000

    return decoded.exp > currentTime
  } catch (error) {
    return false
  }
}

// Check if user has specific role
export const hasRole = (role: string | string[]): boolean => {
  const user = getCurrentUser()
  if (!user) return false

  if (Array.isArray(role)) {
    return role.includes(user.role)
  }

  return user.role === role
}

// Check if user has specific permission
export const hasPermission = async (permission: string): Promise<boolean> => {
  try {
    const response = await apiGet<{ hasPermission: boolean }>(`/auth/check-permission?permission=${permission}`)
    return response.hasPermission
  } catch (error) {
    console.error("Error checking permission:", error)
    return false
  }
}

// Fetch complete user profile
export const fetchUserProfile = async (): Promise<User> => {
  return await apiGet<User>("/users/me", { cache: true, cacheTTL: 5 * 60 * 1000 }) // Cache for 5 minutes
}

// Update user profile
export const updateUserProfile = async (data: Partial<User>): Promise<User> => {
  try {
    const response = await apiPut<User>("/users/me", data)

    // Clear user cache after update
    clearApiCache("/users/me")

    // Track profile update event
    trackEvent("auth_profile_updated", {
      userId: response.id,
      updatedFields: Object.keys(data),
      timestamp: new Date().toISOString(),
    })

    toast({
      title: "Profile updated",
      description: "Your profile has been updated successfully.",
    })

    return response
  } catch (error) {
    throw error
  }
}

// Update user preferences
export const updateUserPreferences = async (preferences: Partial<UserPreferences>): Promise<UserPreferences> => {
  try {
    const response = await apiPut<UserPreferences>("/users/me/preferences", preferences)

    // Clear user cache after update
    clearApiCache("/users/me")

    // Track preferences update event
    trackEvent("auth_preferences_updated", {
      updatedPreferences: Object.keys(preferences),
      timestamp: new Date().toISOString(),
    })

    toast({
      title: "Preferences updated",
      description: "Your preferences have been updated successfully.",
    })

    return response
  } catch (error) {
    throw error
  }
}

// Change password
export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  try {
    await apiPost("/auth/change-password", { currentPassword, newPassword })

    toast({
      title: "Password changed",
      description: "Your password has been changed successfully.",
    })

    // Track password change event
    const user = getCurrentUser()
    if (user) {
      trackEvent("auth_password_changed", {
        userId: user.id,
        timestamp: new Date().toISOString(),
      })
    }
  } catch (error) {
    throw error
  }
}

// Request password reset
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    await apiPost("/auth/forgot-password", { email })

    toast({
      title: "Password reset requested",
      description: "If your email is registered, you will receive a password reset link.",
    })

    // Track password reset request event
    trackEvent("auth_password_reset_requested", {
      email,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Reset password with token
export const resetPassword = async (token: string, password: string): Promise<void> => {
  try {
    await apiPost("/auth/reset-password", { token, password })

    toast({
      title: "Password reset successful",
      description: "Your password has been reset successfully. You can now log in with your new password.",
    })

    // Track password reset completion event
    trackEvent("auth_password_reset_completed", {
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    throw error
  }
}

// Enable two-factor authentication
export const enableTwoFactorAuth = async (): Promise<{ qrCode: string; secret: string }> => {
  return await apiPost<{ qrCode: string; secret: string }>("/auth/2fa/enable")
}

// Verify two-factor authentication
export const verifyTwoFactorAuth = async (secret: string, token: string): Promise<void> => {
  await apiPost("/auth/2fa/verify", { secret, token })
}

// Disable two-factor authentication
export const disableTwoFactorAuth = async (password: string): Promise<void> => {
  await apiPost("/auth/2fa/disable", { password })
}

// Get active sessions
export const getActiveSessions = async (): Promise<any[]> => {
  return await apiGet<any[]>("/auth/sessions")
}

// Revoke a specific session
export const revokeSession = async (sessionId: string): Promise<void> => {
  await apiPost(`/auth/sessions/${sessionId}/revoke`)
}

// Revoke all sessions except current
export const revokeAllSessions = async (): Promise<void> => {
  await apiPost("/auth/sessions/revoke-all")
}

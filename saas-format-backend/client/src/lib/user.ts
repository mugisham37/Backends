import { apiGet, apiPost, apiPut, apiDelete } from "./api"
import type { User } from "./auth"

export interface UserProfile {
  id: string
  userId: string
  bio?: string
  location?: string
  website?: string
  avatarUrl?: string
  socialLinks?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export interface UserPreference {
  id: string
  userId: string
  theme: string
  language: string
  timezone: string
  emailNotifications: boolean
  pushNotifications: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateUserDto {
  email: string
  password: string
  firstName: string
  lastName: string
  role?: string
}

export interface UpdateUserDto {
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  isActive?: boolean
}

export interface UpdateProfileDto {
  bio?: string
  location?: string
  website?: string
  avatarUrl?: string
  socialLinks?: Record<string, string>
}

export interface UpdatePreferenceDto {
  theme?: string
  language?: string
  timezone?: string
  emailNotifications?: boolean
  pushNotifications?: boolean
}

// User API functions
export const getUsers = async (): Promise<User[]> => {
  return await apiGet<User[]>("/users")
}

export const getUser = async (id: string): Promise<User> => {
  return await apiGet<User>(`/users/${id}`)
}

export const createUser = async (data: CreateUserDto): Promise<User> => {
  return await apiPost<User>("/users", data)
}

export const updateUser = async (id: string, data: UpdateUserDto): Promise<User> => {
  return await apiPut<User>(`/users/${id}`, data)
}

export const deleteUser = async (id: string): Promise<void> => {
  await apiDelete(`/users/${id}`)
}

export const getCurrentUser = async (): Promise<User> => {
  return await apiGet<User>("/users/me")
}

// Profile API functions
export const getUserProfile = async (userId: string): Promise<UserProfile> => {
  return await apiGet<UserProfile>(`/users/${userId}/profile`)
}

export const getCurrentUserProfile = async (): Promise<UserProfile> => {
  return await apiGet<UserProfile>("/users/me/profile")
}

export const updateUserProfile = async (data: UpdateProfileDto): Promise<UserProfile> => {
  return await apiPut<UserProfile>("/users/me/profile", data)
}

export const uploadProfileAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData()
  formData.append("avatar", file)

  return await apiPost<{ avatarUrl: string }>("/users/me/profile/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
}

// Preference API functions
export const getUserPreferences = async (): Promise<UserPreference> => {
  return await apiGet<UserPreference>("/users/me/preferences")
}

export const updateUserPreferences = async (data: UpdatePreferenceDto): Promise<UserPreference> => {
  return await apiPut<UserPreference>("/users/me/preferences", data)
}

import { apiGet, apiPost, apiPut, apiDelete } from "./api"

export interface Project {
  id: string
  name: string
  description?: string
  status: string
  tenantId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  projectId: string
  assignedTo?: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Comment {
  id: string
  content: string
  taskId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Attachment {
  id: string
  name: string
  fileUrl: string
  fileType: string
  fileSize: number
  taskId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectDto {
  name: string
  description?: string
  status?: string
}

export interface UpdateProjectDto {
  name?: string
  description?: string
  status?: string
}

export interface CreateTaskDto {
  title: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string
  assignedTo?: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string
  assignedTo?: string
}

export interface CreateCommentDto {
  content: string
}

// Project API functions
export const getProjects = async (): Promise<Project[]> => {
  return await apiGet<Project[]>("/projects")
}

export const getProject = async (id: string): Promise<Project> => {
  return await apiGet<Project>(`/projects/${id}`)
}

export const createProject = async (data: CreateProjectDto): Promise<Project> => {
  return await apiPost<Project>("/projects", data)
}

export const updateProject = async (id: string, data: UpdateProjectDto): Promise<Project> => {
  return await apiPut<Project>(`/projects/${id}`, data)
}

export const deleteProject = async (id: string): Promise<void> => {
  await apiDelete(`/projects/${id}`)
}

// Task API functions
export const getTasks = async (projectId: string): Promise<Task[]> => {
  return await apiGet<Task[]>(`/projects/${projectId}/tasks`)
}

export const getTask = async (projectId: string, taskId: string): Promise<Task> => {
  return await apiGet<Task>(`/projects/${projectId}/tasks/${taskId}`)
}

export const createTask = async (projectId: string, data: CreateTaskDto): Promise<Task> => {
  return await apiPost<Task>(`/projects/${projectId}/tasks`, data)
}

export const updateTask = async (projectId: string, taskId: string, data: UpdateTaskDto): Promise<Task> => {
  return await apiPut<Task>(`/projects/${projectId}/tasks/${taskId}`, data)
}

export const deleteTask = async (projectId: string, taskId: string): Promise<void> => {
  await apiDelete(`/projects/${projectId}/tasks/${taskId}`)
}

export const assignTask = async (projectId: string, taskId: string, userId: string): Promise<Task> => {
  return await apiPost<Task>(`/projects/${projectId}/tasks/${taskId}/assign`, { userId })
}

export const unassignTask = async (projectId: string, taskId: string): Promise<Task> => {
  return await apiPost<Task>(`/projects/${projectId}/tasks/${taskId}/unassign`)
}

export const updateTaskStatus = async (projectId: string, taskId: string, status: string): Promise<Task> => {
  return await apiPut<Task>(`/projects/${projectId}/tasks/${taskId}/status`, { status })
}

// Comment API functions
export const getComments = async (projectId: string, taskId: string): Promise<Comment[]> => {
  return await apiGet<Comment[]>(`/projects/${projectId}/tasks/${taskId}/comments`)
}

export const createComment = async (projectId: string, taskId: string, data: CreateCommentDto): Promise<Comment> => {
  return await apiPost<Comment>(`/projects/${projectId}/tasks/${taskId}/comments`, data)
}

export const updateComment = async (
  projectId: string,
  taskId: string,
  commentId: string,
  data: CreateCommentDto,
): Promise<Comment> => {
  return await apiPut<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`, data)
}

export const deleteComment = async (projectId: string, taskId: string, commentId: string): Promise<void> => {
  await apiDelete(`/projects/${projectId}/tasks/${taskId}/comments/${commentId}`)
}

// Attachment API functions
export const getAttachments = async (projectId: string, taskId: string): Promise<Attachment[]> => {
  return await apiGet<Attachment[]>(`/projects/${projectId}/tasks/${taskId}/attachments`)
}

export const uploadAttachment = async (projectId: string, taskId: string, file: File): Promise<Attachment> => {
  const formData = new FormData()
  formData.append("file", file)

  return await apiPost<Attachment>(`/projects/${projectId}/tasks/${taskId}/attachments/upload`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  })
}

export const deleteAttachment = async (projectId: string, taskId: string, attachmentId: string): Promise<void> => {
  await apiDelete(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`)
}

export const downloadAttachment = async (projectId: string, taskId: string, attachmentId: string): Promise<Blob> => {
  return await apiGet<Blob>(`/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download`, {
    responseType: "blob",
  })
}

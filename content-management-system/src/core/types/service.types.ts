import type {
  Content,
  FilterOptions,
  Media,
  PaginatedResult,
  Tenant,
  User,
} from "./database.types";
import type { Result } from "./result.types";

/**
 * Base service interface
 */
export interface IBaseService {
  readonly name: string;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
  healthCheck?(): Promise<{ healthy: boolean; error?: string }>;
}

/**
 * Authentication service interface
 */
export interface IAuthService extends IBaseService {
  authenticate(
    credentials: LoginCredentials
  ): Promise<Result<AuthResult, Error>>;
  generateTokens(userId: string): Promise<Result<TokenPair, Error>>;
  refreshToken(refreshToken: string): Promise<Result<TokenPair, Error>>;
  validateToken(token: string): Promise<Result<UserPayload, Error>>;
  revokeToken(token: string): Promise<Result<void, Error>>;
  hashPassword(password: string): Promise<Result<string, Error>>;
  verifyPassword(
    password: string,
    hash: string
  ): Promise<Result<boolean, Error>>;
  generateResetToken(userId: string): Promise<Result<string, Error>>;
  validateResetToken(token: string): Promise<Result<string, Error>>;
}

/**
 * User service interface
 */
export interface IUserService extends IBaseService {
  createUser(data: CreateUserData): Promise<Result<User, Error>>;
  getUserById(id: string): Promise<Result<User | null, Error>>;
  getUser(id: string): Promise<Result<User | null, Error>>; // Alias for getUserById
  getUserByEmail(email: string): Promise<Result<User | null, Error>>;
  updateUser(id: string, data: UpdateUserData): Promise<Result<User, Error>>;
  deleteUser(id: string): Promise<Result<void, Error>>;
  listUsers(
    options?: FilterOptions<User>
  ): Promise<Result<PaginatedResult<User>, Error>>;
  getUsersByTenant(tenantId: string): Promise<Result<User[], Error>>; // Added for DataLoader
  activateUser(id: string): Promise<Result<User, Error>>;
  deactivateUser(id: string): Promise<Result<User, Error>>;
  changePassword(
    id: string,
    oldPassword: string,
    newPassword: string
  ): Promise<Result<void, Error>>;
  resetPassword(id: string, newPassword: string): Promise<Result<void, Error>>;
}

/**
 * Tenant service interface
 */
export interface ITenantService extends IBaseService {
  createTenant(data: CreateTenantData): Promise<Result<Tenant, Error>>;
  getTenant(id: string): Promise<Result<Tenant | null, Error>>;
  getTenantBySlug(slug: string): Promise<Result<Tenant | null, Error>>;
  updateTenant(
    id: string,
    data: UpdateTenantData
  ): Promise<Result<Tenant, Error>>;
  deleteTenant(id: string): Promise<Result<void, Error>>;
  listTenants(
    options?: FilterOptions<Tenant>
  ): Promise<Result<PaginatedResult<Tenant>, Error>>;
  getUserTenants(userId: string): Promise<Result<Tenant[], Error>>;
  addUserToTenant(
    tenantId: string,
    userId: string,
    role?: string
  ): Promise<Result<void, Error>>;
  removeUserFromTenant(
    tenantId: string,
    userId: string
  ): Promise<Result<void, Error>>;
}

/**
 * Content service interface
 */
export interface IContentService extends IBaseService {
  createContent(data: CreateContentData): Promise<Result<Content, Error>>;
  getContent(
    id: string,
    version?: string
  ): Promise<Result<Content | null, Error>>;
  getContentBySlug(
    slug: string,
    tenantId?: string
  ): Promise<Result<Content | null, Error>>;
  updateContent(
    id: string,
    data: UpdateContentData
  ): Promise<Result<Content, Error>>;
  deleteContent(id: string): Promise<Result<void, Error>>;
  listContent(
    options?: FilterOptions<Content>
  ): Promise<Result<PaginatedResult<Content>, Error>>;
  getContentsByTenant(tenantId: string): Promise<Result<Content[], Error>>; // Added for DataLoader
  publishContent(id: string): Promise<Result<Content, Error>>;
  unpublishContent(id: string): Promise<Result<Content, Error>>;
  archiveContent(id: string): Promise<Result<Content, Error>>;
  getContentVersions(id: string): Promise<Result<ContentVersion[], Error>>;
  getContentsByTenant(
    tenantId: string,
    options?: FilterOptions<Content>
  ): Promise<Result<Content[], Error>>; // Added for DataLoader
  revertToVersion(id: string, version: number): Promise<Result<Content, Error>>;
  duplicateContent(
    id: string,
    data?: Partial<CreateContentData>
  ): Promise<Result<Content, Error>>;
}

/**
 * Media service interface
 */
export interface IMediaService extends IBaseService {
  uploadFile(
    file: FileUpload,
    metadata: MediaMetadata
  ): Promise<Result<Media, Error>>;
  getFile(id: string): Promise<Result<Media | null, Error>>;
  updateFile(id: string, data: UpdateMediaData): Promise<Result<Media, Error>>;
  deleteFile(id: string): Promise<Result<void, Error>>;
  listFiles(
    options?: FilterOptions<Media>
  ): Promise<Result<PaginatedResult<Media>, Error>>;
  getMediaByTenant(
    tenantId: string,
    options?: FilterOptions<Media>
  ): Promise<Result<Media[], Error>>; // Added for DataLoader
  processImage(
    id: string,
    transformations: ImageTransformation[]
  ): Promise<Result<Media, Error>>;
  generateCdnUrl(
    id: string,
    options?: CdnOptions
  ): Promise<Result<string, Error>>;
  generateThumbnail(
    id: string,
    size: ThumbnailSize
  ): Promise<Result<string, Error>>;
  getFileStream(id: string): Promise<Result<NodeJS.ReadableStream, Error>>;
  validateFile(file: FileUpload): Promise<Result<boolean, Error>>;
}

/**
 * Search service interface
 */
export interface ISearchService extends IBaseService {
  indexDocument(
    type: string,
    id: string,
    document: Record<string, unknown>
  ): Promise<Result<void, Error>>;
  removeDocument(type: string, id: string): Promise<Result<void, Error>>;
  search(query: SearchQuery): Promise<Result<SearchResult, Error>>;
  suggest(query: string, type?: string): Promise<Result<string[], Error>>;
  reindex(type?: string): Promise<Result<void, Error>>;
  getStats(): Promise<Result<SearchStats, Error>>;
}

/**
 * Cache service interface
 */
export interface ICacheService extends IBaseService {
  get<T = unknown>(key: string): Promise<Result<T | null, Error>>;
  set(key: string, value: unknown, ttl?: number): Promise<Result<void, Error>>;
  delete(key: string): Promise<Result<void, Error>>;
  clear(pattern?: string): Promise<Result<void, Error>>;
  exists(key: string): Promise<Result<boolean, Error>>;
  increment(key: string, amount?: number): Promise<Result<number, Error>>;
  decrement(key: string, amount?: number): Promise<Result<number, Error>>;
  expire(key: string, ttl: number): Promise<Result<void, Error>>;
  ttl(key: string): Promise<Result<number, Error>>;
  keys(pattern: string): Promise<Result<string[], Error>>;
}

/**
 * Webhook service interface
 */
export interface IWebhookService extends IBaseService {
  registerWebhook(data: RegisterWebhookData): Promise<Result<Webhook, Error>>;
  unregisterWebhook(id: string): Promise<Result<void, Error>>;
  triggerWebhook(event: WebhookEvent): Promise<Result<void, Error>>;
  retryWebhook(deliveryId: string): Promise<Result<void, Error>>;
  getWebhookDeliveries(
    webhookId: string
  ): Promise<Result<WebhookDelivery[], Error>>;
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): Promise<Result<boolean, Error>>;
}

/**
 * Audit service interface
 */
export interface IAuditService extends IBaseService {
  log(event: AuditEvent): Promise<Result<void, Error>>;
  getAuditLog(
    options?: AuditLogOptions
  ): Promise<Result<PaginatedResult<AuditEvent>, Error>>;
  getEntityAuditLog(
    entityType: string,
    entityId: string
  ): Promise<Result<AuditEvent[], Error>>;
  getUserAuditLog(userId: string): Promise<Result<AuditEvent[], Error>>;
  getTenantAuditLog(tenantId: string): Promise<Result<AuditEvent[], Error>>;
}

/**
 * Data transfer objects and types
 */

/**
 * Authentication types
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  user: UserPayload;
  tokens: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
  permissions?: string[];
}

/**
 * User management types
 */
export interface CreateUserData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * Tenant management types
 */
export interface CreateTenantData {
  name: string;
  slug?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateTenantData {
  name?: string;
  slug?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * Content management types
 */
export interface CreateContentData {
  title: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  status?: "draft" | "published" | "archived";
  categoryId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateContentData {
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  status?: "draft" | "published" | "archived";
  categoryId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  title: string;
  body?: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

/**
 * Media management types
 */
export interface FileUpload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface MediaMetadata {
  alt?: string;
  caption?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateMediaData {
  filename?: string;
  alt?: string;
  caption?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ImageTransformation {
  type: "resize" | "crop" | "rotate" | "quality" | "format";
  params: Record<string, unknown>;
}

export interface CdnOptions {
  transformations?: ImageTransformation[];
  expires?: number;
  secure?: boolean;
}

export interface ThumbnailSize {
  width: number;
  height: number;
  fit?: "cover" | "contain" | "fill";
}

/**
 * Search types
 */
export interface SearchQuery {
  query: string;
  type?: string;
  filters?: Record<string, unknown>;
  sort?: Array<{ field: string; direction: "asc" | "desc" }>;
  pagination?: {
    page: number;
    limit: number;
  };
  facets?: string[];
  boost?: Record<string, number>;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  took: number;
  facets?: Record<string, SearchFacet[]>;
  suggestions?: string[];
}

export interface SearchHit {
  id: string;
  type: string;
  score: number;
  source: Record<string, unknown>;
  highlights?: Record<string, string[]>;
}

export interface SearchFacet {
  value: string;
  count: number;
}

export interface SearchStats {
  totalDocuments: number;
  indexSize: number;
  types: Record<string, number>;
}

/**
 * Webhook types
 */
export interface RegisterWebhookData {
  url: string;
  events: string[];
  secret?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: Date;
  tenantId?: string;
  userId?: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventId: string;
  status: "pending" | "success" | "failed" | "retrying";
  attempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;
  response?: {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audit types
 */
export interface AuditEvent {
  id: string;
  type: string;
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  tenantId?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogOptions extends FilterOptions<AuditEvent> {
  entityType?: string;
  entityId?: string;
  userId?: string;
  tenantId?: string;
  actions?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
}

/**
 * Service configuration types
 */
export interface ServiceConfig {
  name: string;
  enabled: boolean;
  dependencies?: string[];
  settings?: Record<string, unknown>;
}

export interface ServiceRegistry {
  register<T extends IBaseService>(name: string, service: T): void;
  get<T extends IBaseService>(name: string): T;
  has(name: string): boolean;
  list(): string[];
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

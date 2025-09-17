/**
 * User DataLoader
 * Prevents N+1 queries when fetching users
 */

import DataLoader from "dataloader";
import { UserRepository } from "../../../core/repositories/user.repository.js";
import { User } from "../../../core/database/schema/index.js";

export class UserLoader {
  private userRepository: UserRepository;
  private byIdLoader: DataLoader<string, User | null>;
  private byEmailLoader: DataLoader<string, User | null>;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;

    // Loader for users by ID
    this.byIdLoader = new DataLoader<string, User | null>(
      async (ids: readonly string[]) => {
        try {
          const users = await this.userRepository.findByIds([...ids]);
          const userMap = new Map(users.map((user) => [user.id, user]));

          return ids.map((id) => userMap.get(id) || null);
        } catch (error) {
          // For DataLoader, we need to return an error for each ID if the batch fails
          return ids.map(() => error as Error);
        }
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );

    // Loader for users by email
    this.byEmailLoader = new DataLoader<string, User | null>(
      async (emails: readonly string[]) => {
        try {
          const users = await this.userRepository.findByEmails([...emails]);
          const userMap = new Map(users.map((user) => [user.email, user]));

          return emails.map((email) => userMap.get(email) || null);
        } catch (error) {
          // For DataLoader, we need to return an error for each email if the batch fails
          return emails.map(() => error as Error);
        }
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );
  }

  // Load user by ID
  async loadById(id: string): Promise<User | null> {
    return this.byIdLoader.load(id);
  }

  // Load multiple users by IDs
  async loadManyByIds(ids: string[]): Promise<(User | null | Error)[]> {
    return this.byIdLoader.loadMany(ids);
  }

  // Load user by email
  async loadByEmail(email: string): Promise<User | null> {
    return this.byEmailLoader.load(email);
  }

  // Load multiple users by emails
  async loadManyByEmails(emails: string[]): Promise<(User | null | Error)[]> {
    return this.byEmailLoader.loadMany(emails);
  }

  // Clear cache for specific user
  clearUser(id: string): void {
    this.byIdLoader.clear(id);
  }

  // Clear cache for specific email
  clearUserByEmail(email: string): void {
    this.byEmailLoader.clear(email);
  }

  // Clear all caches
  clearAll(): void {
    this.byIdLoader.clearAll();
    this.byEmailLoader.clearAll();
  }

  // Prime cache with user data
  prime(user: User): void {
    this.byIdLoader.prime(user.id, user);
    this.byEmailLoader.prime(user.email, user);
  }
}

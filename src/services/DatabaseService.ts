/**
 * DatabaseService.ts
 * 
 * This file implements a lightweight SQLite database service for the Todo application.
 * 
 * WHY SQLITE?
 * - SQLite is perfect for small to medium applications like this one
 * - Requires no separate database server (file-based)
 * - ACID compliant and reliable
 * - Minimal configuration required
 * - Easy to install with minimal dependencies
 */
import Database from 'better-sqlite3';
import { config, ensureDbFolder } from '../config.js';

/**
 * DatabaseService Class
 * 
 * This service manages the SQLite database connection and schema.
 * It follows the singleton pattern to ensure only one database connection exists.
 * 
 * WHY SINGLETON PATTERN?
 * - Prevents multiple database connections which could lead to conflicts
 * - Provides a central access point to the database throughout the application
 * - Makes it easier to manage connection lifecycle (open/close)
 */
class DatabaseService {
  private db: Database.Database;

  private migrations: Record<number, string[]> = {
    1: [`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        completedAt TEXT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `],
    2: [`
      ALTER TABLE todos ADD COLUMN scheduledDate TEXT;
    `, `
      ALTER TABLE todos ADD COLUMN dueDate TEXT;
    `, `
      ALTER TABLE todos ADD COLUMN recurrence TEXT;
    `],
    3: [`
      CREATE TABLE IF NOT EXISTS todo_completions (
        id TEXT PRIMARY KEY,
        todoId TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
        completedDate TEXT NOT NULL,
        completedAt TEXT NOT NULL,
        UNIQUE(todoId, completedDate)
      )
    `],
  };

  constructor() {
    ensureDbFolder();
    this.db = new Database(config.db.path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.runMigrations();
  }

  private getCurrentVersion(): number {
    const row = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).get() as any;

    if (!row) return 0;

    const versionRow = this.db.prepare(
      'SELECT MAX(version) as version FROM schema_version'
    ).get() as any;

    return versionRow?.version ?? 0;
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER NOT NULL,
        appliedAt TEXT NOT NULL
      )
    `);

    const currentVersion = this.getCurrentVersion();
    const maxVersion = Math.max(...Object.keys(this.migrations).map(Number));
    const now = new Date().toISOString();

    for (let v = currentVersion + 1; v <= maxVersion; v++) {
      const statements = this.migrations[v];
      if (!statements) continue;

      const transaction = this.db.transaction(() => {
        for (const sql of statements) {
          this.db.exec(sql);
        }
        this.db.prepare(
          'INSERT INTO schema_version (version, appliedAt) VALUES (?, ?)'
        ).run(v, now);
      });
      transaction();
    }
  }

  /**
   * Get the database instance
   * 
   * This allows other services to access the database for operations.
   * 
   * @returns The SQLite database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close the database connection
   * 
   * This should be called when shutting down the application to ensure
   * all data is properly saved and resources are released.
   */
  close(): void {
    this.db.close();
  }
}

// Create a singleton instance that will be used throughout the application
export const databaseService = new DatabaseService(); 
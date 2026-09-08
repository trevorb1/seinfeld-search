import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "seinfeld.db");

// Maintain a single database instance across hot-reloads in development
const globalForDb = globalThis as unknown as {
  db: Database.Database | undefined;
};

// Read-only mode prevents accidental writes and file lock contention
export const db =
  globalForDb.db ??
  new Database(dbPath, { readonly: true, fileMustExist: true });

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// Optimize query planning and ensure read-only operation
db.pragma("query_only = ON");
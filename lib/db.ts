import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "seinfeld.db");

// Read-only mode prevents accidental writes and file lock contention
export const db = new Database(dbPath, { readonly: true, fileMustExist: true });

// Optimize query planning
db.pragma("query_only = ON");
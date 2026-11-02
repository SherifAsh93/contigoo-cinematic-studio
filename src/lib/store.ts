import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Job } from "./contracts";

const globalDb = globalThis as typeof globalThis & { studioDb?: DatabaseSync };
function database() {
  if (!globalDb.studioDb) {
    const dir = path.resolve(/* turbopackIgnore: true */ process.env.STUDIO_DATA_DIR || ".data");
    mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, "studio.sqlite"));
    db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, data TEXT NOT NULL)");
    globalDb.studioDb = db;
  }
  return globalDb.studioDb;
}

export function saveJob(job: Job) {
  database().prepare("INSERT INTO jobs (id, created_at, data) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").run(job.id, job.createdAt, JSON.stringify(job));
  return job;
}
export function listJobs(): Job[] {
  return database().prepare("SELECT data FROM jobs ORDER BY created_at DESC LIMIT 200").all().map(row => JSON.parse(row.data as string));
}
export function findJob(id: string): Job | undefined {
  const row = database().prepare("SELECT data FROM jobs WHERE id = ?").get(id);
  return row ? JSON.parse(row.data as string) : undefined;
}
export function deleteJob(id: string) {
  database().prepare("DELETE FROM jobs WHERE id = ?").run(id);
}

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Manuscript } from "./types";

interface SmrDB extends DBSchema {
  manuscripts: {
    key: string;
    value: Manuscript;
    indexes: { "by-importedAt": number };
  };
  playbackPositions: {
    key: string; // manuscriptId
    value: { manuscriptId: string; positionMs: number };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

let dbPromise: Promise<IDBPDatabase<SmrDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SmrDB>("smr-stories-made-real", 1, {
      upgrade(db) {
        const manuscripts = db.createObjectStore("manuscripts", { keyPath: "id" });
        manuscripts.createIndex("by-importedAt", "importedAtEpochMs");
        db.createObjectStore("playbackPositions", { keyPath: "manuscriptId" });
        db.createObjectStore("settings");
      }
    });
  }
  return dbPromise;
}

export async function listManuscripts(): Promise<Manuscript[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("manuscripts", "by-importedAt");
  return all.reverse();
}

export async function getManuscript(id: string): Promise<Manuscript | undefined> {
  const db = await getDb();
  return db.get("manuscripts", id);
}

export async function putManuscript(manuscript: Manuscript): Promise<void> {
  const db = await getDb();
  await db.put("manuscripts", manuscript);
}

export async function deleteManuscript(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("manuscripts", id);
  await db.delete("playbackPositions", id);
}

export async function savePosition(manuscriptId: string, positionMs: number): Promise<void> {
  const db = await getDb();
  await db.put("playbackPositions", { manuscriptId, positionMs });
}

export async function getPosition(manuscriptId: string): Promise<number> {
  const db = await getDb();
  const row = await db.get("playbackPositions", manuscriptId);
  return row?.positionMs ?? 0;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const value = await db.get("settings", key);
  return (value as T | undefined) ?? fallback;
}

export async function putSetting(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put("settings", value, key);
}

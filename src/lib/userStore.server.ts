/**
 * userStore.server.ts — User persistence & credential hashing.
 * Server-only module using native crypto.subtle PBKDF2.
 * Supports filesystem (.data/users.json) and Supabase (app_users table).
 */
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { supabase } from "./supabase";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const USERS_FILE = path.resolve(process.cwd(), ".data", "users.json");

function getEnv(key: string): string | undefined {
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key];
  }
  return (import.meta.env as any)?.[key];
}

/** Hashes a plain-text password with salt using PBKDF2 (100,000 rounds of SHA-256). */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Buffer.from(derivedBits).toString("hex");
}

export function generateSalt(): string {
  return randomBytes(16).toString("hex");
}

/** Loads all users from Supabase or the filesystem. */
async function loadAllUsers(): Promise<UserRecord[]> {
  // 1. Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.from("app_users").select("*");
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as UserRecord[];
      }
    } catch {
      // Table may not exist yet, proceed to filesystem
    }
  }

  // 2. Filesystem
  try {
    const raw = await fs.readFile(USERS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as UserRecord[];
  } catch {
    // File not created yet
  }

  return [];
}

/** Saves all users to Supabase and filesystem. */
async function saveAllUsers(users: UserRecord[]): Promise<void> {
  // 1. Filesystem
  try {
    const dataDir = path.dirname(USERS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to write users.json:", err);
  }

  // 2. Supabase (upsert)
  if (supabase) {
    try {
      await supabase.from("app_users").upsert(users, { onConflict: "id" });
    } catch {
      // Ignore if table does not exist
    }
  }
}

/** Finds a user by email (case-insensitive). */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const users = await loadAllUsers();
  const found = users.find((u) => u.email.toLowerCase() === normalized);
  if (found) return found;

  // Fallback: check if matches owner configured in env
  const ownerEmail = (getEnv("APP_EMAIL") ?? "sanjaynathiya81@gmail.com").toLowerCase();
  const ownerPassword = getEnv("APP_PASSWORD") ?? "&Anjay2512";

  if (normalized === ownerEmail) {
    // Auto-create user record for owner
    const salt = generateSalt();
    const hash = await hashPassword(ownerPassword, salt);
    const ownerUser: UserRecord = {
      id: "owner",
      name: "Sanjay",
      email: ownerEmail,
      passwordHash: hash,
      salt,
      createdAt: new Date().toISOString(),
    };
    users.push(ownerUser);
    await saveAllUsers(users);
    return ownerUser;
  }

  return null;
}

/** Finds a user by ID. */
export async function findUserById(id: string): Promise<UserRecord | null> {
  const users = await loadAllUsers();
  return users.find((u) => u.id === id) ?? null;
}

/** Creates a new user record after ensuring the email is not already in use. */
export async function createUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ user: UserRecord | null; error: string | null }> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const existing = await findUserByEmail(normalizedEmail);

  if (existing) {
    return { user: null, error: "An account with this email already exists. Please sign in." };
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(data.password, salt);
  const id = `usr_${randomBytes(8).toString("hex")}`;

  const newUser: UserRecord = {
    id,
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  const users = await loadAllUsers();
  users.push(newUser);
  await saveAllUsers(users);

  return { user: newUser, error: null };
}

/** Verifies plain password against stored user hash. */
export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<{ user: UserRecord | null; valid: boolean }> {
  const user = await findUserByEmail(email);
  if (!user) return { user: null, valid: false };

  const hash = await hashPassword(password, user.salt);
  const valid = hash === user.passwordHash;
  return { user: valid ? user : null, valid };
}

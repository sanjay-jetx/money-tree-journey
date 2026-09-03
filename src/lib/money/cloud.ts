import { createServerFn } from "@tanstack/react-start";
import type { MoneyState } from "./types";

// In-memory store for server session persistence across all connected devices
const serverMemoryStore = new Map<string, { state: MoneyState; updatedAt: string }>();

export interface SyncPayload {
  syncKey: string;
  state: MoneyState;
}

export interface SyncResponse {
  success: boolean;
  state?: MoneyState | undefined;
  updatedAt?: string | undefined;
  message?: string | undefined;
}

export const fetchCloudState = createServerFn({ method: "GET" })
  .validator((data: { syncKey: string }) => data)
  .handler(async ({ data }): Promise<SyncResponse> => {
    const key = data.syncKey || "default-tree";
    const existing = serverMemoryStore.get(key);

    if (existing) {
      return {
        success: true,
        state: existing.state,
        updatedAt: existing.updatedAt,
      };
    }

    // Try filesystem fallback in node environment
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const dataDir = path.resolve(process.cwd(), ".data");
        const filePath = path.join(dataDir, `tree_${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
        const content = await fs.readFile(filePath, "utf-8");
        const parsed = JSON.parse(content) as { state: MoneyState; updatedAt: string };
        serverMemoryStore.set(key, parsed);
        return {
          success: true,
          state: parsed.state,
          updatedAt: parsed.updatedAt,
        };
      }
    } catch {
      // File not found or first sync
    }

    return {
      success: false,
      message: "No cloud state found for this key yet",
    };
  });

export const pushCloudState = createServerFn({ method: "POST" })
  .validator((data: SyncPayload) => data)
  .handler(async ({ data }): Promise<SyncResponse> => {
    const key = data.syncKey || "default-tree";
    const now = new Date().toISOString();
    const entry = { state: data.state, updatedAt: now };

    serverMemoryStore.set(key, entry);

    // Save to filesystem if node environment
    try {
      if (typeof process !== "undefined" && process.versions?.node) {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const dataDir = path.resolve(process.cwd(), ".data");
        await fs.mkdir(dataDir, { recursive: true });
        const filePath = path.join(dataDir, `tree_${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
        await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
      }
    } catch (err) {
      console.error("Failed to write tree to file storage:", err);
    }

    return {
      success: true,
      updatedAt: now,
    };
  });

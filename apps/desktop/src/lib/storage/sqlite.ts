import type { StoreBackend } from "@gx/core";
export class SqliteBackend implements StoreBackend {
  async request(operation: string, data: unknown = {}) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke("practice_request", { operation, data });
  }
}

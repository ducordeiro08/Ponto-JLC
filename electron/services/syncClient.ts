import type { CreateEntryResult, CreatePresenceRecordInput, CreatePresenceRecordResult, PresenceRecord, PresenceRecordDetail, Session, TimeForm, UpdatePresenceRecordInput, Worksite, WorksiteEmployee } from "../../shared/types.js";
import type { PresenceRecordSyncPayload, SyncQueueItem, TimeEntrySyncPayload } from "../database.js";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export class TothApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TothApiRequestError";
  }
}

export function isOfflineSyncError(error: unknown) {
  return !(error instanceof TothApiRequestError);
}

export class TothSyncClient {
  private readonly apiUrl: string | null;
  private sessionId = "";

  constructor() {
    this.apiUrl = this.resolveApiUrl();
  }

  get enabled() {
    return Boolean(this.apiUrl);
  }

  async listWorksites(): Promise<Worksite[]> {
    if (!this.apiUrl) return [];
    return this.request<Worksite[]>("/worksites");
  }

  async createRemoteSession(cpf: string, worksiteId: string): Promise<Session> {
    const response = await this.request<Session & { sessionId: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ cpf, worksiteId }),
    });
    this.sessionId = response.sessionId;
    return { employee: response.employee, worksite: response.worksite };
  }

  async listWorksiteEmployees(): Promise<WorksiteEmployee[]> {
    if (!this.apiUrl || !this.sessionId) throw new Error("Sessao remota ausente.");
    return this.request<WorksiteEmployee[]>("/worksite-employees");
  }

  async createTimeEntry(allowDuplicate: boolean): Promise<CreateEntryResult> {
    if (!this.apiUrl || !this.sessionId) throw new Error("API de sincronizacao nao configurada.");
    return this.request<CreateEntryResult>("/time-entries", {
      method: "POST",
      body: JSON.stringify({ allowDuplicate }),
    });
  }

  async listForms(): Promise<TimeForm[]> {
    if (!this.apiUrl || !this.sessionId) throw new Error("Sessao remota ausente.");
    return this.request<TimeForm[]>("/forms");
  }

  async createPresenceRecord(input: CreatePresenceRecordInput): Promise<CreatePresenceRecordResult> {
    if (!this.apiUrl || !this.sessionId) throw new Error("API de sincronizacao nao configurada.");
    return this.request<CreatePresenceRecordResult>("/presence-records", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async listPresenceRecords(): Promise<PresenceRecord[]> {
    if (!this.apiUrl || !this.sessionId) throw new Error("Sessao remota ausente.");
    return this.request<PresenceRecord[]>("/presence-records");
  }

  async getPresenceRecord(recordId: string): Promise<PresenceRecordDetail> {
    if (!this.apiUrl || !this.sessionId) throw new Error("API de sincronizacao nao configurada.");
    return this.request<PresenceRecordDetail>(`/presence-records/${encodeURIComponent(recordId)}`);
  }

  async updatePresenceRecord(input: UpdatePresenceRecordInput): Promise<PresenceRecordDetail> {
    if (!this.apiUrl || !this.sessionId) throw new Error("API de sincronizacao nao configurada.");
    return this.request<PresenceRecordDetail>(`/presence-records/${encodeURIComponent(input.recordId)}`, {
      method: "PATCH",
      body: JSON.stringify({ observations: input.observations }),
    });
  }

  async createSession(session: Session) {
    if (!this.apiUrl) return;
    const response = await this.request<{ sessionId: string }>("/sessions", {
      method: "POST",
      body: JSON.stringify({ cpf: session.employee.cpf, worksiteId: session.worksite.id }),
    });
    this.sessionId = response.sessionId;
  }

  async syncTimeEntry(payload: TimeEntrySyncPayload) {
    if (!this.apiUrl) return;
    await this.request("/sync/time-entries", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async syncPresenceRecord(payload: PresenceRecordSyncPayload) {
    if (!this.apiUrl) return;
    await this.request("/sync/presence-records", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async syncItem(item: SyncQueueItem) {
    if (item.kind === "time-entry") {
      await this.syncTimeEntry(item.payload as TimeEntrySyncPayload);
      return;
    }
    await this.syncPresenceRecord(item.payload as PresenceRecordSyncPayload);
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.apiUrl) throw new Error("API de sincronizacao nao configurada.");
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.sessionId) headers.set("x-toth-session-id", this.sessionId);

    const response = await fetch(`${this.apiUrl}${path}`, { ...init, headers });
    const data = await response.json().catch(() => undefined);
    if (!response.ok) throw new TothApiRequestError(data?.message || "Falha ao sincronizar com a API.", response.status);
    return data as T;
  }

  private resolveApiUrl() {
    const envUrl = process.env.TOTH_API_URL?.replace(/\/$/, "");
    if (envUrl) return envUrl;

    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const executableDir = path.dirname(process.execPath);
    const configPaths = [
      path.join(appData, "TOTH", "config.json"),
      path.join(appData, "toth", "config.json"),
      path.join(executableDir, "config.json"),
      path.join(executableDir, "resources", "config.json"),
    ];
    const configPath = configPaths.find((candidate) => existsSync(candidate));
    if (!configPath) return null;

    try {
      const configText = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
      const config = JSON.parse(configText) as { apiUrl: string };
      return config.apiUrl.replace(/\/$/, "") || null;
    } catch {
      return null;
    }
  }
}

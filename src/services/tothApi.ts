import type { CreateEntryResult, CreatePresenceRecordInput, CreatePresenceRecordResult, PresenceRecord, PresenceRecordDetail, Session, TimeForm, TothApi, UpdatePresenceRecordInput, Worksite, WorksiteEmployee } from "../../shared/types";

type SessionResponse = Session & { sessionId: string };

const sessionStorageKey = "toth-funcionario-session-id";
const apiUrl = (import.meta.env.VITE_TOTH_API_URL || `${window.location.protocol}//${window.location.hostname}:3333`).replace(/\/$/, "");

let browserSessionId = window.localStorage.getItem(sessionStorageKey) ?? "";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (browserSessionId) headers.set("x-toth-session-id", browserSessionId);

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  const data = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(data?.message || "Falha ao comunicar com a API TOTH.");
  return data as T;
}

const browserApi: TothApi = {
  listWorksites: () => request<Worksite[]>("/worksites"),
  async createSession(cpf: string, worksiteId: string) {
    const session = await request<SessionResponse>("/sessions", {
      method: "POST",
      body: JSON.stringify({ cpf, worksiteId }),
    });
    browserSessionId = session.sessionId;
    window.localStorage.setItem(sessionStorageKey, session.sessionId);
    return { employee: session.employee, worksite: session.worksite };
  },
  createTimeEntry: (allowDuplicate = false) => request<CreateEntryResult>("/time-entries", {
    method: "POST",
    body: JSON.stringify({ allowDuplicate }),
  }),
  listForms: () => request<TimeForm[]>("/forms"),
  listWorksiteEmployees: () => request<WorksiteEmployee[]>("/worksite-employees"),
  createPresenceRecord: (input: CreatePresenceRecordInput) => request<CreatePresenceRecordResult>("/presence-records", {
    method: "POST",
    body: JSON.stringify(input),
  }),
  listPresenceRecords: () => request<PresenceRecord[]>("/presence-records"),
  getPresenceRecord: (recordId: string) => request<PresenceRecordDetail>(`/presence-records/${encodeURIComponent(recordId)}`),
  updatePresenceRecord: (input: UpdatePresenceRecordInput) => request<PresenceRecordDetail>(`/presence-records/${encodeURIComponent(input.recordId)}`, {
    method: "PATCH",
    body: JSON.stringify({ observations: input.observations }),
  }),
};

export const tothApi = window.toth ?? browserApi;

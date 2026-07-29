import type { TothApi } from "../shared/types.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const channels = {
  listWorksites: "worksites:list",
  createSession: "sessions:create",
  createTimeEntry: "time-entries:create",
  listForms: "forms:list",
  listWorksiteEmployees: "worksite-employees:list",
  createPresenceRecord: "presence-records:create",
  listPresenceRecords: "presence-records:list",
  getPresenceRecord: "presence-records:get",
  updatePresenceRecord: "presence-records:update",
} as const;

const api: TothApi = {
  listWorksites: () => ipcRenderer.invoke(channels.listWorksites),
  createSession: (cpf, worksiteId) => ipcRenderer.invoke(channels.createSession, cpf, worksiteId),
  createTimeEntry: (allowDuplicate) => ipcRenderer.invoke(channels.createTimeEntry, allowDuplicate),
  listForms: () => ipcRenderer.invoke(channels.listForms),
  listWorksiteEmployees: () => ipcRenderer.invoke(channels.listWorksiteEmployees),
  createPresenceRecord: (input) => ipcRenderer.invoke(channels.createPresenceRecord, input),
  listPresenceRecords: () => ipcRenderer.invoke(channels.listPresenceRecords),
  getPresenceRecord: (recordId) => ipcRenderer.invoke(channels.getPresenceRecord, recordId),
  updatePresenceRecord: (input) => ipcRenderer.invoke(channels.updatePresenceRecord, input),
};

contextBridge.exposeInMainWorld("toth", api);

import type { CreatePresenceRecordInput, UpdatePresenceRecordInput } from "../../shared/types";

export const tothApi = {
  listWorksites: () => window.toth.listWorksites(),
  createSession: (cpf: string, worksiteId: string) => window.toth.createSession(cpf, worksiteId),
  createTimeEntry: (allowDuplicate = false) => window.toth.createTimeEntry(allowDuplicate),
  listForms: () => window.toth.listForms(),
  listWorksiteEmployees: () => window.toth.listWorksiteEmployees(),
  createPresenceRecord: (input: CreatePresenceRecordInput) => window.toth.createPresenceRecord(input),
  listPresenceRecords: () => window.toth.listPresenceRecords(),
  getPresenceRecord: (recordId: string) => window.toth.getPresenceRecord(recordId),
  updatePresenceRecord: (input: UpdatePresenceRecordInput) => window.toth.updatePresenceRecord(input),
};

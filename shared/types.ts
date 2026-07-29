export interface Role {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  cpf: string;
  name: string;
  role: Role;
}

export interface Worksite {
  id: string;
  name: string;
  active: boolean;
  endereco?: string | null;
  cidade?: string | null;
  responsavel?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export interface Session {
  employee: Employee;
  worksite: Worksite;
}

export interface TimeEntry {
  id: string;
  time: string;
  status: "pendente_sync" | "sincronizado";
  createdAt: string;
}

export interface TimeForm {
  id: string;
  date: string;
  worksiteName: string;
  status: "incompleto" | "completo";
  entries: TimeEntry[];
}

export interface ManagementTimeForm extends TimeForm {
  employeeId: string;
  employeeName: string;
  employeeCpf: string;
}

export interface WorksiteEmployee {
  id: string;
  name: string;
  roleName: string;
}

export interface PresenceEntryInput {
  employeeId: string;
  employeeName: string;
  present: boolean;
  observation: string;
}

export interface CreatePresenceRecordInput {
  entries: PresenceEntryInput[];
}

export interface PresenceRecord {
  id: string;
  date: string;
  worksiteName: string;
  totalEmployees: number;
  presentCount: number;
  observationsCount: number;
}

export interface ManagementPresenceRecord extends PresenceRecord {
  supervisorName: string;
}

export interface PresenceRecordEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  present: boolean;
  observation: string;
}

export interface PresenceRecordDetail extends PresenceRecord {
  entries: PresenceRecordEntry[];
}

export interface UpdatePresenceRecordInput {
  recordId: string;
  observations: Array<{ entryId: string; observation: string }>;
}

export interface CreatePresenceRecordResult {
  id: string;
  date: string;
  presentCount: number;
}

export interface CreateEntryInput {
  employeeId: string;
  cpf: string;
  worksiteId: string;
  allowDuplicate: boolean;
}

export type CreateEntryResult =
  | { kind: "created"; entry: TimeEntry }
  | { kind: "duplicate"; message: string };

export interface TothApi {
  listWorksites(): Promise<Worksite[]>;
  createSession(cpf: string, worksiteId: string): Promise<Session>;
  createTimeEntry(allowDuplicate: boolean): Promise<CreateEntryResult>;
  listForms(): Promise<TimeForm[]>;
  listWorksiteEmployees(): Promise<WorksiteEmployee[]>;
  createPresenceRecord(input: CreatePresenceRecordInput): Promise<CreatePresenceRecordResult>;
  listPresenceRecords(): Promise<PresenceRecord[]>;
  getPresenceRecord(recordId: string): Promise<PresenceRecordDetail>;
  updatePresenceRecord(input: UpdatePresenceRecordInput): Promise<PresenceRecordDetail>;
}

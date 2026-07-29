import type { CreateEntryResult, CreatePresenceRecordInput, CreatePresenceRecordResult, PresenceRecord, PresenceRecordDetail, Session, TimeForm, UpdatePresenceRecordInput, Worksite, WorksiteEmployee } from "../../shared/types.js";
import { TothDatabase } from "../database.js";
import { isOfflineSyncError, TothSyncClient } from "./syncClient.js";

export class TothService {
  private session: Session | null = null;
  private readonly syncClient = new TothSyncClient();
  private syncSessionPromise: Promise<void> = Promise.resolve();

  constructor(private readonly database: TothDatabase) {}

  async listWorksites(): Promise<Worksite[]> {
    if (this.syncClient.enabled) {
      try {
        const worksites = await this.syncClient.listWorksites();
        for (const worksite of worksites) this.database.upsertWorksite(worksite);
        return worksites;
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.listWorksites();
      }
    }
    return this.database.listWorksites();
  }

  async createSession(cpf: string, worksiteId: string): Promise<Session> {
    if (this.syncClient.enabled) {
      try {
        this.session = await this.syncClient.createRemoteSession(cpf, worksiteId);
        this.database.upsertEmployeeFromSession(this.session);
        this.syncSessionPromise = Promise.resolve();
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        this.session = this.database.createSession(cpf, worksiteId);
        this.syncSessionPromise = this.syncClient.createSession(this.session).catch(() => undefined);
      }
    } else {
      this.session = this.database.createSession(cpf, worksiteId);
    }
    void this.syncSessionPromise.then(() => this.flushSyncQueue()).catch(() => undefined);
    return this.session;
  }

  async createTimeEntry(allowDuplicate = false): Promise<CreateEntryResult> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        await this.flushSyncQueue();
        return await this.syncClient.createTimeEntry(allowDuplicate);
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        // Cache offline: only used when the central API is unreachable.
      }
    }
    const result = this.database.createTimeEntry({
      employeeId: session.employee.id,
      cpf: session.employee.cpf,
      worksiteId: session.worksite.id,
      allowDuplicate,
    });
    if (result.kind === "created") {
      this.database.enqueueSyncItem("time-entry", this.database.getTimeEntrySyncPayload(result.entry.id));
      void this.flushSyncQueue();
    }
    return result;
  }

  async listForms(): Promise<TimeForm[]> {
    if (this.syncClient.enabled) {
      try {
        return await this.syncClient.listForms();
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.listForms(this.requireSession().employee.cpf);
      }
    }
    return this.database.listForms(this.requireSession().employee.cpf);
  }

  async listWorksiteEmployees(): Promise<WorksiteEmployee[]> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        const employees = await this.syncClient.listWorksiteEmployees();
        this.database.upsertWorksiteEmployees(session.worksite.id, employees);
        return employees;
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.listWorksiteEmployees(session.worksite.id);
      }
    }
    return this.database.listWorksiteEmployees(session.worksite.id);
  }

  async createPresenceRecord(input: CreatePresenceRecordInput): Promise<CreatePresenceRecordResult> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        await this.flushSyncQueue();
        return await this.syncClient.createPresenceRecord(input);
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        // Cache offline: only used when the central API is unreachable.
      }
    }
    const result = this.database.createPresenceRecord({
      supervisorEmployeeId: session.employee.id,
      supervisorCpf: session.employee.cpf,
      worksiteId: session.worksite.id,
      entries: input.entries,
    });
    this.database.enqueueSyncItem("presence-record", this.database.getPresenceRecordSyncPayload(result.id));
    void this.flushSyncQueue();
    return result;
  }

  private async flushSyncQueue() {
    if (!this.syncClient.enabled) return;
    await this.syncSessionPromise;
    const pending = this.database.listPendingSyncItems();
    for (const item of pending) {
      try {
        await this.syncClient.syncItem(item);
        this.database.markSyncItemDone(item.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.database.markSyncItemFailed(item.id, message);
      }
    }
  }

  async listPresenceRecords(): Promise<PresenceRecord[]> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        return await this.syncClient.listPresenceRecords();
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.listPresenceRecords(session.worksite.id, session.employee.id);
      }
    }
    return this.database.listPresenceRecords(session.worksite.id, session.employee.id);
  }

  async getPresenceRecord(recordId: string): Promise<PresenceRecordDetail> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        return await this.syncClient.getPresenceRecord(recordId);
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.getPresenceRecord(recordId, session.worksite.id, session.employee.id);
      }
    }
    return this.database.getPresenceRecord(recordId, session.worksite.id, session.employee.id);
  }

  async updatePresenceRecord(input: UpdatePresenceRecordInput): Promise<PresenceRecordDetail> {
    const session = this.requireSession();
    if (this.syncClient.enabled) {
      try {
        return await this.syncClient.updatePresenceRecord(input);
      } catch (error) {
        if (!isOfflineSyncError(error)) throw error;
        return this.database.updatePresenceRecord(input, session.worksite.id, session.employee.id);
      }
    }
    return this.database.updatePresenceRecord(input, session.worksite.id, session.employee.id);
  }

  private requireSession(): Session {
    if (!this.session) throw new Error("Sessão inválida. Informe CPF e obra novamente.");
    return this.session;
  }
}

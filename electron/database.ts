import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { CreateEntryInput, CreateEntryResult, CreatePresenceRecordResult, ManagementPresenceRecord, ManagementTimeForm, PresenceEntryInput, PresenceRecord, PresenceRecordDetail, PresenceRecordEntry, Session, TimeForm, UpdatePresenceRecordInput, Worksite, WorksiteEmployee } from "../shared/types.js";

const TIMEZONE = "America/Sao_Paulo";
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

type EmployeeRow = { id: string; cpf: string; name: string; roleId: string; roleName: string };
type WorksiteRow = { id: string; name: string; active: number; endereco?: string | null; cidade?: string | null; responsavel?: string | null; data_inicio?: string | null; data_fim?: string | null };
type EntryRow = { id: string; time: string; status: "pendente_sync" | "sincronizado"; createdAt: string };
type FormRow = { id: string; date: string; worksiteName: string; status: "incompleto" | "completo" };
type ManagementFormRow = FormRow & { employeeId: string; employeeName: string; employeeCpf: string };
type WorksiteEmployeeRow = { id: string; name: string; roleName: string };
type ManagementEmployeeRow = { id: string; cpf: string; name: string; registration: number | null; phone: string | null; email: string | null; roleId: string; roleName: string; worksiteName: string; active: number };
type RoleRow = { id: string; name: string; description: string | null; active: number };
type ManagementAttendanceRow = {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  roleName: string;
  worksiteName: string;
  timeEntryCount: number;
  firstTime: string | null;
  lastTime: string | null;
  foremanPresent: number | null;
  foremanObservation: string | null;
};
type PresenceRecordRow = { id: string; date: string; worksiteName: string; totalEmployees: number; presentCount: number; observationsCount: number };
type ManagementPresenceRecordRow = PresenceRecordRow & { supervisorName: string };
type PresenceRecordEntryRow = { id: string; employeeId: string; employeeName: string; present: number; observation: string };
type SyncQueueRow = { id: string; kind: "time-entry" | "presence-record"; payload: string; attempts: number; createdAt: string; lastError: string | null };
export type TimeEntrySyncPayload = { id: string; employeeId: string; cpf: string; worksiteId: string; date: string; time: string; createdAt: string };
export type PresenceRecordSyncPayload = {
  id: string;
  supervisorEmployeeId: string;
  supervisorCpf: string;
  worksiteId: string;
  date: string;
  createdAt: string;
  entries: Array<{ id: string; employeeId: string; employeeName: string; present: boolean; observation: string }>;
};
export type SyncQueueItem = { id: string; kind: SyncQueueRow["kind"]; payload: TimeEntrySyncPayload | PresenceRecordSyncPayload; attempts: number; createdAt: string; lastError: string | null };
type CreatePresenceRecordDatabaseInput = {
  supervisorEmployeeId: string;
  supervisorCpf: string;
  worksiteId: string;
  entries: PresenceEntryInput[];
};
type ManagementEmployeeInput = { name: string; cpf: string; roleId: string; worksiteId: string; phone: string | null; email: string | null; active: boolean };
type ManagementTimeEntryInput = { employeeId: string; worksiteId: string; dateTime: string; observation: string | null };
type WorksiteInput = { name: string; active: boolean; endereco?: string | null; cidade?: string | null; responsavel?: string | null; data_inicio?: string | null; data_fim?: string | null };

export class TothDatabase {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("foreign_keys = ON");
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.migrate();
    this.seed();
  }

  close() {
    this.db.close();
  }

  listWorksites(): Worksite[] {
    return this.db.prepare("SELECT id, name, active, endereco, cidade, responsavel, data_inicio, data_fim FROM worksites WHERE active = 1 ORDER BY name").all()
      .map((row) => this.toWorksite(row as WorksiteRow));
  }

  createWorksite(input: WorksiteInput): Worksite {
    const id = `worksite-${this.slug(input.name)}-${randomUUID().slice(0, 8)}`;
    this.db.prepare("INSERT INTO worksites (id, name, active, endereco, cidade, responsavel, data_inicio, data_fim) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.name.trim(), input.active === false ? 0 : 1, this.optionalText(input.endereco), this.optionalText(input.cidade), this.optionalText(input.responsavel), this.optionalText(input.data_inicio), this.optionalText(input.data_fim));
    return this.getWorksite(id);
  }

  updateWorksite(id: string, input: WorksiteInput): Worksite {
    this.db.prepare("UPDATE worksites SET name = ?, active = ?, endereco = ?, cidade = ?, responsavel = ?, data_inicio = ?, data_fim = ? WHERE id = ?")
      .run(input.name.trim(), input.active === false ? 0 : 1, this.optionalText(input.endereco), this.optionalText(input.cidade), this.optionalText(input.responsavel), this.optionalText(input.data_inicio), this.optionalText(input.data_fim), id);
    return this.getWorksite(id);
  }

  setWorksiteActive(id: string, active: boolean): Worksite {
    this.db.prepare("UPDATE worksites SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    return this.getWorksite(id);
  }

  upsertWorksite(worksite: Worksite) {
    this.db.prepare(`
      INSERT INTO worksites (id, name, active)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, active = excluded.active
    `).run(worksite.id, worksite.name, worksite.active ? 1 : 0);
  }

  upsertEmployeeFromSession(session: Session) {
    this.db.transaction(() => {
      const hasLegacyRoleColumn = this.hasColumn("employees", "role");
      this.upsertWorksite(session.worksite);
      this.db.prepare(`
        INSERT INTO roles (id, name)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name
      `).run(session.employee.role.id, session.employee.role.name);
      this.db.prepare("DELETE FROM employee_worksites WHERE employee_id IN (SELECT id FROM employees WHERE cpf = ? AND id <> ?)")
        .run(session.employee.cpf, session.employee.id);
      this.db.prepare("DELETE FROM employees WHERE cpf = ? AND id <> ?")
        .run(session.employee.cpf, session.employee.id);
      if (hasLegacyRoleColumn) {
        this.db.prepare(`
          INSERT INTO employees (id, cpf, name, role, role_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            cpf = excluded.cpf,
            name = excluded.name,
            role = excluded.role,
            role_id = excluded.role_id
        `).run(session.employee.id, session.employee.cpf, session.employee.name, session.employee.role.name, session.employee.role.id, new Date().toISOString());
      } else {
        this.db.prepare(`
          INSERT INTO employees (id, cpf, name, role_id, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            cpf = excluded.cpf,
            name = excluded.name,
            role_id = excluded.role_id
        `).run(session.employee.id, session.employee.cpf, session.employee.name, session.employee.role.id, new Date().toISOString());
      }
      this.db.prepare("INSERT OR IGNORE INTO employee_worksites (employee_id, worksite_id) VALUES (?, ?)")
        .run(session.employee.id, session.worksite.id);
    })();
  }

  upsertWorksiteEmployees(worksiteId: string, employees: WorksiteEmployee[]) {
    const roleIdFor = (roleName: string) => `role-${roleName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    this.db.transaction(() => {
      const hasLegacyRoleColumn = this.hasColumn("employees", "role");
      this.db.prepare("DELETE FROM employee_worksites WHERE worksite_id = ?").run(worksiteId);
      for (const employee of employees) {
        const roleId = roleIdFor(employee.roleName);
        const technicalCpf = `sync-${employee.id}`;
        this.db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)").run(roleId, employee.roleName);
        if (hasLegacyRoleColumn) {
          this.db.prepare(`
            INSERT OR IGNORE INTO employees (id, cpf, name, role, role_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(employee.id, technicalCpf, employee.name, employee.roleName, roleId, new Date().toISOString());
          this.db.prepare("UPDATE employees SET name = ?, role = ?, role_id = ? WHERE id = ?").run(employee.name, employee.roleName, roleId, employee.id);
        } else {
          this.db.prepare(`
            INSERT OR IGNORE INTO employees (id, cpf, name, role_id, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(employee.id, technicalCpf, employee.name, roleId, new Date().toISOString());
          this.db.prepare("UPDATE employees SET name = ?, role_id = ? WHERE id = ?").run(employee.name, roleId, employee.id);
        }
        this.db.prepare("INSERT OR IGNORE INTO employee_worksites (employee_id, worksite_id) VALUES (?, ?)").run(employee.id, worksiteId);
      }
    })();
  }

  createSession(cpf: string, worksiteId: string): Session {
    const normalizedCpf = cpf.replace(/\D/g, "");
    const employee = this.db.prepare(`
      SELECT e.id, e.cpf, e.name, r.id AS roleId, r.name AS roleName
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      JOIN employee_worksites ew ON ew.employee_id = e.id
      WHERE e.cpf = ? AND ew.worksite_id = ? AND COALESCE(e.active, 1) = 1
    `).get(normalizedCpf, worksiteId) as EmployeeRow | undefined;
    if (!employee) throw new Error("Funcionário não localizado para este CPF.");

    const worksite = this.db.prepare("SELECT id, name, active FROM worksites WHERE id = ? AND active = 1").get(worksiteId) as WorksiteRow | undefined;
    if (!worksite) throw new Error("Selecione uma obra ativa.");

    return { employee: this.toEmployee(employee), worksite: this.toWorksite(worksite) };
  }

  createTimeEntry(input: CreateEntryInput): CreateEntryResult {
    const now = new Date();
    const parts = this.dateParts(now);
    const latest = this.db.prepare(`
      SELECT created_at AS createdAt FROM time_entries
      WHERE employee_id = ? AND worksite_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(input.employeeId, input.worksiteId) as { createdAt: string } | undefined;

    if (!input.allowDuplicate && latest && now.getTime() - new Date(latest.createdAt).getTime() < DUPLICATE_WINDOW_MS) {
      return { kind: "duplicate", message: "Existe um ponto registrado há menos de 2 minutos. Deseja registrar novamente" };
    }

    return this.db.transaction(() => {
      let form = this.db.prepare(`
        SELECT id FROM forms WHERE employee_id = ? AND worksite_id = ? AND date = ?
      `).get(input.employeeId, input.worksiteId, parts.date) as { id: string } | undefined;

      if (!form) {
        form = { id: randomUUID() };
        this.db.prepare(`
          INSERT INTO forms (id, employee_id, cpf, worksite_id, date, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'incompleto', ?)
        `).run(form.id, input.employeeId, input.cpf, input.worksiteId, parts.date, now.toISOString());
      }

      const count = (this.db.prepare("SELECT COUNT(*) AS total FROM time_entries WHERE form_id = ?").get(form.id) as { total: number }).total;
      if (count >= 4) throw new Error("Este formulário já possui os quatro registros permitidos.");

      const id = randomUUID();
      this.db.prepare(`
        INSERT INTO time_entries
          (id, form_id, employee_id, cpf, worksite_id, date, time, status, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente_sync', ?, ?)
      `).run(id, form.id, input.employeeId, input.cpf, input.worksiteId, parts.date, parts.time, TIMEZONE, now.toISOString());

      const nextCount = count + 1;
      this.db.prepare("UPDATE forms SET status = ? WHERE id = ?").run(nextCount === 4 ? "completo" : "incompleto", form.id);
      return {
        kind: "created",
        entry: { id, time: parts.time, status: "pendente_sync", createdAt: now.toISOString() },
      } satisfies CreateEntryResult;
    })();
  }

  listForms(cpf: string): TimeForm[] {
    const forms = this.db.prepare(`
      SELECT f.id, f.date, w.name AS worksiteName, f.status
      FROM forms f JOIN worksites w ON w.id = f.worksite_id
      WHERE f.cpf = ? ORDER BY f.date DESC, f.created_at DESC
    `).all(cpf.replace(/\D/g, "")) as FormRow[];

    const entriesQuery = this.db.prepare(`
      SELECT id, time, status, created_at AS createdAt
      FROM time_entries WHERE form_id = ? ORDER BY created_at ASC
    `);
    return forms.map((form) => ({ ...form, entries: entriesQuery.all(form.id) as EntryRow[] }));
  }

  getTimeEntrySyncPayload(entryId: string): TimeEntrySyncPayload {
    const entry = this.db.prepare(`
      SELECT id, employee_id AS employeeId, cpf, worksite_id AS worksiteId, date, time, created_at AS createdAt
      FROM time_entries WHERE id = ?
    `).get(entryId) as TimeEntrySyncPayload | undefined;
    if (!entry) throw new Error("Registro de ponto não localizado para sincronização.");
    return entry;
  }

  createSyncedTimeEntry(input: TimeEntrySyncPayload) {
    this.db.transaction(() => {
      let form = this.db.prepare(`
        SELECT id FROM forms WHERE employee_id = ? AND worksite_id = ? AND date = ?
      `).get(input.employeeId, input.worksiteId, input.date) as { id: string } | undefined;

      if (!form) {
        form = { id: randomUUID() };
        this.db.prepare(`
          INSERT INTO forms (id, employee_id, cpf, worksite_id, date, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'incompleto', ?)
        `).run(form.id, input.employeeId, input.cpf, input.worksiteId, input.date, input.createdAt);
      }

      this.db.prepare(`
        INSERT OR IGNORE INTO time_entries
          (id, form_id, employee_id, cpf, worksite_id, date, time, status, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sincronizado', ?, ?)
      `).run(input.id, form.id, input.employeeId, input.cpf, input.worksiteId, input.date, input.time, TIMEZONE, input.createdAt);

      const count = (this.db.prepare("SELECT COUNT(*) AS total FROM time_entries WHERE form_id = ?").get(form.id) as { total: number }).total;
      this.db.prepare("UPDATE forms SET status = ? WHERE id = ?").run(count >= 4 ? "completo" : "incompleto", form.id);
    })();
  }

  createManagementTimeEntry(input: ManagementTimeEntryInput): EntryRow {
    const employee = this.db.prepare("SELECT id, cpf FROM employees WHERE id = ?").get(input.employeeId) as { id: string; cpf: string } | undefined;
    if (!employee) throw new Error("Funcionário não localizado.");

    const parts = this.dateTimeInputParts(input.dateTime);
    const now = new Date().toISOString();
    const id = randomUUID();

    return this.db.transaction(() => {
      let form = this.db.prepare(`
        SELECT id FROM forms WHERE employee_id = ? AND worksite_id = ? AND date = ?
      `).get(input.employeeId, input.worksiteId, parts.date) as { id: string } | undefined;

      if (!form) {
        form = { id: randomUUID() };
        this.db.prepare(`
          INSERT INTO forms (id, employee_id, cpf, worksite_id, date, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'incompleto', ?)
        `).run(form.id, input.employeeId, employee.cpf, input.worksiteId, parts.date, now);
      }

      const count = (this.db.prepare("SELECT COUNT(*) AS total FROM time_entries WHERE form_id = ?").get(form.id) as { total: number }).total;
      if (count >= 4) throw new Error("Este formulário já possui os quatro registros permitidos.");

      this.db.prepare(`
        INSERT INTO time_entries
          (id, form_id, employee_id, cpf, worksite_id, date, time, status, timezone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'sincronizado', ?, ?)
      `).run(id, form.id, input.employeeId, employee.cpf, input.worksiteId, parts.date, parts.time, TIMEZONE, now);

      this.db.prepare("UPDATE forms SET status = ? WHERE id = ?").run(count + 1 >= 4 ? "completo" : "incompleto", form.id);
      return { id, time: parts.time, status: "sincronizado", createdAt: now } satisfies EntryRow;
    })();
  }

  listManagementTimeForms(worksiteId: string): ManagementTimeForm[] {
    const where = worksiteId ? "WHERE f.worksite_id = ?" : "";
    const forms = this.db.prepare(`
      SELECT f.id, f.date, w.name AS worksiteName, f.status, e.id AS employeeId, e.name AS employeeName, f.cpf AS employeeCpf
      FROM forms f
      JOIN worksites w ON w.id = f.worksite_id
      JOIN employees e ON e.id = f.employee_id
      ${where}
      ORDER BY f.date DESC, f.created_at DESC
    `).all(...(worksiteId ? [worksiteId] : [])) as ManagementFormRow[];

    const entriesQuery = this.db.prepare(`
      SELECT id, time, status, created_at AS createdAt
      FROM time_entries WHERE form_id = ? ORDER BY created_at ASC
    `);
    return forms.map((form) => ({ ...form, entries: entriesQuery.all(form.id) as EntryRow[] }));
  }

  listManagementTimeEntries(worksiteId: string, employeeId: string, date: string): EntryRow[] {
    return this.db.prepare(`
      SELECT te.id, te.time, te.status, te.created_at AS createdAt
      FROM time_entries te
      JOIN forms f ON f.id = te.form_id
      WHERE f.worksite_id = ? AND f.employee_id = ? AND f.date = ?
      ORDER BY te.created_at ASC
    `).all(worksiteId, employeeId, date) as EntryRow[];
  }

  listManagementAttendance(worksiteId: string) {
    const rows = this.db.prepare(`
      WITH dates AS (
        SELECT DISTINCT date FROM forms WHERE worksite_id = ?
        UNION
        SELECT DISTINCT date FROM presence_records WHERE worksite_id = ?
      ),
      latest_presence AS (
        SELECT pr.*
        FROM presence_records pr
        JOIN (
          SELECT date, MAX(created_at) AS created_at
          FROM presence_records
          WHERE worksite_id = ?
          GROUP BY date
        ) latest ON latest.date = pr.date AND latest.created_at = pr.created_at
        WHERE pr.worksite_id = ?
      )
      SELECT
        d.date || '-' || e.id AS id,
        d.date,
        e.id AS employeeId,
        e.name AS employeeName,
        r.name AS roleName,
        w.name AS worksiteName,
        COUNT(te.id) AS timeEntryCount,
        MIN(te.time) AS firstTime,
        MAX(te.time) AS lastTime,
        MAX(pre.present) AS foremanPresent,
        MAX(pre.observation) AS foremanObservation
      FROM dates d
      JOIN employee_worksites ew ON ew.worksite_id = ?
      JOIN employees e ON e.id = ew.employee_id
      JOIN roles r ON r.id = e.role_id
      JOIN worksites w ON w.id = ew.worksite_id
      LEFT JOIN forms f ON f.employee_id = e.id AND f.worksite_id = ew.worksite_id AND f.date = d.date
      LEFT JOIN time_entries te ON te.form_id = f.id
      LEFT JOIN latest_presence pr ON pr.worksite_id = ew.worksite_id AND pr.date = d.date
      LEFT JOIN presence_record_entries pre ON pre.record_id = pr.id AND pre.employee_id = e.id
      WHERE COALESCE(e.active, 1) = 1
      GROUP BY d.date, e.id, e.name, r.name, w.name
      ORDER BY d.date DESC, e.name
    `).all(worksiteId, worksiteId, worksiteId, worksiteId, worksiteId) as ManagementAttendanceRow[];

    return rows.map((row) => ({
      ...row,
      timeStatus: row.timeEntryCount === 0 ? "sem_ponto" : row.timeEntryCount >= 4 ? "completo" : "incompleto",
      pointPresence: row.timeEntryCount > 0,
      foremanStatus: row.foremanPresent === null ? "nao_marcado" : row.foremanPresent ? "presente" : "ausente",
      foremanObservation: row.foremanObservation ?? "",
    }));
  }

  listWorksiteEmployees(worksiteId: string): WorksiteEmployee[] {
    return this.db.prepare(`
      SELECT e.id, e.name, r.name AS roleName
      FROM employee_worksites ew
      JOIN employees e ON e.id = ew.employee_id
      JOIN roles r ON r.id = e.role_id
      WHERE ew.worksite_id = ? AND COALESCE(e.active, 1) = 1
      ORDER BY e.name
    `).all(worksiteId) as WorksiteEmployeeRow[];
  }

  listManagementEmployees(worksiteId: string): ManagementEmployeeRow[] {
    const where = worksiteId ? "WHERE ew.worksite_id = ?" : "";
    return this.db.prepare(`
      SELECT e.id, e.cpf, e.name, e.registration, e.phone, e.email, r.id AS roleId, r.name AS roleName, COALESCE(w.name, '') AS worksiteName, COALESCE(e.active, 1) AS active
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      LEFT JOIN employee_worksites ew ON ew.employee_id = e.id
      LEFT JOIN worksites w ON w.id = ew.worksite_id
      ${where}
      ORDER BY e.name
    `).all(...(worksiteId ? [worksiteId] : [])) as ManagementEmployeeRow[];
  }

  listRoles(worksiteId: string): RoleRow[] {
    if (!worksiteId) return this.db.prepare("SELECT id, name, description, COALESCE(active, 1) AS active FROM roles ORDER BY name").all() as RoleRow[];

    return this.db.prepare(`
      SELECT DISTINCT r.id, r.name, r.description, COALESCE(r.active, 1) AS active
      FROM roles r
      LEFT JOIN employees e ON e.role_id = r.id AND COALESCE(e.active, 1) = 1
      LEFT JOIN employee_worksites ew ON ew.employee_id = e.id
      LEFT JOIN role_worksites rw ON rw.role_id = r.id
      WHERE ew.worksite_id = ? OR rw.worksite_id = ?
      ORDER BY r.name
    `).all(worksiteId, worksiteId) as RoleRow[];
  }

  createRole(name: string, worksiteId: string, description: string | null = null): RoleRow {
    const roleName = name.trim();
    const roleDescription = this.optionalText(description);
    const id = `role-${this.slug(roleName)}-${randomUUID().slice(0, 8)}`;
    this.db.transaction(() => {
      this.db.prepare("INSERT INTO roles (id, name, description, active) VALUES (?, ?, ?, 1)").run(id, roleName, roleDescription);
      if (worksiteId) {
        this.db.prepare("INSERT OR IGNORE INTO role_worksites (role_id, worksite_id) VALUES (?, ?)")
          .run(id, worksiteId);
      }
    })();
    return { id, name: roleName, description: roleDescription, active: 1 };
  }

  updateRole(id: string, name: string, description: string | null = null): RoleRow {
    const roleName = name.trim();
    this.db.prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?").run(roleName, this.optionalText(description), id);
    const role = this.db.prepare("SELECT id, name, description, COALESCE(active, 1) AS active FROM roles WHERE id = ?").get(id) as RoleRow | undefined;
    if (!role) throw new Error("Cargo não localizado.");
    return role;
  }

  setRoleActive(id: string, active: boolean): RoleRow {
    this.db.prepare("UPDATE roles SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    const role = this.db.prepare("SELECT id, name, description, COALESCE(active, 1) AS active FROM roles WHERE id = ?").get(id) as RoleRow | undefined;
    if (!role) throw new Error("Cargo não localizado.");
    return role;
  }

  deleteRole(id: string, worksiteId: string) {
    const params = worksiteId ? [id, worksiteId] : [id];
    const where = worksiteId ? "e.role_id = ? AND ew.worksite_id = ?" : "e.role_id = ?";
    const linkedEmployees = (this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM employees e
      LEFT JOIN employee_worksites ew ON ew.employee_id = e.id
      WHERE ${where}
    `).get(...params) as { total: number }).total;
    if (linkedEmployees > 0) throw new Error("Cargo vinculado a funcionários. Remova ou edite os funcionários antes de excluir.");

    this.db.transaction(() => {
      if (worksiteId) {
        this.db.prepare("DELETE FROM role_worksites WHERE role_id = ? AND worksite_id = ?").run(id, worksiteId);
      } else {
        this.db.prepare("DELETE FROM role_worksites WHERE role_id = ?").run(id);
      }

      const remainingWorksites = (this.db.prepare("SELECT COUNT(*) AS total FROM role_worksites WHERE role_id = ?").get(id) as { total: number }).total;
      const remainingEmployees = (this.db.prepare("SELECT COUNT(*) AS total FROM employees WHERE role_id = ?").get(id) as { total: number }).total;
      if (remainingWorksites === 0 && remainingEmployees === 0) {
        this.db.prepare("DELETE FROM roles WHERE id = ?").run(id);
      }
    })();
  }

  createManagementEmployee(input: ManagementEmployeeInput): ManagementEmployeeRow {
    const id = `employee-${randomUUID()}`;
    const cpf = input.cpf.replace(/\D/g, "");
    const registration = this.nextEmployeeRegistration();
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO employees (id, cpf, name, role_id, registration, phone, email, active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        cpf,
        input.name.trim(),
        input.roleId,
        registration,
        this.optionalText(input.phone),
        this.optionalText(input.email),
        input.active === false ? 0 : 1,
        new Date().toISOString(),
      );
      if (input.worksiteId) {
        this.db.prepare("INSERT OR IGNORE INTO employee_worksites (employee_id, worksite_id) VALUES (?, ?)")
          .run(id, input.worksiteId);
      }
    })();
    return this.getManagementEmployee(id, input.worksiteId);
  }

  updateManagementEmployee(id: string, input: ManagementEmployeeInput): ManagementEmployeeRow {
    const cpf = input.cpf.replace(/\D/g, "");
    this.db.transaction(() => {
      this.ensureEmployeeRegistration(id);
      this.db.prepare("UPDATE employees SET cpf = ?, name = ?, role_id = ?, phone = ?, email = ?, active = ? WHERE id = ?")
        .run(cpf, input.name.trim(), input.roleId, this.optionalText(input.phone), this.optionalText(input.email), input.active === false ? 0 : 1, id);
      if (input.worksiteId) {
        this.db.prepare("INSERT OR IGNORE INTO employee_worksites (employee_id, worksite_id) VALUES (?, ?)")
          .run(id, input.worksiteId);
      }
    })();
    return this.getManagementEmployee(id, input.worksiteId);
  }

  setManagementEmployeeActive(id: string, active: boolean): ManagementEmployeeRow {
    this.db.prepare("UPDATE employees SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    return this.getManagementEmployee(id);
  }

  private getManagementEmployee(id: string, worksiteId = ""): ManagementEmployeeRow {
    const where = worksiteId ? "e.id = ? AND ew.worksite_id = ?" : "e.id = ?";
    const params = worksiteId ? [id, worksiteId] : [id];
    const employee = this.db.prepare(`
      SELECT e.id, e.cpf, e.name, e.registration, e.phone, e.email, r.id AS roleId, r.name AS roleName, COALESCE(w.name, '') AS worksiteName, COALESCE(e.active, 1) AS active
      FROM employees e
      JOIN roles r ON r.id = e.role_id
      LEFT JOIN employee_worksites ew ON ew.employee_id = e.id
      LEFT JOIN worksites w ON w.id = ew.worksite_id
      WHERE ${where}
      ORDER BY w.name
      LIMIT 1
    `).get(...params) as ManagementEmployeeRow | undefined;
    if (!employee) throw new Error("Funcionário não localizado.");
    return employee;
  }

  createPresenceRecord(input: CreatePresenceRecordDatabaseInput): CreatePresenceRecordResult {
    const now = new Date();
    const parts = this.dateParts(now);
    const entries = input.entries.filter((entry) => entry.present || entry.observation.trim());
    const id = randomUUID();

    return this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO presence_records (id, supervisor_employee_id, supervisor_cpf, worksite_id, date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, input.supervisorEmployeeId, input.supervisorCpf, input.worksiteId, parts.date, now.toISOString());

      const insertEntry = this.db.prepare(`
        INSERT INTO presence_record_entries
          (id, record_id, employee_id, employee_name, present, observation)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const entry of entries) {
        insertEntry.run(randomUUID(), id, entry.employeeId, entry.employeeName, entry.present ? 1 : 0, entry.observation.trim());
      }

      return { id, date: parts.date, presentCount: entries.filter((entry) => entry.present).length };
    })();
  }

  getPresenceRecordSyncPayload(recordId: string): PresenceRecordSyncPayload {
    const record = this.db.prepare(`
      SELECT id, supervisor_employee_id AS supervisorEmployeeId, supervisor_cpf AS supervisorCpf,
        worksite_id AS worksiteId, date, created_at AS createdAt
      FROM presence_records WHERE id = ?
    `).get(recordId) as Omit<PresenceRecordSyncPayload, "entries"> | undefined;
    if (!record) throw new Error("Registro de presença não localizado para sincronização.");

    const entries = this.db.prepare(`
      SELECT id, employee_id AS employeeId, employee_name AS employeeName, present, observation
      FROM presence_record_entries WHERE record_id = ?
    `).all(recordId) as PresenceRecordEntryRow[];

    return {
      ...record,
      entries: entries.map((entry) => ({
        id: entry.id,
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
        present: Boolean(entry.present),
        observation: entry.observation,
      })),
    };
  }

  createSyncedPresenceRecord(input: PresenceRecordSyncPayload) {
    this.db.transaction(() => {
      this.db.prepare(`
        INSERT OR IGNORE INTO presence_records (id, supervisor_employee_id, supervisor_cpf, worksite_id, date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(input.id, input.supervisorEmployeeId, input.supervisorCpf, input.worksiteId, input.date, input.createdAt);

      const insertEntry = this.db.prepare(`
        INSERT OR IGNORE INTO presence_record_entries
          (id, record_id, employee_id, employee_name, present, observation)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const entry of input.entries) {
        insertEntry.run(entry.id, input.id, entry.employeeId, entry.employeeName, entry.present ? 1 : 0, entry.observation.trim());
      }
    })();
  }

  enqueueSyncItem(kind: SyncQueueRow["kind"], payload: SyncQueueItem["payload"]) {
    this.db.prepare(`
      INSERT INTO sync_queue (id, kind, payload, attempts, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).run(randomUUID(), kind, JSON.stringify(payload), new Date().toISOString());
  }

  listPendingSyncItems(limit = 25): SyncQueueItem[] {
    const rows = this.db.prepare(`
      SELECT id, kind, payload, attempts, created_at AS createdAt, last_error AS lastError
      FROM sync_queue
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit) as SyncQueueRow[];
    return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as SyncQueueItem["payload"] }));
  }

  markSyncItemDone(id: string) {
    this.db.prepare("DELETE FROM sync_queue WHERE id = ?").run(id);
  }

  markSyncItemFailed(id: string, error: string) {
    this.db.prepare(`
      UPDATE sync_queue
      SET attempts = attempts + 1, last_error = ?
      WHERE id = ?
    `).run(error.slice(0, 500), id);
  }

  listPresenceRecords(worksiteId: string, supervisorEmployeeId: string): PresenceRecord[] {
    return this.db.prepare(`
      SELECT pr.id, pr.date, w.name AS worksiteName,
        COUNT(pre.id) AS totalEmployees,
        COALESCE(SUM(pre.present), 0) AS presentCount,
        COALESCE(SUM(CASE WHEN pre.observation <> '' THEN 1 ELSE 0 END), 0) AS observationsCount
      FROM presence_records pr
      JOIN worksites w ON w.id = pr.worksite_id
      LEFT JOIN presence_record_entries pre ON pre.record_id = pr.id
      WHERE pr.worksite_id = ? AND pr.supervisor_employee_id = ?
      GROUP BY pr.id
      ORDER BY pr.created_at DESC
    `).all(worksiteId, supervisorEmployeeId) as PresenceRecordRow[];
  }

  listManagementPresenceRecords(worksiteId: string): ManagementPresenceRecord[] {
    const where = worksiteId ? "WHERE pr.worksite_id = ?" : "";
    return this.db.prepare(`
      SELECT pr.id, pr.date, w.name AS worksiteName, e.name AS supervisorName,
        COUNT(pre.id) AS totalEmployees,
        COALESCE(SUM(pre.present), 0) AS presentCount,
        COALESCE(SUM(CASE WHEN pre.observation <> '' THEN 1 ELSE 0 END), 0) AS observationsCount
      FROM presence_records pr
      JOIN worksites w ON w.id = pr.worksite_id
      JOIN employees e ON e.id = pr.supervisor_employee_id
      LEFT JOIN presence_record_entries pre ON pre.record_id = pr.id
      ${where}
      GROUP BY pr.id
      ORDER BY pr.created_at DESC
    `).all(...(worksiteId ? [worksiteId] : [])) as ManagementPresenceRecordRow[];
  }

  getPresenceRecord(recordId: string, worksiteId: string, supervisorEmployeeId: string): PresenceRecordDetail {
    const record = this.db.prepare(`
      SELECT pr.id, pr.date, w.name AS worksiteName,
        COUNT(pre.id) AS totalEmployees,
        COALESCE(SUM(pre.present), 0) AS presentCount,
        COALESCE(SUM(CASE WHEN pre.observation <> '' THEN 1 ELSE 0 END), 0) AS observationsCount
      FROM presence_records pr
      JOIN worksites w ON w.id = pr.worksite_id
      LEFT JOIN presence_record_entries pre ON pre.record_id = pr.id
      WHERE pr.id = ? AND pr.worksite_id = ? AND pr.supervisor_employee_id = ?
      GROUP BY pr.id
    `).get(recordId, worksiteId, supervisorEmployeeId) as PresenceRecordRow | undefined;
    if (!record) throw new Error("Registro não localizado.");

    const entries = this.db.prepare(`
      SELECT id, employee_id AS employeeId, employee_name AS employeeName, present, observation
      FROM presence_record_entries
      WHERE record_id = ?
      ORDER BY employee_name
    `).all(recordId) as PresenceRecordEntryRow[];

    return { ...record, entries: entries.map((entry) => this.toPresenceRecordEntry(entry)) };
  }

  getManagementPresenceRecord(recordId: string, worksiteId: string): PresenceRecordDetail {
    const where = worksiteId ? "pr.id = ? AND pr.worksite_id = ?" : "pr.id = ?";
    const params = worksiteId ? [recordId, worksiteId] : [recordId];
    const record = this.db.prepare(`
      SELECT pr.id, pr.date, w.name AS worksiteName,
        COUNT(pre.id) AS totalEmployees,
        COALESCE(SUM(pre.present), 0) AS presentCount,
        COALESCE(SUM(CASE WHEN pre.observation <> '' THEN 1 ELSE 0 END), 0) AS observationsCount
      FROM presence_records pr
      JOIN worksites w ON w.id = pr.worksite_id
      LEFT JOIN presence_record_entries pre ON pre.record_id = pr.id
      WHERE ${where}
      GROUP BY pr.id
    `).get(...params) as PresenceRecordRow | undefined;
    if (!record) throw new Error("Registro não localizado.");

    const entries = this.db.prepare(`
      SELECT id, employee_id AS employeeId, employee_name AS employeeName, present, observation
      FROM presence_record_entries
      WHERE record_id = ?
      ORDER BY employee_name
    `).all(recordId) as PresenceRecordEntryRow[];

    return { ...record, entries: entries.map((entry) => this.toPresenceRecordEntry(entry)) };
  }

  updateManagementPresenceEntryStatus(recordId: string, worksiteId: string, employeeId: string, status: string): PresenceRecordDetail {
    this.getManagementPresenceRecord(recordId, worksiteId);
    const normalized = status.toUpperCase();
    const present = normalized === "REGULAR" || normalized === "ABONADO";
    const observation = normalized === "ABONADO" ? "ABONADO" : "";
    const employee = this.db.prepare("SELECT name FROM employees WHERE id = ?").get(employeeId) as { name: string } | undefined;
    if (!employee) throw new Error("Funcionário não localizado.");

    this.db.transaction(() => {
      const existing = this.db.prepare(`
        SELECT id FROM presence_record_entries WHERE record_id = ? AND employee_id = ?
      `).get(recordId, employeeId) as { id: string } | undefined;

      if (existing) {
        this.db.prepare("UPDATE presence_record_entries SET present = ?, observation = ? WHERE id = ?")
          .run(present ? 1 : 0, observation, existing.id);
      } else {
        this.db.prepare(`
          INSERT INTO presence_record_entries (id, record_id, employee_id, employee_name, present, observation)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), recordId, employeeId, employee.name, present ? 1 : 0, observation);
      }
      this.db.prepare("UPDATE presence_records SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), recordId);
    })();

    return this.getManagementPresenceRecord(recordId, worksiteId);
  }

  touchManagementPresenceRecord(recordId: string, worksiteId: string) {
    this.getManagementPresenceRecord(recordId, worksiteId);
    this.db.prepare("UPDATE presence_records SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), recordId);
    return { ok: true };
  }

  updatePresenceRecord(input: UpdatePresenceRecordInput, worksiteId: string, supervisorEmployeeId: string): PresenceRecordDetail {
    this.getPresenceRecord(input.recordId, worksiteId, supervisorEmployeeId);
    const updateObservation = this.db.prepare(`
      UPDATE presence_record_entries
      SET observation = ?
      WHERE id = ? AND record_id = ?
    `);

    this.db.transaction(() => {
      for (const item of input.observations) {
        updateObservation.run(item.observation.trim(), item.entryId, input.recordId);
      }
      this.db.prepare("UPDATE presence_records SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), input.recordId);
    })();

    return this.getPresenceRecord(input.recordId, worksiteId, supervisorEmployeeId);
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY, cpf TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role_id TEXT NOT NULL, registration INTEGER, phone TEXT, email TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
        FOREIGN KEY(role_id) REFERENCES roles(id)
      );
      CREATE TABLE IF NOT EXISTS worksites (
        id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL CHECK(active IN (0, 1)), endereco TEXT, cidade TEXT, responsavel TEXT, data_inicio TEXT, data_fim TEXT
      );
      CREATE TABLE IF NOT EXISTS employee_worksites (
        employee_id TEXT NOT NULL, worksite_id TEXT NOT NULL,
        PRIMARY KEY(employee_id, worksite_id),
        FOREIGN KEY(employee_id) REFERENCES employees(id), FOREIGN KEY(worksite_id) REFERENCES worksites(id)
      );
      CREATE TABLE IF NOT EXISTS role_worksites (
        role_id TEXT NOT NULL, worksite_id TEXT NOT NULL,
        PRIMARY KEY(role_id, worksite_id),
        FOREIGN KEY(role_id) REFERENCES roles(id), FOREIGN KEY(worksite_id) REFERENCES worksites(id)
      );
      CREATE TABLE IF NOT EXISTS forms (
        id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, cpf TEXT NOT NULL, worksite_id TEXT NOT NULL,
        date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('incompleto', 'completo')), created_at TEXT NOT NULL,
        UNIQUE(employee_id, worksite_id, date),
        FOREIGN KEY(employee_id) REFERENCES employees(id), FOREIGN KEY(worksite_id) REFERENCES worksites(id)
      );
      CREATE TABLE IF NOT EXISTS time_entries (
        id TEXT PRIMARY KEY, form_id TEXT NOT NULL, employee_id TEXT NOT NULL, cpf TEXT NOT NULL, worksite_id TEXT NOT NULL,
        date TEXT NOT NULL, time TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pendente_sync', 'sincronizado')),
        timezone TEXT NOT NULL, created_at TEXT NOT NULL,
        FOREIGN KEY(form_id) REFERENCES forms(id), FOREIGN KEY(employee_id) REFERENCES employees(id),
        FOREIGN KEY(worksite_id) REFERENCES worksites(id)
      );
      CREATE INDEX IF NOT EXISTS idx_forms_cpf_date ON forms(cpf, date DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_form_created ON time_entries(form_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_entries_employee_worksite_created ON time_entries(employee_id, worksite_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS presence_records (
        id TEXT PRIMARY KEY, supervisor_employee_id TEXT NOT NULL, supervisor_cpf TEXT NOT NULL,
        worksite_id TEXT NOT NULL, date TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT,
        FOREIGN KEY(supervisor_employee_id) REFERENCES employees(id), FOREIGN KEY(worksite_id) REFERENCES worksites(id)
      );
      CREATE TABLE IF NOT EXISTS presence_record_entries (
        id TEXT PRIMARY KEY, record_id TEXT NOT NULL, employee_id TEXT NOT NULL, employee_name TEXT NOT NULL,
        present INTEGER NOT NULL CHECK(present IN (0, 1)), observation TEXT NOT NULL DEFAULT '',
        FOREIGN KEY(record_id) REFERENCES presence_records(id), FOREIGN KEY(employee_id) REFERENCES employees(id)
      );
      CREATE INDEX IF NOT EXISTS idx_presence_records_worksite_created ON presence_records(worksite_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK(kind IN ('time-entry', 'presence-record')),
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
    `);
    this.migrateEmployeeRoles();
    this.migrateEmployeeActive();
    this.migrateEmployeeContactFields();
    this.migrateEmployeeRegistration();
    this.migratePresenceRecordUpdates();
    this.migrateRoleDescription();
    this.migrateRoleActive();
    this.migrateWorksiteDetails();
  }

  private hasColumn(table: string, column: string) {
    return (this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[])
      .some((item) => item.name === column);
  }

  private seed() {
    const now = new Date().toISOString();
    const role = this.db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)");
    role.run("role-gesseiro", "Gesseiro");
    role.run("role-pintora", "Pintora");
    role.run("role-encarregado", "Encarregado");

    const worksite = this.db.prepare("INSERT OR IGNORE INTO worksites (id, name, active) VALUES (?, ?, 1)");
    worksite.run("worksite-butanta", "Butantã");
    worksite.run("worksite-pinheiros", "Pinheiros");
    worksite.run("worksite-moema", "Moema");

    const roleWorksite = this.db.prepare("INSERT OR IGNORE INTO role_worksites (role_id, worksite_id) VALUES (?, ?)");
    for (const roleId of ["role-gesseiro", "role-pintora", "role-encarregado"]) {
      for (const siteId of ["worksite-butanta", "worksite-pinheiros", "worksite-moema"]) {
        roleWorksite.run(roleId, siteId);
      }
    }
    this.ensureEmployeeRegistrations();
  }

  private toWorksite(row: WorksiteRow): Worksite {
    return { id: row.id, name: row.name, active: Boolean(row.active), endereco: row.endereco ?? null, cidade: row.cidade ?? null, responsavel: row.responsavel ?? null, data_inicio: row.data_inicio ?? null, data_fim: row.data_fim ?? null } as Worksite;
  }

  private getWorksite(id: string): Worksite {
    const worksite = this.db.prepare("SELECT id, name, active, endereco, cidade, responsavel, data_inicio, data_fim FROM worksites WHERE id = ?").get(id) as WorksiteRow | undefined;
    if (!worksite) throw new Error("Obra não localizada.");
    return this.toWorksite(worksite);
  }

  getWorksiteById(id: string): Worksite {
    return this.getWorksite(id);
  }

  private toEmployee(row: EmployeeRow) {
    return {
      id: row.id,
      cpf: row.cpf,
      name: row.name,
      role: { id: row.roleId, name: row.roleName },
    };
  }

  private toPresenceRecordEntry(row: PresenceRecordEntryRow): PresenceRecordEntry {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      present: Boolean(row.present),
      observation: row.observation,
    };
  }

  private migrateEmployeeRoles() {
    const columns = this.db.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    const hasRoleId = columns.some((column) => column.name === "role_id");
    if (!hasRoleId) this.db.prepare("ALTER TABLE employees ADD COLUMN role_id TEXT").run();

    const hasLegacyRole = columns.some((column) => column.name === "role");
    if (!hasLegacyRole) return;

    const legacyRoles = this.db.prepare("SELECT DISTINCT role FROM employees WHERE role IS NOT NULL AND role <> ''").all() as { role: string }[];
    const insertRole = this.db.prepare("INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)");
    const updateEmployees = this.db.prepare("UPDATE employees SET role_id = ? WHERE role = ? AND (role_id IS NULL OR role_id = '')");
    for (const legacyRole of legacyRoles) {
      const id = `role-${legacyRole.role.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      insertRole.run(id, legacyRole.role);
      updateEmployees.run(id, legacyRole.role);
    }
  }

  private migratePresenceRecordUpdates() {
    const columns = this.db.prepare("PRAGMA table_info(presence_records)").all() as { name: string }[];
    const hasUpdatedAt = columns.some((column) => column.name === "updated_at");
    if (!hasUpdatedAt) this.db.prepare("ALTER TABLE presence_records ADD COLUMN updated_at TEXT").run();
  }

  private migrateRoleDescription() {
    const columns = this.db.prepare("PRAGMA table_info(roles)").all() as { name: string }[];
    const hasDescription = columns.some((column) => column.name === "description");
    if (!hasDescription) this.db.prepare("ALTER TABLE roles ADD COLUMN description TEXT").run();
  }

  private migrateRoleActive() {
    const columns = this.db.prepare("PRAGMA table_info(roles)").all() as { name: string }[];
    const hasActive = columns.some((column) => column.name === "active");
    if (!hasActive) this.db.prepare("ALTER TABLE roles ADD COLUMN active INTEGER NOT NULL DEFAULT 1").run();
  }

  private migrateWorksiteDetails() {
    const columns = this.db.prepare("PRAGMA table_info(worksites)").all() as { name: string }[];
    for (const column of ["endereco", "cidade", "responsavel", "data_inicio", "data_fim"]) {
      if (!columns.some((item) => item.name === column)) this.db.prepare(`ALTER TABLE worksites ADD COLUMN ${column} TEXT`).run();
    }
  }

  private migrateEmployeeActive() {
    const columns = this.db.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    const hasActive = columns.some((column) => column.name === "active");
    if (!hasActive) this.db.prepare("ALTER TABLE employees ADD COLUMN active INTEGER NOT NULL DEFAULT 1").run();
  }

  private migrateEmployeeContactFields() {
    const columns = this.db.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "phone")) this.db.prepare("ALTER TABLE employees ADD COLUMN phone TEXT").run();
    if (!columns.some((column) => column.name === "email")) this.db.prepare("ALTER TABLE employees ADD COLUMN email TEXT").run();
  }

  private migrateEmployeeRegistration() {
    const columns = this.db.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "registration")) this.db.prepare("ALTER TABLE employees ADD COLUMN registration INTEGER").run();
    this.ensureEmployeeRegistrations();
    this.db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_registration ON employees(registration)").run();
  }

  private ensureEmployeeRegistrations() {
    const rows = this.db.prepare("SELECT id FROM employees WHERE registration IS NULL ORDER BY created_at, name, id").all() as { id: string }[];
    if (!rows.length) return;
    let next = this.nextEmployeeRegistration();
    const update = this.db.prepare("UPDATE employees SET registration = ? WHERE id = ?");
    this.db.transaction(() => {
      for (const row of rows) update.run(next++, row.id);
    })();
  }

  private ensureEmployeeRegistration(id: string) {
    const row = this.db.prepare("SELECT registration FROM employees WHERE id = ?").get(id) as { registration: number | null } | undefined;
    if (row && row.registration === null) {
      this.db.prepare("UPDATE employees SET registration = ? WHERE id = ?").run(this.nextEmployeeRegistration(), id);
    }
  }

  private nextEmployeeRegistration() {
    const row = this.db.prepare("SELECT COALESCE(MAX(registration), 0) + 1 AS next FROM employees").get() as { next: number };
    return row.next;
  }

  private optionalText(value: string | null | undefined) {
    const text = value?.trim() ?? "";
    return text || null;
  }

  private slug(value: string) {
    return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
  }

  private dateParts(date: Date) {
    const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
    const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
    return { date: dateFormatter.format(date), time: timeFormatter.format(date) };
  }

  private dateTimeInputParts(value: string) {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (match) return { date: match[1], time: match[2] };
    return this.dateParts(new Date(value));
  }
}

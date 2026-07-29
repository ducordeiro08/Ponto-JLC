import cors from "@fastify/cors";
import Fastify from "fastify";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { TothDatabase } from "../electron/database.js";
import type { Session } from "../shared/types.js";

type ApiSession = Session & { sessionId: string };

const DEFAULT_PORT = 3333;
const DEFAULT_HOST = "0.0.0.0";

const createSessionBodySchema = z.object({
  cpf: z.string().min(1),
  worksiteId: z.string().min(1),
});

const managementLoginBodySchema = z.object({
  cpf: z.string().min(1),
  senha: z.string().optional(),
  worksiteId: z.string().min(1).optional(),
});

const createTimeEntryBodySchema = z.object({
  allowDuplicate: z.boolean().optional(),
});

const createPresenceRecordBodySchema = z.object({
  entries: z.array(z.object({
    employeeId: z.string().min(1),
    employeeName: z.string().min(1),
    present: z.boolean(),
    observation: z.string(),
  })),
});

const updatePresenceRecordBodySchema = z.object({
  observations: z.array(z.object({
    entryId: z.string().min(1),
    observation: z.string(),
  })),
});

const syncTimeEntryBodySchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  cpf: z.string().min(1),
  worksiteId: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  createdAt: z.string().min(1),
});

const syncPresenceRecordBodySchema = z.object({
  id: z.string().min(1),
  supervisorEmployeeId: z.string().min(1),
  supervisorCpf: z.string().min(1),
  worksiteId: z.string().min(1),
  date: z.string().min(1),
  createdAt: z.string().min(1),
  entries: z.array(z.object({
    id: z.string().min(1),
    employeeId: z.string().min(1),
    employeeName: z.string().min(1),
    present: z.boolean(),
    observation: z.string(),
  })),
});

const managementEmployeeBodySchema = z.object({
  name: z.string().min(1),
  cpf: z.string().min(1),
  roleId: z.string().min(1),
  worksiteId: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const managementEmployeeActiveSchema = z.object({
  active: z.boolean(),
});

const managementRoleBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const managementRoleActiveSchema = z.object({
  active: z.boolean(),
});

const managementWorksiteBodySchema = z.object({
  name: z.string().min(1),
  active: z.boolean().optional(),
  endereco: z.string().nullable().optional(),
  cidade: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
});

const managementTimeEntryBodySchema = z.object({
  employeeId: z.string().min(1),
  dateTime: z.string().min(1),
  observation: z.string().nullable().optional(),
});

const managementPresenceEntryStatusSchema = z.object({
  status: z.string().min(1),
});

function defaultDatabasePath() {
  const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  return path.join(appData, "TOTH", "shared-backend", "toth.sqlite");
}

function createDatabase() {
  const databasePath = process.env.TOTH_DATABASE_PATH || defaultDatabasePath();
  mkdirSync(path.dirname(databasePath), { recursive: true });
  return new TothDatabase(databasePath);
}

function normalizeCpf(value: string) {
  return value.replace(/\D/g, "");
}

function managementCpfs() {
  const configured = process.env.TOTH_MANAGEMENT_CPFS;
  const source = configured || "18303563807,39442581856,01042668809";
  return new Set(source.split(",").map((cpf) => normalizeCpf(cpf)).filter(Boolean));
}

function assertManagementCredentials(cpf: string, senha = "") {
  const normalizedCpf = normalizeCpf(cpf);
  if (!managementCpfs().has(normalizedCpf)) throw new Error("CPF nao autorizado para a Gestao.");
  const expectedPassword = process.env.TOTH_MANAGEMENT_PASSWORD ?? "toth123";
  if (senha !== expectedPassword) throw new Error("Senha invalida.");
  return normalizedCpf;
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  const database = createDatabase();
  const sessions = new Map<string, ApiSession>();

  await app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-toth-session-id"],
  });

  app.addHook("onClose", async () => {
    database.close();
  });

  function getSession(sessionId: string | undefined) {
    if (!sessionId) throw new Error("Sessao ausente. Informe CPF e obra novamente.");
    const session = sessions.get(sessionId);
    if (!session) throw new Error("Sessao invalida. Informe CPF e obra novamente.");
    return session;
  }

  function getManagerSession(sessionId: string | undefined) {
    const session = getSession(sessionId);
    const role = session.employee.role.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (role !== "encarregado") throw new Error("Acesso permitido apenas para encarregados.");
    return session;
  }

  app.get("/health", async () => ({ ok: true, name: "TOTH API" }));

  app.get("/worksites", async () => database.listWorksites());

  app.post("/management/worksites", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = managementWorksiteBodySchema.parse(request.body);
    return database.createWorksite({ ...input, active: input.active ?? true });
  });

  app.put("/management/worksites/:worksiteId", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ worksiteId: z.string().min(1) }).parse(request.params);
    const input = managementWorksiteBodySchema.parse(request.body);
    return database.updateWorksite(params.worksiteId, { ...input, active: input.active ?? true });
  });

  app.delete("/management/worksites/:worksiteId", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ worksiteId: z.string().min(1) }).parse(request.params);
    return database.setWorksiteActive(params.worksiteId, false);
  });

  app.post("/sessions", async (request) => {
    const input = createSessionBodySchema.parse(request.body);
    const session = database.createSession(input.cpf, input.worksiteId);
    const apiSession = { ...session, sessionId: randomUUID() };
    sessions.set(apiSession.sessionId, apiSession);
    return apiSession;
  });

  app.post("/management/login", async (request) => {
    const input = managementLoginBodySchema.parse(request.body);
    const cpf = assertManagementCredentials(input.cpf, input.senha ?? "");
    const worksite = input.worksiteId
      ? database.getWorksiteById(input.worksiteId)
      : database.listWorksites()[0];
    if (!worksite) throw new Error("Nenhuma obra ativa cadastrada.");
    const apiSession: ApiSession = {
      sessionId: randomUUID(),
      worksite,
      employee: {
        id: `management-${cpf}`,
        cpf,
        name: "Gestao TOTH",
        role: { id: "role-encarregado", name: "Encarregado" },
      },
    };
    sessions.set(apiSession.sessionId, apiSession);
    return apiSession;
  });

  app.post("/management/sessions", async (request) => {
    const input = z.object({ worksiteId: z.string().min(1), cpf: z.string().min(1), senha: z.string().optional() }).parse(request.body);
    const cpf = assertManagementCredentials(input.cpf, input.senha ?? "");
    const worksite = database.getWorksiteById(input.worksiteId);
    const apiSession: ApiSession = {
      sessionId: randomUUID(),
      worksite,
      employee: {
        id: `management-${cpf}`,
        cpf,
        name: "Gestão TOTH",
        role: { id: "role-encarregado", name: "Encarregado" },
      },
    };
    sessions.set(apiSession.sessionId, apiSession);
    return apiSession;
  });

  app.post("/time-entries", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = createTimeEntryBodySchema.parse(request.body ?? {});
    return database.createTimeEntry({
      employeeId: session.employee.id,
      cpf: session.employee.cpf,
      worksiteId: session.worksite.id,
      allowDuplicate: input.allowDuplicate ?? false,
    });
  });

  app.get("/forms", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listForms(session.employee.cpf);
  });

  app.get("/management/time-forms", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listManagementTimeForms(session.worksite.id);
  });

  app.get("/management/time-entries", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const query = z.object({ employeeId: z.string().min(1), date: z.string().min(1) }).parse(request.query);
    return database.listManagementTimeEntries(session.worksite.id, query.employeeId, query.date);
  });

  app.post("/management/time-entries", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = managementTimeEntryBodySchema.parse(request.body);
    return database.createManagementTimeEntry({ ...input, worksiteId: session.worksite.id, observation: input.observation ?? null });
  });

  app.get("/management/attendance", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listManagementAttendance(session.worksite.id);
  });

  app.get("/management/employees", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listManagementEmployees(session.worksite.id);
  });

  app.post("/management/employees", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = managementEmployeeBodySchema.parse(request.body);
    return database.createManagementEmployee({ ...input, worksiteId: input.worksiteId ?? session.worksite.id, phone: input.phone ?? null, email: input.email ?? null, active: input.active ?? true });
  });

  app.put("/management/employees/:employeeId", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ employeeId: z.string().min(1) }).parse(request.params);
    const input = managementEmployeeBodySchema.parse(request.body);
    return database.updateManagementEmployee(params.employeeId, { ...input, worksiteId: input.worksiteId ?? session.worksite.id, phone: input.phone ?? null, email: input.email ?? null, active: input.active ?? true });
  });

  app.patch("/management/employees/:employeeId/active", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ employeeId: z.string().min(1) }).parse(request.params);
    const input = managementEmployeeActiveSchema.parse(request.body);
    return database.setManagementEmployeeActive(params.employeeId, input.active);
  });

  app.get("/management/roles", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listRoles(session.worksite.id);
  });

  app.post("/management/roles", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = managementRoleBodySchema.parse(request.body);
    return database.createRole(input.name, session.worksite.id, input.description ?? null);
  });

  app.put("/management/roles/:roleId", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ roleId: z.string().min(1) }).parse(request.params);
    const input = managementRoleBodySchema.parse(request.body);
    return database.updateRole(params.roleId, input.name, input.description ?? null);
  });

  app.patch("/management/roles/:roleId/active", async (request) => {
    getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ roleId: z.string().min(1) }).parse(request.params);
    const input = managementRoleActiveSchema.parse(request.body);
    return database.setRoleActive(params.roleId, input.active);
  });

  app.delete("/management/roles/:roleId", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ roleId: z.string().min(1) }).parse(request.params);
    database.deleteRole(params.roleId, session.worksite.id);
    return { ok: true };
  });

  app.get("/worksite-employees", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listWorksiteEmployees(session.worksite.id);
  });

  app.post("/presence-records", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    const input = createPresenceRecordBodySchema.parse(request.body);
    return database.createPresenceRecord({
      supervisorEmployeeId: session.employee.id,
      supervisorCpf: session.employee.cpf,
      worksiteId: session.worksite.id,
      entries: input.entries,
    });
  });

  app.get("/presence-records", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listPresenceRecords(session.worksite.id, session.employee.id);
  });

  app.get("/management/presence-records", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    return database.listManagementPresenceRecords(session.worksite.id);
  });

  app.get("/management/presence-records/:recordId", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ recordId: z.string().min(1) }).parse(request.params);
    return database.getManagementPresenceRecord(params.recordId, session.worksite.id);
  });

  app.patch("/management/presence-records/:recordId/status", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ recordId: z.string().min(1) }).parse(request.params);
    return database.touchManagementPresenceRecord(params.recordId, session.worksite.id);
  });

  app.patch("/management/presence-records/:recordId/employees/:employeeId/status", async (request) => {
    const session = getManagerSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ recordId: z.string().min(1), employeeId: z.string().min(1) }).parse(request.params);
    const input = managementPresenceEntryStatusSchema.parse(request.body);
    return database.updateManagementPresenceEntryStatus(params.recordId, session.worksite.id, params.employeeId, input.status);
  });

  app.post("/sync/time-entries", async (request) => {
    const input = syncTimeEntryBodySchema.parse(request.body);
    database.createSyncedTimeEntry(input);
    return { ok: true };
  });

  app.post("/sync/presence-records", async (request) => {
    const input = syncPresenceRecordBodySchema.parse(request.body);
    database.createSyncedPresenceRecord(input);
    return { ok: true };
  });

  app.get("/presence-records/:recordId", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ recordId: z.string().min(1) }).parse(request.params);
    return database.getPresenceRecord(params.recordId, session.worksite.id, session.employee.id);
  });

  app.patch("/presence-records/:recordId", async (request) => {
    const session = getSession(request.headers["x-toth-session-id"] as string | undefined);
    const params = z.object({ recordId: z.string().min(1) }).parse(request.params);
    const input = updatePresenceRecordBodySchema.parse(request.body);
    return database.updatePresenceRecord({ recordId: params.recordId, observations: input.observations }, session.worksite.id, session.employee.id);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      void reply.status(400).send({ message: "Dados invalidos.", issues: error.issues });
      return;
    }
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = /sessao|cpf|obra|registro|formulario/i.test(message) ? 400 : 500;
    void reply.status(statusCode).send({ message });
  });

  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await buildServer();
  const port = Number(process.env.TOTH_API_PORT ?? DEFAULT_PORT);
  const host = process.env.TOTH_API_HOST ?? DEFAULT_HOST;
  await app.listen({ port, host });
}

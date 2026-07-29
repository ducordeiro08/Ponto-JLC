type TothWorksite = { id: string; name: string; active: boolean; endereco?: string | null; cidade?: string | null; responsavel?: string | null; data_inicio?: string | null; data_fim?: string | null };
type TothSession = {
  sessionId: string;
  employee: { id: string; name: string; cpf: string; role: { name: string } };
  worksite: TothWorksite;
};
type TothEmployee = { id: string; cpf: string; name: string; registration: number | null; phone: string | null; email: string | null; roleId: string; roleName: string; worksiteName: string; active: number };
type TothRole = { id: string; name: string; description?: string | null; active?: number | boolean };
type TothEntry = { id: string; time: string; status: string; createdAt: string };
type TothTimeForm = {
  id: string;
  date: string;
  worksiteName: string;
  status: "incompleto" | "completo";
  employeeId: string;
  employeeName: string;
  employeeCpf: string;
  entries: TothEntry[];
};
type TothPresenceRecord = {
  id: string;
  date: string;
  worksiteName: string;
  supervisorName: string;
  totalEmployees: number;
  presentCount: number;
  observationsCount: number;
};
type TothPresenceDetail = TothPresenceRecord & {
  entries: Array<{ id: string; employeeId: string; employeeName: string; present: boolean; observation: string }>;
};
type TothAttendance = {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  roleName: string;
  worksiteName: string;
  timeEntryCount: number;
  firstTime: string | null;
  lastTime: string | null;
  timeStatus: "sem_ponto" | "incompleto" | "completo";
  pointPresence: boolean;
  foremanStatus: "nao_marcado" | "presente" | "ausente";
  foremanObservation: string;
};

const apiBaseUrl = (import.meta.env.VITE_TOTH_API_URL ?? "http://127.0.0.1:3333").replace(/\/$/, "");

async function request<T>(path: string, options: RequestInit = {}, retrySession = true): Promise<T | null> {
  try {
    const needsManagementSession = path.startsWith("/management/") && path !== "/management/login";
    if (needsManagementSession) {
      const ready = await ensureSessionForActiveWorksite();
      if (!ready) return null;
    }

    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    const sessionId = localStorage.getItem("toth-api-session-id");
    if (sessionId) headers.set("x-toth-session-id", sessionId);

    const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    if (!response.ok) {
      if (needsManagementSession && retrySession) {
        localStorage.removeItem("toth-api-session-id");
        localStorage.removeItem("toth-api-session-worksite-id");
        return request<T>(path, options, false);
      }
      return null;
    }
    if (response.status === 204) return {} as T;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function ensureSessionForActiveWorksite() {
  const worksiteId = resolveWorksiteId(localStorage.getItem("toth-obra"));
  const currentSession = localStorage.getItem("toth-api-session-id");
  const currentWorksite = localStorage.getItem("toth-api-session-worksite-id");
  if (currentSession && currentWorksite === worksiteId) return true;

  const gestor = JSON.parse(localStorage.getItem("toth-gestor") || "{}") as { cpf: string; nome: string };
  const candidates = Array.from(new Set([gestor.cpf, localStorage.getItem("toth-manager-cpf")].filter(Boolean))) as string[];

  for (const cpf of candidates) {
    const response = await fetch(`${apiBaseUrl}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cpf, worksiteId }),
    });
    if (!response.ok) continue;

    const session = await response.json() as TothSession;
    const role = session.employee.role.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (role !== "encarregado") continue;

    localStorage.setItem("toth-api-session-id", session.sessionId);
    localStorage.setItem("toth-api-session-worksite-id", session.worksite.id);
    localStorage.setItem("toth-token", session.sessionId);
    localStorage.setItem("toth-manager-cpf", session.employee.cpf);
    localStorage.setItem("toth-gestor", JSON.stringify({ id: 1, nome: session.employee.name, cpf: session.employee.cpf, email: "" }));
    return true;
  }

  const managementCpf = candidates[0];
  if (!managementCpf) return false;
  const bootstrapResponse = await fetch(`${apiBaseUrl}/management/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ worksiteId, cpf: managementCpf, senha: localStorage.getItem("toth-management-password") || "toth123" }),
  });
  if (!bootstrapResponse.ok) return false;
  const bootstrapSession = await bootstrapResponse.json() as TothSession;
  localStorage.setItem("toth-api-session-id", bootstrapSession.sessionId);
  localStorage.setItem("toth-api-session-worksite-id", bootstrapSession.worksite.id);
  localStorage.setItem("toth-token", bootstrapSession.sessionId);
  localStorage.setItem("toth-gestor", JSON.stringify({ id: 1, nome: bootstrapSession.employee.name, cpf: bootstrapSession.employee.cpf, email: "" }));
  return true;
}

function saveMap(name: string, entries: Array<[string, string]>) {
  localStorage.setItem(name, JSON.stringify(Object.fromEntries(entries)));
}

function readMap(name: string) {
  return JSON.parse(localStorage.getItem(name) || "{}") as Record<string, string>;
}

function resolveWorksiteId(value: unknown) {
  const selected = String(value || "");
  if (selected.startsWith("worksite-")) return selected;
  return readMap("toth-worksite-map")[selected] || "worksite-butanta";
}

function resolveMappedId(mapName: string, value: unknown) {
  const selected = String(value || "");
  if (!selected) return "";
  return readMap(mapName)[selected] || selected;
}

function numericId(value: string, index: number) {
  const digits = value.replace(/\D/g, "");
  return Number(digits.slice(-8)) || index + 1;
}

function mapWorksites(worksites: TothWorksite[]) {
  saveMap("toth-worksite-map", worksites.map((worksite, index) => [String(index + 1), worksite.id]));
  return worksites.map((worksite, index) => ({
    id: index + 1,
    nome: worksite.name,
    codigo: `OBR-${String(index + 1).padStart(3, "0")}`,
    endereco: worksite.endereco || null,
    cidade: worksite.cidade || null,
    responsavel: worksite.responsavel || null,
    data_inicio: worksite.data_inicio || null,
    data_fim: worksite.data_fim || null,
    ativa: worksite.active ? 1 : 0,
  }));
}

function mapEmployees(employees: TothEmployee[]) {
  saveMap("toth-employee-map", employees.map((employee, index) => [String(numericId(employee.id, index)), employee.id]));
  return employees.map((employee, index) => ({
    id: numericId(employee.id, index),
    id_api: employee.id,
    nome: employee.name,
    cpf: employee.cpf,
    matricula: employee?.registration ? `FUN-${String(employee.registration).padStart(4, "0")}` : `FUN-${String(index + 1).padStart(4, "0")}`,
    telefone: employee.phone,
    email: employee.email,
    cargo_id: numericId(employee.roleId, index),
    cargo_nome: employee.roleName,
    obras: employee.worksiteName,
    ativo: Number(employee.active ?? 1),
  }));
}

function mapRoles(roles: TothRole[]) {
  saveMap("toth-role-map", roles.map((role, index) => [String(numericId(role.id, index)), role.id]));
  return roles.map((role, index) => ({
    id: numericId(role.id, index),
    nome: role.name,
    descricao: role.description || null,
    ativo: Number(role.active ?? 1),
  }));
}

function mapJourneys(records: TothPresenceRecord[]) {
  saveMap("toth-journey-map", records.map((record, index) => [String(index + 1), record.id]));
  return records.map((record, index) => ({
    id: index + 1,
    obra_id: 1,
    obra_nome: record.worksiteName,
    obra_codigo: "OBR-001",
    data: record.date,
    hora_inicio_prevista: "08:00",
    hora_fim_prevista: "17:00",
    status: "ENCERRADA",
    total_funcionarios: record.totalEmployees,
    presentes: record.presentCount,
  }));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function loadJourneyContext(displayId: string) {
  const recordId = readMap("toth-journey-map")[displayId] || displayId;
  const [detail, forms, employees] = await Promise.all([
    request<TothPresenceDetail>(`/management/presence-records/${encodeURIComponent(recordId)}`),
    request<TothTimeForm[]>("/management/time-forms"),
    request<TothEmployee[]>("/management/employees"),
  ]);
  if (!detail || !forms || !employees) return null;
  saveMap("toth-journey-employee-map", detail.entries.map((entry, index) => [String(numericId(entry.employeeId, index)), entry.employeeId]));
  return { recordId, detail, forms, employees };
}

function resolveJourneyEmployeeId(value: string) {
  return readMap("toth-journey-employee-map")[value] || readMap("toth-employee-map")[value] || value;
}

function punchesFor(forms: TothTimeForm[], employeeId: string, date: string) {
  return forms.find((form) => form.employeeId === employeeId && form.date === date)?.entries || [];
}

function mapPunches(entries: TothEntry[], date: string) {
  return entries.map((entry, index) => ({
    id: numericId(entry.id, index),
    tipo: index % 2 === 0 ? "ENTRADA" : "SAIDA",
    data_hora: `${date}T${entry.time}:00`,
    observacao: null,
  }));
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  const worksiteEditMatch = path.match(/^\/obras\/([^/]+)$/);
  if (worksiteEditMatch && options.method === "DELETE") {
    const worksiteId = resolveWorksiteId(worksiteEditMatch[1]);
    const result = await request<TothWorksite>(`/management/worksites/${encodeURIComponent(worksiteId)}`, { method: "DELETE" });
    return result ? {} as T : null;
  }

  if (worksiteEditMatch && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const worksiteId = resolveWorksiteId(worksiteEditMatch[1]);
    const result = await request<TothWorksite>(`/management/worksites/${encodeURIComponent(worksiteId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: body.nome, active: body.ativa !== false, endereco: body.endereco || null, cidade: body.cidade || null, responsavel: body.responsavel || null, data_inicio: body.data_inicio || null, data_fim: body.data_fim || null }),
    });
    return result ? {} as T : null;
  }

  if (path === "/obras" && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const result = await request<TothWorksite>("/management/worksites", {
      method: "POST",
      body: JSON.stringify({ name: body.nome, active: body.ativa !== false, endereco: body.endereco || null, cidade: body.cidade || null, responsavel: body.responsavel || null, data_inicio: body.data_inicio || null, data_fim: body.data_fim || null }),
    });
    return result ? {} as T : null;
  }

  if (path.startsWith("/obras")) {
    const worksites = await request<TothWorksite[]>("/worksites");
    return worksites ? mapWorksites(worksites) as T : null;
  }

  if (path === "/login" && options.body) {
    const body = JSON.parse(String(options.body)) as { cpf: string; senha?: string };
    const session = await request<TothSession>("/management/login", {
      method: "POST",
      body: JSON.stringify({ cpf: body.cpf, senha: body.senha }),
    });
    if (!session) return null;
    localStorage.setItem("toth-api-session-id", session.sessionId);
    localStorage.setItem("toth-api-session-worksite-id", session.worksite.id);
    localStorage.setItem("toth-manager-cpf", session.employee.cpf);
    localStorage.setItem("toth-management-password", body.senha || "");
    localStorage.setItem("toth-obra", session.worksite.id);
    return {
      token: session.sessionId,
      gestor: { id: 1, nome: session.employee.name, cpf: session.employee.cpf, email: "" },
    } as T;
  }

  if (path.startsWith("/dashboard")) {
    const [employees, forms, records] = await Promise.all([
      request<TothEmployee[]>("/management/employees"),
      request<TothTimeForm[]>("/management/time-forms"),
      request<TothPresenceRecord[]>("/management/presence-records"),
    ]);
    if (!employees || !forms || !records) return null;
    const today = todayIso();
    const todayForms = forms.filter((form) => form.date === today);
    const entriesToday = todayForms.reduce((sum, form) => sum + form.entries.length, 0);
    const presentByPoint = todayForms.filter((form) => form.entries.length > 0).length;
    const selectedWorksiteName = employees[0]?.worksiteName || forms[0]?.worksiteName || records[0]?.worksiteName || "Obra selecionada";
    const dailyPresence = Array.from(forms.reduce((map, form) => {
      if (form.entries.length > 0) map.set(form.date, (map.get(form.date) || 0) + 1);
      return map;
    }, new Map<string, number>()).entries()).map(([date, presentes]) => ({ data: date, presentes }));
    return {
      data: today,
      resumo: {
        funcionariosAtivos: employees.length,
        obrasAtivas: 1,
        jornadasHoje: records.filter((record) => record.date === today).length,
        presentes: presentByPoint,
        pendentes: Math.max(0, employees.length - presentByPoint),
        batidas: entriesToday,
      },
      porObra: [{
        id: 1,
        nome: selectedWorksiteName,
        codigo: "OBR-001",
        jornada_id: 1,
        status: "ENCERRADA",
        total_funcionarios: employees.length,
        presentes: presentByPoint,
        pendentes: Math.max(0, employees.length - presentByPoint),
      }],
      presencaDiaria: dailyPresence,
    } as T;
  }

  const employeeActiveMatch = path.match(/^\/funcionarios\/([^/]+)\/ativo$/);
  if (employeeActiveMatch && options.body) {
    const body = JSON.parse(String(options.body)) as { ativo: boolean };
    const employeeId = resolveMappedId("toth-employee-map", employeeActiveMatch[1]);
    const employee = await request<TothEmployee>(`/management/employees/${encodeURIComponent(employeeId)}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active: body.ativo }),
    });
    return employee ? mapEmployees([employee])[0] as T : null;
  }

  const employeeEditMatch = path.match(/^\/funcionarios\/([^/]+)$/);
  if (employeeEditMatch && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const employeeId = resolveMappedId("toth-employee-map", employeeEditMatch[1]);
    const employee = await request<TothEmployee>(`/management/employees/${encodeURIComponent(employeeId)}`, {
      method: "PUT",
      body: JSON.stringify({
        name: body.nome,
        cpf: body.cpf,
        roleId: resolveMappedId("toth-role-map", body.cargo_id),
        worksiteId: resolveWorksiteId(body.obra_id || localStorage.getItem("toth-obra")),
        phone: body.telefone || null,
        email: body.email || null,
        active: body.ativo !== false,
      }),
    });
    return employee ? mapEmployees([employee])[0] as T : null;
  }

  if (path === "/funcionarios" && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const employee = await request<TothEmployee>("/management/employees", {
      method: "POST",
      body: JSON.stringify({
        name: body.nome,
        cpf: body.cpf,
        roleId: resolveMappedId("toth-role-map", body.cargo_id),
        worksiteId: resolveWorksiteId(body.obra_id || localStorage.getItem("toth-obra")),
        phone: body.telefone || null,
        email: body.email || null,
        active: body.ativo !== false,
      }),
    });
    return employee ? mapEmployees([employee])[0] as T : null;
  }

  if (path.startsWith("/funcionarios")) {
    const employees = await request<TothEmployee[]>("/management/employees");
    return employees ? mapEmployees(employees) as T : null;
  }

  const roleDeleteMatch = path.match(/^\/cargos\/([^/]+)$/);
  if (roleDeleteMatch && options.method === "DELETE") {
    const roleId = resolveMappedId("toth-role-map", roleDeleteMatch[1]);
    const result = await request<{ ok: boolean }>(`/management/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" });
    return result ? {} as T : null;
  }

  const roleActiveMatch = path.match(/^\/cargos\/([^/]+)\/ativo$/);
  if (roleActiveMatch && options.body) {
    const body = JSON.parse(String(options.body)) as { ativo: boolean };
    const roleId = resolveMappedId("toth-role-map", roleActiveMatch[1]);
    const role = await request<TothRole>(`/management/roles/${encodeURIComponent(roleId)}/active`, {
      method: "PATCH",
      body: JSON.stringify({ active: body.ativo }),
    });
    return role ? mapRoles([role])[0] as T : null;
  }

  const roleEditMatch = path.match(/^\/cargos\/([^/]+)$/);
  if (roleEditMatch && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const roleId = resolveMappedId("toth-role-map", roleEditMatch[1]);
    const role = await request<TothRole>(`/management/roles/${encodeURIComponent(roleId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: body.nome, description: body.descricao || null }),
    });
    return role ? mapRoles([role])[0] as T : null;
  }

  if (path === "/cargos" && options.body) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    const role = await request<TothRole>("/management/roles", {
      method: "POST",
      body: JSON.stringify({ name: body.nome, description: body.descricao || null }),
    });
    return role ? mapRoles([role])[0] as T : null;
  }

  if (path.startsWith("/cargos")) {
    const roles = await request<TothRole[]>("/management/roles");
    const mapped = roles ? mapRoles(roles) : null;
    if (!mapped) return null;
    return (path.includes("ativos=true") ? mapped.filter((role) => role.ativo) : mapped) as T;
  }

  if (path.startsWith("/conferencia")) {
    return await request<TothAttendance[]>("/management/attendance") as T | null;
  }

  const journeyEmployeeStatusMatch = path.match(/^\/jornadas\/([^/]+)\/funcionarios\/([^/]+)\/status$/);
  if (journeyEmployeeStatusMatch && options.body) {
    const recordId = readMap("toth-journey-map")[journeyEmployeeStatusMatch[1]] || journeyEmployeeStatusMatch[1];
    const employeeId = resolveJourneyEmployeeId(journeyEmployeeStatusMatch[2]);
    const body = JSON.parse(String(options.body)) as { status: string };
    const result = await request<TothPresenceDetail>(
      `/management/presence-records/${encodeURIComponent(recordId)}/employees/${encodeURIComponent(employeeId)}/status`,
      { method: "PATCH", body: JSON.stringify({ status: body.status }) },
    );
    return result ? {} as T : null;
  }

  const journeyStatusMatch = path.match(/^\/jornadas\/([^/]+)\/status$/);
  if (journeyStatusMatch && options.body) {
    const recordId = readMap("toth-journey-map")[journeyStatusMatch[1]] || journeyStatusMatch[1];
    const result = await request<{ ok: boolean }>(
      `/management/presence-records/${encodeURIComponent(recordId)}/status`,
      { method: "PATCH", body: options.body },
    );
    return result ? {} as T : null;
  }

  const punchesMatch = path.match(/^\/jornadas\/([^/]+)\/funcionarios\/([^/]+)\/batidas/);
  if (punchesMatch) {
    const context = await loadJourneyContext(punchesMatch[1]);
    if (!context) return null;
    const employeeId = resolveJourneyEmployeeId(punchesMatch[2]);
    return mapPunches(punchesFor(context.forms, employeeId, context.detail.date), context.detail.date) as T;
  }

  if (path === "/batidas" && options.body) {
    const body = JSON.parse(String(options.body)) as { jornada_id: number; funcionario_id: number; data_hora: string; tipo: "ENTRADA" | "SAIDA"; observacao: string | null };
    const employeeId = resolveJourneyEmployeeId(String(body.funcionario_id));
    const entry = await request<TothEntry>("/management/time-entries", {
      method: "POST",
      body: JSON.stringify({ employeeId, dateTime: body.data_hora, observation: body.observacao || null }),
    });
    if (!entry) return null;
    return {
      id: numericId(entry.id, 0),
      tipo: body.tipo,
      data_hora: `${body.data_hora.slice(0, 10)}T${entry.time}:00`,
      observacao: body.observacao || null,
    } as T;
  }

  const detailMatch = path.match(/^\/jornadas\/([^/]+)$/);
  if (detailMatch) {
    const context = await loadJourneyContext(detailMatch[1]);
    if (!context) return null;
    const { detail, forms, employees } = context;
    return {
      id: Number(detailMatch[1]) || 1,
      obra_id: 1,
      obra_nome: detail.worksiteName,
      obra_codigo: "OBR-001",
      data: detail.date,
      hora_inicio_prevista: "08:00",
      hora_fim_prevista: "17:00",
      status: "ENCERRADA",
      total_funcionarios: detail.totalEmployees,
      presentes: detail.presentCount,
      funcionarios: detail.entries.map((entry, index) => {
        const employee = employees.find((item) => item.id === entry.employeeId);
        const punches = punchesFor(forms, entry.employeeId, detail.date);
        return {
          jornada_funcionario_id: index + 1,
          funcionario_id: numericId(entry.employeeId, index),
          nome: entry.employeeName,
          matricula: employee?.registration ? `FUN-${String(employee.registration).padStart(4, "0")}` : `FUN-${String(index + 1).padStart(4, "0")}`,
          cargo_nome: employee?.roleName || null,
          status: entry.observation === "ABONADO" ? "ABONADO" : entry.present ? "REGULAR" : "AUSENTE",
          primeira_batida: punches[0] ? `${detail.date}T${punches[0].time}:00` : null,
          ultima_batida: punches[punches.length - 1] ? `${detail.date}T${punches[punches.length - 1].time}:00` : null,
          total_batidas: punches.length,
        };
      }),
    } as T;
  }

  if (path.startsWith("/jornadas")) {
    const records = await request<TothPresenceRecord[]>("/management/presence-records");
    return records ? mapJourneys(records) as T : null;
  }

  return null;
}

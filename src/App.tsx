import { useEffect, useState } from "react";
import type { PresenceRecord, PresenceRecordDetail, Session, TimeForm, Worksite, WorksiteEmployee } from "../shared/types";
import logo from "./assets/logo_nome.png";
import { formatCpf, formatDate, formatTime } from "./domain/formatters";
import { tothApi } from "./services/tothApi";

type Screen = "login" | "home" | "new-entry" | "success" | "records" | "foreman-home" | "foreman-entry" | "observation" | "foreman-success" | "foreman-records" | "foreman-record-detail" | "foreman-employees";

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button className="back-button" type="button" onClick={onClick} aria-label="Voltar">?</button>
);
const Brand = () => <img className="header-logo" src={logo} alt="TOTH" />;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [session, setSession] = useState<Session | null>(null);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [cpf, setCpf] = useState("");
  const [worksiteId, setWorksiteId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());
  const [savedTime, setSavedTime] = useState("");
  const [savedDate, setSavedDate] = useState("");
  const [forms, setForms] = useState<TimeForm[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [foremanEmployees, setForemanEmployees] = useState<WorksiteEmployee[]>([]);
  const [presentEmployees, setPresentEmployees] = useState<Record<string, boolean>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<WorksiteEmployee | null>(null);
  const [observationDraft, setObservationDraft] = useState("");
  const [presenceRecords, setPresenceRecords] = useState<PresenceRecord[]>([]);
  const [presenceRecordDetail, setPresenceRecordDetail] = useState<PresenceRecordDetail | null>(null);
  const [detailObservations, setDetailObservations] = useState<Record<string, string>>({});

  useEffect(() => {
    tothApi.listWorksites().then(setWorksites).catch(() => setError("Não foi possível carregar as obras."));
  }, []);

  useEffect(() => {
    if (screen !== "new-entry") return;
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, [screen]);

  async function loadForemanEmployees(resetRecord = false) {
    setBusy(true);
    setError("");
    try {
      const employees = await tothApi.listWorksiteEmployees();
      setForemanEmployees(employees);
      if (resetRecord) {
        setPresentEmployees({});
        setObservations({});
      }
    } catch {
      setError("Não foi possível carregar os funcionários da obra.");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!cpf.replace(/\D/g, "") || !worksiteId) {
      setError("Informe o CPF e selecione uma obra.");
      return;
    }
    setBusy(true);
    try {
      const nextSession = await tothApi.createSession(cpf, worksiteId);
      const isForeman = normalize(nextSession.employee.role.name) === "encarregado";
      setSession(nextSession);
      if (isForeman) {
        setScreen("foreman-home");
        setTimeout(() => void loadForemanEmployees(), 0);
      } else {
        setScreen("home");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEntry(allowDuplicate = false) {
    if (!session || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await tothApi.createTimeEntry(allowDuplicate);
      if (result.kind === "duplicate") {
        setBusy(false);
        if (window.confirm(result.message)) await confirmEntry(true);
        return;
      }
      setSavedTime(result.entry.time);
      setScreen("success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o ponto. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function savePresenceRecord() {
    if (!session || busy) return;
    const hasPresent = Object.values(presentEmployees).some(Boolean);
    if (!hasPresent && !window.confirm("Nenhum funcionário foi marcado como presente. Deseja continuar")) return;
    setBusy(true);
    setError("");
    try {
      const result = await tothApi.createPresenceRecord({
        entries: foremanEmployees.map((employee) => ({
          employeeId: employee.id,
          employeeName: employee.name,
          present: Boolean(presentEmployees[employee.id]),
          observation: observations[employee.id] ?? "",
        })),
      });
      setSavedDate(result.date);
      setPresentEmployees({});
      setObservations({});
      setScreen("foreman-success");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o registro.");
    } finally {
      setBusy(false);
    }
  }

  async function openRecords() {
    if (!session) return;
    setScreen("records");
    setRecordsLoading(true);
    setError("");
    try {
      setForms(await tothApi.listForms());
    } catch {
      setError("Não foi possível carregar seus registros.");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function openPresenceRecords() {
    if (!session) return;
    setScreen("foreman-records");
    setRecordsLoading(true);
    setError("");
    try {
      setPresenceRecords(await tothApi.listPresenceRecords());
    } catch {
      setError("Não foi possível carregar os registros salvos.");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function openPresenceRecordDetail(recordId: string) {
    setScreen("foreman-record-detail");
    setRecordsLoading(true);
    setError("");
    try {
      const detail = await tothApi.getPresenceRecord(recordId);
      setPresenceRecordDetail(detail);
      setDetailObservations(Object.fromEntries(detail.entries.map((entry) => [entry.id, entry.observation])));
    } catch {
      setError("Não foi possível abrir este registro.");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function savePresenceRecordDetail() {
    if (!presenceRecordDetail || busy) return;
    setBusy(true);
    setError("");
    try {
      const detail = await tothApi.updatePresenceRecord({
        recordId: presenceRecordDetail.id,
        observations: presenceRecordDetail.entries.map((entry) => ({
          entryId: entry.id,
          observation: detailObservations[entry.id] ?? "",
        })),
      });
      setPresenceRecordDetail(detail);
      setDetailObservations(Object.fromEntries(detail.entries.map((entry) => [entry.id, entry.observation])));
      setPresenceRecords(await tothApi.listPresenceRecords());
    } catch {
      setError("Não foi possível salvar as alterações.");
    } finally {
      setBusy(false);
    }
  }

  async function startPresenceRecord() {
    setScreen("foreman-entry");
    await loadForemanEmployees(true);
  }

  async function openLinkedEmployees() {
    setScreen("foreman-employees");
    await loadForemanEmployees(false);
  }

  function openObservation(employee: WorksiteEmployee) {
    setSelectedEmployee(employee);
    setObservationDraft(observations[employee.id] ?? "");
    setScreen("observation");
  }

  function backFromPresenceRecord() {
    const hasDraft = Object.values(presentEmployees).some(Boolean) || Object.values(observations).some((observation) => observation.trim());
    if (hasDraft && !window.confirm("Existem alteracoes nao salvas. Deseja descarta-las")) return;
    setPresentEmployees({});
    setObservations({});
    setScreen("foreman-home");
  }

  function closeObservation() {
    if (selectedEmployee && observationDraft !== (observations[selectedEmployee.id] ?? "") && !window.confirm("Descartar a observação digitada")) return;
    setScreen("foreman-entry");
  }

  function saveObservation() {
    if (!selectedEmployee) return;
    setObservations((current) => ({ ...current, [selectedEmployee.id]: observationDraft }));
    setScreen("foreman-entry");
  }

  function logout() {
    setSession(null);
    setScreen("login");
    setCpf("");
    setWorksiteId("");
    setError("");
  }

  if (screen === "login") {
    return <main className="app login-screen"><section className="login-card">
      <div className="login-brand"><img className="login-logo" src={logo} alt="TOTH" /><p>login</p></div>
      <form onSubmit={login} className="form">
        <label>CPF<input value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} inputMode="numeric" placeholder="000.000.000-00" /></label>
        <label>Obra<select value={worksiteId} onChange={(event) => setWorksiteId(event.target.value)}>
          <option value="">Selecione uma obra</option>
          {worksites.map((worksite) => <option key={worksite.id} value={worksite.id}>{worksite.name}</option>)}
        </select></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
      </form>
      <p className="demo-hint">Demonstração encarregado: CPF 111.222.333-44</p>
    </section></main>;
  }

  if (!session) return null;

  return <main className="app"> 
    {screen === "home" && <section className="screen home-screen">
      <header className="topbar"><div><p>Bem-vindo</p><h1>{session.employee.name}</h1><span>{session.employee.role.name}</span></div><Brand /></header>
      <div className="worksite-card"><span>Obra atual</span><strong>{session.worksite.name}</strong></div>
      <div className="home-actions">
        <button className="action-card green" onClick={() => { setError(""); setScreen("new-entry"); }}><span className="action-icon">+</span><strong>Novo ponto</strong><small>Registrar horário atual</small></button>
        <button className="action-card amber" onClick={openRecords}><span className="action-icon">?</span><strong>Meus registros</strong><small>Consultar formulários</small></button>
      </div>
      <button className="text-button" onClick={logout}>Trocar sessão</button>
    </section>}

    {screen === "foreman-home" && <section className="screen home-screen foreman-home-screen">
      <header className="topbar"><div><p>Bem-vindo</p><h1>{session.employee.name}</h1><span>{session.employee.role.name}</span></div><Brand /></header>
      <div className="worksite-card"><span>Obra atual</span><strong>{session.worksite.name}</strong></div>
      <div className="home-actions">
        <button className="action-card green" onClick={() => void startPresenceRecord()}><span className="action-icon">+</span><strong>Novo</strong><small>Criar registro de presença</small></button>
        <button className="action-card amber" onClick={openPresenceRecords}><span className="action-icon">?</span><strong>Registros salvos</strong><small>Histórico dos novos registros</small></button>
        <button className="action-card violet" onClick={() => void openLinkedEmployees()}><span className="action-icon">?</span><strong>Funcionários vinculados</strong><small>Equipe vinculada a esta obra</small></button>
      </div>
      <button className="text-button" onClick={logout}>Trocar sessão</button>
    </section>}

    {screen === "foreman-entry" && <section className="screen foreman-screen">
      <BackButton onClick={backFromPresenceRecord} /><header className="foreman-header"><Brand /><button className="text-button" onClick={logout}>Trocar sessao</button></header>
      <div className="section-title"><p>{session.worksite.name}</p><h1>Novo registro</h1></div>
      {busy && <p className="state compact">Carregando funcionários...</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="employee-list">{foremanEmployees.map((employee) => {
        const present = Boolean(presentEmployees[employee.id]);
        const hasNote = Boolean((observations[employee.id] ?? "").trim());
        return <article className="employee-row" key={employee.id}>
          <button className={`presence-dot-button ${present ? "selected" : ""}`} type="button" aria-label={`Marcar ${employee.name}`} onClick={() => setPresentEmployees((current) => ({ ...current, [employee.id]: !present }))} />
          <div><strong>{employee.name}</strong><small>{employee.roleName}</small></div>
          <button className={`note-button ${hasNote ? "has-note" : ""}`} type="button" aria-label={`Observação de ${employee.name}`} onClick={() => openObservation(employee)}>?</button>
        </article>;
      })}</div>
      <button className="button primary sticky-save" onClick={savePresenceRecord} disabled={busy}>Salvar</button>
    </section>}

    {screen === "observation" && selectedEmployee && <section className="screen observation-screen">
      <BackButton onClick={closeObservation} /><Brand />
      <div className="section-title"><p>{selectedEmployee.name}</p><h1>Observação</h1></div>
      <textarea value={observationDraft} onChange={(event) => setObservationDraft(event.target.value)} placeholder="Digite..." />
      <button className="button primary sticky-save" onClick={saveObservation}>OK</button>
    </section>}

    {screen === "new-entry" && <section className="screen centered-screen">
      <BackButton onClick={() => setScreen("home")} /><Brand />
      <div className="clock">{formatTime(now)}</div>
      <p className="record-label">Registro {formatDate(now)} - {session.worksite.name}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="round-confirm" onClick={() => confirmEntry()} disabled={busy}><span>{busy ? "..." : "?"}</span><strong>{busy ? "Salvando" : "Confirmar"}</strong></button>
    </section>}

    {screen === "success" && <section className="screen centered-screen">
      <Brand /><h1 className="success-title">Registro realizado</h1><div className="saved-time">{savedTime}</div><div className="success-check">?</div>
      <div className="stack-actions"><button className="button primary" onClick={() => setScreen("home")}>Início</button><button className="button secondary" onClick={openRecords}>Meus registros</button></div>
    </section>}

    {screen === "foreman-success" && <section className="screen centered-screen">
      <Brand /><h1 className="success-title">Registro realizado</h1><p className="record-label">{formatDate(savedDate)}</p><div className="success-check">?</div>
      <div className="stack-actions"><button className="button primary" onClick={() => setScreen("foreman-home")}>Inicio</button><button className="button secondary" onClick={openPresenceRecords}>Registros salvos</button></div>
    </section>}

    {screen === "records" && <section className="screen records-screen">
      <BackButton onClick={() => setScreen("home")} /><Brand /><h1>Meus registros</h1>
      {recordsLoading && <p className="state">Carregando registros...</p>}
      {error && <div className="state"><p className="error">{error}</p><button className="text-button" onClick={openRecords}>Tentar novamente</button></div>}
      {!recordsLoading && !error && forms.length === 0 && <p className="state">Você ainda não possui registros salvos.</p>}
      <div className="records-list">{forms.map((form) => <article className="record-card" key={form.id}>
        <div className="record-card-header"><div><span>Registro {formatDate(form.date)}</span><strong>{form.worksiteName}</strong></div><span className={`status ${form.status}`}>{form.status}</span></div>
        <div className="times">{form.entries.map((entry, index) => <div key={entry.id}><span>{index + 1}? registro</span><strong>{entry.time}</strong></div>)}</div>
        <small>{form.entries.length}/4 horários registrados</small>
      </article>)}</div>
    </section>}

    {screen === "foreman-records" && <section className="screen records-screen">
      <BackButton onClick={() => setScreen("foreman-home")} /><Brand /><h1>Registros salvos</h1>
      {recordsLoading && <p className="state">Carregando registros...</p>}
      {error && <div className="state"><p className="error">{error}</p><button className="text-button" onClick={openPresenceRecords}>Tentar novamente</button></div>}
      {!recordsLoading && !error && presenceRecords.length === 0 && <p className="state">Nenhum registro salvo para esta obra.</p>}
      <div className="records-list">{presenceRecords.map((record) => <button className="record-card record-button" type="button" onClick={() => void openPresenceRecordDetail(record.id)} key={record.id}>
        <div className="record-card-header"><div><span>Registro {formatDate(record.date)}</span><strong>{record.worksiteName}</strong></div><span className="status completo">{record.presentCount} presentes</span></div>
        <small>{record.totalEmployees} funcionarios no registro - {record.observationsCount} observacoes</small>
        <span className="open-record-hint">Visualizar lista de presenca</span>
      </button>)}</div>
    </section>}
    {screen === "foreman-record-detail" && <section className="screen records-screen">
      <BackButton onClick={openPresenceRecords} /><Brand /><h1>Registro salvo</h1>
      {recordsLoading && <p className="state">Carregando registro...</p>}
      {error && <div className="state"><p className="error">{error}</p><button className="text-button" onClick={() => presenceRecordDetail && void openPresenceRecordDetail(presenceRecordDetail.id)}>Tentar novamente</button></div>}
      {presenceRecordDetail && !recordsLoading && <div className="record-detail">
        <div className="record-summary">
          <span>{formatDate(presenceRecordDetail.date)}</span>
          <strong>{presenceRecordDetail.worksiteName}</strong>
          <small>{presenceRecordDetail.presentCount} presentes</small>
        </div>
        <div className="detail-list">{presenceRecordDetail.entries.map((entry) => <article className="detail-row" key={entry.id}>
          <div className="detail-person">
            <span className={`mini-presence ${entry.present ? "selected" : ""}`} />
            <div><strong>{entry.employeeName}</strong><small>{entry.present ? "Presente" : "Nao presente"}</small></div>
          </div>
          <label>Observacao<textarea value={detailObservations[entry.id] ?? ""} onChange={(event) => setDetailObservations((current) => ({ ...current, [entry.id]: event.target.value }))} placeholder="Digite..." /></label>
        </article>)}</div>
        <button className="button primary sticky-save" onClick={savePresenceRecordDetail} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</button>
      </div>}
    </section>}
    {screen === "foreman-employees" && <section className="screen records-screen">
      <BackButton onClick={() => setScreen("foreman-home")} /><Brand /><h1>Funcionários vinculados</h1>
      <p className="record-label">{session.worksite.name}</p>
      {busy && <p className="state">Carregando funcionários...</p>}
      {error && <div className="state"><p className="error">{error}</p><button className="text-button" onClick={() => void openLinkedEmployees()}>Tentar novamente</button></div>}
      {!busy && !error && foremanEmployees.filter((employee) => employee.id !== session.employee.id).length === 0 && <p className="state">Nenhum funcionario vinculado a esta obra.</p>}
      <div className="employee-list linked-list">{foremanEmployees.filter((employee) => employee.id !== session.employee.id).map((employee) => <article className="employee-row linked-row" key={employee.id}>
        <div><strong>{employee.name}</strong><small>{employee.roleName}</small></div>
      </article>)}</div>
    </section>}
  </main>;
}

export default App;


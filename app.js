const works = ["Obra 1", "Obra 2", "Obra 3"];
const employeeSeed = ["Pedro", "Matheus", "Gabriel", "Paulo", "Henrique", "João", "Rafael", "José", "Lucas"];
const databaseKey = "ponto-jlc-db-v1";
const legacyKey = "ponto-jlc-registros";

const state = {
  work: "",
  responsibleName: "",
  selectedEmployees: [],
  createdAt: null,
  lastFormularioId: "",
  editingFormularioId: ""
};

const screens = {
  works: document.querySelector("#screen-works"),
  employees: document.querySelector("#screen-employees"),
  confirm: document.querySelector("#screen-confirm"),
  result: document.querySelector("#screen-result"),
  saved: document.querySelector("#screen-saved"),
  edit: document.querySelector("#screen-edit")
};

const formatters = {
  date: new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }),
  time: new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  })
};

function makeId(prefix) {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${random}`;
}

function getDefaultDatabase() {
  return {
    Formulario: [],
    Responsavel: [],
    Funcionario: employeeSeed.map((name, index) => ({
      ID_Funcionario: `FUN_${String(index + 1).padStart(3, "0")}`,
      Nome: name,
      Cargo: ""
    })),
    Registro_Presenca: []
  };
}

function normalizeDatabase(db) {
  const normalized = { ...getDefaultDatabase(), ...db };
  normalized.Funcionario = getDefaultDatabase().Funcionario.map((employee) => {
    const current = normalized.Funcionario.find((item) => item.Nome === employee.Nome);
    return current || employee;
  });
  return normalized;
}

function migrateLegacyRecords(db) {
  const legacy = JSON.parse(localStorage.getItem(legacyKey) || "[]");
  if (!legacy.length || db.Formulario.length) return db;

  legacy.forEach((record) => {
    const responsible = getOrCreateResponsavel(db, "Responsável não informado");
    const funcionario = db.Funcionario.find((item) => item.Nome === record.funcionario);
    if (!funcionario) return;

    const formularioId = makeId("FORM");
    db.Formulario.push({
      ID_Formulario: formularioId,
      Data: record.data,
      Hora: record.hora,
      Obra: record.obra,
      ID_Responsavel: responsible.ID_Responsavel
    });
    db.Registro_Presenca.push({
      ID_RegistroPonto: record.id || makeId("PONTO"),
      ID_Formulario: formularioId,
      ID_Funcionario: funcionario.ID_Funcionario
    });
  });

  return db;
}

function getDatabase() {
  const stored = JSON.parse(localStorage.getItem(databaseKey) || "null");
  const db = migrateLegacyRecords(normalizeDatabase(stored || getDefaultDatabase()));
  saveDatabase(db);
  return db;
}

function saveDatabase(db) {
  localStorage.setItem(databaseKey, JSON.stringify(normalizeDatabase(db)));
}

function getOrCreateResponsavel(db, name) {
  const cleanName = name.trim();
  const existing = db.Responsavel.find((item) => item.Nome.toLowerCase() === cleanName.toLowerCase());
  if (existing) return existing;

  const responsible = {
    ID_Responsavel: makeId("RESP"),
    Nome: cleanName
  };
  db.Responsavel.push(responsible);
  return responsible;
}

function getFuncionarioByName(db, name) {
  return db.Funcionario.find((item) => item.Nome === name);
}

function getFormularioDetails(db, formularioId) {
  const formulario = db.Formulario.find((item) => item.ID_Formulario === formularioId);
  if (!formulario) return null;

  const responsavel = db.Responsavel.find((item) => item.ID_Responsavel === formulario.ID_Responsavel);
  const presencas = db.Registro_Presenca.filter((item) => item.ID_Formulario === formularioId);
  const funcionarios = presencas
    .map((presenca) => db.Funcionario.find((employee) => employee.ID_Funcionario === presenca.ID_Funcionario))
    .filter(Boolean);

  return { formulario, responsavel, presencas, funcionarios };
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function createButton(className, text, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function getResponsibleName() {
  return document.querySelector("#responsible-name").value.trim();
}

function updateResponsibleValidation(showMessage = false) {
  const input = document.querySelector("#responsible-name");
  const error = document.querySelector("#responsible-error");
  const hasName = Boolean(getResponsibleName());
  error.classList.toggle("visible", showMessage && !hasName);
  input.classList.toggle("invalid", showMessage && !hasName);
  return hasName;
}

function renderWorks() {
  const list = document.querySelector("#works-list");
  list.innerHTML = "";
  works.forEach((work) => {
    list.appendChild(createButton("option-button", work, () => {
      if (!updateResponsibleValidation(true)) return;

      state.responsibleName = getResponsibleName();
      state.work = work;
      state.selectedEmployees = [];
      document.querySelector("#selected-work-label").textContent = work;
      renderEmployees("#employees-list", state.selectedEmployees, updateNextButton);
      updateNextButton();
      showScreen("employees");
    }));
  });
}

function renderEmployees(containerSelector, selectedEmployees, onChange) {
  const list = document.querySelector(containerSelector);
  list.innerHTML = "";
  employeeSeed.forEach((employee) => {
    const label = document.createElement("label");
    label.className = "employee-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = employee;
    checkbox.checked = selectedEmployees.includes(employee);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked && !selectedEmployees.includes(employee)) {
        selectedEmployees.push(employee);
      }
      if (!checkbox.checked) {
        const index = selectedEmployees.indexOf(employee);
        if (index >= 0) selectedEmployees.splice(index, 1);
      }
      label.classList.toggle("selected", checkbox.checked);
      onChange?.();
    });

    const box = document.createElement("span");
    box.className = "custom-checkbox";
    box.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "employee-name";
    name.textContent = employee;

    label.classList.toggle("selected", checkbox.checked);
    label.append(checkbox, box, name);
    list.appendChild(label);
  });
}

function updateNextButton() {
  const total = state.selectedEmployees.length;
  const button = document.querySelector("#next-button");
  button.disabled = total === 0;
  button.textContent = total ? `Próximo (${total})` : "Próximo";
}

function goToConfirmation() {
  state.responsibleName = getResponsibleName();
  state.createdAt = new Date();
  updateSummary();
  showScreen("confirm");
}

function updateSummary() {
  document.querySelector("#summary-responsible").textContent = state.responsibleName;
  document.querySelector("#summary-work").textContent = state.work;
  document.querySelector("#summary-employees").textContent = state.selectedEmployees.join(", ");
  document.querySelector("#summary-date").textContent = formatters.date.format(state.createdAt);
  document.querySelector("#summary-time").textContent = formatters.time.format(state.createdAt);
}

function updateReceipt() {
  const db = getDatabase();
  const details = getFormularioDetails(db, state.lastFormularioId);
  if (!details) return;

  document.querySelector("#receipt-form-id").textContent = details.formulario.ID_Formulario;
  document.querySelector("#receipt-responsible").textContent = details.responsavel?.Nome || "-";
  document.querySelector("#receipt-work").textContent = details.formulario.Obra;
  document.querySelector("#receipt-count").textContent = `${details.presencas.length} presença(s)`;
  document.querySelector("#receipt-date").textContent = details.formulario.Data;
  document.querySelector("#receipt-time").textContent = details.formulario.Hora;
}

function createFormulario() {
  const db = getDatabase();
  const responsible = getOrCreateResponsavel(db, state.responsibleName);
  const formularioId = makeId("FORM");

  db.Formulario.push({
    ID_Formulario: formularioId,
    Data: formatters.date.format(state.createdAt),
    Hora: formatters.time.format(state.createdAt),
    Obra: state.work,
    ID_Responsavel: responsible.ID_Responsavel
  });

  state.selectedEmployees.forEach((employeeName) => {
    const funcionario = getFuncionarioByName(db, employeeName);
    if (!funcionario) return;
    db.Registro_Presenca.push({
      ID_RegistroPonto: makeId("PONTO"),
      ID_Formulario: formularioId,
      ID_Funcionario: funcionario.ID_Funcionario
    });
  });

  state.lastFormularioId = formularioId;
  saveDatabase(db);
  updateReceipt();
  renderSavedRecords();
  showScreen("result");
}

function buildExportDatabase() {
  return getDatabase();
}

function downloadDatabaseFile(db) {
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ponto-jlc-base-dados-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return new File([blob], link.download, { type: "application/json" });
}

async function shareRecord() {
  const db = buildExportDatabase();
  const file = downloadDatabaseFile(db);
  const text = "Ponto JLC - base de dados exportada em JSON relacional.";

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: "Ponto JLC", text, files: [file] });
    return;
  }

  if (navigator.share) {
    await navigator.share({ title: "Ponto JLC", text });
  }
}

function resetFlow() {
  state.work = "";
  state.selectedEmployees = [];
  state.createdAt = null;
  state.lastFormularioId = "";
  showScreen("works");
}

function toInputDate(displayDate) {
  const [day, month, year] = displayDate.split("/");
  return `${year}-${month}-${day}`;
}

function toDisplayDate(inputDate) {
  const [year, month, day] = inputDate.split("-");
  return `${day}/${month}/${year}`;
}

function renderSelect(select, values, selectedValue) {
  select.innerHTML = "";
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selectedValue;
    select.appendChild(option);
  });
}

function renderSavedRecords() {
  const db = getDatabase();
  const list = document.querySelector("#saved-list");
  const formularios = db.Formulario.slice().reverse();
  list.innerHTML = "";

  if (!formularios.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Nenhum formulário salvo até o momento.";
    list.appendChild(empty);
    return;
  }

  formularios.forEach((formulario) => {
    const details = getFormularioDetails(db, formulario.ID_Formulario);
    if (!details) return;

    const item = document.createElement("article");
    item.className = "saved-item saved-form";

    const button = document.createElement("button");
    button.className = "saved-summary";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    button.innerHTML = `
      <strong>${formulario.Obra}</strong>
      <span>${formulario.Data} às ${formulario.Hora}</span>
      <span>Responsável: ${details.responsavel?.Nome || "-"}</span>
      <span>${details.presencas.length} presença(s)</span>
    `;

    const detailsBox = document.createElement("div");
    detailsBox.className = "saved-details";
    detailsBox.hidden = true;
    detailsBox.innerHTML = `
      <p>ID Formulário: ${formulario.ID_Formulario}</p>
      <p>Colaboradores: ${details.funcionarios.map((employee) => employee.Nome).join(", ")}</p>
    `;

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      detailsBox.hidden = expanded;
    });

    const editButton = createButton("edit-button", "Editar", () => openEdit(formulario.ID_Formulario));
    item.append(button, detailsBox, editButton);
    list.appendChild(item);
  });
}

function openEdit(formularioId) {
  const db = getDatabase();
  const details = getFormularioDetails(db, formularioId);
  if (!details) return;

  state.editingFormularioId = formularioId;
  document.querySelector("#edit-responsible").value = details.responsavel?.Nome || "";
  renderSelect(document.querySelector("#edit-work"), works, details.formulario.Obra);
  document.querySelector("#edit-date").value = toInputDate(details.formulario.Data);
  document.querySelector("#edit-time").value = details.formulario.Hora;
  const selected = details.funcionarios.map((employee) => employee.Nome);
  renderEmployees("#edit-employees-list", selected, null);
  document.querySelector("#edit-employees-list").dataset.selected = JSON.stringify(selected);
  showScreen("edit");
}

function getEditSelectedEmployees() {
  return Array.from(document.querySelectorAll("#edit-employees-list input:checked")).map((input) => input.value);
}

function saveEdit(event) {
  event.preventDefault();
  const db = getDatabase();
  const details = getFormularioDetails(db, state.editingFormularioId);
  if (!details) return;

  const responsible = getOrCreateResponsavel(db, document.querySelector("#edit-responsible").value);
  const date = document.querySelector("#edit-date").value;
  const time = document.querySelector("#edit-time").value;

  details.formulario.ID_Responsavel = responsible.ID_Responsavel;
  details.formulario.Obra = document.querySelector("#edit-work").value;
  details.formulario.Data = date ? toDisplayDate(date) : details.formulario.Data;
  details.formulario.Hora = time || details.formulario.Hora;

  db.Registro_Presenca = db.Registro_Presenca.filter((item) => item.ID_Formulario !== details.formulario.ID_Formulario);
  getEditSelectedEmployees().forEach((employeeName) => {
    const employee = getFuncionarioByName(db, employeeName);
    if (!employee) return;
    db.Registro_Presenca.push({
      ID_RegistroPonto: makeId("PONTO"),
      ID_Formulario: details.formulario.ID_Formulario,
      ID_Funcionario: employee.ID_Funcionario
    });
  });

  saveDatabase(db);
  renderSavedRecords();
  showScreen("saved");
}

document.querySelectorAll("[data-back]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.back));
});

document.querySelector("#responsible-name").addEventListener("input", () => updateResponsibleValidation(false));
document.querySelector("#next-button").addEventListener("click", goToConfirmation);
document.querySelector("#confirm-button").addEventListener("click", createFormulario);
document.querySelector("#new-button").addEventListener("click", resetFlow);
document.querySelector("#share-button").addEventListener("click", shareRecord);
document.querySelector("#saved-button").addEventListener("click", () => {
  renderSavedRecords();
  showScreen("saved");
});
document.querySelector("#edit-form").addEventListener("submit", saveEdit);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js");
  });
}

renderWorks();
renderEmployees("#employees-list", state.selectedEmployees, updateNextButton);
renderSavedRecords();

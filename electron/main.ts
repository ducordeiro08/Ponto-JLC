import { app, BrowserWindow, ipcMain } from "electron";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { channels } from "../shared/channels.js";
import type { TothDatabase } from "./database.js";
import type { TothService } from "./services/tothService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let database: TothDatabase;
let service: TothService;
let mainWindow: BrowserWindow | null = null;

function log(message: string) {
  appendFileSync(path.join(app.getPath("userData"), "main.log"), `${new Date().toISOString()} ${message}\n`);
}

function registerIpc() {
  ipcMain.handle(channels.listWorksites, () => service.listWorksites());
  ipcMain.handle(channels.createSession, (_event, cpf: string, worksiteId: string) => service.createSession(cpf, worksiteId));
  ipcMain.handle(channels.createTimeEntry, (_event, allowDuplicate: boolean) => service.createTimeEntry(Boolean(allowDuplicate)));
  ipcMain.handle(channels.listForms, () => service.listForms());
  ipcMain.handle(channels.listWorksiteEmployees, () => service.listWorksiteEmployees());
  ipcMain.handle(channels.createPresenceRecord, (_event, input) => service.createPresenceRecord(input));
  ipcMain.handle(channels.listPresenceRecords, () => service.listPresenceRecords());
  ipcMain.handle(channels.getPresenceRecord, (_event, recordId: string) => service.getPresenceRecord(recordId));
  ipcMain.handle(channels.updatePresenceRecord, (_event, input) => service.updatePresenceRecord(input));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 470, height: 820, minWidth: 390, minHeight: 650, backgroundColor: "#12076B", autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log(`Renderer console [${level}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on("did-fail-load", (_event, code, description, url) => {
    log(`Renderer falhou ao carregar: ${code} ${description} ${url}`);
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    log(`Renderer encerrado: ${details.reason} (${details.exitCode})`);
  });
  if (process.env.VITE_DEV_SERVER_URL) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
}

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

app.on("second-instance", () => {
  if (!mainWindow) {
    void createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  try {
    log("Inicialização iniciada.");
    const [{ TothDatabase }, { TothService }] = await Promise.all([
      import("./database.js"),
      import("./services/tothService.js"),
    ]);
    database = new TothDatabase(path.join(app.getPath("userData"), "toth.sqlite"));
    service = new TothService(database);
    registerIpc();
    await createWindow();
    log("Janela criada.");
    app.on("activate", () => { if (!mainWindow) void createWindow(); });
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
    log(`Falha na inicialização: ${message}`);
    const { dialog } = await import("electron");
    dialog.showErrorBox("Não foi possível abrir o TOTH", message);
    app.quit();
  }
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => database.close());

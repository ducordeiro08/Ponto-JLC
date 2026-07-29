import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { TothDatabase } from "../database";
import { TothService } from "./tothService";

describe("TothService", () => {
  let database: TothDatabase;
  let service: TothService;
  let appData: string;
  const originalAppData = process.env.APPDATA;
  const originalApiUrl = process.env.TOTH_API_URL;

  beforeEach(() => {
    appData = mkdtempSync(path.join(os.tmpdir(), "toth-service-test-"));
    process.env.APPDATA = appData;
    delete process.env.TOTH_API_URL;
    database = new TothDatabase(":memory:");
    service = new TothService(database);
  });

  afterEach(() => {
    database.close();
    rmSync(appData, { recursive: true, force: true });
    if (originalAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = originalAppData;
    if (originalApiUrl === undefined) delete process.env.TOTH_API_URL;
    else process.env.TOTH_API_URL = originalApiUrl;
  });

  it("protege operacoes que exigem sessao ativa", async () => {
    await expect(service.listForms()).rejects.toThrow("Sess");
    await expect(service.createTimeEntry()).rejects.toThrow("Sess");
  });

  it("usa exclusivamente o funcionario e a obra da sessao ativa", async () => {
    await service.createSession("12345678909", "worksite-butanta");
    expect((await service.createTimeEntry()).kind).toBe("created");
    expect(await service.listForms()).toHaveLength(1);
  });
});

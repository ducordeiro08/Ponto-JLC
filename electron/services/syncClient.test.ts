import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TothSyncClient } from "./syncClient";

describe("TothSyncClient", () => {
  const originalAppData = process.env.APPDATA;
  const originalApiUrl = process.env.TOTH_API_URL;
  const tempDirs: string[] = [];

  afterEach(() => {
    if (originalAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = originalAppData;
    if (originalApiUrl === undefined) delete process.env.TOTH_API_URL;
    else process.env.TOTH_API_URL = originalApiUrl;

    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aceita config.json UTF-8 com BOM", () => {
    const appData = mkdtempSync(path.join(os.tmpdir(), "toth-sync-client-"));
    tempDirs.push(appData);
    delete process.env.TOTH_API_URL;
    process.env.APPDATA = appData;

    const configDir = path.join(appData, "TOTH");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(path.join(configDir, "config.json"), `\uFEFF${JSON.stringify({ apiUrl: "http://127.0.0.1:3333/" })}`, "utf8");

    expect(new TothSyncClient().enabled).toBe(true);
  });
});

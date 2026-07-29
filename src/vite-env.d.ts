/// <reference types="vite/client" />

import type { TothApi } from "../shared/types";

declare global {
  interface Window { toth: TothApi; }
}

export {};

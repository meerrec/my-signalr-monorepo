/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIGNALR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HINDCAST_KEY?: string;
  readonly VITE_HINDCAST_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

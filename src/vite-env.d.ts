/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend address for production builds, e.g. https://cybermate-api.azurewebsites.net */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

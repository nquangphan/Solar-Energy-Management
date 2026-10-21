// Build-time variables the web reads (Vite `import.meta.env`). Only VITE_* reach the bundle.
interface ImportMetaEnv {
  /** Backend base URL: `/api` (dev proxy, default) or the backend's full URL in production. */
  readonly VITE_API_BASE_URL?: string;
}

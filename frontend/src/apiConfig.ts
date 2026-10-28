/**
 * Global API Base URL Configuration
 * Reads from VITE_API_URL environment variable in production (e.g. Render backend URL)
 * Defaults to http://127.0.0.1:8000 in local development
 */
export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000"
).replace(/\/$/, "");


/**
 * Config for csv-uploader. Override via .env (VITE_API_URL).
 */
const apiUrl =
  typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL != null
    ? import.meta.env.VITE_API_URL
    : "http://localhost:3000";

export const config = { apiUrl } as const;

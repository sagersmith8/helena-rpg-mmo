/**
 * App config. Override via environment variables (e.g. .env or EAS env).
 * - EXPO_PUBLIC_API_URL: backend API base URL (PostgREST / Supabase REST)
 * - EXPO_PUBLIC_IMAGE_HOST: base URL for static assets (icons, images)
 */
const getEnv = (key: string, fallback: string): string => {
  const value = typeof process !== "undefined" && process.env?.[key];
  return (value != null && value !== "") ? value : fallback;
};

export const config = {
  apiUrl: getEnv("EXPO_PUBLIC_API_URL", "http://localhost:3000"),
  imageHost: getEnv("EXPO_PUBLIC_IMAGE_HOST", "http://localhost:3001/"),
} as const;

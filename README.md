# Helena RPG MMO

Expo/React Native location-based RPG with a PostgREST backend.

## Structure

- **Root** – Mobile app (Expo), shared `api/` (OpenAPI-generated client), `config.ts`, `apiClient.ts`
- **csv-uploader/** – Vite + React admin tool for uploading CSV data to the API
- **Backend** – Postgres + PostgREST via `docker-compose.yml` (no custom server)

## Config

API and asset URLs are driven by environment variables so you can point at local Docker or Supabase without code changes.

### Mobile app (Expo)

Copy `.env.example` to `.env.local` and set:

- `EXPO_PUBLIC_API_URL` – Backend base URL (e.g. `http://localhost:3000` or Supabase REST URL). No trailing slash.
- `EXPO_PUBLIC_IMAGE_HOST` – Asset base URL with trailing slash (e.g. `http://localhost:3001/` or Supabase Storage URL).

### csv-uploader (Vite)

Copy `csv-uploader/.env.example` to `csv-uploader/.env` and set:

- `VITE_API_URL` – Same as above. No trailing slash.

## Run backend

```bash
docker compose up -d
```

PostgREST on port 3000, Postgres on 5432, nginx (static assets) on 3001.

## Regenerate API types

With the backend running:

```bash
npm run gen-types
```

For csv-uploader: `cd csv-uploader && npm run gen-types`.

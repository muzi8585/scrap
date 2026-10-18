# Scrap Business Manager (MongoDB + React)

Laravel is gone. The API is now Node (Express + MongoDB) and lives inside the `frontend` folder, so the whole app is one project that runs locally and deploys to Vercel.

```
frontend/
  src/            React + TypeScript screens (unchanged)
  server/         API: routes, MongoDB access, money maths, Excel and PDF export
  api/index.ts    Vercel serverless entry (wraps server/app.ts)
  vercel.json     routes /api/* to the function
  .env.example    settings to copy into .env
```

## Run on your computer (data saved on your drive)

1. Install MongoDB Community Server (https://www.mongodb.com/try/download/community) and let it run as a service. It stores the data on your drive (its `dbPath`, for example `C:\Program Files\MongoDB\Server\<version>\data` on Windows).
2. In `frontend`:

```bash
cp .env.example .env
npm install
npm run dev
```

3. Open the address Vite prints. The API runs on `http://127.0.0.1:8000`, and Vite forwards `/api` to it.

First login: `admin@example.com` / `password` (created automatically when the users collection is empty; change `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` before the first run to use your own). Collections and indexes are created automatically.

Backup: `mongodump --db scrap-erp --out backup` and restore with `mongorestore backup`.

## Deploy on Vercel

Vercel cannot reach MongoDB running on your computer, so the deployed app needs a hosted database. MongoDB Atlas has a free tier.

1. Create an Atlas cluster, add a database user, and under Network Access allow `0.0.0.0/0` (Vercel has no fixed IPs).
2. Move your local data across: `mongodump --db scrap-erp --out backup` then `mongorestore --uri "<atlas-uri>" --nsFrom "scrap-erp.*" --nsTo "scrap-erp.*" backup`.
3. Push `frontend` to Git and import it in Vercel. If the repo root is `scrap-erp`, set Root Directory to `frontend`.
4. Add these environment variables in Vercel: `MONGODB_URI` (the Atlas string), `MONGODB_DB=scrap-erp`, `JWT_SECRET` (long random text), and optionally `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_NAME`.
5. Deploy. Open `https://your-app.vercel.app/api/health`; it should answer `{"ok":true}` once the database connection works.

## How the money maths works

- A stock entry stores `amount = kg x rate`, so a later rate change never alters old records.
- Party balance = sold pending - bought pending - payments received + payments paid.
- Positive balance: the party owes you. Negative: you owe the party.
- Debit = party owes you more. Credit = you owe the party more.

## Data layout

Collections: `users`, `parties`, `vehicles`, `rates`, `stock_entries`, `payments`, `expenses`, `counters`. Ids stay simple numbers (a counter per collection), dates are stored as `YYYY-MM-DD`, so the React code needed no changes.

## API routes (all need the login token except `login`)

| Module | Routes |
| --- | --- |
| Auth | `POST /api/login`, `POST /api/logout` |
| Dashboard | `GET /api/dashboard?from=&to=` |
| Rates | `GET /api/rates`, `GET /api/rates/current`, `POST /api/rates`, `DELETE /api/rates/{id}` |
| Parties | `GET/POST /api/parties`, `PUT/DELETE /api/parties/{id}`, `GET /api/parties/{id}/statement`, `GET /api/parties/{id}/statement-pdf` |
| Vehicles | `GET/POST /api/vehicles`, `DELETE /api/vehicles/{id}` |
| Stock | `GET/POST /api/stock`, `PUT/DELETE /api/stock/{id}` (filters: type, party_id, from, to) |
| Payments | `GET/POST /api/payments`, `DELETE /api/payments/{id}` |
| Expenses | `GET/POST /api/expenses`, `DELETE /api/expenses/{id}` |
| Excel | `GET /api/export/{stock\|payments\|expenses\|parties}` |
| Health | `GET /api/health` |

## Redux (frontend state)

The React app uses Redux Toolkit. Files are in `frontend/src/store`:

| File | What it holds |
| --- | --- |
| `index.ts` | `configureStore`, plus the `RootState` and `AppDispatch` types |
| `hooks.ts` | typed `useAppDispatch` and `useAppSelector` |
| `authSlice.ts` | login / logout thunks, `loggedIn`, `loading`, `error` |
| `uiSlice.ts` | active tab and the open party statement |
| `resourcesSlice.ts` | one cached entry per API path (`/parties`, `/stock`, ...) |

`useFetch(path)` keeps the same `{ data, error, reload }` shape, so screens read from the store without other changes. After `npm install`, the Redux DevTools browser extension shows every action.

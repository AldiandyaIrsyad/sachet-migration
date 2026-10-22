# Sachet Migration

Scan a sachet product and see a cheaper, lower-plastic swap. Log what you bought and see the money saved and plastic avoided add up.

- Every pack is compared **per serving**: rupiah per cup, grams of plastic per cup.
- Swaps that need extras (sugar and creamer to match a 3-in-1) include them in the price.
- Each swap shows how much of the pack you could waste and still come out cheaper.
- Practical rule, no app needed: **skip the bulk-sachet bag.** It costs about the same per serving and adds more plastic.

## Architecture

```
browser (Vite + TypeScript, thin client)  ──/api──▶  Go server  ──▶  SQLite (per-visitor switches)
        ZXing barcode scanning                        catalogue, search, swap maths
```

- **Go server** (`server/`): owns the catalogue, search, barcode lookup, the per-serving and swap maths, and each visitor's saved switches. Plain `net/http`, SQLite through a pure-Go driver (no cgo), anonymous visitors identified by an `HttpOnly` session cookie (only its hash is stored).
- **Frontend** (`src/`): renders what the API returns and does the camera scanning. It only talks to the `Backend` interface in `src/ports.ts`.
- **Demo** (`src/demo/`): the same `Backend` implemented in the browser, so the GitHub Pages site works with no server. It is a separate chunk that only the demo build loads.

| Mode | Build | Backend | Switches saved in | Extras |
|---|---|---|---|---|
| `app` (default) | `npm run build` / Docker image | Go server via `/api` | server database | none |
| `demo` | `npm run build:demo` | in the browser | this browser's localStorage | demo notice, skippable guide, "try an example" |

`src/compose.ts` is the one place that picks the mode. The Go server and `src/demo/` implement the same maths twice; the tests on both sides use the same worked examples to keep them in step.

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:8080 (set `SACHET_PORT` to use another host port). The database lives in the `sachet-data` volume, so switches survive restarts and rebuilds. The image is one small distroless container holding the server and the built frontend.

| Variable | Default (in the image) | Meaning |
|---|---|---|
| `PORT` | `8080` | Listen port |
| `DB_PATH` | `/data/sachet.db` | SQLite file |
| `DATA_DIR` | `/app/data` | Folder holding `products.json` |
| `STATIC_DIR` | `/app/web` | Built frontend; the server serves only the API if it is missing |

## Develop

Backend (needs Go 1.26+):

```bash
cd server
DATA_DIR=../public/data go run ./cmd/sachet     # API on :8080
go test ./...
```

Frontend, in another terminal (Vite proxies `/api` to the server):

```bash
npm install
npm run dev          # real app, needs the server above
npm run dev:demo     # demo, no server needed
npm test             # frontend tests (the demo engine)
```

### API

| Endpoint | Purpose |
|---|---|
| `GET /api/products?q=&category=&limit=&lang=` | Browse and search listed products |
| `GET /api/products/{id}/page?swaps=` | Everything the product screen shows: swaps with comparisons, warnings, your status |
| `GET /api/barcode/{code}` | Look up a scanned or typed barcode |
| `GET /api/compare?base=&to=&packs=` | What a switch saves |
| `GET /api/migrations` | My switches and their totals |
| `POST /api/migrations`, `POST /api/migrations/{base}/switch`, `POST /api/migrations/{base}/again`, `DELETE /api/migrations/{base}` | Change my switches |
| `POST /api/wants` | Ask for a bigger pack |
| `GET /healthz` | Liveness |

## Data

Products live in `public/data/products.json`; the Go server loads them at start-up and the demo fetches them as a static file. Each row needs a price, the portions per pack, and the grams of plastic (see `src/data.ts` for the fields). The server refuses to start on duplicate ids or barcodes, unknown categories and bad numbers, and `npm run build` runs `npm run check:data` to catch the same mistakes earlier.

Prices and packaging weights are **estimates** unless noted; barcodes starting `8990000` are placeholders. Replace them with real shelf prices, real barcodes, and weighed packaging.

## Deploy

- **Real app:** build the image (`docker build -t sachet-migration .`) and run it anywhere Docker runs, with a volume on `/data`. Put it behind HTTPS (the session cookie turns on `Secure` when `X-Forwarded-Proto: https` is set by your proxy).
- **Demo:** push to `main`. In the repo set **Settings → Pages → Source: GitHub Actions**; `.github/workflows/deploy.yml` builds the demo (`npm run build:demo`) and publishes it. `ci.yml` runs the tests and builds the image on every push and pull request.

## Layout

- `server/cmd/sachet`: entry point (config from environment, graceful shutdown, `healthcheck` subcommand for Docker).
- `server/internal/catalog`: loading, validation, derived numbers, barcode lookup, ranked search.
- `server/internal/calc`: per-serving cost, plastic and swap maths.
- `server/internal/store`: the `Store` interface and its SQLite implementation (another database could sit behind the same interface).
- `server/internal/api`: HTTP handlers.
- `src/ports.ts`, `src/backend.ts`, `src/compose.ts`: the `Backend` interface and where it is chosen. `src/adapters/api-backend.ts` is the server client.
- `src/views/`: one file per screen (home, products, product, savings, why). `src/lookup.ts`: camera, photo, typed barcode and quick search.
- `src/demo/`: the in-browser backend, its guide and its tests' subject.

## Later

- Plastic-free refill stations ("refill at X near you").
- Crowdsourced prices and unknown barcodes.
- Accounts, so switches follow a person across devices.

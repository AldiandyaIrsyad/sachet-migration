# Sachet Migration: one image holding the Go API and the built frontend.
#   docker build -t sachet-migration .
#   docker run -p 8080:8080 -e DATABASE_URL=postgres://... sachet-migration
# (docker compose up starts PostgreSQL alongside it.)

# 1. Frontend (the real app mode: it talks to the Go server).
FROM node:22-alpine AS web
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run build

# 2. Go server, statically linked (the SQLite driver is pure Go, so no cgo).
FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/sachet ./cmd/sachet

# 3. Runtime.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=server /out/sachet /app/sachet
COPY --from=web /web/dist /app/web
# Only the real catalogue: the demo-only products stay on GitHub Pages.
COPY public/data/products.json /app/data/products.json

ENV PORT=8080 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/web
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["/app/sachet", "healthcheck"]
ENTRYPOINT ["/app/sachet"]

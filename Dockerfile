# Sachet Migration: one image holding the Go API and the built frontend.
#   docker build -t sachet-migration .
#   docker run -p 8080:8080 -v sachet-data:/data sachet-migration

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
# The final image has no shell, so make the (empty) data directory here and hand it to the nonroot user.
RUN mkdir /out/data && chown 65532:65532 /out/data

# 3. Runtime.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=server /out/sachet /app/sachet
COPY --from=web /web/dist /app/web
# Only the real catalogue: the demo-only products stay on GitHub Pages.
COPY public/data/products.json /app/data/products.json
COPY --from=server --chown=65532:65532 /out/data /data

ENV PORT=8080 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/web \
    DB_PATH=/data/sachet.db
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD ["/app/sachet", "healthcheck"]
ENTRYPOINT ["/app/sachet"]

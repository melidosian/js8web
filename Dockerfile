# ---- Build stage ----
FROM golang:1.25-bookworm AS builder

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -o /js8web .

# ---- Runtime stage ----
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /js8web /usr/local/bin/js8web

# Default database path inside the volume
ENV JS8WEB_DB_PATH=/data/js8web.db

# Database volume
VOLUME /data

EXPOSE 8080

ENTRYPOINT ["js8web"]

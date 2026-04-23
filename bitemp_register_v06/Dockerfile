# Frontend build stage
FROM node:22-alpine AS frontend-builder

WORKDIR /app/web/vite

# Install frontend dependencies first for better layer caching
COPY web/vite/package.json web/vite/package-lock.json ./
RUN npm ci

# Copy de frontend source. De UML-editor module zit nu binnen web/vite/src/umleditor
# en wordt dus automatisch meegenomen.
COPY web/vite/ ./
RUN npm run build

# Go build stage
FROM golang:1.25-alpine AS go-builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Replace the checked-in React build with the fresh container build output
COPY --from=frontend-builder /app/web/react ./web/react

ARG COMMIT=dev
ARG BUILD_TIME=dev

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags "-X 'main.commit=${COMMIT}' -X 'main.buildTime=${BUILD_TIME}'" -o /out/bitemp-go-api .

# Runtime stage
FROM alpine:3.21

RUN apk --no-cache add ca-certificates

WORKDIR /root/

COPY --from=go-builder /out/bitemp-go-api ./bitemp-go-api

# Only copy runtime web assets served under /viz
COPY --from=go-builder /app/web/index.html ./web/index.html
COPY --from=go-builder /app/web/index_oud.html ./web/index_oud.html
COPY --from=go-builder /app/web/index_schema.html ./web/index_schema.html
COPY --from=go-builder /app/web/root_index.html ./web/root_index.html
COPY --from=go-builder /app/web/tijdlijn.html ./web/tijdlijn.html
COPY --from=go-builder /app/web/tijdlijn_oud.html ./web/tijdlijn_oud.html
COPY --from=go-builder /app/web/tijdlijn_schema.html ./web/tijdlijn_schema.html
COPY --from=go-builder /app/web/shared ./web/shared
COPY --from=go-builder /app/web/react ./web/react

EXPOSE 8080

CMD ["./bitemp-go-api"]

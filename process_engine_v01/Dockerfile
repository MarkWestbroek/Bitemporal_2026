# Multi-stage build voor de Process Engine Go-binary.
FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.mod ./
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -o /out/process-engine ./cmd/process-engine

FROM alpine:3.20
RUN adduser -D -u 10001 engine
WORKDIR /app
COPY --from=builder /out/process-engine /app/process-engine
COPY config /app/config
USER engine
ENV PROCESS_ENGINE_ADDR=:8090
ENV PROCESS_ENGINE_CONFIG=/app/config/registers.yaml
EXPOSE 8090
ENTRYPOINT ["/app/process-engine"]

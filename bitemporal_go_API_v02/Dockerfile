# Build stage
FROM golang:1.24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build metadata (commit/time) - set via build args and embedded into binary
ARG COMMIT=dev
ARG BUILD_TIME=dev

# Build the application with ldflags to embed metadata
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags "-X 'main.commit=${COMMIT}' -X 'main.buildTime=${BUILD_TIME}'" -o bitemp-go-api .

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates

# Set working directory
WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/bitemp-go-api .

# Expose port 8080 (default Gin port)
EXPOSE 8080

# Run the application
CMD ["./bitemp-go-api"]

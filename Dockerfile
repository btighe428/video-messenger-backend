# Build stage for mediasoup native compilation
FROM node:20-slim AS builder

# Install build dependencies for mediasoup
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including mediasoup native build)
RUN npm ci --only=production

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy built node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY . .

# Expose HTTP and UDP ports
EXPOSE 3000
EXPOSE 10000-10100/udp

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]

# Simple Node.js Dockerfile for LiveKit-based video messaging
# No native compilation required - LiveKit SDK is pure JavaScript

FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no native builds needed)
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose HTTP port only (LiveKit handles media via cloud)
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]

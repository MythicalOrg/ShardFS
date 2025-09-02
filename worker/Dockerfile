# Dockerfile.worker
FROM node:20-alpine

# Set working dir
WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Build TypeScript → JavaScript
RUN npm install -g typescript && npm run build

# Default exposed port (can override)
EXPOSE 8000

# Entry: let user pass CLI args (port + master URL)
ENTRYPOINT ["node", "dist/index.js"]
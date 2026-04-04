FROM node:20-alpine

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Create data directories
RUN mkdir -p /data/evidence /data/uploads

# Expose port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PORT=3000

# Start the server
CMD ["node", "server.js"]

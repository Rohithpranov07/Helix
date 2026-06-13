# Shadow twin base image — ShopLite (Next.js dev server).
# Production note: swap CMD for "npm run build && npm run start" for a prod shadow.
#
# Usage (via shadow/docker-compose.yml):
#   docker compose -f shadow/docker-compose.yml up -d --build
#
# The shadow/workspace/apps/target/src/ directory is volume-mounted over /app/src/
# so applyToShadow() patch writes are visible to Next.js hot-reload immediately.
FROM node:20-alpine
WORKDIR /app

# Install dependencies first (cached layer — only re-runs when package.json changes).
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy full source (overridden at runtime by volume mount for shadow patches).
COPY . .

EXPOSE 3001

# Force file-watching to poll inside Docker volumes (avoids inotify issues).
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "run", "dev"]

# The LiveFit server as a container. Most hosts (Railway, Render, Fly.io…) build
# this automatically when the service's root folder is `server/`.
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first, so they're cached between builds when only code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src

# Run as the unprivileged user the Node image provides, not root.
USER node

# Hosts set PORT; 4000 is the default for running the image yourself.
EXPOSE 4000
# Apply any new database migrations, then start. `exec` makes Node the main
# process, so it gets the host's stop signal and can shut down cleanly.
CMD ["sh", "-c", "node --import tsx src/db/migrate.ts && exec node --import tsx src/index.ts"]

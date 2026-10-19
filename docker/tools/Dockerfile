FROM node:22-alpine
WORKDIR /app
RUN npm install pg@8.13.1 --no-audit --no-fund
COPY db ./db
COPY scripts ./scripts
COPY seed ./seed
CMD ["node", "scripts/migrate.mjs"]

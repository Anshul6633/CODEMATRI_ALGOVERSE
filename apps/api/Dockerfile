FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace packages/shared
RUN npm run build --workspace apps/api

FROM cgr.dev/chainguard/node:latest
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
EXPOSE 8080
CMD ["/app/apps/api/dist/server.js"]

FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --ignore-scripts

FROM dependencies AS build
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api ./apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @base/api

FROM build AS tools
WORKDIR /app/apps/api
USER node
CMD ["../../node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --workspace=@base/api --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/src/server.js"]

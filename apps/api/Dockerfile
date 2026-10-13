FROM node:22-alpine AS base
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN npm install
COPY apps/api ./apps/api
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npm run build -w @base/api
EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate -w @base/api && npm run db:seed -w @base/api && npm run start -w @base/api"]

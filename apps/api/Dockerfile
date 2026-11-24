FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=optional
COPY apps/api apps/api
RUN rm -f apps/api/tsconfig.build.tsbuildinfo && npm --workspace apps/api run build

FROM node:22-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
RUN npm ci --include=optional && npx prisma generate --schema=apps/api/prisma/schema.prisma
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/docker-entrypoint.sh apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh
EXPOSE 4000
CMD ["sh", "apps/api/docker-entrypoint.sh"]

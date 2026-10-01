FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM dependencies AS api-build
COPY . .
RUN npm --workspace apps/api run prisma:generate
RUN npm --workspace apps/api run build

FROM dependencies AS web-build
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm --workspace apps/web run build

FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-build /app /app
EXPOSE 4000
CMD ["sh", "-c", "npm --workspace apps/api run prisma:deploy && node apps/api/dist/main.js"]

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-build /app /app
EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "start", "--", "-H", "0.0.0.0"]

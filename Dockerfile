FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install

FROM dependencies AS web-build
COPY . .
RUN npm --workspace apps/web run build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=web-build /app /app
EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "start", "--", "-H", "0.0.0.0"]

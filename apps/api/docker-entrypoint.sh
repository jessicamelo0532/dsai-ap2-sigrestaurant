#!/bin/sh
# Start da API em produção: migrações, seed idempotente e servidor.
# SPEC/2026-11-24-publicacao-da-api-na-render.md
# A Render executa o CMD do Dockerfile; não usar dockerCommand inline com &&.
set -e

npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm --workspace apps/api run prisma:seed
exec node apps/api/dist/main.js

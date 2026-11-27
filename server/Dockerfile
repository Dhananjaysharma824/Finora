FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S finora && adduser -S finora -G finora

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

USER finora
EXPOSE 4000

CMD ["node", "dist/server.js"]

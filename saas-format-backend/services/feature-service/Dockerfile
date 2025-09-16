FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

# Production image
FROM node:18-alpine AS production

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/dist ./dist/

RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3006

# Start the service
CMD ["node", "dist/index.js"]

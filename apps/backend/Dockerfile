FROM node:22-alpine AS deps
WORKDIR /workspace
COPY package*.json turbo.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install
FROM deps AS build
COPY . .
RUN npm run prisma:generate -w @education-erp/backend && npm run build -w @education-erp/backend
FROM node:22-alpine AS runtime
RUN apk add --no-cache font-dejavu
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/backend/dist ./dist
COPY --from=build /workspace/apps/backend/prisma ./prisma
COPY --from=build /workspace/apps/backend/package.json ./package.json
EXPOSE 4000
CMD ["node","dist/main.js"]

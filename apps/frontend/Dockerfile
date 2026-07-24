FROM node:22-alpine AS deps
WORKDIR /workspace
COPY package*.json turbo.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm install
FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @education-erp/frontend
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /workspace/apps/frontend/.next/standalone ./
COPY --from=build /workspace/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /workspace/apps/frontend/public ./apps/frontend/public
EXPOSE 3000
CMD ["node","apps/frontend/server.js"]

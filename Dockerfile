FROM node:22-bookworm-slim@sha256:a6385bc33f0f9d6a08482c87f52baee537a9184e2b47dea1ed97caac62f8960c
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY shared ./shared
COPY server ./server
COPY src ./src
COPY index.html tsconfig.json vite.config.ts ./
RUN npm run build
ENV NODE_ENV=production PORT=3188 CATAN_DATA=/data/rooms.json
EXPOSE 3188
CMD ["node", "--import", "tsx", "server/index.ts"]

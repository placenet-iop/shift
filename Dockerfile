FROM node:22-bullseye
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

RUN npx prisma generate
RUN npm run build
RUN npm prune --production

WORKDIR /app
EXPOSE 3000
ENV NODE_ENV=production
CMD ["sh", "-c", "node build"]

FROM node:22-slim

# Установка зависимостей
RUN apt-get update && apt-get install -y \
  postgresql-client \
  openssl \
  wget \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start:prod"]
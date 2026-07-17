FROM node:22-slim

# python3/make/g++ — fallback сборка native-модулей (bcrypt), если prebuild с GitHub недоступен
RUN apt-get update && apt-get install -y \
  postgresql-client \
  openssl \
  wget \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start:prod"]

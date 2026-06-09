FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY patches ./patches

# Install Python3 for fingerprint enrollment scripts
RUN apk add --no-cache python3 py3-pip tzdata && \
    cp /usr/share/zoneinfo/Asia/Manila /etc/localtime && \
    echo "Asia/Manila" > /etc/timezone

RUN npm install

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && { [ -f /app/uploads/.seeded_lock ] || { npx prisma db seed && touch /app/uploads/.seeded_lock; }; } && npm run start"]
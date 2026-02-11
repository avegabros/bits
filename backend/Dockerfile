FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Install Python3 for fingerprint enrollment scripts
RUN apk add --no-cache python3 py3-pip

RUN npm install

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD ["npm", "run", "dev"]
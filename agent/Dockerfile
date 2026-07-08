FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]

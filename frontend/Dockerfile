FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

# BACKEND_URL must be set at build time because Next.js bakes rewrites
# into the production build (.next/routes-manifest.json).
# Inside Docker, the backend is always reachable at http://backend:3001.
ENV BACKEND_URL=http://backend:3001

RUN npm run build

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "run", "start"]

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
COPY patches ./patches

# Install Python3 for fingerprint enrollment scripts and postgresql-client for migration check
RUN apk add --no-cache python3 py3-pip tzdata postgresql-client && \
    cp /usr/share/zoneinfo/Asia/Manila /etc/localtime && \
    echo "Asia/Manila" > /etc/timezone

RUN npm install

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3001

# On startup — 3-case migration strategy:
#   1. _prisma_migrations EXISTS  → DB already managed by Prisma → just deploy new migrations.
#   2. No tables at all           → Fresh database               → deploy all migrations normally.
#   3. Tables exist, no history   → Existing DB (P3005 case)     → baseline ALL migrations, then deploy.
#   After migration: seed once (guarded by .seeded_lock), then start server.
CMD ["sh", "-c", "\
  DB_HOST=$(echo $DATABASE_URL | sed 's|.*@\\([^:/]*\\)[:/].*|\\1|') && \
  DB_PORT=$(echo $DATABASE_URL | sed 's|.*:\\([0-9][0-9]*\\)/.*|\\1|') && \
  DB_NAME=$(echo $DATABASE_URL | sed 's|.*/\\([^?]*\\).*|\\1|') && \
  DB_USER=$(echo $DATABASE_URL | sed 's|.*://\\([^:]*\\):.*|\\1|') && \
  export PGPASSWORD=$(echo $DATABASE_URL | sed 's|.*://[^:]*:\\([^@]*\\)@.*|\\1|') && \
  \
  echo '[Prisma] Waiting for database to be ready...' && \
  RETRIES=30 && \
  until pg_isready -h $DB_HOST -p $DB_PORT -q; do \
    RETRIES=$((RETRIES - 1)) && \
    if [ $RETRIES -le 0 ]; then echo '[Prisma] ERROR: Database never became ready. Exiting.' && exit 1; fi && \
    echo \"[Prisma] Not ready — retrying in 2s ($RETRIES left)...\" && \
    sleep 2; \
  done && \
  echo '[Prisma] Database is ready.' && \
  \
  HAS_MIGRATIONS=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations';\" 2>/dev/null | tr -d '[:space:]' || echo '0') && \
  if [ \"$HAS_MIGRATIONS\" = \"1\" ]; then \
    echo '[Prisma] Migration history found — running migrate deploy...' && \
    npx prisma migrate deploy; \
  else \
    HAS_TABLES=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -tAc \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';\" 2>/dev/null | tr -d '[:space:]' || echo '0') && \
    if [ \"$HAS_TABLES\" = \"0\" ]; then \
      echo '[Prisma] Fresh database — running all migrations...' && \
      npx prisma migrate deploy; \
    else \
      echo '[Prisma] Existing DB without migration history (P3005) — baselining all migrations then deploying...' && \
      MIGRATIONS=$(ls /app/prisma/migrations | grep -v migration_lock.toml | sort) && \
      if [ -z \"$MIGRATIONS\" ]; then \
        echo '[Prisma] ERROR: No migration folders found. Cannot baseline.' && exit 1; \
      fi && \
      for M in $MIGRATIONS; do \
        echo \"[Prisma] Baselining migration: $M\" && \
        npx prisma migrate resolve --applied \"$M\"; \
      done && \
      npx prisma migrate deploy; \
    fi; \
  fi && \
  { [ -f /app/uploads/.seeded_lock ] || { npx prisma db seed && touch /app/uploads/.seeded_lock; }; } && \
  npm run start \
"]
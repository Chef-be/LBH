# ============================================================
# Plateforme LBH — Interface utilisateur Next.js
# ============================================================
# Stages :
#   developpement  → next dev (hot-reload, source montée en volume)
#   production     → next build + next start (image optimisée)
# ============================================================

# ------------------------------------------------------------
# Base commune
# ------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ------------------------------------------------------------
# Stage : developpement
# ------------------------------------------------------------
FROM base AS developpement
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------
# Stage : construction (intermédiaire pour la prod)
# ------------------------------------------------------------
FROM base AS construction
COPY . .
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ------------------------------------------------------------
# Stage : production
# ------------------------------------------------------------
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Conserver aussi les outils de vérification dans l'image finale pour permettre
# les contrôles build/lint depuis le conteneur déjà déployé.
COPY --from=base /app/node_modules ./node_modules
COPY --from=construction /app/package.json ./package.json
COPY --from=construction /app/package-lock.json ./package-lock.json
COPY --from=construction /app/next.config.ts ./next.config.ts
COPY --from=construction /app/postcss.config.js ./postcss.config.js
COPY --from=construction /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=construction /app/tsconfig.json ./tsconfig.json
COPY --from=construction /app/.eslintrc.json ./.eslintrc.json
COPY --from=construction /app/src ./src

# Copier ce qui est nécessaire à l'exécution
COPY --from=construction /app/public ./public
COPY --from=construction /app/.next/standalone ./
COPY --from=construction /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]

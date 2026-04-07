FROM node:20-slim

RUN npm install -g pnpm@10

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json ./

COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

COPY lib/db/src ./lib/db/src
COPY lib/db/tsconfig.json ./lib/db/
COPY lib/db/drizzle.config.ts ./lib/db/

COPY lib/api-zod/src ./lib/api-zod/src
COPY lib/api-zod/tsconfig.json ./lib/api-zod/

COPY lib/api-client-react/src ./lib/api-client-react/src
COPY lib/api-client-react/tsconfig.json ./lib/api-client-react/

COPY artifacts/api-server/src ./artifacts/api-server/src
COPY artifacts/api-server/tsconfig.json ./artifacts/api-server/
COPY artifacts/api-server/build.mjs ./artifacts/api-server/

RUN pnpm run typecheck:libs
RUN pnpm --filter @workspace/api-server run build

WORKDIR /app/artifacts/api-server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]

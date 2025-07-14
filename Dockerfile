FROM node:lts-alpine AS base

FROM base AS build

WORKDIR /usr/src/postfix-prefix

RUN apk add --no-cache curl libwebp libwebp-tools

COPY ./package*json ./

RUN npm install

COPY . .

ENV CWEBPTIMEOUT=360000

RUN npm run build && \
 npm install --production

FROM base AS deploy

# HEALTHCHECK  --timeout=3s \
#   CMD curl --fail http://localhost:8080/api/healthcheck || exit 1

WORKDIR /usr/src/postfix-prefix

COPY --from=build /usr/src/postfix-prefix /usr/src/postfix-prefix

RUN apk add --no-cache curl postfix

USER node

EXPOSE 8080

CMD [ "node", "--experimental-strip-types", "src/index.ts"]

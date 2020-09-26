FROM hayd/alpine-deno:1.4.2
RUN apk add --no-cache python py-pip git && \
  pip install awscli

WORKDIR /app

COPY deps.ts .
RUN deno cache deps.ts && \
  deno run -A deps.ts
COPY test_deps.ts .
RUN deno cache test_deps.ts

ADD . .

ENTRYPOINT [ "/app/run-tests.sh" ]
FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node server ./server
COPY --chown=node:node index.html ./
COPY --chown=node:node css ./css
COPY --chown=node:node js ./js
COPY --chown=node:node images ./images
COPY --chown=node:node data ./data
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=3000 DATABASE_PATH=/data/trades.sqlite
EXPOSE 3000
CMD ["node", "server/app.mjs"]

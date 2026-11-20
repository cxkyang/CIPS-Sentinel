FROM node:22-alpine
WORKDIR /app
ENV PORT=8787 HOST=0.0.0.0
COPY . .
EXPOSE 8787
CMD ["node", "server.mjs"]

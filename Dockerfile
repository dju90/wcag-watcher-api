FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js htmlcs.js ibm-ace.js ./

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.js"]
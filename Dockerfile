FROM node:22-bookworm

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

CMD ["node", "index.mjs", "--ip", "0.0.0.0"]

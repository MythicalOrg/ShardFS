FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Expose the master API port (default 9000)
EXPOSE 9000

# Command to run your app
CMD ["npm","start"]
FROM node:17.5.0-alpine3.15

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
COPY public ./public
COPY src ./src
COPY backend ./backend
COPY build ./build

RUN npm install
RUN npm run

RUN cd ./backend && \
    npm install

# Expose app
EXPOSE 8080
CMD [ "node", "/usr/src/app/backend/frontendserver.js" ]

FROM node:18-alpine AS build
WORKDIR /app

# Copy shared-ui from root context
COPY shared-ui/ ./shared-ui/

# Copy portal package files and install
COPY student-portal/package.json student-portal/package-lock.json ./
RUN npm install

# Copy portal source (shared-ui already in place for @shared alias)
COPY student-portal/src/ ./src/
COPY student-portal/index.html student-portal/vite.config.ts student-portal/tsconfig.json ./
COPY student-portal/tailwind.config.js student-portal/postcss.config.js ./

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY student-portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

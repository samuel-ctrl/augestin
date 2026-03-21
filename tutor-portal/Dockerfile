FROM node:18-alpine AS build
WORKDIR /app
COPY shared-ui/ ./shared-ui/
COPY tutor-portal/package.json tutor-portal/package-lock.json ./
RUN npm install
COPY tutor-portal/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY tutor-portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

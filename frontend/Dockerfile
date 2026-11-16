# Build de la SPA y servidor Nginx para el stack de Coolify.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# En producción el frontend llama al subdominio dedicado de la API. Coolify
# pasa este valor como build arg; se puede sobrescribir si cambia el dominio.
ARG VITE_API_URL=https://api.carnetisena.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

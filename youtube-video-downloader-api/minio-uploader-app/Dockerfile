## Etapa de build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --prefer-offline
COPY . .
RUN npm run build

## Etapa de runtime con Nginx
FROM nginx:1.25-alpine

# Copiar build estático
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuración de Nginx que sirve la app y proxyea /api al backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# Dockerfile para MinIO Uploader Frontend
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Compilar la aplicación
RUN npm run build

# Exponer el puerto
EXPOSE 4173

# Comando para iniciar la aplicación
CMD ["npm", "start"]

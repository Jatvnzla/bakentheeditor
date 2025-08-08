#!/bin/bash
# Script para desplegar el frontend en el mismo servidor que el backend

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando despliegue del frontend...${NC}"

# Configuración (ajusta estas variables según tu servidor)
SERVER_USER="tu_usuario"
SERVER_IP="tu_ip_o_dominio"
REMOTE_FRONTEND_DIR="/var/www/minio-uploader-app"
LOCAL_DIST_DIR="./minio-uploader-app/dist"

# Paso 1: Crear directorio remoto si no existe
echo -e "${YELLOW}Creando directorio remoto...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_FRONTEND_DIR"

# Paso 2: Copiar archivos compilados al servidor
echo -e "${YELLOW}Copiando archivos al servidor...${NC}"
scp -r $LOCAL_DIST_DIR/* $SERVER_USER@$SERVER_IP:$REMOTE_FRONTEND_DIR/

# Paso 3: Copiar configuración de Nginx
echo -e "${YELLOW}Copiando configuración de Nginx...${NC}"
scp nginx.conf $SERVER_USER@$SERVER_IP:/tmp/minio-uploader.conf
ssh $SERVER_USER@$SERVER_IP "sudo mv /tmp/minio-uploader.conf /etc/nginx/sites-available/minio-uploader && \
                            sudo ln -sf /etc/nginx/sites-available/minio-uploader /etc/nginx/sites-enabled/ && \
                            sudo nginx -t && \
                            sudo systemctl restart nginx"

echo -e "${GREEN}¡Despliegue del frontend completado!${NC}"
echo -e "${YELLOW}La aplicación estará disponible en: http://tu_dominio${NC}"

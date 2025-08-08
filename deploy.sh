#!/bin/bash
# Script de despliegue para la aplicación MinIO Uploader

# Colores para mensajes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Iniciando despliegue de la aplicación MinIO Uploader...${NC}"

# Directorio base (cambia esto a la ruta en tu servidor)
SERVER_DIR="/var/www"
FRONTEND_DIR="$SERVER_DIR/minio-uploader-app"
BACKEND_DIR="$SERVER_DIR/youtube-video-downloader-api"

# Paso 1: Compilar el frontend
echo -e "${YELLOW}Compilando el frontend...${NC}"
cd minio-uploader-app
npm install
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Error al compilar el frontend${NC}"
    exit 1
fi
echo -e "${GREEN}Frontend compilado exitosamente${NC}"

# Paso 2: Crear directorios en el servidor si no existen
echo -e "${YELLOW}Creando directorios en el servidor...${NC}"
mkdir -p $FRONTEND_DIR
mkdir -p $BACKEND_DIR

# Paso 3: Copiar archivos al servidor
echo -e "${YELLOW}Copiando archivos al servidor...${NC}"
# Copiar frontend compilado
cp -r minio-uploader-app/dist/* $FRONTEND_DIR/
# Copiar backend
cp -r youtube-video-downloader-api/* $BACKEND_DIR/

# Paso 4: Instalar dependencias del backend
echo -e "${YELLOW}Instalando dependencias del backend...${NC}"
cd $BACKEND_DIR
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo -e "${RED}Error al instalar dependencias del backend${NC}"
    exit 1
fi
echo -e "${GREEN}Dependencias del backend instaladas exitosamente${NC}"

# Paso 5: Configurar y reiniciar servicios
echo -e "${YELLOW}Configurando servicios...${NC}"
# Copiar configuración de Nginx
cp nginx.conf /etc/nginx/sites-available/minio-uploader
ln -sf /etc/nginx/sites-available/minio-uploader /etc/nginx/sites-enabled/
# Reiniciar Nginx
systemctl restart nginx

# Paso 6: Configurar y iniciar el servicio del backend
echo -e "${YELLOW}Configurando servicio del backend...${NC}"
cat > /etc/systemd/system/minio-uploader-api.service << EOF
[Unit]
Description=MinIO Uploader API
After=network.target

[Service]
User=www-data
WorkingDirectory=$BACKEND_DIR
ExecStart=$BACKEND_DIR/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 main:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd y reiniciar el servicio
systemctl daemon-reload
systemctl enable minio-uploader-api
systemctl restart minio-uploader-api

echo -e "${GREEN}¡Despliegue completado exitosamente!${NC}"
echo -e "${YELLOW}La aplicación está disponible en: http://minio-uploader.tudominio.com${NC}"

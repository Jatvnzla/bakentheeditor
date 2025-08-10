# Variables de entorno BACKEND que necesitas cambiar:

```bash
# CAMBIAR ESTA LÍNEA:
NGINX_PROXY_REQUEST_BUFFERING = off

# POR ESTA:
NGINX_PROXY_REQUEST_BUFFERING = on

# MANTENER ESTAS (están bien):
MAX_CONTENT_LENGTH= 300000000 
NGINX_CLIENT_MAX_BODY_SIZE= 300M
GUNICORN_TIMEOUT= 300 
NGINX_PROXY_SEND_TIMEOUT = 600
NGINX_ADD_HEADERS = Access-Control-Allow-Origin:$http_origin;Access-Control-Allow-Methods:GET, POST, OPTIONS;Access-Control-Allow-Headers:Content-Type, Authorization, X-Requested-With;Vary:Origin
VITE_API_URL=https://prueba-editor.1xrk3z.easypanel.host

# AGREGAR ESTAS NUEVAS VARIABLES:
NGINX_PROXY_READ_TIMEOUT = 3600
NGINX_CHUNKED_TRANSFER_ENCODING = off
```

# Variables de entorno FRONTEND (están correctas):

```bash
VITE_API_URL=/api
```

# Explicación del problema:

1. **NGINX_PROXY_REQUEST_BUFFERING = off** está causando que Nginx envíe Transfer-Encoding: chunked al upstream (MinIO)
2. Las URLs presignadas de S3/MinIO requieren Content-Length fijo y rechazan chunked encoding
3. MinIO devuelve error y Nginx responde con 502

# Solución:

1. Cambiar `NGINX_PROXY_REQUEST_BUFFERING = on` en el backend
2. Agregar `NGINX_CHUNKED_TRANSFER_ENCODING = off`
3. Aumentar `NGINX_PROXY_READ_TIMEOUT = 3600` para archivos grandes
4. Redeploy del backend para que tome las nuevas variables

# Después del cambio:

- Nginx buffeará el archivo completo antes de enviarlo a MinIO
- Se enviará Content-Length en lugar de chunked encoding
- MinIO aceptará la subida presignada correctamente

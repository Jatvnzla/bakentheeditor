# Despliegue en EasyPanel

Este repositorio contiene dos aplicaciones que se pueden desplegar por separado en EasyPanel:

## 1. Backend (API) - ya desplegado
- **Carpeta**: `youtube-video-downloader-api/`
- **Tipo**: Python Application
- **URL actual**: https://prueba-bakentheeditor.1xrk3z.easypanel.host
- **Puerto**: 5000
- **Comando de inicio**: `python main.py`

## 2. Frontend (MinIO Uploader)
- **Carpeta**: `minio-uploader-app/`
- **Tipo**: Static Site
- **Comando de build**: `npm install && npm run build`
- **Directorio de salida**: `dist`
- **Variables de entorno**:
  - `VITE_API_URL=https://prueba-bakentheeditor.1xrk3z.easypanel.host`

## Configuración en EasyPanel

### Para el Frontend:
1. Crear nueva aplicación en EasyPanel
2. Seleccionar "Static Site"
3. Conectar con este mismo repositorio GitHub
4. Configurar:
   - **Root Directory**: `minio-uploader-app`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**: 
     - `VITE_API_URL=https://prueba-bakentheeditor.1xrk3z.easypanel.host`

### Resultado:
- Frontend: `https://tu-frontend.easypanel.host`
- Backend: `https://prueba-bakentheeditor.1xrk3z.easypanel.host` (ya existente)

## Funcionalidades:
- Subida de archivos a MinIO
- Integración con API de transformación de video
- Interfaz moderna con Mantine UI

import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { MinioConfig } from '../types';

// Configuración fija de MinIO con los parámetros proporcionados
// Esta configuración NO es editable por el usuario
export const minioConfig: MinioConfig = {
  endPoint: 'prueba-minio.1xrk3z.easypanel.host',
  port: 443,
  useSSL: true,
  accessKey: 'l2jatniel',
  secretKey: '04142312256',
  bucket: 'ciberfobia',
  uploadPath: 'videosYotube' // Ruta por defecto para subir archivos
};

// Crear un cliente S3 para interactuar con MinIO
export const createS3Client = (config: MinioConfig = minioConfig) => {
  return new S3Client({
    endpoint: `https://${config.endPoint}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey
    },
    forcePathStyle: true // Necesario para MinIO
  });
};

// Función para listar objetos en un bucket de MinIO
export const listMinioObjects = async (
  config: MinioConfig = minioConfig,
  path: string = ''
): Promise<MinioObject[]> => {
  const s3Client = createS3Client(config);
  
  try {
    // Configurar el comando para listar objetos
    const listCommand = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: path // Filtrar por prefijo (ruta) si se proporciona
    });
    
    // Obtener la lista de objetos
    const response = await s3Client.send(listCommand);
    
    // Transformar la respuesta en un formato más amigable
    const objects = response.Contents?.map(item => ({
      name: item.Key || '',
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
      url: `https://${config.endPoint}/${config.bucket}/${item.Key}`
    })) || [];
    
    return objects;
  } catch (error) {
    console.error('Error al listar objetos de MinIO:', error);
    throw error;
  }
};

// Función para subir un archivo a MinIO
export const uploadToMinio = async (
  file: File, 
  config: MinioConfig = minioConfig,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    // Iniciar con un pequeño progreso para indicar que la carga comenzó
    if (onProgress) {
      onProgress(5);
    }
    
    // Crear un FormData para enviar el archivo al backend
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', config.bucket);
    formData.append('path', config.uploadPath);
    
    // Configurar el progreso simulado con ajustes para archivos grandes
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (onProgress) {
      const totalSize = file.size;
      let progress = 5;
      
      // Ajustar el intervalo según el tamaño del archivo
      const intervalTime = totalSize > 100 * 1024 * 1024 ? 1000 : 300; // 1 segundo para archivos >100MB
      
      progressInterval = setInterval(() => {
        // Incremento variable basado en el tamaño del archivo
        // Más lento para archivos grandes
        const increment = Math.max(Math.min(3, 100 / (totalSize / (2 * 1024 * 1024))), 0.5);
        progress += increment;
        
        if (progress >= 95) { // Reservar el último 5% para la confirmación
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          progress = 95;
        }
        onProgress(progress);
      }, intervalTime);
    }
    
    // URL del backend (configurable para desarrollo/producción)
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    // Configurar timeout extendido para archivos grandes
    const timeoutDuration = Math.max(5 * 60 * 1000, file.size / 50000); // Mínimo 5 minutos, o más según tamaño
    
    // Crear controlador de aborto con timeout extendido
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    // Enviar el archivo al backend para que lo suba a MinIO
    const response = await fetch(`${API_URL}/upload_to_minio`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
      // No es necesario especificar Content-Type, fetch lo establece automáticamente con FormData
    });
    
    // Limpiar el timeout
    clearTimeout(timeoutId);
    
    // Limpiar el intervalo de progreso
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al subir archivo');
    }
    
    const data = await response.json();
    
    // Actualizar al 100% cuando se complete
    if (onProgress) {
      onProgress(100);
    }
    
    return data.url;
  } catch (error) {
    console.error('Error al subir archivo a MinIO:', error);
    throw error;
  }
};

// Interfaz para los objetos listados de MinIO
export interface MinioObject {
  name: string;
  size: number;
  lastModified: Date;
  url: string;
}

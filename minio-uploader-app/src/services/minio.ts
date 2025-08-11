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
    
    // Pedir URL presignada al backend (proxy) para subir vía PUT
    const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';
    const presignRes = await fetch(`${API_URL}/v1/minio/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: config.bucket,
        object_name: `${config.uploadPath}/${Date.now()}_${file.name}`,
        content_type: file.type || 'application/octet-stream',
      }),
    });
    if (!presignRes.ok) {
      throw new Error('No se pudo obtener URL presignada');
    }
    const { url, object_url } = await presignRes.json();
    const proxiedUrl = url.replace(
      /^https?:\/\/prueba-minio\.1xrk3z\.easypanel\.host\//,
      `${API_URL}/minio-proxy/`
    );
    
    // Configurar el progreso simulado
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (onProgress) {
      const totalSize = file.size;
      let progress = 5;
      
      progressInterval = setInterval(() => {
        // Incremento variable basado en el tamaño del archivo
        const increment = Math.max(Math.min(5, 100 / (totalSize / (5 * 1024 * 1024))), 1);
        progress += increment;
        
        if (progress >= 95) { // Reservar el último 5% para la confirmación
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          progress = 95;
        }
        onProgress(progress);
      }, 300);
    }

    // Subir directo a MinIO vía proxy usando XHR para progreso
    return await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', proxiedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.addEventListener('progress', (e) => {
        if (onProgress) {
          const progress = Math.round((e.loaded / e.total) * 90) + 5;
          onProgress(progress);
        }
      });
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(object_url);
        } else {
          reject(new Error('Error al subir archivo'));
        }
      };
      xhr.onerror = () => {
        reject(new Error('Error al subir archivo'));
      };
      xhr.send(file);
    });
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

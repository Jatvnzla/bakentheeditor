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
    if (onProgress) onProgress(5);

    // 1) Solicitar URL firmada al backend
    const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';
    const presignRes = await fetch(`${API_URL}/v1/minio/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        bucket: config.bucket,
        path: config.uploadPath,
      }),
    });
    if (!presignRes.ok) {
      let msg = 'No se pudo obtener URL firmada';
      try { const e = await presignRes.json(); msg = e.error || msg; } catch {}
      throw new Error(msg);
    }
    const { url, object_url } = await presignRes.json();

    // Reescribir a proxy local para evitar CORS del navegador
    const proxiedUrl = url.replace(
      /^https?:\/\/prueba-minio\.1xrk3z\.easypanel\.host\//,
      '/minio-proxy/'
    );

    // 2) Subir directo a MinIO usando PUT y XHR para progreso real
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', proxiedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.timeout = 1000 * 60 * 20; // 20 minutos

      xhr.upload.onprogress = (evt) => {
        if (!onProgress) return;
        if (evt.lengthComputable) {
          const p = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          onProgress(p);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(new Error(`Error PUT MinIO: ${xhr.status} ${xhr.statusText}`));
        }
      };
      xhr.onerror = () => reject(new Error('Fallo de red durante la subida'));
      xhr.ontimeout = () => reject(new Error('Timeout en la subida'));
      xhr.send(file);
    });

    return object_url;
  } catch (error) {
    console.error('Error al subir archivo a MinIO (presigned):', error);
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

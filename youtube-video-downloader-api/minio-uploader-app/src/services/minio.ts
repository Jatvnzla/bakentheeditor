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
  uploadPath: 'uploads' // Prefijo habilitado para escritura anónima
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

    // Construir clave de objeto bajo el prefijo permitido
    const prefix = (config.uploadPath || '').replace(/^\/+|\/+$/g, '');
    const uniqueName = `${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}-${file.name}`;
    const objectKey = prefix ? `${prefix}/${uniqueName}` : uniqueName;

    // URL pública estilo path para MinIO
    const objectUrl = `https://${config.endPoint}/${config.bucket}/${encodeURIComponent(objectKey)}`;

    // Subida directa con XHR (progreso y timeout)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', objectUrl, true);
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

    return objectUrl;
  } catch (error) {
    console.error('Error al subir archivo a MinIO (direct PUT):', error);
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

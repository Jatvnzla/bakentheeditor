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

// Interfaz para los objetos listados de MinIO
export interface MinioObject {
  name: string;
  size: number;
  lastModified: Date;
  url: string;
}

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
    const objects: MinioObject[] = response.Contents?.map(item => ({
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

export const uploadToMinio = async (
  file: File,
  config: MinioConfig = minioConfig,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    if (onProgress) onProgress(2);

    // Construir clave bajo prefijo permitido
    const prefix = (config.uploadPath || '').replace(/^\/+|\/+$/g, '');
    const uniqueName = `${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now()}-${file.name}`;
    const objectKey = prefix ? `${prefix}/${uniqueName}` : uniqueName;

    // URL pública estilo path para MinIO (codificar por segmentos, no las barras)
    const encodedKey = objectKey.split('/').map(encodeURIComponent).join('/');
    const objectUrl = `https://${config.endPoint}/${config.bucket}/${encodedKey}`;
    const bucketUrl = `https://${config.endPoint}/${config.bucket}`;

    // Configuración de multipart upload
    const PART_SIZE = 8 * 1024 * 1024; // 8MB por parte
    const MAX_RETRIES = 3;
    const totalParts = Math.ceil(file.size / PART_SIZE);
    
    // Iniciar multipart upload
    const createMultipartUrl = `${bucketUrl}/${encodedKey}?uploads`;
    let uploadId = '';
    
    if (onProgress) onProgress(5);
    
    // Paso 1: Crear multipart upload
    const createResponse = await fetch(createMultipartUrl, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    });
    
    if (!createResponse.ok) {
      throw new Error(`Error al iniciar multipart upload: ${createResponse.status} ${createResponse.statusText}`);
    }
    
    const createXml = await createResponse.text();
    const createParser = new DOMParser();
    const createDoc = createParser.parseFromString(createXml, 'application/xml');
    uploadId = createDoc.querySelector('UploadId')?.textContent || '';
    
    if (!uploadId) {
      throw new Error('No se pudo obtener el ID de upload multipart');
    }
    
    if (onProgress) onProgress(10);
    
    // Paso 2: Subir partes en paralelo con límite de concurrencia
    const parts: {PartNumber: number, ETag: string}[] = [];
    const MAX_CONCURRENT = 3;
    let completedParts = 0;
    let failedParts = 0;
    
    const uploadPart = async (partNumber: number, retryCount = 0): Promise<{PartNumber: number, ETag: string}> => {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, file.size);
      const chunk = file.slice(start, end);
      
      const partUrl = `${bucketUrl}/${encodedKey}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
      
      try {
        const response = await fetch(partUrl, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Error al subir parte ${partNumber}: ${response.status}`);
        }
        
        const etag = response.headers.get('ETag');
        if (!etag) {
          throw new Error(`No se recibió ETag para la parte ${partNumber}`);
        }
        
        completedParts++;
        if (onProgress) {
          // Reservamos 10% para inicio y 10% para completar
          const progressPercent = 10 + Math.floor((completedParts / totalParts) * 80);
          onProgress(Math.min(90, progressPercent));
        }
        
        return {
          PartNumber: partNumber,
          ETag: etag.replace(/\"/g, '') // Quitar comillas del ETag
        };
      } catch (error) {
        if (retryCount < MAX_RETRIES) {
          console.warn(`Reintentando parte ${partNumber}, intento ${retryCount + 1}`);
          return uploadPart(partNumber, retryCount + 1);
        }
        failedParts++;
        throw error;
      }
    };
    
    // Subir partes con concurrencia limitada
    for (let i = 0; i < totalParts; i += MAX_CONCURRENT) {
      const partPromises = [];
      
      for (let j = 0; j < MAX_CONCURRENT && i + j < totalParts; j++) {
        const partNumber = i + j + 1; // PartNumber comienza en 1
        partPromises.push(uploadPart(partNumber));
      }
      
      const results = await Promise.allSettled(partPromises);
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          parts.push(result.value);
        } else {
          console.error('Error en parte:', result.reason);
          // Si hay demasiados fallos, abortamos
          if (failedParts > totalParts * 0.1) { // Más del 10% de fallos
            // Abortar multipart upload
            await fetch(`${bucketUrl}/${encodedKey}?uploadId=${encodeURIComponent(uploadId)}`, {
              method: 'DELETE'
            }).catch(e => console.error('Error al abortar multipart upload:', e));
            
            throw new Error('Demasiados fallos en la subida multipart');
          }
        }
      }
    }
    
    if (parts.length !== totalParts) {
      throw new Error(`No se completaron todas las partes: ${parts.length}/${totalParts}`);
    }
    
    // Paso 3: Completar multipart upload
    if (onProgress) onProgress(95);
    
    // Ordenar partes por número
    parts.sort((a, b) => a.PartNumber - b.PartNumber);
    
    // Crear XML para completar
    const completeXml = `
      <CompleteMultipartUpload>
        ${parts.map(part => `<Part>
          <PartNumber>${part.PartNumber}</PartNumber>
          <ETag>${part.ETag}</ETag>
        </Part>`).join('')}
      </CompleteMultipartUpload>
    `;
    
    const completeUrl = `${bucketUrl}/${encodedKey}?uploadId=${encodeURIComponent(uploadId)}`;
    const completeResponse = await fetch(completeUrl, {
      method: 'POST',
      body: completeXml,
      headers: {
        'Content-Type': 'application/xml'
      }
    });
    
    if (!completeResponse.ok) {
      const errorText = await completeResponse.text();
      throw new Error(`Error al completar multipart upload: ${completeResponse.status} ${errorText}`);
    }
    
    if (onProgress) onProgress(100);
    
    return objectUrl;
  } catch (error) {
    console.error('Error al subir archivo a MinIO (multipart):', error);
    throw error;
  }
};

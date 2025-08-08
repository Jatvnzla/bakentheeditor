// Definición de tipos para la aplicación de subida a MinIO

// Configuración para la conexión a MinIO
export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  uploadPath: string;
}

// Objeto almacenado en MinIO
export interface MinioObject {
  name: string;
  size: number;
  lastModified: Date;
  url: string;
}

export interface VideoFormat {
  itag: number;
  url?: string;
  mimeType: string;
  bitrate?: number;
  width?: number;
  height?: number;
  lastModified?: string;
  contentLength?: string;
  quality?: string;
  qualityLabel?: string;
  audioQuality?: string;
  audioSampleRate?: string;
  audioChannels?: number;
  audioBitrate?: number;
  hasVideo: boolean;
  hasAudio: boolean;
  container?: string;
  codecs?: string;
}

export interface VideoThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface VideoInfo {
  id: string;
  videoId?: string;
  title: string;
  url?: string;
  thumbnail?: string;
  thumbnails: VideoThumbnail[];
  description?: string;
  lengthSeconds?: string;
  viewCount?: string;
  author: string;
  channelId?: string;
  channelTitle?: string;
  publishDate?: string;
  formats: VideoFormat[];
  selectedFormat?: VideoFormat;
  format?: string;
  status?: string;
  duration?: string;
  downloadUrl?: string;
  progress?: number;
  error?: string;
  localPath?: string;
  minioUrl?: string;
  size?: number;
  createdAt: Date;
  rawData?: any; // Para almacenar la respuesta completa de la API si es necesario
}

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  uploadPath: string; // Ruta específica dentro del bucket para subir los archivos
}

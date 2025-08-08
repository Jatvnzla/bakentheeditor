import axios from 'axios';
import type { VideoInfo, VideoFormat, VideoThumbnail } from '../types';

const RAPID_API_KEY = '41d50df29fmsh8a887ef309a4c4fp16c293jsn1ddc0f3e51a4';
const RAPID_API_HOST = 'yt-api.p.rapidapi.com';

// Función para extraer el ID del video de una URL de YouTube
export const extractVideoId = (url: string): string | null => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Función para formatear la duración del video en formato legible
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
};

// Función para formatear el número de vistas
export const formatViewCount = (viewCount: number): string => {
  if (viewCount >= 1000000) {
    return `${(viewCount / 1000000).toFixed(1)}M vistas`;
  } else if (viewCount >= 1000) {
    return `${(viewCount / 1000).toFixed(1)}K vistas`;
  } else {
    return `${viewCount} vistas`;
  }
};

// Función para obtener información del video
export const getVideoInfo = async (url: string): Promise<VideoInfo> => {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error('URL de YouTube inválida');
  }
  
  const options = {
    method: 'GET',
    url: `https://yt-api.p.rapidapi.com/dl?id=${videoId}`,
    headers: {
      'x-rapidapi-host': RAPID_API_HOST,
      'x-rapidapi-key': RAPID_API_KEY
    }
  };
  
  try {
    const response = await axios.request(options);
    const data = response.data;
    
    // Procesar los formatos para asegurar que tengan las propiedades hasVideo y hasAudio
    const processedFormats = data.formats?.map((format: any) => {
      const mimeType = format.mimeType || '';
      const hasVideo = mimeType.includes('video');
      const hasAudio = mimeType.includes('audio');
      
      return {
        ...format,
        hasVideo,
        hasAudio
      } as VideoFormat;
    }) || [];
    
    // Crear objeto VideoInfo con los datos recibidos
    const videoInfo: VideoInfo = {
      id: crypto.randomUUID(),
      videoId: data.id || videoId,
      title: data.title || 'Video sin título',
      url,
      thumbnail: data.thumbnail || data.thumbnails?.[0]?.url,
      thumbnails: data.thumbnails as VideoThumbnail[],
      description: data.description,
      lengthSeconds: data.lengthSeconds,
      viewCount: data.viewCount,
      author: data.author?.name || '',
      channelId: data.author?.id || '',
      channelTitle: data.author?.name || '',
      publishDate: data.publishDate,
      formats: processedFormats,
      status: 'pending',
      createdAt: new Date(),
      rawData: data
    };
    
    // Guardar en localStorage para persistencia
    try {
      const savedVideos = JSON.parse(localStorage.getItem('youtube-videos') || '[]');
      const updatedVideos = [...savedVideos, videoInfo];
      localStorage.setItem('youtube-videos', JSON.stringify(updatedVideos));
    } catch (e) {
      console.error('Error al guardar video en localStorage:', e);
    }
    
    return videoInfo;
  } catch (error) {
    console.error('Error al obtener información del video:', error);
    throw error;
  }
};

// URL del backend
const BACKEND_URL = 'http://localhost:5000';

// Función para descargar un video usando la API de RapidAPI
export const downloadVideo = async (url: string, quality: string = '720p', onProgressCallback?: (progress: number) => void) => {
  try {
    // 1. Obtener información del video
    const videoInfo = await getVideoInfo(url);
    
    // 2. Encontrar los formatos disponibles
    const formats = videoInfo.formats || [];
    
    // 3. Buscar el formato de video y audio adecuado
    let videoFormat: VideoFormat | null = null;
    let audioFormat: VideoFormat | null = null;
    
    // Buscar el formato de video con la calidad solicitada
    for (const format of formats) {
      if (format.qualityLabel === quality && format.hasVideo && !format.hasAudio) {
        videoFormat = format;
      }
      
      // Buscar el mejor formato de audio
      if (format.hasAudio && !format.hasVideo) {
        if (!audioFormat || (format.audioBitrate !== undefined && audioFormat.audioBitrate !== undefined && format.audioBitrate > audioFormat.audioBitrate)) {
          audioFormat = format;
        }
      }
      
      // Si encontramos un formato con video y audio juntos con la calidad deseada, lo usamos directamente
      if (format.qualityLabel === quality && format.hasVideo && format.hasAudio) {
        // Actualizar el video con el formato seleccionado
        const updatedVideoInfo = {
          ...videoInfo,
          selectedFormat: format,
          status: 'completed' as const,
          progress: 100
        };
        
        // Simular progreso de descarga
        if (onProgressCallback) {
          onProgressCallback(100);
        }
        
        return {
          videoInfo: updatedVideoInfo,
          url: format.url || '',
          title: videoInfo.title,
          thumbnail: videoInfo.thumbnail || '',
          format: format.qualityLabel || '',
          combined: true
        };
      }
    }
    
    // 4. Si no encontramos la calidad exacta, buscar la más cercana
    if (!videoFormat) {
      const availableQualities = formats
        .filter(f => f.hasVideo)
        .sort((a, b) => {
          const aHeight = parseInt(a.qualityLabel || '0') || 0;
          const bHeight = parseInt(b.qualityLabel || '0') || 0;
          return bHeight - aHeight;
        });
      
      if (availableQualities.length > 0) {
        videoFormat = availableQualities[0];
      }
    }
    
    // 5. Actualizar el video con los formatos seleccionados
    const updatedVideoInfo = {
      ...videoInfo,
      selectedFormat: videoFormat || undefined,
      status: 'completed' as const,
      progress: 100
    };
    
    // Simular progreso de descarga
    if (onProgressCallback) {
      onProgressCallback(100);
    }
    
    // 6. Retornar las URLs para descargar
    return {
      videoInfo: updatedVideoInfo,
      videoUrl: videoFormat?.url || '',
      audioUrl: audioFormat?.url || '',
      title: videoInfo.title,
      thumbnail: videoInfo.thumbnail || '',
      format: videoFormat?.qualityLabel || '',
      combined: false
    };
  } catch (error) {
    console.error('Error al descargar el video:', error);
    throw error;
  }
};

// Función para cargar videos guardados desde localStorage
export const loadSavedVideos = (): VideoInfo[] => {
  try {
    const savedVideos = localStorage.getItem('youtube-videos');
    if (savedVideos) {
      const parsedVideos = JSON.parse(savedVideos);
      // Convertir las fechas de string a Date
      return parsedVideos.map((video: any) => ({
        ...video,
        createdAt: new Date(video.createdAt)
      }));
    }
    return [];
  } catch (e) {
    console.error('Error al cargar videos guardados:', e);
    return [];
  }
};

// Función para guardar un video en localStorage
export const saveVideo = (video: VideoInfo): void => {
  try {
    const savedVideos = loadSavedVideos();
    const existingIndex = savedVideos.findIndex(v => v.id === video.id);
    
    if (existingIndex >= 0) {
      savedVideos[existingIndex] = video;
    } else {
      savedVideos.push(video);
    }
    
    localStorage.setItem('youtube-videos', JSON.stringify(savedVideos));
  } catch (e) {
    console.error('Error al guardar video:', e);
  }
};

// Función para eliminar un video de localStorage
export const deleteVideo = (videoId: string): void => {
  try {
    const savedVideos = loadSavedVideos();
    const updatedVideos = savedVideos.filter(v => v.id !== videoId);
    localStorage.setItem('youtube-videos', JSON.stringify(updatedVideos));
  } catch (e) {
    console.error('Error al eliminar video:', e);
  }
};

// Función para descargar el mejor video y audio y combinarlos con ffmpeg usando el backend
export const downloadBestQuality = async (url: string, onProgressCallback?: (progress: number) => void) => {
  try {
    // Simular inicio de progreso
    if (onProgressCallback) {
      onProgressCallback(10);
    }
    
    // 1. Obtener información del video para mostrar mientras se procesa
    const videoInfo = await getVideoInfo(url);
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(30);
    }
    
    // 2. Llamar al backend para descargar y combinar
    const response = await axios.post(`${BACKEND_URL}/download_best`, { url });
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(90);
    }
    
    // 3. Actualizar el video con la información de descarga
    const updatedVideoInfo = {
      ...videoInfo,
      status: 'completed' as const,
      progress: 100,
      downloadUrl: `${BACKEND_URL}${response.data.download_url}`,
      filename: response.data.filename
    };
    
    // Guardar video actualizado
    saveVideo(updatedVideoInfo);
    
    // Completar progreso
    if (onProgressCallback) {
      onProgressCallback(100);
    }
    
    return {
      videoInfo: updatedVideoInfo,
      downloadUrl: `${BACKEND_URL}${response.data.download_url}`,
      message: response.data.message
    };
  } catch (error) {
    console.error('Error al descargar el video con la mejor calidad:', error);
    throw error;
  }
};

// Función para descargar el mejor video y audio como blob y subirlo directamente a MinIO
export const downloadBestQualityAsBlob = async (
  url: string, 
  onProgressCallback?: (progress: number) => void
): Promise<Blob> => {
  try {
    // Simular inicio de progreso
    if (onProgressCallback) {
      onProgressCallback(10);
    }
    
    // 1. Obtener información del video para mostrar mientras se procesa
    const videoInfo = await getVideoInfo(url);
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(30);
    }
    
    // 2. Llamar al backend para descargar y combinar, solicitando el blob directamente
    const response = await axios.post(
      `${BACKEND_URL}/download_best`, 
      { url, direct_blob: true },
      { responseType: 'blob' } // Importante: especificar que esperamos un blob
    );
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(90);
    }
    
    // 3. Actualizar el video con la información de descarga
    const updatedVideoInfo = {
      ...videoInfo,
      status: 'completed' as const,
      progress: 100,
      filename: `${videoInfo.title}.mp4`.replace(/[^a-zA-Z0-9.]/g, '_')
    };
    
    // Guardar video actualizado
    saveVideo(updatedVideoInfo);
    
    // Completar progreso
    if (onProgressCallback) {
      onProgressCallback(100);
    }
    
    return response.data; // Este es el blob del video
  } catch (error) {
    console.error('Error al descargar el video como blob:', error);
    throw error;
  }
};

// Función para descargar video en la calidad seleccionada con el mejor audio y combinarlos con ffmpeg
export const downloadSelectedQuality = async (url: string, quality: string, onProgressCallback?: (progress: number) => void) => {
  try {
    // Simular inicio de progreso
    if (onProgressCallback) {
      onProgressCallback(10);
    }
    
    // 1. Obtener información del video para mostrar mientras se procesa
    const videoInfo = await getVideoInfo(url);
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(30);
    }
    
    // 2. Llamar al backend para descargar y combinar
    const response = await axios.post(`${BACKEND_URL}/download_selected/${quality}`, { url });
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(90);
    }
    
    // 3. Actualizar el video con la información de descarga
    const updatedVideoInfo = {
      ...videoInfo,
      status: 'completed' as const,
      progress: 100,
      downloadUrl: `${BACKEND_URL}${response.data.download_url}`,
      filename: response.data.filename,
      selectedQuality: quality
    };
    
    // Guardar video actualizado
    saveVideo(updatedVideoInfo);
    
    // Completar progreso
    if (onProgressCallback) {
      onProgressCallback(100);
    }
    
    return {
      videoInfo: updatedVideoInfo,
      downloadUrl: `${BACKEND_URL}${response.data.download_url}`,
      message: response.data.message
    };
  } catch (error) {
    console.error(`Error al descargar el video en calidad ${quality} con el mejor audio:`, error);
    throw error;
  }
};

// Función para descargar video en la calidad seleccionada como blob y subirlo directamente a MinIO
export const downloadSelectedQualityAsBlob = async (
  url: string, 
  quality: string,
  onProgressCallback?: (progress: number) => void
): Promise<Blob> => {
  try {
    // Simular inicio de progreso
    if (onProgressCallback) {
      onProgressCallback(10);
    }
    
    // 1. Obtener información del video para mostrar mientras se procesa
    const videoInfo = await getVideoInfo(url);
    
    // Verificar si el formato seleccionado es adaptativo (solo video sin audio)
    const isAdaptiveFormat = quality.match(/^\d+$/) && // Es un itag (número)
      videoInfo.rawData?.adaptiveFormats?.some((format: any) => 
        format.itag.toString() === quality && 
        format.mimeType.includes('video') && 
        !format.mimeType.includes('audio')
      );
    
    console.log(`Formato seleccionado (${quality}) es adaptativo: ${isAdaptiveFormat}`);
    
    // Actualizar progreso
    if (onProgressCallback) {
      onProgressCallback(30);
    }
    
    // 2. Llamar al backend para descargar y combinar, solicitando el blob directamente
    try {
      const response = await axios.post(
        `${BACKEND_URL}/download_selected/${quality}`, 
        { url, direct_blob: true },
        { 
          responseType: 'blob', // Importante: especificar que esperamos un blob
          timeout: 60000 // Aumentar el timeout a 60 segundos para dar tiempo a ffmpeg
        }
      );
      
      // Actualizar progreso
      if (onProgressCallback) {
        onProgressCallback(90);
      }
      
      // 3. Actualizar el video con la información de descarga
      const updatedVideoInfo = {
        ...videoInfo,
        status: 'completed' as const,
        progress: 100,
        selectedQuality: quality,
        filename: `${videoInfo.title}_${quality}.mp4`.replace(/[^a-zA-Z0-9.]/g, '_')
      };
      
      // Guardar video actualizado
      saveVideo(updatedVideoInfo);
      
      // Completar progreso
      if (onProgressCallback) {
        onProgressCallback(100);
      }
      
      return response.data; // Este es el blob del video
    } catch (axiosError: any) {
      console.error(`Error en la petición al backend:`, axiosError);
      
      // Si el error es 500 y es un formato adaptativo, mostrar un mensaje más específico
      if (axiosError.response?.status === 500 && isAdaptiveFormat) {
        throw new Error(
          `Error al procesar el formato ${quality}: Este es un formato adaptativo (solo video) ` +
          `que requiere combinar con audio. Es posible que ffmpeg no esté disponible en el servidor.`
        );
      }
      
      // Si es otro tipo de error, reenviar el error original
      throw axiosError;
    }
  } catch (error) {
    console.error(`Error al descargar el video en calidad ${quality} como blob:`, error);
    throw error;
  }
};

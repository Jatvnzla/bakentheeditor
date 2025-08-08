import axios from 'axios';

const API_URL = 'http://localhost:5000'; // URL de nuestra API de descarga de YouTube

export const getVideoInfo = async (url: string) => {
  try {
    const response = await axios.post(`${API_URL}/video_info`, { url });
    return response.data;
  } catch (error) {
    console.error('Error al obtener información del video:', error);
    throw error;
  }
};

export const downloadVideo = async (url: string, resolution: string) => {
  try {
    const response = await axios.post(`${API_URL}/download/${resolution}`, { url });
    return response.data;
  } catch (error) {
    console.error('Error al descargar el video:', error);
    throw error;
  }
};

// Función para simular la descarga de un video (para desarrollo)
export const simulateDownload = (url: string, onProgress: (progress: number) => void, onComplete: (path: string) => void) => {
  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 10;
    if (progress > 100) {
      progress = 100;
      clearInterval(interval);
      onComplete(`/downloads/${Date.now()}_video.mp4`);
    }
    onProgress(progress);
  }, 500);

  // Retornamos una función para cancelar la descarga
  return () => clearInterval(interval);
};

import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { VideoInfo, MinioConfig } from '../types';
import { minioConfig } from '../services/minio';

interface AppContextType {
  videos: VideoInfo[];
  addVideo: (video: VideoInfo) => void;
  updateVideo: (id: string, updates: Partial<VideoInfo>) => void;
  removeVideo: (id: string) => void;
  minioConfig: MinioConfig; // Ahora siempre es la configuración fija
}

// La configuración de MinIO ahora se importa directamente desde el servicio

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [videos, setVideos] = useState<VideoInfo[]>([]);

  const addVideo = (video: VideoInfo) => {
    const newVideo = {
      ...video,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };
    setVideos(prev => [...prev, newVideo]);
  };

  const updateVideo = (id: string, updates: Partial<VideoInfo>) => {
    setVideos(prev => 
      prev.map(video => 
        video.id === id ? { ...video, ...updates } : video
      )
    );
  };

  const removeVideo = (id: string) => {
    setVideos(prev => prev.filter(video => video.id !== id));
  };

  // Ya no se permite cambiar la configuración de MinIO

  return (
    <AppContext.Provider value={{ 
      videos, 
      addVideo, 
      updateVideo, 
      removeVideo, 
      minioConfig // Configuración fija importada del servicio
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

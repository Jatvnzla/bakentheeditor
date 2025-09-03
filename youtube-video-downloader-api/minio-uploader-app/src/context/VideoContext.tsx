import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  videoService, 
  scheduleService, 
  publicationService,
  type Video,
  type Schedule,
  type Publication
} from '../services/videoService';
import { useAuth } from './AuthContext';

interface VideoContextType {
  // Videos
  videos: Video[];
  loading: boolean;
  error: string | null;
  refreshVideos: () => Promise<void>;
  getVideo: (id: string) => Promise<Video | null>;
  addVideo: (video: Omit<Video, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateVideo: (id: string, updates: Partial<Video>) => Promise<void>;
  deleteVideo: (id: string) => Promise<void>;
  getVideoFragments: (parentId: string) => Promise<Video[]>;
  
  // Programaciones
  schedules: Schedule[];
  loadingSchedules: boolean;
  refreshSchedules: () => Promise<void>;
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSchedule: (id: string, updates: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  getVideoSchedules: (videoId: string) => Promise<Schedule[]>;
  
  // Publicaciones
  publications: Publication[];
  loadingPublications: boolean;
  refreshPublications: () => Promise<void>;
  getVideoPublications: (videoId: string) => Promise<Publication[]>;
}

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export const VideoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingPublications, setLoadingPublications] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar videos del usuario al iniciar
  useEffect(() => {
    if (user?.uid) {
      refreshVideos();
      refreshSchedules();
      refreshPublications();
    } else {
      setVideos([]);
      setSchedules([]);
      setPublications([]);
      setLoading(false);
      setLoadingSchedules(false);
      setLoadingPublications(false);
    }
  }, [user?.uid]);

  // Función para refrescar la lista de videos
  const refreshVideos = async () => {
    if (!user?.uid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userVideos = await videoService.getUserVideos(user.uid);
      setVideos(userVideos);
    } catch (err) {
      console.error('Error al cargar videos:', err);
      setError('Error al cargar videos. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Función para refrescar la lista de programaciones
  const refreshSchedules = async () => {
    if (!user?.uid) return;
    
    setLoadingSchedules(true);
    
    try {
      const userSchedules = await scheduleService.getUserSchedules(user.uid);
      setSchedules(userSchedules);
    } catch (err) {
      console.error('Error al cargar programaciones:', err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Función para refrescar la lista de publicaciones
  const refreshPublications = async () => {
    if (!user?.uid) return;
    
    setLoadingPublications(true);
    
    try {
      const userPublications = await publicationService.getUserPublications(user.uid);
      setPublications(userPublications);
    } catch (err) {
      console.error('Error al cargar publicaciones:', err);
    } finally {
      setLoadingPublications(false);
    }
  };

  // Obtener un video por ID
  const getVideo = async (id: string) => {
    return await videoService.getVideo(id);
  };

  // Añadir un nuevo video
  const addVideo = async (video: Omit<Video, 'id' | 'createdAt' | 'updatedAt'>) => {
    const videoId = await videoService.createVideo(video);
    await refreshVideos();
    return videoId;
  };

  // Actualizar un video existente
  const updateVideo = async (id: string, updates: Partial<Video>) => {
    await videoService.updateVideo(id, updates);
    await refreshVideos();
  };

  // Eliminar un video
  const deleteVideo = async (id: string) => {
    await videoService.deleteVideo(id);
    await refreshVideos();
  };

  // Obtener fragmentos de un video
  const getVideoFragments = async (parentId: string) => {
    return await videoService.getVideoFragments(parentId);
  };

  // Añadir una nueva programación
  const addSchedule = async (schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const scheduleId = await scheduleService.createSchedule(schedule);
    await refreshSchedules();
    return scheduleId;
  };

  // Actualizar una programación existente
  const updateSchedule = async (id: string, updates: Partial<Schedule>) => {
    await scheduleService.updateSchedule(id, updates);
    await refreshSchedules();
  };

  // Eliminar una programación
  const deleteSchedule = async (id: string) => {
    await scheduleService.deleteSchedule(id);
    await refreshSchedules();
  };

  // Obtener programaciones de un video
  const getVideoSchedules = async (videoId: string) => {
    return await scheduleService.getVideoSchedules(videoId);
  };

  // Obtener publicaciones de un video
  const getVideoPublications = async (videoId: string) => {
    return await publicationService.getVideoPublications(videoId);
  };

  const value = {
    // Videos
    videos,
    loading,
    error,
    refreshVideos,
    getVideo,
    addVideo,
    updateVideo,
    deleteVideo,
    getVideoFragments,
    
    // Programaciones
    schedules,
    loadingSchedules,
    refreshSchedules,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    getVideoSchedules,
    
    // Publicaciones
    publications,
    loadingPublications,
    refreshPublications,
    getVideoPublications
  };

  return (
    <VideoContext.Provider value={value}>
      {children}
    </VideoContext.Provider>
  );
};

export const useVideo = () => {
  const context = useContext(VideoContext);
  if (context === undefined) {
    throw new Error('useVideo debe ser usado dentro de un VideoProvider');
  }
  return context;
};

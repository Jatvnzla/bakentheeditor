import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// Interfaces para el modelo de datos
export interface Video {
  id?: string;
  title: string;
  description: string;
  minioUrl: string;
  thumbnailUrl: string | null; // Cambiado de opcional a null
  duration: number | null; // Cambiado de opcional a null
  type: 'original' | 'fragment';
  parentId: string | null; // Cambiado de opcional a null
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId: string;
  metadata?: Record<string, any>;
}

export interface Schedule {
  id?: string;
  videoId: string;
  scheduledDate: Timestamp;
  status: 'scheduled' | 'published' | 'cancelled';
  platform: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  userId: string;
  caption?: string;
  hashtags?: string[];
}

export interface Publication {
  id?: string;
  videoId: string;
  scheduleId?: string;
  publishedDate: Timestamp;
  platform: string;
  status: 'success' | 'failed';
  url?: string;
  userId: string;
  analytics?: Record<string, any>;
}

// Servicios para videos
export const videoService = {
  // Crear un nuevo video
  async createVideo(video: Omit<Video, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const videoData = {
        ...video,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'videos'), videoData);
      return docRef.id;
    } catch (error) {
      console.error('Error al crear video:', error);
      throw error;
    }
  },

  // Obtener un video por ID
  async getVideo(id: string): Promise<Video | null> {
    try {
      const docRef = doc(db, 'videos', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Video;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener video:', error);
      throw error;
    }
  },

  // Actualizar un video
  async updateVideo(id: string, updates: Partial<Video>): Promise<void> {
    try {
      const videoRef = doc(db, 'videos', id);
      await updateDoc(videoRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error al actualizar video:', error);
      throw error;
    }
  },

  // Eliminar un video
  async deleteVideo(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'videos', id));
    } catch (error) {
      console.error('Error al eliminar video:', error);
      throw error;
    }
  },

  // Obtener todos los videos de un usuario
  async getUserVideos(userId: string): Promise<Video[]> {
    try {
      const q = query(
        collection(db, 'videos'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
    } catch (error) {
      console.error('Error al obtener videos del usuario:', error);
      throw error;
    }
  },

  // Obtener fragmentos de un video original
  async getVideoFragments(parentId: string): Promise<Video[]> {
    try {
      const q = query(
        collection(db, 'videos'),
        where('parentId', '==', parentId),
        where('type', '==', 'fragment'),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video));
    } catch (error) {
      console.error('Error al obtener fragmentos del video:', error);
      throw error;
    }
  }
};

// Servicios para programación de publicaciones
export const scheduleService = {
  // Crear una nueva programación
  async createSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const scheduleData = {
        ...schedule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'schedules'), scheduleData);
      return docRef.id;
    } catch (error) {
      console.error('Error al crear programación:', error);
      throw error;
    }
  },

  // Obtener una programación por ID
  async getSchedule(id: string): Promise<Schedule | null> {
    try {
      const docRef = doc(db, 'schedules', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Schedule;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener programación:', error);
      throw error;
    }
  },

  // Actualizar una programación
  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<void> {
    try {
      const scheduleRef = doc(db, 'schedules', id);
      await updateDoc(scheduleRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error al actualizar programación:', error);
      throw error;
    }
  },

  // Eliminar una programación
  async deleteSchedule(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'schedules', id));
    } catch (error) {
      console.error('Error al eliminar programación:', error);
      throw error;
    }
  },

  // Obtener todas las programaciones de un usuario
  async getUserSchedules(userId: string): Promise<Schedule[]> {
    try {
      const q = query(
        collection(db, 'schedules'),
        where('userId', '==', userId),
        orderBy('scheduledDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
    } catch (error) {
      console.error('Error al obtener programaciones del usuario:', error);
      throw error;
    }
  },

  // Obtener programaciones de un video específico
  async getVideoSchedules(videoId: string): Promise<Schedule[]> {
    try {
      const q = query(
        collection(db, 'schedules'),
        where('videoId', '==', videoId),
        orderBy('scheduledDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
    } catch (error) {
      console.error('Error al obtener programaciones del video:', error);
      throw error;
    }
  },

  // Obtener programaciones pendientes (para procesamiento automático)
  async getPendingSchedules(): Promise<Schedule[]> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, 'schedules'),
        where('status', '==', 'scheduled'),
        where('scheduledDate', '<=', now),
        orderBy('scheduledDate', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Schedule));
    } catch (error) {
      console.error('Error al obtener programaciones pendientes:', error);
      throw error;
    }
  }
};

// Servicios para publicaciones
export const publicationService = {
  // Crear una nueva publicación
  async createPublication(publication: Omit<Publication, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'publications'), publication);
      return docRef.id;
    } catch (error) {
      console.error('Error al crear publicación:', error);
      throw error;
    }
  },

  // Obtener una publicación por ID
  async getPublication(id: string): Promise<Publication | null> {
    try {
      const docRef = doc(db, 'publications', id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Publication;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener publicación:', error);
      throw error;
    }
  },

  // Actualizar una publicación
  async updatePublication(id: string, updates: Partial<Publication>): Promise<void> {
    try {
      const publicationRef = doc(db, 'publications', id);
      await updateDoc(publicationRef, updates);
    } catch (error) {
      console.error('Error al actualizar publicación:', error);
      throw error;
    }
  },

  // Obtener publicaciones de un usuario
  async getUserPublications(userId: string): Promise<Publication[]> {
    try {
      const q = query(
        collection(db, 'publications'),
        where('userId', '==', userId),
        orderBy('publishedDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publication));
    } catch (error) {
      console.error('Error al obtener publicaciones del usuario:', error);
      throw error;
    }
  },

  // Obtener publicaciones de un video específico
  async getVideoPublications(videoId: string): Promise<Publication[]> {
    try {
      const q = query(
        collection(db, 'publications'),
        where('videoId', '==', videoId),
        orderBy('publishedDate', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Publication));
    } catch (error) {
      console.error('Error al obtener publicaciones del video:', error);
      throw error;
    }
  }
};

// Función auxiliar para convertir un video de MinIO a un registro en Firebase
export const convertMinioVideoToFirebase = (
  minioUrl: string, 
  fileName: string, 
  userId: string,
  initialStatus: 'pending' | 'processing' | 'completed' | 'error' = 'pending',
  type: 'original' | 'fragment' = 'original',
  parentId: string | null = null,
  duration: number | null = null,
  thumbnailUrl: string | null = null,
  metadata: Record<string, any> = {}
): Omit<Video, 'id' | 'createdAt' | 'updatedAt'> => {
  return {
    title: fileName.replace(/\.[^/.]+$/, ''), // Eliminar extensión
    description: '',
    minioUrl,
    thumbnailUrl, // Ya es null por defecto si no se proporciona
    duration, // Ya es null por defecto si no se proporciona
    type,
    parentId, // Ya es null por defecto si no se proporciona
    status: initialStatus,
    userId,
    metadata: {
      originalFileName: fileName,
      fileSize: metadata.fileSize || null,
      mimeType: metadata.mimeType || null,
      resolution: metadata.resolution || null,
      format: metadata.format || null,
      job_id: metadata.job_id || null,
      ...metadata
    }
  };
};

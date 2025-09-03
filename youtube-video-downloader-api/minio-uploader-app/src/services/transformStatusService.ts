import { videoService, convertMinioVideoToFirebase } from './videoService';
import { transformService } from './transformService';
import type { TransformStatusResponse } from './transformService';

/**
 * Servicio para verificar y actualizar el estado de transformación de videos
 */
export const transformStatusService = {
  /**
   * Verifica el estado de un trabajo de transformación y actualiza el registro en Firebase
   * @param jobId ID del trabajo de transformación
   * @param videoId ID del video en Firebase
   * @returns Objeto con el estado actualizado
   */
  async checkTransformStatus(jobId: string, videoId: string) {
    try {
      // Obtener el estado actual del trabajo desde la API
      const status = await transformService.getTransformStatus(jobId);
      
      // Obtener el video actual de Firebase
      const video = await videoService.getVideo(videoId);
      if (!video) {
        throw new Error(`Video con ID ${videoId} no encontrado`);
      }
      
      // Determinar el nuevo estado basado en la respuesta de la API
      let newStatus: 'pending' | 'processing' | 'completed' | 'error' = 'processing';
      
      if (status.status === 'completed') {
        newStatus = 'completed';
        // Si el estado es completado, registrar los fragmentos en Firebase
        if (status.result_url) {
          await this.registerVideoFragments(status, video);
        }
      } else if (status.status === 'failed') {
        newStatus = 'error';
      } else if (status.status === 'processing') {
        newStatus = 'processing';
      }
      
      // Actualizar el video en Firebase si el estado ha cambiado
      if (video.status !== newStatus) {
        await videoService.updateVideo(videoId, {
          status: newStatus,
          metadata: {
            ...video.metadata,
            transformStatus: status
          }
        });
        
        console.log(`Estado del video ${videoId} actualizado a ${newStatus}`);
      }
      
      return {
        videoId,
        jobId,
        previousStatus: video.status,
        currentStatus: newStatus,
        transformStatus: status
      };
    } catch (error) {
      console.error('Error al verificar estado de transformación:', error);
      throw error;
    }
  },
  
  /**
   * Configura un intervalo para verificar periódicamente el estado de un trabajo
   * @param jobId ID del trabajo de transformación
   * @param videoId ID del video en Firebase
   * @param intervalMs Intervalo en milisegundos (por defecto 5000ms)
   * @param maxChecks Número máximo de verificaciones (por defecto 12)
   * @returns Función para cancelar el intervalo
   */
  startStatusPolling(jobId: string, videoId: string, intervalMs = 5000, maxChecks = 12) {
    let checkCount = 0;
    
    const intervalId = setInterval(async () => {
      try {
        checkCount++;
        console.log(`Verificando estado de transformación ${checkCount}/${maxChecks}...`);
        
        const result = await this.checkTransformStatus(jobId, videoId);
        
        // Si el estado es terminal (completado o error) o se alcanzó el máximo de verificaciones, detener el polling
        if (result.currentStatus === 'completed' || result.currentStatus === 'error' || checkCount >= maxChecks) {
          clearInterval(intervalId);
          console.log(`Polling finalizado. Estado final: ${result.currentStatus}`);
        }
      } catch (error) {
        console.error('Error durante el polling de estado:', error);
        
        // En caso de error, también detener el polling
        if (checkCount >= maxChecks) {
          clearInterval(intervalId);
          console.log('Polling finalizado por número máximo de intentos');
        }
      }
    }, intervalMs);
    
    // Devolver función para cancelar el intervalo manualmente
    return () => clearInterval(intervalId);
  },

  /**
   * Registra los fragmentos de video en Firebase cuando se completa una transformación
   * @param status Respuesta de estado de la transformación
   * @param originalVideo Video original desde el que se generaron los fragmentos
   */
  async registerVideoFragments(status: TransformStatusResponse, originalVideo: any) {
    try {
      // Verificar si hay una URL de resultado
      if (!status.result_url || !originalVideo.id) {
        console.error('No hay URL de resultado o ID de video original para registrar fragmentos');
        return;
      }

      // Verificar si ya existen fragmentos para este video
      const existingFragments = await videoService.getVideoFragments(originalVideo.id);
      if (existingFragments && existingFragments.length > 0) {
        console.log(`Ya existen ${existingFragments.length} fragmentos para el video ${originalVideo.id}`);
        return;
      }

      // Extraer información de segmentos del metadata si está disponible
      const segments = originalVideo.metadata?.transformStatus?.segments || [];
      
      if (segments.length === 0) {
        console.log('No hay información de segmentos disponible para crear fragmentos');
        
        // Si no hay segmentos definidos, crear un único fragmento con la URL de resultado
        const fragmentData = convertMinioVideoToFirebase(
          status.result_url,
          `${originalVideo.title}_fragment_1`,
          originalVideo.userId,
          'completed',
          'fragment',
          originalVideo.id,
          originalVideo.duration,
          undefined, // thumbnailUrl
          {
            ...originalVideo.metadata,
            job_id: status.job_id,
            segment_number: 1,
            transformCompleted: true
          }
        );

        // Registrar el fragmento en Firebase
        const fragmentId = await videoService.createVideo(fragmentData);
        console.log(`Fragmento único registrado con ID: ${fragmentId}`);
        return;
      }

      // Si hay segmentos definidos, crear un fragmento para cada uno
      const fragmentPromises = segments.map(async (segment: any) => {
        // Construir URL del fragmento basada en la URL de resultado y el número de segmento
        // Esto depende de cómo la API devuelve las URLs de los fragmentos
        // Por ejemplo: result_url puede ser una URL base y cada fragmento tiene un sufijo
        const resultUrl = status.result_url || '';
        const segmentUrl = `${resultUrl.replace('.mp4', '')}_segment_${segment.segment_number}.mp4`;
        
        const fragmentData = convertMinioVideoToFirebase(
          segmentUrl,
          `${originalVideo.title}_fragment_${segment.segment_number}`,
          originalVideo.userId,
          'completed',
          'fragment',
          originalVideo.id,
          segment.duration || segment.duration_minutes * 60, // Convertir minutos a segundos si es necesario
          undefined, // thumbnailUrl
          {
            ...originalVideo.metadata,
            job_id: status.job_id,
            segment_number: segment.segment_number,
            start_time: segment.start_time,
            end_time: segment.end_time,
            transformCompleted: true
          }
        );

        // Registrar el fragmento en Firebase
        return videoService.createVideo(fragmentData);
      });

      // Esperar a que todos los fragmentos se registren
      const fragmentIds = await Promise.all(fragmentPromises);
      console.log(`${fragmentIds.length} fragmentos registrados para el video ${originalVideo.id}`);
    } catch (error) {
      console.error('Error al registrar fragmentos de video:', error);
      throw error;
    }
  }
};

import { transformStatusService } from './transformStatusService';
import { videoService } from './videoService';
import type { TransformStatusResponse } from './transformService';

/**
 * Función para probar el registro de fragmentos de video
 * Esta función simula una respuesta de la API de transformación y registra fragmentos en Firebase
 * @param videoId ID del video original en Firebase
 */
export const testFragmentRegistration = async (videoId: string): Promise<void> => {
  try {
    // Obtener el video original
    const originalVideo = await videoService.getVideo(videoId);
    if (!originalVideo) {
      console.error(`Video con ID ${videoId} no encontrado`);
      return;
    }

    console.log(`Probando registro de fragmentos para video: ${originalVideo.title}`);

    // Crear una respuesta simulada de la API de transformación
    const mockTransformResponse: TransformStatusResponse = {
      status: 'completed',
      job_id: originalVideo.metadata?.job_id || `test_job_${Date.now()}`,
      result_url: `${originalVideo.minioUrl.replace('.mp4', '')}_transformed.mp4`,
      progress: 100,
      completed_at: new Date().toISOString(),
      started_at: new Date(Date.now() - 60000).toISOString(),
      segments: [
        {
          segment_number: 1,
          start_time: 0,
          end_time: 30,
          duration: 30,
          duration_minutes: 0.5
        },
        {
          segment_number: 2,
          start_time: 30,
          end_time: 60,
          duration: 30,
          duration_minutes: 0.5
        },
        {
          segment_number: 3,
          start_time: 60,
          end_time: 90,
          duration: 30,
          duration_minutes: 0.5
        }
      ]
    };

    // Actualizar el video original con la información de segmentos
    await videoService.updateVideo(videoId, {
      metadata: {
        ...originalVideo.metadata,
        transformStatus: mockTransformResponse
      }
    });

    console.log('Video original actualizado con información de segmentos');

    // Registrar los fragmentos en Firebase
    await transformStatusService.registerVideoFragments(mockTransformResponse, originalVideo);

    console.log('Prueba de registro de fragmentos completada');

    // Verificar los fragmentos registrados
    const fragments = await videoService.getVideoFragments(videoId);
    console.log(`Fragmentos registrados: ${fragments.length}`);
    fragments.forEach((fragment, index) => {
      console.log(`Fragmento ${index + 1}:`, {
        id: fragment.id,
        title: fragment.title,
        url: fragment.minioUrl,
        segmentNumber: fragment.metadata?.segment_number
      });
    });
  } catch (error) {
    console.error('Error en la prueba de registro de fragmentos:', error);
    throw error;
  }
};

/**
 * Función para eliminar fragmentos de prueba
 * @param videoId ID del video original
 */
export const cleanupTestFragments = async (videoId: string): Promise<void> => {
  try {
    const fragments = await videoService.getVideoFragments(videoId);
    console.log(`Eliminando ${fragments.length} fragmentos de prueba...`);
    
    for (const fragment of fragments) {
      if (fragment.id) {
        await videoService.deleteVideo(fragment.id);
        console.log(`Fragmento ${fragment.id} eliminado`);
      }
    }
    
    console.log('Limpieza de fragmentos de prueba completada');
  } catch (error) {
    console.error('Error al eliminar fragmentos de prueba:', error);
    throw error;
  }
};

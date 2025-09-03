/**
 * Script para probar el flujo completo de actualización de fragmentos
 * 
 * Este script simula el proceso de:
 * 1. Obtener un video original existente
 * 2. Simular una respuesta de transformación completada
 * 3. Registrar fragmentos en Firebase
 * 4. Verificar que los fragmentos se han creado correctamente
 */

import { videoService } from '../services/videoService';
import { transformStatusService } from '../services/transformStatusService';
import type { TransformStatusResponse } from '../services/transformService';

/**
 * Función principal para probar el flujo de fragmentos
 * @param videoId ID de un video original existente (opcional)
 */
export async function testFragmentFlow(videoId?: string): Promise<void> {
  try {
    console.log('Iniciando prueba de flujo de fragmentos...');
    
    // 1. Obtener un video original existente o el primero disponible
    let targetVideo;
    if (videoId) {
      targetVideo = await videoService.getVideo(videoId);
      if (!targetVideo) {
        throw new Error(`No se encontró un video con ID: ${videoId}`);
      }
    } else {
      // Buscar el primer video original disponible
      const videos = await videoService.getVideos();
      targetVideo = videos.find(v => v.type === 'original');
      
      if (!targetVideo) {
        throw new Error('No se encontraron videos originales para probar');
      }
    }
    
    console.log(`Video seleccionado para prueba: ${targetVideo.title} (${targetVideo.id})`);
    
    // 2. Verificar si ya tiene fragmentos
    const existingFragments = await videoService.getVideoFragments(targetVideo.id);
    if (existingFragments && existingFragments.length > 0) {
      console.log(`El video ya tiene ${existingFragments.length} fragmentos. Eliminándolos para la prueba...`);
      
      // Eliminar fragmentos existentes
      for (const fragment of existingFragments) {
        if (fragment.id) {
          await videoService.deleteVideo(fragment.id);
          console.log(`Fragmento ${fragment.id} eliminado`);
        }
      }
    }
    
    // 3. Crear una respuesta simulada de transformación
    const mockTransformResponse: TransformStatusResponse = {
      status: 'completed',
      job_id: targetVideo.metadata?.job_id || `test_job_${Date.now()}`,
      result_url: `${targetVideo.minioUrl.replace('.mp4', '')}_transformed.mp4`,
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
    
    // 4. Actualizar el video original con la información de segmentos
    await videoService.updateVideo(targetVideo.id, {
      metadata: {
        ...targetVideo.metadata,
        transformStatus: mockTransformResponse
      }
    });
    
    console.log('Video original actualizado con información de segmentos');
    
    // 5. Registrar los fragmentos en Firebase
    await transformStatusService.registerVideoFragments(mockTransformResponse, targetVideo);
    
    // 6. Verificar los fragmentos registrados
    const newFragments = await videoService.getVideoFragments(targetVideo.id);
    console.log(`Fragmentos registrados: ${newFragments.length}`);
    
    newFragments.forEach((fragment, index) => {
      console.log(`Fragmento ${index + 1}:`, {
        id: fragment.id,
        title: fragment.title,
        url: fragment.minioUrl,
        segmentNumber: fragment.metadata?.segment_number,
        startTime: fragment.metadata?.start_time,
        endTime: fragment.metadata?.end_time
      });
    });
    
    console.log('Prueba de flujo de fragmentos completada con éxito');
    return;
    
  } catch (error) {
    console.error('Error en la prueba de flujo de fragmentos:', error);
    throw error;
  }
}

// Función para ejecutar la prueba desde la consola del navegador
(window as any).testFragmentFlow = testFragmentFlow;

// Servicio para la API de transformación de video a formato vertical

export interface TransformParams {
  video_url?: string;
  minio_object?: {
    bucket: string;
    object_name: string;
  };
  segment_duration_minutes: number;
  zoom_level: number;
  background_color: string;
  background_image_url?: string;
  webhook_url: string;
  job_id: string;
  chat_id: string;
  chat_Whatsapp?: string; // opcional: número E.164 sin '+'
  add_subtitles: boolean;
  language: string;
  subtitle_settings: {
    line_color: string;
    word_color: string;
    all_caps: boolean;
    max_words_per_line: number;
    font_size: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikeout: boolean;
    outline_width: number;
    shadow_offset: number;
    style: string;
    font_family: string;
    position: string;
    margin_v: number;
    line_count: number;
    max_lines: number;
  };
}

export interface TransformResponse {
  status: string;
  job_id: string;
  message: string;
  segments: {
    segment_number: number;
    start_time: number;
    end_time: number;
    duration: number;
    duration_minutes: number;
  }[];
}

// Configuración de la API
// Usar proxy local para evitar problemas de CORS
const API_URL = '/api/v1/video/transform-to-vertical';
const API_KEY = 'l2jatniel';
const WEBHOOK_URL = 'https://clickgo-n8n.1xrk3z.easypanel.host/webhook/videoYoutube';

// Valores predeterminados para los parámetros
export const defaultTransformParams: Omit<TransformParams, 'minio_object'> = {
  segment_duration_minutes: 2,
  zoom_level: 30,
  background_color: '#000000',
  webhook_url: WEBHOOK_URL,
  job_id: `job_${Date.now()}`,
  chat_id: '', // Campo obligatorio - se precarga desde perfil
  add_subtitles: true,
  language: 'es',
  subtitle_settings: {
    line_color: '#FFFFFF',
    word_color: '#FFFF00',
    all_caps: true,
    max_words_per_line: 3,
    font_size: 60,
    bold: false,
    italic: false,
    underline: false,
    strikeout: false,
    outline_width: 3,
    shadow_offset: 4,
    style: 'highlight',
    font_family: 'The Bold Font',
    position: 'middle_center',
    margin_v: 10,
    line_count: 2,
    max_lines: 2
  }
};

// Opciones para los selectores
export const subtitleStyles = [
  { value: 'highlight', label: 'Highlight' },
  { value: 'outline', label: 'Outline' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'plain', label: 'Plain' },
  { value: 'karaoke', label: 'Karaoke' }
];

export const fontFamilies = [
  { value: 'The Bold Font', label: 'The Bold Font' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Verdana', label: 'Verdana' }
];

export const positions = [
  { value: 'top_left', label: 'Arriba Izquierda' },
  { value: 'top_center', label: 'Arriba Centro' },
  { value: 'top_right', label: 'Arriba Derecha' },
  { value: 'middle_left', label: 'Medio Izquierda' },
  { value: 'middle_center', label: 'Medio Centro' },
  { value: 'middle_right', label: 'Medio Derecha' },
  { value: 'bottom_left', label: 'Abajo Izquierda' },
  { value: 'bottom_center', label: 'Abajo Centro' },
  { value: 'bottom_right', label: 'Abajo Derecha' },
  { value: 'lower_center', label: 'Parte Inferior Centro' }
];

export const languages = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Portugués' }
];

// Función para transformar video usando URL del video
export const transformVideo = async (
  videoUrl: string,
  params: Partial<TransformParams> = {}
): Promise<TransformResponse> => {
  try {
    // Combinar parámetros predeterminados con los proporcionados
    const transformParams: TransformParams = {
      ...defaultTransformParams,
      ...params,
      video_url: videoUrl
    };
    
    // Eliminar minio_object si existe, ya que usamos video_url
    delete transformParams.minio_object;

    console.log('Enviando parámetros de transformación:', transformParams);

    const response = await fetch(API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify(transformParams)
    });

    if (!response.ok) {
      let errorMessage = `Error HTTP: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = `${errorMessage} - ${errorData.message}`;
        } else if (errorData.error) {
          errorMessage = `${errorMessage} - ${errorData.error}`;
        } else if (errorData.detail) {
          errorMessage = `${errorMessage} - ${errorData.detail}`;
        }
        console.error('Respuesta de error del servidor:', errorData);
      } catch (e) {
        console.error('No se pudo parsear la respuesta de error');
      }
      throw new Error(errorMessage);
    }

    const data: TransformResponse = await response.json();
    console.log('Respuesta de la API de transformación:', data);
    
    return data;
  } catch (error) {
    console.error('Error al transformar video:', error);
    throw error;
  }
};

// Función para generar un job_id único
export const generateJobId = (fileName: string = ''): string => {
  // Formatear la fecha actual
  const now = new Date();
  const formattedDate = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Limpiar el nombre del archivo para que sea seguro usarlo en un ID
  const safeFileName = fileName
    ? fileName.replace(/\.[^/.]+$/, '') // Eliminar extensión
             .replace(/[^a-zA-Z0-9]/g, '_') // Reemplazar caracteres no alfanuméricos con guiones bajos
             .substring(0, 30) // Limitar longitud
    : 'unknown';
  
  return `transform_${safeFileName}_${formattedDate}_${Math.random().toString(36).substring(2, 7)}`;
};

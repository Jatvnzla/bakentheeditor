import React, { useState, useEffect } from 'react';
import { 
  TextInput, Button, Group, Paper, Title, Select, Progress, Text, Alert,
  Image, Divider, Tabs, Switch, Checkbox, ColorInput, NumberInput, Box, Slider, rem
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import type { FileWithPath } from '@mantine/dropzone';
import { useForm } from '@mantine/form';
import { 
  IconAlertCircle, IconWand, IconPhoto, IconUpload, IconX, IconFile
} from '@tabler/icons-react';
import axios from 'axios';
import { uploadToMinio, minioConfig, listMinioObjects } from '../services/minio';
import { useAppContext } from '../context/AppContext';

interface VideoTransformerProps {}

interface TransformParams {
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

const VideoTransformer: React.FC<VideoTransformerProps> = () => {
  const { minioConfig } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [minioVideos, setMinioVideos] = useState<{value: string, label: string}[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoFiles, setVideoFiles] = useState<FileWithPath[]>([]);

  const API_URL = 'https://prueba-ciberfobia.1xrk3z.easypanel.host/v1/video/transform-to-vertical';
  const API_KEY = 'l2jatniel';
  const WEBHOOK_URL = 'https://clickgo-n8n.1xrk3z.easypanel.host/webhook/videoYoutube';

  const subtitleStyles = [
    { value: 'highlight', label: 'Highlight' },
    { value: 'outline', label: 'Outline' },
    { value: 'shadow', label: 'Shadow' },
    { value: 'plain', label: 'Plain' }
  ];

  const fontFamilies = [
    { value: 'The Bold Font', label: 'The Bold Font' },
    { value: 'Arial', label: 'Arial' },
    { value: 'Helvetica', label: 'Helvetica' },
    { value: 'Times New Roman', label: 'Times New Roman' },
    { value: 'Verdana', label: 'Verdana' }
  ];

  const positions = [
    { value: 'top_left', label: 'Arriba Izquierda' },
    { value: 'top_center', label: 'Arriba Centro' },
    { value: 'top_right', label: 'Arriba Derecha' },
    { value: 'middle_left', label: 'Medio Izquierda' },
    { value: 'middle_center', label: 'Medio Centro' },
    { value: 'middle_right', label: 'Medio Derecha' },
    { value: 'bottom_left', label: 'Abajo Izquierda' },
    { value: 'bottom_center', label: 'Abajo Centro' },
    { value: 'bottom_right', label: 'Abajo Derecha' }
  ];

  const languages = [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'Inglés' }
  ];

  const form = useForm<TransformParams>({
    initialValues: {
      segment_duration_minutes: 4,
      zoom_level: 4,
      background_color: '#000000',
      webhook_url: WEBHOOK_URL,
      job_id: `job_${Date.now()}`,
      add_subtitles: true,
      language: 'es',
      subtitle_settings: {
        line_color: '#000000',
        word_color: '#FFFFFF',
        all_caps: true,
        max_words_per_line: 5,
        font_size: 50,
        bold: false,
        italic: false,
        underline: true,
        strikeout: false,
        outline_width: 1,
        shadow_offset: 1,
        style: 'highlight',
        font_family: 'The Bold Font',
        position: 'middle_center',
        margin_v: 150,
        line_count: 1,
        max_lines: 1
      }
    },
    validate: {
      job_id: (value) => (!value ? 'ID del trabajo es requerido' : null),
    }
  });

  // Cargar lista de videos de MinIO al iniciar
  useEffect(() => {
    loadMinioVideos();
  }, []);

  const loadMinioVideos = async () => {
    try {
      setLoadingVideos(true);
      const objects = await listMinioObjects(minioConfig, 'ciberfobia');
      
      // Filtrar solo archivos de video
      const videoObjects = objects
        .filter(obj => obj.name.endsWith('.mp4'))
        .map(obj => ({
          value: obj.name,
          label: obj.name
        }));
      
      setMinioVideos(videoObjects);
    } catch (error) {
      console.error('Error al cargar videos de MinIO:', error);
      setError('No se pudieron cargar los videos de MinIO');
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleBackgroundImageUpload = async (file: File | null) => {
    if (!file) return;
    
    try {
      setUploadingBackground(true);
      setBackgroundUploadProgress(0);
      setError(null);
      
      // Configuración específica para imágenes de fondo
      const backgroundConfig = {
        ...minioConfig,
        uploadPath: 'backgrounds' // Cambiar la ruta para imágenes de fondo
      };
      
      // Subir la imagen a MinIO
      const uploadedUrl = await uploadToMinio(
        file, 
        backgroundConfig, 
        (progress) => setBackgroundUploadProgress(progress)
      );
      
      if (uploadedUrl) {
        // Actualizar el formulario con la URL de la imagen
        form.setFieldValue('background_image_url', uploadedUrl);
        console.log('Imagen subida:', uploadedUrl);
        setSuccess('Imagen de fondo subida correctamente');
      } else {
        throw new Error('Error al subir la imagen');
      }
    } catch (error) {
      console.error('Error al subir la imagen de fondo:', error);
      setError(`Error al subir la imagen: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleDropVideo = (acceptedFiles: FileWithPath[]) => {
    if (!acceptedFiles.length) return;
    
    setVideoFiles(acceptedFiles);
    setError(null);
    
    // Limpiar campos que podrían estar en conflicto
    form.setFieldValue('video_url', '');
    form.setFieldValue('minio_object.object_name', '');
  };
  
  const [transformStatus, setTransformStatus] = useState<{
    isTransforming: boolean;
    jobId: string | null;
    message: string | null;
    error: string | null;
    segments: any[] | null;
  }>({ 
    isTransforming: false, 
    jobId: null, 
    message: null, 
    error: null, 
    segments: null 
  });

  // Función para enviar el objeto MinIO a la API de transformación
  const sendToTransformAPI = async (bucketName: string, objectName: string) => {
    try {
      // Actualizar estado para mostrar que estamos transformando
      setTransformStatus({
        isTransforming: true,
        jobId: null,
        message: "Iniciando transformación del video...",
        error: null,
        segments: null
      });

      // Crear el payload para la API según el formato requerido
      const apiPayload = {
        minio_object: {
          bucket: bucketName,
          object_name: objectName
        },
        segment_duration_minutes: 4,
        zoom_level: 4,
        background_color: "#000000",
        background_image_url: "https://prueba-minio.1xrk3z.easypanel.host/ciberfobia/video/fondo%20videos%20redes.png",
        webhook_url: "https://clickgo-n8n.1xrk3z.easypanel.host/webhook/videoYoutube",
        job_id: `transform-${Date.now()}`,
        chat_id: "telegram-123456",
        add_subtitles: true,
        language: "es",
        subtitle_settings: {
          line_color: "#000000",
          word_color: "#FFFFFF",
          all_caps: true,
          max_words_per_line: 5,
          font_size: 50,
          bold: false,
          italic: false,
          underline: true,
          strikeout: false,
          outline_width: 1,
          shadow_offset: 1,
          style: "highlight",
          font_family: "The Bold Font",
          position: "middle_center",
          margin_v: 150,
          line_count: 1,
          max_lines: 1
        }
      };
      
      console.log('Enviando a API de transformación:', apiPayload);
      
      // Realizar la llamada a la API
      const response = await axios.post("https://prueba-ciberfobia.1xrk3z.easypanel.host/v1/video/transform-to-vertical", apiPayload, {
        headers: {
          'X-API-KEY': "l2jatniel",
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Respuesta de la API:', response.data);
      
      // Actualizar el estado con la respuesta
      setTransformStatus({
        isTransforming: true,
        jobId: response.data.job_id || apiPayload.job_id,
        message: response.data.message || "Transformación iniciada correctamente",
        error: null,
        segments: response.data.segments || null
      });
      
      return response.data;
    } catch (error) {
      console.error('Error al enviar a la API de transformación:', error);
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message || 'Error sin mensaje';
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error !== null && error !== undefined) {
        errorMessage = String(error);
      }
      
      // Actualizar el estado con el error
      setTransformStatus({
        isTransforming: false,
        jobId: null,
        message: null,
        error: `Error al transformar el video: ${errorMessage}`,
        segments: null
      });
      
      throw error;
    }
  };

  const handleVideoUpload = async () => {
    if (!videoFiles.length) return;
    
    try {
      // Limpiar campos que podrían estar en conflicto
      form.setFieldValue('video_url', '');
      form.setFieldValue('minio_object.object_name', '');
      
      setUploadingVideo(true);
      setVideoUploadProgress(0);
      setError(null);
      
      const file = videoFiles[0]; // Tomamos solo el primer archivo
      
      // Subir el video a MinIO usando la función existente
      const uploadedUrl = await uploadToMinio(
        file, 
        minioConfig, 
        (progress) => setVideoUploadProgress(progress)
      );
      
      if (uploadedUrl) {
        // Extraer el nombre del objeto de la URL
        const objectName = uploadedUrl.split('/').pop();
        if (objectName) {
          // Construir la ruta del objeto en MinIO
          const minioObjectPath = `videosYotube/${objectName}`;
          
          // Actualizar el formulario con el objeto de MinIO
          form.setFieldValue('minio_object', {
            bucket: 'ciberfobia',
            object_name: minioObjectPath
          });
          
          console.log('Video subido:', uploadedUrl);
          
          // Actualizar la lista de videos disponibles
          await loadMinioVideos();
          
          // Mostrar mensaje de éxito
          setSuccess('Video subido correctamente a MinIO');
          
          // Limpiar los archivos después de subirlos
          setVideoFiles([]);
          
          try {
            // Enviar automáticamente a la API para comenzar la transformación
            console.log('Enviando a la API de transformación...');
            await sendToTransformAPI('ciberfobia', minioObjectPath);
            console.log('Transformación iniciada correctamente');
          } catch (apiError) {
            console.error('Error al enviar a la API:', apiError);
          }
        }
      } else {
        throw new Error('Error al subir el video');
      }
    } catch (error) {
      console.error('Error al subir el video:', error);
      // Manejo más detallado del error para evitar objetos vacíos en la consola
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message || 'Error sin mensaje';
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error !== null && error !== undefined) {
        errorMessage = String(error);
      }
      setError(`Error al subir el video: ${errorMessage}`);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async (values: TransformParams) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Preparar los datos para la API
      const apiData = { ...values };
      
      // Si se seleccionó un video de MinIO, usar minio_object en lugar de video_url
      if (form.values.minio_object?.object_name) {
        apiData.minio_object = {
          bucket: 'ciberfobia',
          object_name: form.values.minio_object.object_name
        };
        delete apiData.video_url; // Eliminar video_url si estamos usando minio_object
      }
      
      // Realizar la llamada a la API
      const response = await axios.post(API_URL, apiData, {
        headers: {
          'X-API-KEY': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      setSuccess(`Transformación iniciada correctamente. ID del trabajo: ${values.job_id}`);
      console.log('Respuesta de la API:', response.data);
    } catch (error) {
      console.error('Error al transformar el video:', error);
      setError(`Error al transformar el video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Title order={2} mb="md">Transformar Video a Vertical</Title>
      
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Tabs defaultValue="video">
          <Tabs.List>
            <Tabs.Tab value="video">Selección de Video</Tabs.Tab>
            <Tabs.Tab value="background">Fondo</Tabs.Tab>
            <Tabs.Tab value="subtitles">Subtítulos</Tabs.Tab>
            <Tabs.Tab value="advanced">Avanzado</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="video" pt="md">
            <Title order={4} mb="md">Seleccionar Video</Title>
            
            <Dropzone
              onDrop={(files) => {
                if (files && files.length > 0) {
                  handleDropVideo(files);
                }
              }}
              onReject={(files) => console.log('rejected files', files)}
              accept={{
                'video/*': ['.mp4', '.webm', '.mkv', '.avi', '.mov'],
              }}
              disabled={loading || !!form.values.video_url || uploadingVideo}
              mb="md"
            >
              <Group justify="center" gap="xl" mih={150} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-blue-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-red-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFile
                    style={{ width: rem(52), height: rem(52), color: 'var(--mantine-color-dimmed)' }}
                    stroke={1.5}
                  />
                </Dropzone.Idle>

                <div>
                  <Text size="xl" inline>
                    Arrastra un video aquí o haz clic para seleccionar
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    Sube cualquier archivo de video, sin límite de tamaño
                  </Text>
                </div>
              </Group>
            </Dropzone>
            
            {videoFiles.length > 0 && (
              <Box style={{ marginTop: '10px', marginBottom: '15px' }}>
                <Text fw={500} mb={5}>Video seleccionado:</Text>
                {videoFiles.map((file, index) => (
                  <Text key={index} size="sm">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                ))}
                
                <Group justify="flex-end" mt="md">
                  <Button 
                    onClick={handleVideoUpload} 
                    loading={uploadingVideo}
                    leftSection={<IconUpload size={16} />}
                  >
                    Subir a MinIO
                  </Button>
                </Group>
              </Box>
            )}
            
            {uploadingVideo && (
              <Box mb="md">
                <Text size="sm">Subiendo video: {Math.round(videoUploadProgress)}%</Text>
                <Progress value={videoUploadProgress} animated mb="md" />
              </Box>
            )}
            
            {/* Panel de estado de transformación integrado en la sección de video */}
            {transformStatus.isTransforming && (
              <Paper mb="md" p="md" withBorder shadow="xs">
                <Title order={5} mb="md">Transformación en Proceso</Title>
                
                {transformStatus.message && (
                  <Alert color="blue" title="Estado" mb="md" variant="light">
                    {transformStatus.message}
                  </Alert>
                )}
                
                {transformStatus.jobId && (
                  <Text mb="md" size="sm"><b>ID del trabajo:</b> {transformStatus.jobId}</Text>
                )}
                
                {transformStatus.error && (
                  <Alert color="red" title="Error" mb="md" variant="light">
                    {transformStatus.error}
                  </Alert>
                )}
              </Paper>
            )}
            
            <Divider my="md" label="O" labelPosition="center" />
            
            <TextInput
              label="URL del video"
              placeholder="https://www.youtube.com/watch?v=ejemplo o https://ejemplo.com/video.mp4"
              {...form.getInputProps('video_url')}
              mb="md"
              disabled={loading || !!form.values.minio_object?.object_name}
              description="Ingresa la URL de un video de YouTube o cualquier otra fuente"
            />
            
            <Divider my="md" label="O" labelPosition="center" />
            
            <Select
              label="Video de MinIO"
              placeholder="Selecciona un video ya subido"
              data={minioVideos}
              searchable
              clearable
              nothingFoundMessage="No se encontraron videos"
              {...form.getInputProps('minio_object.object_name')}
              mb="md"
              disabled={loading || loadingVideos || !!form.values.video_url}
              description="Selecciona un video que ya hayas subido anteriormente"
            />
            
            <Button 
              onClick={loadMinioVideos} 
              variant="outline" 
              mb="xl"
              loading={loadingVideos}
            >
              Actualizar lista de videos
            </Button>
            
            <Text size="sm" c="dimmed" mb="md">
              Nota: Puedes subir un archivo, proporcionar una URL o seleccionar un video de MinIO, pero solo una opción a la vez.
            </Text>
          </Tabs.Panel>

          <Tabs.Panel value="background" pt="md">
            <Title order={4} mb="md">Configuración del Fondo</Title>
            
            <ColorInput
              label="Color de fondo"
              format="hex"
              swatches={['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF']}
              {...form.getInputProps('background_color')}
              mb="md"
            />
            
            <Dropzone
              onDrop={(files) => {
                if (files && files.length > 0) {
                  handleBackgroundImageUpload(files[0]);
                }
              }}
              onReject={(files) => console.log('rejected files', files)}
              accept={{
                'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
              }}
              disabled={uploadingBackground}
              mb="md"
              maxFiles={1}
            >
              <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: 'none' }}>
                <Dropzone.Accept>
                  <IconUpload
                    style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-blue-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX
                    style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-red-6)' }}
                    stroke={1.5}
                  />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconPhoto
                    style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-dimmed)' }}
                    stroke={1.5}
                  />
                </Dropzone.Idle>

                <div>
                  <Text size="md" inline>
                    Arrastra una imagen aquí o haz clic para seleccionar
                  </Text>
                  <Text size="xs" c="dimmed" inline mt={7}>
                    Selecciona una imagen para usar como fondo
                  </Text>
                </div>
              </Group>
            </Dropzone>
            
            {uploadingBackground && (
              <Box mb="md">
                <Text size="sm">Subiendo imagen: {Math.round(backgroundUploadProgress)}%</Text>
                <Progress value={backgroundUploadProgress} animated mb="md" />
              </Box>
            )}
            
            <TextInput
              label="URL de imagen de fondo"
              placeholder="https://prueba-minio.1xrk3z.easypanel.host/ciberfobia/video/fondo.png"
              {...form.getInputProps('background_image_url')}
              mb="md"
            />
            
            {form.values.background_image_url && (
              <Box mb="md">
                <Text size="sm" mb="xs">Vista previa:</Text>
                <Image 
                  src={form.values.background_image_url} 
                  alt="Imagen de fondo" 
                  height={150} 
                  fit="contain"
                />
              </Box>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="subtitles" pt="md">
            <Title order={4} mb="md">Configuración de Subtítulos</Title>
            
            <Switch
              label="Añadir subtítulos"
              {...form.getInputProps('add_subtitles', { type: 'checkbox' })}
              mb="md"
            />
            
            {form.values.add_subtitles && (
              <>
                <Select
                  label="Idioma"
                  data={languages}
                  {...form.getInputProps('language')}
                  mb="md"
                />
                
                <Group grow mb="md">
                  <ColorInput
                    label="Color de línea"
                    format="hex"
                    {...form.getInputProps('subtitle_settings.line_color')}
                  />
                  <ColorInput
                    label="Color de palabra"
                    format="hex"
                    {...form.getInputProps('subtitle_settings.word_color')}
                  />
                </Group>
                
                <Group grow mb="md">
                  <NumberInput
                    label="Tamaño de fuente"
                    min={10}
                    max={100}
                    {...form.getInputProps('subtitle_settings.font_size')}
                  />
                  <NumberInput
                    label="Máx. palabras por línea"
                    min={1}
                    max={10}
                    {...form.getInputProps('subtitle_settings.max_words_per_line')}
                  />
                </Group>
                
                <Group grow mb="md">
                  <Select
                    label="Estilo"
                    data={subtitleStyles}
                    {...form.getInputProps('subtitle_settings.style')}
                  />
                  <Select
                    label="Fuente"
                    data={fontFamilies}
                    {...form.getInputProps('subtitle_settings.font_family')}
                  />
                </Group>
                
                <Select
                  label="Posición"
                  data={positions}
                  {...form.getInputProps('subtitle_settings.position')}
                  mb="md"
                />
                
                <Group mb="md">
                  <Checkbox
                    label="Mayúsculas"
                    {...form.getInputProps('subtitle_settings.all_caps', { type: 'checkbox' })}
                  />
                  <Checkbox
                    label="Negrita"
                    {...form.getInputProps('subtitle_settings.bold', { type: 'checkbox' })}
                  />
                  <Checkbox
                    label="Cursiva"
                    {...form.getInputProps('subtitle_settings.italic', { type: 'checkbox' })}
                  />
                  <Checkbox
                    label="Subrayado"
                    {...form.getInputProps('subtitle_settings.underline', { type: 'checkbox' })}
                  />
                  <Checkbox
                    label="Tachado"
                    {...form.getInputProps('subtitle_settings.strikeout', { type: 'checkbox' })}
                  />
                </Group>
                
                <Group grow mb="md">
                  <NumberInput
                    label="Ancho de contorno"
                    min={0}
                    max={5}
                    {...form.getInputProps('subtitle_settings.outline_width')}
                  />
                  <NumberInput
                    label="Desplazamiento de sombra"
                    min={0}
                    max={5}
                    {...form.getInputProps('subtitle_settings.shadow_offset')}
                  />
                </Group>
                
                <Group grow mb="md">
                  <NumberInput
                    label="Margen vertical"
                    min={0}
                    max={300}
                    {...form.getInputProps('subtitle_settings.margin_v')}
                  />
                  <NumberInput
                    label="Número de líneas"
                    min={1}
                    max={5}
                    {...form.getInputProps('subtitle_settings.line_count')}
                  />
                </Group>
              </>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="advanced" pt="md">
            <Title order={4} mb="md">Configuración Avanzada</Title>
            
            <NumberInput
              label="Duración del segmento (minutos)"
              min={1}
              max={10}
              {...form.getInputProps('segment_duration_minutes')}
              mb="md"
            />
            
            <Text size="sm" mb="xs">Nivel de zoom</Text>
            <Slider
              min={1}
              max={10}
              step={1}
              marks={[
                { value: 1, label: '1' },
                { value: 5, label: '5' },
                { value: 10, label: '10' }
              ]}
              {...form.getInputProps('zoom_level')}
              mb="xl"
            />
            
            <TextInput
              label="ID del trabajo"
              placeholder="job_123456"
              {...form.getInputProps('job_id')}
              mb="md"
            />
            
            <TextInput
              label="URL del webhook"
              placeholder="https://ejemplo.com/webhook"
              {...form.getInputProps('webhook_url')}
              mb="md"
            />
          </Tabs.Panel>
        </Tabs>
        
        <Group justify="flex-end" mt="xl">
          <Button type="submit" loading={loading} leftSection={<IconWand size={16} />}>
            Transformar Video
          </Button>
        </Group>
      </form>
      
      {error && (
        <Alert color="red" title="Error" mt="md" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert color="green" title="Éxito" mt="md">
          {success}
        </Alert>
      )}
      
      {/* Panel de estado de transformación */}
      {transformStatus.isTransforming && (
        <Paper withBorder shadow="xs" p="md" mt="md">
          <Title order={4} mb="md">Estado de la Transformación</Title>
          
          {transformStatus.message && (
            <Alert color="blue" title="Procesando" mb="md">
              {transformStatus.message}
            </Alert>
          )}
          
          {transformStatus.jobId && (
            <Text mb="md"><b>ID del trabajo:</b> {transformStatus.jobId}</Text>
          )}
          
          {transformStatus.segments && transformStatus.segments.length > 0 && (
            <>
              <Text mb="xs"><b>Segmentos a procesar:</b> {transformStatus.segments.length}</Text>
              <Progress 
                value={(0/transformStatus.segments.length) * 100} 
                mb="md"
                size="xl"
                color="blue"
                striped
                animated
              />
              
              <Box mb="md">
                {transformStatus.segments.map((segment, index) => (
                  <Paper key={index} p="xs" mb="xs" withBorder>
                    <Group justify="space-between">
                      <Text>Segmento {segment.segment_number}</Text>
                      <Text size="sm" color="dimmed">
                        {Math.floor(segment.start_time / 60)}:{(segment.start_time % 60).toString().padStart(2, '0')} - 
                        {Math.floor(segment.end_time / 60)}:{(segment.end_time % 60).toString().padStart(2, '0')}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Box>
            </>
          )}
          
          {transformStatus.error && (
            <Alert color="red" title="Error" icon={<IconAlertCircle />}>
              {transformStatus.error}
            </Alert>
          )}
        </Paper>
      )}
    </Paper>
  );
};

export default VideoTransformer;

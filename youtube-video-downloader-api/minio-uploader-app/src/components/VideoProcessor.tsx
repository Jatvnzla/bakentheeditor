import { useEffect, useState } from 'react';
import {
  Paper,
  Title,
  Text,
  Button,
  Group,
  Collapse,
  ActionIcon,
  Alert,
  Progress,
  Box,
  Tabs,
  TextInput,
  NumberInput,
  ColorInput,
  Select,
  Switch,
  Checkbox,
  Slider,
  Divider,
  Stack,
  rem
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { 
  Dropzone, 
  IMAGE_MIME_TYPE
} from '@mantine/dropzone';
import type { FileWithPath } from '@mantine/dropzone';
import {
  IconSettings,
  IconWand,
  IconCheck,
  IconAlertCircle,
  IconChevronUp,
  IconVideo,
  IconMessageCircle,
  IconPalette,
  IconUpload,
  IconX,
  IconPhoto
} from '@tabler/icons-react';
import {
  transformVideo,
  defaultTransformParams,
  subtitleStyles,
  fontFamilies,
  positions,
  languages,
  generateJobId,
  type TransformParams,
  type TransformResponse
} from '../services/transformService';
import { uploadToMinio, minioConfig } from '../services/minio';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface VideoProcessorProps {
  videoUrl: string;
  fileName: string;
}

export function VideoProcessor({ videoUrl, fileName }: VideoProcessorProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundUploadProgress, setBackgroundUploadProgress] = useState(0);
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>('');
  const [success, setSuccess] = useState<string | null>(null);
  const [transformResult, setTransformResult] = useState<TransformResponse | null>(null);
  const { user } = useAuth();
  // WhatsApp per-job controls
  const [sendToWhatsapp, setSendToWhatsapp] = useState(false);
  const [waNumber, setWaNumber] = useState(''); // UI with '+'
  const [waFieldError, setWaFieldError] = useState<string | null>(null);

  const form = useForm<Omit<TransformParams, 'minio_object'>>({
    initialValues: {
      ...defaultTransformParams,
      job_id: generateJobId(fileName)
    }
  });

  // Precargar chat_id y chat_Whatsapp desde Firestore para evitar pedirlo en UI
  useEffect(() => {
    let mounted = true;
    async function loadChatId() {
      if (!user?.uid) return;
      try {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        const data = snap.data() as { id_telegram?: string; whatsapp_number?: string; send_to_whatsapp?: boolean; webhook_url?: string } | undefined;
        if (!mounted || !data) return;
        if (data.id_telegram) {
          form.setFieldValue('chat_id', data.id_telegram);
        }
        if (data.whatsapp_number) {
          setWaNumber(`+${data.whatsapp_number}`);
        }
        const enabled = !!(data.send_to_whatsapp && data.whatsapp_number);
        setSendToWhatsapp(enabled);
        if (enabled) {
          form.setFieldValue('chat_Whatsapp', data.whatsapp_number);
        } else {
          form.setFieldValue('chat_Whatsapp', undefined as unknown as string);
        }
      } catch (e) {
        // No interrumpir UI; si falla, el usuario podría volver a intentarlo más tarde
        console.warn('No se pudo cargar id_telegram del perfil', e);
      }
    }
    loadChatId();
    return () => { mounted = false; };
  }, [user?.uid]);

  const handleTransform = async (values: Omit<TransformParams, 'minio_object'>) => {
    // Validar que chat_id esté presente (debería venir precargado desde Firestore)
    if (!values.chat_id || values.chat_id.trim() === '') {
      setError('Falta tu Chat ID de Telegram en el perfil. Vuelve a iniciar sesión o completa tu perfil.');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);
    setTransformResult(null);

    try {
      // WhatsApp validation and persistence if enabled (allow group IDs / flexible formats)
      if (sendToWhatsapp) {
        setWaFieldError(null);
        const waTrim = waNumber.trim().replace(/\s+/g, '');
        const waStored = waTrim.startsWith('+') ? waTrim.slice(1) : waTrim;
        if (!waStored) {
          setWaFieldError('Ingresa un identificador de WhatsApp.');
          setProcessing(false);
          return;
        }
        form.setFieldValue('chat_Whatsapp', waStored);
        // Persist to profile so futuras sesiones lo carguen
        if (user?.uid) {
          await setDoc(doc(db, 'users', user.uid), {
            whatsapp_number: waStored,
            send_to_whatsapp: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      } else {
        form.setFieldValue('chat_Whatsapp', undefined as unknown as string);
        if (user?.uid) {
          await setDoc(doc(db, 'users', user.uid), {
            send_to_whatsapp: false,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }

      // Si hay imagen de fondo subida, usarla en lugar del color
      const finalValues = {
        ...values,
        background_image_url: backgroundImageUrl || values.background_image_url
      };
      
      const result = await transformVideo(videoUrl, finalValues);
      setTransformResult(result);
      setSuccess(`Video enviado para transformación.`);
    } catch (error) {
      console.error('Error al transformar video:', error);
      
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error !== null && error !== undefined) {
        errorMessage = String(error);
      }
      
      setError(`Error al transformar video: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickTransform = () => {
    // Usar valores predeterminados para transformación rápida
    handleTransform(form.values);
  };

  const handleBackgroundImageUpload = async (files: FileWithPath[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    setUploadingBackground(true);
    setBackgroundUploadProgress(0);
    setError(null);
    
    try {
      const url = await uploadToMinio(
        file,
        minioConfig,
        (progress) => setBackgroundUploadProgress(progress)
      );
      
      setBackgroundImageUrl(url);
      // Actualizar el formulario con la URL de la imagen
      form.setFieldValue('background_image_url', url);
    } catch (error) {
      console.error('Error al subir imagen de fondo:', error);
      setError('Error al subir imagen de fondo: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setUploadingBackground(false);
    }
  };

  return (
    <Paper p="lg" radius="lg" shadow="xl" withBorder={false} className="glass" mt="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Procesar Video</Title>
          <Text size="sm" c="dimmed">
            {fileName} - Subido exitosamente a MinIO
          </Text>
        </div>
        <ActionIcon
          variant="light"
          color="brand"
          size="lg"
          onClick={() => setShowSettings(!showSettings)}
          title={showSettings ? 'Ocultar configuración' : 'Mostrar configuración'}
        >
          {showSettings ? <IconChevronUp size={20} /> : <IconSettings size={20} />}
        </ActionIcon>
      </Group>

      {/* Vista previa del video y nota de chat_id */}
      <Box mb="md">
        <Text size="sm" mb="xs" fw={500}>Vista previa:</Text>
        <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
          {videoUrl}
        </Text>
        {form.values.chat_id && (
          <Text size="xs" c="dimmed" mt="xs">
            Se usará tu Chat ID de Telegram del perfil: {form.values.chat_id}
          </Text>
        )}
        {/* WhatsApp per-job toggle and number input */}
        <Group mt="xs" align="flex-end" gap="md">
          <Switch
            checked={sendToWhatsapp}
            onChange={(e) => setSendToWhatsapp(e.currentTarget.checked)}
            label="Enviar también a WhatsApp"
          />
          {sendToWhatsapp && (
            <TextInput
              label="Número WhatsApp"
              placeholder="+584140000000"
              value={waNumber}
              onChange={(e) => setWaNumber(e.currentTarget.value)}
              error={waFieldError}
            />
          )}
        </Group>
      </Box>

      {/* Botón de transformación rápida */}
      <Group justify="center" mb="md">
        <Button
          color="brand"
          size="lg"
          leftSection={<IconWand size={20} />}
          onClick={handleQuickTransform}
          loading={processing}
          disabled={processing}
        >
          Transformar Video Automáticamente
        </Button>
      </Group>

      {/* Panel de configuración avanzada */}
      <Collapse in={showSettings}>
        <Divider my="md" />
        <form onSubmit={form.onSubmit(handleTransform)}>
          <Tabs defaultValue="basic" mb="md" variant="pills" color="brand">
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconVideo size={14} />}>Básico</Tabs.Tab>
              <Tabs.Tab value="appearance" leftSection={<IconPalette size={14} />}>Apariencia</Tabs.Tab>
              <Tabs.Tab value="subtitles" leftSection={<IconMessageCircle size={14} />}>Subtítulos</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="basic" pt="md">
              <Stack>
                <NumberInput
                  label="Duración del segmento (minutos)"
                  description="Cada segmento será de esta duración"
                  min={0.5}
                  max={10}
                  step={0.5}
                  {...form.getInputProps('segment_duration_minutes')}
                />

                <div>
                  <Text size="sm" mb="xs">Nivel de zoom: {form.values.zoom_level}</Text>
                  <Slider
                    min={0}
                    max={100}
                    step={5}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 30, label: '30%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' }
                    ]}
                    {...form.getInputProps('zoom_level')}
                  />
                </div>

                <ColorInput
                  label="Color de fondo"
                  placeholder="#000000"
                  {...form.getInputProps('background_color')}
                />

                <div>
                  <Text size="sm" mb="xs" fw={500}>Imagen de fondo (opcional)</Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Puedes usar un color de fondo o subir una imagen. Si subes una imagen, se usará en lugar del color.
                  </Text>
                  
                  <Dropzone
                    onDrop={handleBackgroundImageUpload}
                    accept={IMAGE_MIME_TYPE}
                    maxSize={10 * 1024 * 1024} // 10 MB
                    loading={uploadingBackground}
                    mb="xs"
                  >
                    <Group justify="center" gap="xl" mih={100} style={{ pointerEvents: 'none' }}>
                      <Dropzone.Accept>
                        <IconUpload style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-blue-6)' }} stroke={1.5} />
                      </Dropzone.Accept>
                      <Dropzone.Reject>
                        <IconX style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-red-6)' }} stroke={1.5} />
                      </Dropzone.Reject>
                      <Dropzone.Idle>
                        <IconPhoto style={{ width: rem(32), height: rem(32), color: 'var(--mantine-color-dimmed)' }} stroke={1.5} />
                      </Dropzone.Idle>
                      <div>
                        <Text size="sm" inline>
                          Arrastra una imagen aquí o haz clic para seleccionar
                        </Text>
                        <Text size="xs" c="dimmed" inline mt={7}>
                          Formatos soportados: JPG, PNG, GIF (máx. 10MB)
                        </Text>
                      </div>
                    </Group>
                  </Dropzone>
                  
                  {uploadingBackground && (
                    <Progress value={backgroundUploadProgress} animated mb="xs" />
                  )}
                  
                  {backgroundImageUrl && (
                    <Alert color="green" mb="xs">
                      <Text size="xs">Imagen subida correctamente: {backgroundImageUrl}</Text>
                    </Alert>
                  )}
                  
                  <TextInput
                    label="O ingresa URL de imagen manualmente"
                    placeholder="https://ejemplo.com/imagen.jpg"
                    {...form.getInputProps('background_image_url')}
                  />
                </div>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="subtitles" pt="md">
              <Stack>
                <Switch
                  label="Añadir subtítulos automáticos"
                  description="Genera subtítulos usando transcripción automática"
                  {...form.getInputProps('add_subtitles', { type: 'checkbox' })}
                />

                {form.values.add_subtitles && (
                  <>
                    <Select
                      label="Idioma"
                      data={languages}
                      {...form.getInputProps('language')}
                    />

                    <Group grow>
                      <ColorInput
                        label="Color de línea"
                        {...form.getInputProps('subtitle_settings.line_color')}
                      />
                      <ColorInput
                        label="Color de palabra"
                        {...form.getInputProps('subtitle_settings.word_color')}
                      />
                    </Group>

                    <Group grow>
                      <NumberInput
                        label="Tamaño de fuente"
                        min={20}
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

                    <Group grow>
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
                    />

                    <Group>
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
                    </Group>

                    <Group grow>
                      <NumberInput
                        label="Ancho del contorno"
                        min={0}
                        max={10}
                        {...form.getInputProps('subtitle_settings.outline_width')}
                      />
                      <NumberInput
                        label="Desplazamiento de sombra"
                        min={0}
                        max={10}
                        {...form.getInputProps('subtitle_settings.shadow_offset')}
                      />
                    </Group>
                  </>
                )}
              </Stack>
            </Tabs.Panel>

            {/* Avanzado eliminado: job_id es interno y webhook se toma del perfil si existe */}
          </Tabs>

          <Group justify="flex-end" mt="md">
            <Button
              type="submit"
              loading={processing}
              leftSection={<IconWand size={16} />}
            >
              Transformar con Configuración Personalizada
            </Button>
          </Group>
        </form>
      </Collapse>

      {/* Indicador de progreso */}
      {processing && (
        <Box mt="md">
          <Text size="sm" mb="xs">Enviando video para transformación...</Text>
          <Progress value={100} animated />
        </Box>
      )}

      {/* Mensajes de error y éxito */}
      {error && (
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Error"
          color="red"
          mt="md"
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          icon={<IconCheck size="1rem" />}
          title="Éxito"
          color="green"
          mt="md"
        >
          {success}
        </Alert>
      )}

      {/* Resultado de la transformación */}
      {transformResult && (
        <Paper withBorder p="md" mt="md">
          <Title order={4} mb="md">Estado de la Transformación</Title>
          
          <Group mb="md">
            {/* Job ID oculto para el usuario */}
            <Text><strong>Estado:</strong> {transformResult.status}</Text>
          </Group>
          
          {transformResult.message && (
            <Text mb="md">{transformResult.message}</Text>
          )}
          
          {transformResult.segments && transformResult.segments.length > 0 && (
            <>
              <Text mb="xs"><strong>Segmentos a procesar:</strong> {transformResult.segments.length}</Text>
              <Stack gap="xs">
                {transformResult.segments.map((segment, index) => (
                  <Paper key={index} p="xs" withBorder>
                    <Group justify="space-between">
                      <Text size="sm">Segmento {segment.segment_number}</Text>
                      <Text size="sm" c="dimmed">
                        {Math.floor(segment.start_time / 60)}:{(segment.start_time % 60).toString().padStart(2, '0')} - 
                        {Math.floor(segment.end_time / 60)}:{(segment.end_time % 60).toString().padStart(2, '0')} 
                        ({segment.duration_minutes} min)
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Paper>
      )}
    </Paper>
  );
}

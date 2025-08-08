import React, { useState } from 'react';
import { useForm } from '@mantine/form';
import { 
  Badge, Button, Card, Checkbox, Group, Image, Progress, 
  Stack, Text, TextInput, Alert, Paper, Tooltip
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { VideoInfo } from '../types';
import { formatDuration, formatViewCount, getVideoInfo, downloadSelectedQuality, downloadSelectedQualityAsBlob } from '../services/youtube';
import { IconBrandYoutube, IconDownload, IconInfoCircle } from '@tabler/icons-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

// Función para subir a MinIO
const uploadToMinio = async (file: File, onProgress: (progress: number) => void): Promise<{url: string}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_URL}/upload_to_minio`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        onProgress(percentCompleted);
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error al subir a MinIO:', error);
    throw error;
  }
};

const YoutubeDownloader: React.FC = () => {
  // Estados para la interfaz de usuario
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState<VideoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [uploadToMinioDirectly, setUploadToMinioDirectly] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  // Utilizamos uploadError para mostrar errores específicos de la subida
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Estado para mostrar en qué etapa del proceso estamos
  const [processStage, setProcessStage] = useState<'idle' | 'info' | 'downloading' | 'processing' | 'uploading' | 'completed' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState<string>('');

  const form = useForm({
    initialValues: {
      url: ''
    },
    validate: {
      url: (value) => (!value ? 'La URL es requerida' : null)
    }
  });

  const handleGetInfo = async () => {
    if (form.validate().hasErrors) return;
    
    setLoading(true);
    setError(null);
    setVideoData(null);
    setDownloadError(null);
    
    try {
      const info = await getVideoInfo(form.values.url);
      setVideoData(info);
      notifications.show({
        title: 'Información obtenida',
        message: `Se ha obtenido la información del video: ${info.title}`,
        color: 'green'
      });
    } catch (err: any) {
      setError(`Error al obtener información del video: ${err.message || 'Desconocido'}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!videoData) return;
    
    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    setUploadedUrl(null);
    setUploadError(null);
    setProcessStage('downloading');
    setProcessMessage('Iniciando descarga...');
    
    try {
      // Verificar si se ha seleccionado un formato específico
      const useSelectedFormat = videoData.selectedFormat !== undefined;
      const selectedItag = useSelectedFormat && videoData.selectedFormat ? String(videoData.selectedFormat.itag) : undefined;
      const qualityLabel = useSelectedFormat && videoData.selectedFormat ? videoData.selectedFormat.qualityLabel : 'mejor calidad';
      
      // Si se seleccionó subir directamente a MinIO
      if (uploadToMinioDirectly) {
        let videoBlob: Blob;
        let filename: string;
        
        // Usar el formato seleccionado o el mejor si no hay selección
        if (useSelectedFormat && selectedItag) {
          setProcessMessage(`Descargando video en ${qualityLabel}...`);
          // Usar downloadSelectedQualityAsBlob con el itag seleccionado
          videoBlob = await downloadSelectedQualityAsBlob(
            form.values.url, 
            selectedItag, 
            (progress) => {
              setDownloadProgress(progress);
              if (progress < 40) {
                setProcessMessage(`Descargando video en ${qualityLabel}...`);
              } else if (progress < 70) {
                setProcessMessage('Descargando audio...');
              } else if (progress < 90) {
                setProcessStage('processing');
                setProcessMessage('Combinando video y audio con ffmpeg...');
              } else {
                setProcessMessage('Finalizando descarga...');
              }
            }
          );
        } else {
          // Si no hay formato seleccionado, mostrar error
          throw new Error('Por favor selecciona una calidad de video');
        }
        
        filename = `${videoData.title}.mp4`.replace(/[^a-zA-Z0-9.]/g, '_');
        
        // Subir a MinIO
        setProcessStage('uploading');
        setProcessMessage('Subiendo a MinIO...');
        setUploading(true);
        
        try {
          const file = new File([videoBlob], filename, { type: 'video/mp4' });
          const uploadResult = await uploadToMinio(file, (progress) => {
            setUploadProgress(progress);
          });
          
          if (uploadResult && typeof uploadResult === 'object' && 'url' in uploadResult) {
            setUploadedUrl(uploadResult.url);
            setProcessStage('completed');
            setProcessMessage('¡Video subido exitosamente!');
            // Limpiar cualquier error previo
            setUploadError(null);
          } else {
            const errorMsg = 'Error al subir el video a MinIO';
            setUploadError(errorMsg);
            throw new Error(errorMsg);
          }
        } catch (uploadErr: any) {
          console.error('Error al subir a MinIO:', uploadErr);
          setUploadError(`Error al subir a MinIO: ${uploadErr.message || 'Desconocido'}`);
          setProcessStage('error');
          setProcessMessage(`Error al subir a MinIO: ${uploadErr.message || 'Desconocido'}`);
        } finally {
          setUploading(false);
        }
      } else {
        // Descarga normal (no subir a MinIO)
        if (useSelectedFormat && selectedItag) {
          // Usar downloadSelectedQuality con el itag seleccionado
          setProcessMessage(`Descargando video en ${qualityLabel}...`);
          const response = await downloadSelectedQuality(
            form.values.url, 
            selectedItag, 
            (progress) => {
              setDownloadProgress(progress);
              if (progress < 40) {
                setProcessMessage(`Descargando video en ${qualityLabel}...`);
              } else if (progress < 70) {
                setProcessMessage('Descargando audio...');
              } else if (progress < 90) {
                setProcessStage('processing');
                setProcessMessage('Combinando video y audio con ffmpeg...');
              } else {
                setProcessMessage('Finalizando descarga...');
              }
            }
          );
          
          // Abrir el enlace de descarga
          if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
            setProcessStage('completed');
            setProcessMessage('¡Descarga completada!');
          }
        } else {
          // Si no hay formato seleccionado, mostrar error
          throw new Error('Por favor selecciona una calidad de video');
        }
      }
    } catch (error: any) {
      console.error('Error al descargar:', error);
      
      // Mensaje de error más descriptivo para formatos adaptativos
      if (error.message && error.message.includes('formato adaptativo')) {
        const selectedItag = videoData.selectedFormat ? videoData.selectedFormat.itag : 'seleccionado';
        setDownloadError(
          `Error: ${error.message}`
        );
        setProcessMessage(
          `Error: Los formatos adaptativos (como ${selectedItag}) contienen solo video sin audio ` +
          `y requieren que el servidor combine el video con una pista de audio usando ffmpeg.\n\n` +
          `Intenta seleccionar un formato no adaptativo que incluya audio (marcado con 🔊).`
        );
      } else {
        setDownloadError(`Error: ${error.message || 'Desconocido'}`);
        setProcessMessage(`Error en el proceso: ${error.message || 'Desconocido'}`);
      }
      
      setProcessStage('error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Paper p="md" shadow="xs">
      <Text size="xl" fw={700} mb="md">Descargador de YouTube</Text>
      
      <form onSubmit={form.onSubmit(handleGetInfo)}>
        <Group align="flex-end">
          <TextInput
            label="URL del video de YouTube"
            placeholder="https://www.youtube.com/watch?v=..."
            {...form.getInputProps('url')}
            style={{ flex: 1 }}
            disabled={loading || downloading}
            leftSection={<IconBrandYoutube size={16} />}
          />
          <Button 
            type="submit" 
            loading={loading}
            leftSection={<IconInfoCircle size={16} />}
          >
            Obtener Info
          </Button>
        </Group>
      </form>
      
      {error && (
        <Alert color="red" title="Error" mt="md">
          {error}
        </Alert>
      )}
      
      {videoData && (
        <div style={{ marginTop: 20 }}>
          <Card withBorder p="md">
            <Group align="flex-start">
              <div style={{ position: 'relative', width: 200, flexShrink: 0 }}>
                {videoData.thumbnails && videoData.thumbnails.length > 0 && (
                  <Image
                    src={videoData.thumbnails[0].url}
                    alt={videoData.title}
                    radius="md"
                    style={{ width: '100%', height: 'auto' }}
                  />
                )}
                <div style={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  background: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: '0.8rem'
                }}>
                  {videoData.lengthSeconds ? formatDuration(Number(videoData.lengthSeconds)) : ''}
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <Text fw={700} size="lg" mb={5}>{videoData.title}</Text>
                <Text size="sm" mb={10}>{videoData.author}</Text>
                
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {videoData.lengthSeconds ? formatDuration(Number(videoData.lengthSeconds)) : '00:00'} • 
                    {videoData.viewCount ? formatViewCount(Number(videoData.viewCount)) : '0'} vistas
                  </Text>
                </Group>
                
                <div>
                  <Text fw={500} size="sm" mb={5}>Selecciona la calidad:</Text>
                  <Group gap="xs" mb={10}>
                    {videoData ? (() => {
                      // Obtener formatos regulares y adaptativos
                      const formats = videoData.formats || [];
                      const adaptiveFormats = videoData.rawData?.adaptiveFormats || [];
                      
                      // Combinar todos los formatos
                      const allFormats = [...formats, ...adaptiveFormats];
                      
                      // Procesar los formatos para asegurar que tengan las propiedades hasVideo y hasAudio
                      const processedFormats = allFormats.map(f => {
                        const mimeType = f.mimeType || '';
                        const hasVideo = mimeType.includes('video');
                        const hasAudio = mimeType.includes('audio');
                        
                        return {
                          ...f,
                          hasVideo,
                          hasAudio
                        };
                      });
                      
                      // Filtrar y mapear los formatos para mostrar las badges
                      return processedFormats
                        .filter(f => f.qualityLabel && f.hasVideo) // Solo mostrar formatos de video con etiqueta de calidad
                        .map(f => ({
                          value: f.qualityLabel || '',
                          label: f.qualityLabel || 'Desconocido',
                          hasAudio: f.hasAudio,
                          itag: f.itag,
                          format: f
                        }))
                        .filter((item, i, arr) => arr.findIndex(t => t.value === item.value) === i) // Eliminar duplicados
                        .sort((a, b) => {
                          const aHeight = parseInt(a.value.replace('p', '')) || 0;
                          const bHeight = parseInt(b.value.replace('p', '')) || 0;
                          return bHeight - aHeight; // Ordenar de mayor a menor resolución
                        })
                        .map((quality, index) => (
                          <Tooltip
                            key={quality.itag || index}
                            label={quality.hasAudio ? 
                              `Formato progresivo: Incluye video y audio (itag: ${quality.itag})` : 
                              `Formato adaptativo: Solo video sin audio. Requiere combinar con audio usando ffmpeg (itag: ${quality.itag})`
                            }
                            position="top"
                            withArrow
                          >
                            <Badge 
                              color={videoData.selectedFormat?.itag === quality.itag ? "green" : quality.hasAudio ? "blue" : "orange"}
                              variant="filled"
                              style={{ 
                                cursor: 'pointer',
                                margin: '2px',
                                position: 'relative',
                                paddingRight: '30px'
                              }}
                              onClick={() => {
                                // Guardar el formato seleccionado
                                const selectedFormat = processedFormats.find(f => f.itag === quality.itag);
                                if (selectedFormat) {
                                  setVideoData({
                                    ...videoData,
                                    selectedFormat: selectedFormat
                                  });
                                }
                              }}
                            >
                              {quality.label}
                              <span style={{
                                position: 'absolute',
                                right: '8px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '14px'
                              }}>
                                {quality.hasAudio ? "🔊" : "🔇"}
                              </span>
                              {!quality.hasAudio && (
                                <span style={{
                                  position: 'absolute',
                                  right: '22px',
                                  top: '50%',
                                  transform: 'translateY(-50%)',
                                  fontSize: '12px',
                                  color: '#fff'
                                }}>
                                  ⚠️
                                </span>
                              )}
                            </Badge>
                          </Tooltip>
                        ));
                    })() : (
                      <Text size="sm" c="dimmed">No hay información de calidad disponible</Text>
                    )}
                  </Group>
                  
                  <Stack gap="xs" mt="md">
                    <Checkbox
                      label="Subir directamente a MinIO (sin descargar)"
                      checked={uploadToMinioDirectly}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setUploadToMinioDirectly(checked);
                      }}
                      disabled={downloading}
                    />
                  </Stack>
                </div>
                
                <Button 
                  onClick={handleDownload} 
                  loading={downloading} 
                  disabled={loading}
                  leftSection={<IconDownload size={16} />}
                  mt="md"
                >
                  Descargar
                </Button>
              </div>
            </Group>
          </Card>
          
          {/* Panel de estado del proceso */}
          {(downloading || uploading || processStage !== 'idle') && (
            <div style={{ marginTop: 20, padding: 15, border: '1px solid #eee', borderRadius: 8 }}>
              <Text fw={700} size="md" mb="xs">Estado del proceso</Text>
              
              <Text size="sm" fw={600} c={processStage === 'error' ? 'red' : 'blue'}>
                {processStage === 'downloading' && '⬇️ DESCARGANDO'}
                {processStage === 'processing' && '⚙️ PROCESANDO'}
                {processStage === 'uploading' && '⬆️ SUBIENDO'}
                {processStage === 'completed' && '✅ COMPLETADO'}
                {processStage === 'error' && '❌ ERROR'}
              </Text>
              
              <Text size="sm" mt="xs" mb="xs">{processMessage}</Text>
              
              {downloading && (
                <div style={{ marginTop: 10 }}>
                  <Text size="sm">Progreso de descarga: {Math.round(downloadProgress)}%</Text>
                  <Progress value={downloadProgress} animated={true} color="blue" />
                </div>
              )}
              
              {uploading && (
                <div style={{ marginTop: 10 }}>
                  <Text size="sm">Progreso de subida: {Math.round(uploadProgress)}%</Text>
                  <Progress value={uploadProgress} animated={true} color="teal" />
                </div>
              )}
            </div>
          )}
          
          {uploadedUrl && (
            <Alert color="teal" title="¡Subida exitosa!" mt="sm">
              <Text>El video ha sido subido exitosamente a MinIO.</Text>
              <Button 
                variant="outline" 
                color="teal" 
                size="xs" 
                mt="xs"
                onClick={() => window.open(uploadedUrl, '_blank')}
              >
                Ver video
              </Button>
            </Alert>
          )}
          
          {downloadError && (
            <Alert color="red" title="Error en la descarga" mt="sm">
              {downloadError}
            </Alert>
          )}
          
          {uploadError && (
            <Alert color="red" title="Error en la subida a MinIO" mt="sm">
              {uploadError}
            </Alert>
          )}
        </div>
      )}
    </Paper>
  );
};

export default YoutubeDownloader;

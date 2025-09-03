import { useState } from 'react';
import { 
  Dropzone, 
  IMAGE_MIME_TYPE,
  PDF_MIME_TYPE,
  MS_WORD_MIME_TYPE,
  MS_EXCEL_MIME_TYPE,
} from '@mantine/dropzone';
import type { FileWithPath } from '@mantine/dropzone';
import { 
  Text, 
  Group, 
  Button, 
  Box, 
  Progress, 
  Paper, 
  Title,
  Alert,
  Stack,
  Divider,
  TextInput,
  Textarea,
  Modal,
  rem
} from '@mantine/core';
import { 
  IconUpload, 
  IconX, 
  IconFile, 
  IconAlertCircle
} from '@tabler/icons-react';
import { uploadToMinio, minioConfig } from '../services/minio';
import { VideoProcessor } from './VideoProcessor';
import { videoService, convertMinioVideoToFirebase } from '../services/videoService';
import { useAuth } from '../context/AuthContext';

interface UploadedFile {
  url: string;
  fileName: string;
  bucket: string;
  objectName: string;
  isVideo: boolean;
  videoId?: string; // ID del video en Firebase
}

export function FileUploader() {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<UploadedFile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const { user } = useAuth();

  const handleDrop = (acceptedFiles: FileWithPath[]) => {
    setFiles(acceptedFiles);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Por favor selecciona al menos un archivo para subir');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    
    const uploadedFilesList: UploadedFile[] = [];
    
    try {
      // Subir cada archivo uno por uno
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Subir el archivo a MinIO
        const url = await uploadToMinio(
          file,
          minioConfig,
          (progress) => setUploadProgress(progress)
        );
        
        // Extraer el nombre del objeto de la URL
        const urlParts = url.split('/');
        const fileName = urlParts.slice(-1)[0]; // Último segmento de la URL (solo el nombre del archivo)
        
        // Determinar si es un video
        const isVideo = file.type.startsWith('video/') || 
                       /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/i.test(file.name);
        
        const uploadedFile: UploadedFile = {
          url,
          fileName: file.name,
          bucket: minioConfig.bucket,
          objectName: fileName, // Solo el nombre del archivo, sin ruta
          isVideo
        };
        
        // Si es un video y el usuario está autenticado, registrarlo en Firebase
        if (isVideo && user) {
          try {
            // Obtener información básica del archivo para los metadatos
            const metadata = {
              fileSize: file.size,
              mimeType: file.type,
              uploadDate: new Date().toISOString()
            };
            
            // Crear registro inicial en Firebase con estado pendiente
            const videoData = convertMinioVideoToFirebase(
              url,
              file.name,
              user.uid,
              'pending',  // Estado inicial: pendiente
              'original', // Tipo: original (no fragmento)
              null,       // No tiene parentId
              null,       // No conocemos la duración aún
              null,       // No tenemos thumbnail aún
              metadata    // Metadatos adicionales
            );
            
            // Guardar en Firebase
            const videoId = await videoService.createVideo(videoData);
            uploadedFile.videoId = videoId;
            
            console.log(`Video registrado en Firebase con ID: ${videoId}`);
          } catch (firebaseError) {
            console.error('Error al registrar video en Firebase:', firebaseError);
            // No interrumpimos el flujo si falla el registro en Firebase
          }
        }
        
        uploadedFilesList.push(uploadedFile);
      }
      
      setUploadedFiles(uploadedFilesList);
      setFiles([]); // Limpiar la lista de archivos después de subir
      
      // Si hay videos subidos, mostrar modal para añadir metadatos al primero
      const firstVideo = uploadedFilesList.find(file => file.isVideo);
      if (firstVideo && firstVideo.videoId) {
        setCurrentFile(firstVideo);
        setTitle(firstVideo.fileName.replace(/\.[^/.]+$/, '')); // Nombre sin extensión
        setDescription('');
        setShowMetadataModal(true);
      }
    } catch (error) {
      console.error('Error al subir archivos:', error);
      
      // Manejo detallado del error
      let errorMessage = 'Error desconocido';
      if (error instanceof Error) {
        errorMessage = error.message || 'Error sin mensaje';
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error);
      } else if (error !== null && error !== undefined) {
        errorMessage = String(error);
      }
      
      setError(`Error al subir archivos: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };
  
  // Función para guardar los metadatos del video
  const handleSaveMetadata = async () => {
    if (!currentFile || !currentFile.videoId) return;
    
    try {
      await videoService.updateVideo(currentFile.videoId, {
        title,
        description
      });
      
      // Actualizar el siguiente video si hay más
      const currentIndex = uploadedFiles.findIndex(file => file === currentFile);
      const nextVideo = uploadedFiles.slice(currentIndex + 1).find(file => file.isVideo && file.videoId);
      
      if (nextVideo) {
        setCurrentFile(nextVideo);
        setTitle(nextVideo.fileName.replace(/\.[^/.]+$/, '')); // Nombre sin extensión
        setDescription('');
      } else {
        setShowMetadataModal(false);
      }
    } catch (error) {
      console.error('Error al guardar metadatos:', error);
      setError('Error al guardar metadatos del video');
      setShowMetadataModal(false);
    }
  };

  return (
    <Paper p="lg" radius="lg" shadow="xl" withBorder={false} className="glass">
      <Title order={3} mb="sm">Subir archivos</Title>
      
      <Dropzone
        onDrop={(files) => {
          if (files && files.length > 0) {
            handleDrop(files);
          }
        }}
        onReject={(files) => console.log('rejected files', files)}
        // Sin límite de tamaño
        accept={[
          ...IMAGE_MIME_TYPE,
          ...PDF_MIME_TYPE,
          ...MS_WORD_MIME_TYPE,
          ...MS_EXCEL_MIME_TYPE,
          'audio/*',
          'video/*',
          'application/*',
          'text/*'
        ]}
        disabled={uploading}
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
            <Text size="lg" inline>
              Arrastra archivos o haz clic para seleccionar
            </Text>
            <Text size="xs" c="dimmed" inline mt={5}>
              Cualquier tipo, sin límite
            </Text>
          </div>
        </Group>
      </Dropzone>
      
      {files.length > 0 && (
        <Box mb="md">
          <Text fw={500} mb={5}>Seleccionados</Text>
          <Stack>
            {files.map((file, index) => (
              <Text key={index} size="sm">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Text>
            ))}
          </Stack>
          
          <Group justify="flex-end" mt="md">
            <Button
              color="brand"
              onClick={handleUpload}
              loading={uploading}
              leftSection={<IconUpload size={16} />}
            >
              Subir
            </Button>
          </Group>
        </Box>
      )}
      
      {uploading && (
        <Box mb="md">
          <Text size="sm">Subiendo archivos: {Math.round(uploadProgress)}%</Text>
          <Progress value={uploadProgress} animated mb="md" />
        </Box>
      )}
      
      {error && (
        <Alert 
          icon={<IconAlertCircle size="1rem" />} 
          title="Error" 
          color="red" 
          mb="md"
        >
          {error}
        </Alert>
      )}
      
      {uploadedFiles.length > 0 && (
        <Box mt="md">
          <Divider my="md" />
          <Stack>
            {uploadedFiles.map((file, index) => (
              <Box key={index}>
                {/* Solo mostramos el procesador para videos, sin nombre ni URL para minimizar ruido */}
                {file.isVideo && (
                  <VideoProcessor
                    videoUrl={file.url}
                    fileName={file.fileName}
                    videoId={file.videoId}
                  />
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
      
      {/* Modal para añadir metadatos */}
      <Modal
        opened={showMetadataModal}
        onClose={() => setShowMetadataModal(false)}
        title="Información del video"
        size="lg"
      >
        <Stack>
          <TextInput
            label="Título del video"
            placeholder="Ingresa un título descriptivo"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />
          
          <Textarea
            label="Descripción"
            placeholder="Describe el contenido del video"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={3}
          />
          
          <Group justify="flex-end" mt="md">
            <Button onClick={handleSaveMetadata}>
              Guardar y continuar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}

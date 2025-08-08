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
  rem
} from '@mantine/core';
import { 
  IconUpload, 
  IconX, 
  IconFile, 
  IconCheck,
  IconAlertCircle
} from '@tabler/icons-react';
import { uploadToMinio, minioConfig } from '../services/minio';
import { VideoProcessor } from './VideoProcessor';

interface UploadedFile {
  url: string;
  fileName: string;
  bucket: string;
  objectName: string;
  isVideo: boolean;
}

export function FileUploader() {
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    setSuccess(null);
    
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
        
        uploadedFilesList.push({
          url,
          fileName: file.name,
          bucket: minioConfig.bucket,
          objectName: fileName, // Solo el nombre del archivo, sin ruta
          isVideo
        });
      }
      
      setUploadedFiles(uploadedFilesList);
      setSuccess(`${files.length} archivo(s) subido(s) correctamente a MinIO`);
      setFiles([]); // Limpiar la lista de archivos después de subir
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

  return (
    <Paper p="md" withBorder>
      <Title order={2} mb="md">Subir Archivos a MinIO</Title>
      
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
            <Text size="xl" inline>
              Arrastra archivos aquí o haz clic para seleccionar
            </Text>
            <Text size="sm" c="dimmed" inline mt={7}>
              Sube cualquier tipo de archivo sin límite de tamaño
            </Text>
          </div>
        </Group>
      </Dropzone>
      
      {files.length > 0 && (
        <Box mb="md">
          <Text fw={500} mb={5}>Archivos seleccionados:</Text>
          <Stack>
            {files.map((file, index) => (
              <Text key={index} size="sm">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </Text>
            ))}
          </Stack>
          
          <Group justify="flex-end" mt="md">
            <Button 
              onClick={handleUpload} 
              loading={uploading}
              leftSection={<IconUpload size={16} />}
            >
              Subir a MinIO
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
      
      {success && (
        <Alert 
          icon={<IconCheck size="1rem" />} 
          title="Éxito" 
          color="green" 
          mb="md"
        >
          {success}
        </Alert>
      )}
      
      {uploadedFiles.length > 0 && (
        <Box mt="md">
          <Divider my="md" />
          <Title order={4} mb="sm">Archivos subidos:</Title>
          <Stack>
            {uploadedFiles.map((file, index) => (
              <Box key={index}>
                <Text size="sm" mb={5} fw={500}>{file.fileName}</Text>
                <Text 
                  component="a" 
                  href={file.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  size="xs"
                  c="dimmed"
                  style={{ wordBreak: 'break-all' }}
                >
                  {file.url}
                </Text>
                
                {/* Mostrar VideoProcessor automáticamente si es un video */}
                {file.isVideo && (
                  <VideoProcessor
                    videoUrl={file.url}
                    fileName={file.fileName}
                  />
                )}
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
}

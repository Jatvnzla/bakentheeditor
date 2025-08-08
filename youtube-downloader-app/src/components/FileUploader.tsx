import React, { useState } from 'react';
import { Group, Text, rem, Button, Progress, Paper, Title, Alert } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import type { FileWithPath } from '@mantine/dropzone';
import { IconUpload, IconX, IconFile, IconAlertCircle } from '@tabler/icons-react';
import { useAppContext } from '../context/AppContext';
import { uploadToMinio } from '../services/minio';

const FileUploader: React.FC = () => {

  const { addVideo, updateVideo, minioConfig } = useAppContext();
  const [files, setFiles] = useState<FileWithPath[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (acceptedFiles: FileWithPath[]) => {
    setFiles(acceptedFiles);
    setError(null);
    
    // Añadir los archivos a la lista con estado pendiente
    // Usamos setTimeout para evitar actualizar el estado durante el renderizado
    setTimeout(() => {
      acceptedFiles.forEach(file => {
        addVideo({
          title: file.name,
          status: 'pending',
          size: file.size,
          createdAt: new Date()
        });
      });
    }, 0);
  };

  const handleUpload = async () => {
    if (!files.length || !minioConfig) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = crypto.randomUUID();
        
        // Actualizar el estado del archivo a 'uploading' - usando setTimeout para evitar actualizar durante el renderizado
        setTimeout(() => {
          updateVideo(fileId, { 
            id: fileId,
            title: file.name, 
            status: 'uploading', 
            progress: 0 
          });
        }, 0);
        
        // Simular progreso de subida
        const uploadInterval = setInterval(() => {
          setProgress(prev => {
            const newProgress = prev + Math.random() * 10;
            if (newProgress >= 100) {
              clearInterval(uploadInterval);
              return 100;
            }
            // Usar setTimeout para evitar actualizar durante el renderizado
            setTimeout(() => {
              updateVideo(fileId, { progress: newProgress });
            }, 0);
            return newProgress;
          });
        }, 300);
        
        // Subir el archivo a MinIO
        try {
          const url = await uploadToMinio(file, minioConfig);
          
          // Actualizar el estado del archivo - usando setTimeout para evitar actualizar durante el renderizado
          setTimeout(() => {
            updateVideo(fileId, { 
              status: 'completed', 
              progress: 100,
              minioUrl: url
            });
          }, 0);
          
          clearInterval(uploadInterval);
          setProgress(100);
        } catch (err) {
          clearInterval(uploadInterval);
          // Usar setTimeout para evitar actualizar durante el renderizado
          setTimeout(() => {
            updateVideo(fileId, { 
              status: 'error', 
              error: 'Error al subir el archivo a MinIO'
            });
          }, 0);
          throw err;
        }
      }
      
      // Limpiar los archivos después de subirlos
      setFiles([]);
      alert('Archivos subidos correctamente a MinIO');
    } catch (err) {
      setError('Error al subir los archivos. Verifica la configuración de MinIO e intenta nuevamente.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Title order={3} mb="md">Subir Archivos a MinIO</Title>
      
      <Dropzone
        onDrop={handleDrop}
        onReject={(files) => console.log('rejected files', files)}
        // Sin límite de tamaño
        accept={{
          'video/*': ['.mp4', '.webm', '.mkv', '.avi', '.mov'],
        }}
        disabled={uploading}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
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
              Sube cualquier archivo de video, sin límite de tamaño
            </Text>
          </div>
        </Group>
      </Dropzone>
      
      {files.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <Text fw={500} mb={5}>Archivos seleccionados:</Text>
          {files.map((file, index) => (
            <Text key={index} size="sm">
              {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </Text>
          ))}
          
          <Group justify="flex-end" mt="md">
            <Button 
              onClick={handleUpload} 
              loading={uploading} 
              disabled={!minioConfig}
            >
              Subir a MinIO
            </Button>
          </Group>
        </div>
      )}
      
      {uploading && (
        <div style={{ marginTop: '20px' }}>
          <Text size="sm" mb={5}>Subiendo: {Math.round(progress)}%</Text>
          <Progress value={progress} animated />
        </div>
      )}
      
      {error && (
        <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red" mt="md">
          {error}
        </Alert>
      )}
      
      {!minioConfig && (
        <Alert icon={<IconAlertCircle size="1rem" />} title="Configuración requerida" color="yellow" mt="md">
          Configura los parámetros de MinIO antes de subir archivos.
        </Alert>
      )}
    </Paper>
  );
};

export default FileUploader;

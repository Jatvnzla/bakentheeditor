import React, { useState, useEffect } from 'react';
import { videoService } from '../services/videoService';
import { Card, Button, Loader, Alert, Group, Text, Badge, Stack, Tooltip, ActionIcon } from '@mantine/core';
import { testFragmentRegistration, cleanupTestFragments } from '../services/testFragmentRegistration';
import { IconRefresh, IconTestPipe, IconTrash, IconEye } from '@tabler/icons-react';

// Definición de tipos para fragmentos de video
interface VideoFragment {
  id: string;
  title: string;
  description?: string;
  minioUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  duration?: number;
  parentId: string;
  metadata?: {
    segment_number?: number;
    start_time?: number;
    end_time?: number;
    [key: string]: any;
  };
}

interface VideoFragmentsProps {
  videoId: string;
  onFragmentSelect?: (fragmentId: string) => void;
}

const VideoFragments: React.FC<VideoFragmentsProps> = ({ videoId, onFragmentSelect }) => {
  const [fragments, setFragments] = useState<VideoFragment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [testLoading, setTestLoading] = useState<boolean>(false);

  // Cargar fragmentos al montar el componente
  useEffect(() => {
    loadFragments();
  }, [videoId]);

  // Función para cargar fragmentos
  const loadFragments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const fragmentsData = await videoService.getVideoFragments(videoId);
      setFragments(fragmentsData);
    } catch (error) {
      console.error('Error al cargar fragmentos:', error);
      setError('Error al cargar fragmentos de video');
    } finally {
      setLoading(false);
    }
  };

  // Función para ejecutar prueba de registro de fragmentos
  const handleTestRegistration = async () => {
    try {
      setTestLoading(true);
      setError(null);
      
      await testFragmentRegistration(videoId);
      
      // Recargar fragmentos después de la prueba
      await loadFragments();
    } catch (error) {
      console.error('Error en prueba de registro:', error);
      setError('Error al ejecutar prueba de registro de fragmentos');
    } finally {
      setTestLoading(false);
    }
  };

  // Función para limpiar fragmentos de prueba
  const handleCleanupTest = async () => {
    try {
      setTestLoading(true);
      setError(null);
      
      await cleanupTestFragments(videoId);
      
      // Recargar fragmentos después de la limpieza
      await loadFragments();
    } catch (error) {
      console.error('Error al limpiar fragmentos:', error);
      setError('Error al limpiar fragmentos de prueba');
    } finally {
      setTestLoading(false);
    }
  };

  // Renderizar fragmentos
  const renderFragments = () => {
    if (fragments.length === 0) {
      return (
        <Alert color="blue" title="Información">
          No hay fragmentos disponibles para este video.
        </Alert>
      );
    }

    return fragments.map((fragment) => (
      <Card key={fragment.id} withBorder mb="md">
        <Card.Section withBorder inheritPadding py="xs">
          <Text fw={500}>{fragment.title}</Text>
        </Card.Section>
        <Card.Section p="md">
          <Stack gap="xs">
            <Group>
              <Text fw={700}>Estado:</Text>
              <Badge color={fragment.status === 'completed' ? 'green' : 'blue'}>{fragment.status}</Badge>
            </Group>
            {fragment.metadata?.segment_number && (
              <Group>
                <Text fw={700}>Segmento:</Text>
                <Text>{fragment.metadata.segment_number}</Text>
              </Group>
            )}
            {fragment.metadata?.start_time !== undefined && fragment.metadata?.end_time !== undefined && (
              <Group>
                <Text fw={700}>Tiempo:</Text>
                <Text>{formatTime(fragment.metadata.start_time)} - {formatTime(fragment.metadata.end_time)}</Text>
              </Group>
            )}
            {fragment.duration && (
              <Group>
                <Text fw={700}>Duración:</Text>
                <Text>{formatTime(fragment.duration)}</Text>
              </Group>
            )}
          </Stack>
        </Card.Section>
        <Card.Section withBorder inheritPadding py="xs">
          <Group justify="space-between">
            <Button 
              component="a"
              href={fragment.minioUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              size="xs"
              leftSection={<IconEye size="0.9rem" />}
              variant="light"
            >
              Ver Video
            </Button>
            {onFragmentSelect && (
              <Button 
                variant="outline" 
                size="xs" 
                onClick={() => onFragmentSelect(fragment.id)}
              >
                Seleccionar
              </Button>
            )}
          </Group>
        </Card.Section>
      </Card>
    ));
  };

  // Función para formatear tiempo en segundos a formato mm:ss
  const formatTime = (seconds: number): string => {
    if (!seconds && seconds !== 0) return '--:--';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="video-fragments">
      <Group justify="space-between" align="center" mb="md">
        <Text fw={700} size="lg">Fragmentos de Video</Text>
        <Group>
          <Tooltip label="Actualizar fragmentos">
            <ActionIcon 
              variant="outline" 
              size="lg" 
              onClick={loadFragments} 
              disabled={loading}
              loading={loading}
            >
              <IconRefresh size="1.2rem" />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={testMode ? 'Ocultar herramientas de prueba' : 'Mostrar herramientas de prueba'}>
            <ActionIcon 
              variant="subtle" 
              size="lg" 
              onClick={() => setTestMode(!testMode)}
              color={testMode ? 'blue' : 'gray'}
            >
              <IconTestPipe size="1.2rem" />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {error && (
        <Alert color="red" title="Error" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {testMode && (
        <Card withBorder mb="md" bg="gray.0">
          <Card.Section withBorder inheritPadding py="xs">
            <Text fw={500}>Herramientas de Prueba</Text>
          </Card.Section>
          <Card.Section p="md">
            <Text size="sm" mb="md">
              Estas herramientas son solo para pruebas y desarrollo.
            </Text>
            <Group>
              <Button 
                color="yellow" 
                onClick={handleTestRegistration} 
                disabled={testLoading}
                loading={testLoading && !fragments.some(f => f.metadata?.is_test)}
                leftSection={<IconTestPipe size="1rem" />}
                size="sm"
              >
                Probar Registro de Fragmentos
              </Button>
              <Button 
                color="red" 
                onClick={handleCleanupTest} 
                disabled={testLoading || !fragments.some(f => f.metadata?.is_test)}
                loading={testLoading && fragments.some(f => f.metadata?.is_test)}
                leftSection={<IconTrash size="1rem" />}
                size="sm"
              >
                Limpiar Fragmentos de Prueba
              </Button>
            </Group>
          </Card.Section>
        </Card>
      )}

      {loading ? (
        <Stack align="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Cargando fragmentos...</Text>
        </Stack>
      ) : (
        renderFragments()
      )}
    </div>
  );
};

export default VideoFragments;

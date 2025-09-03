import { useState } from 'react';
import { 
  Paper, 
  Title, 
  Text, 
  Group, 
  Button, 
  Stack, 
  Card, 
  Image, 
  Badge, 
  ActionIcon, 
  Menu, 
  Loader, 
  Tabs,
  Modal,
  TextInput,
  Textarea,
  Box,
  Divider
} from '@mantine/core';
import { 
  IconDots, 
  IconEdit, 
  IconTrash, 
  IconCalendarEvent, 
  IconPlayerPlay,
  IconPlus,
  IconVideo,
  IconScissors,
  IconPuzzle
} from '@tabler/icons-react';
import { useVideo } from '../context/VideoContext';
import { useDisclosure } from '@mantine/hooks';
import type { Video } from '../services/videoService';
import { VideoPlayer } from './VideoPlayer.js';
import VideoFragments from './VideoFragments';

export function VideoList() {
  const { videos, loading, error, updateVideo, deleteVideo } = useVideo();
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [playerOpened, { open: openPlayer, close: closePlayer }] = useDisclosure(false);
  const [fragmentsOpened, { open: openFragments, close: closeFragments }] = useDisclosure(false);
  const [videoFilter, setVideoFilter] = useState<'all' | 'original' | 'fragment'>('all');

  // Filtrar videos según el tipo seleccionado
  const filteredVideos = videos.filter(video => {
    if (videoFilter === 'all') return true;
    return video.type === videoFilter;
  });

  // Ordenar videos por fecha de creación (más recientes primero)
  const sortedVideos = [...filteredVideos].sort((a, b) => {
    const dateA = a.createdAt?.toDate?.() || new Date();
    const dateB = b.createdAt?.toDate?.() || new Date();
    return dateB.getTime() - dateA.getTime();
  });

  // Manejar la edición de un video
  const handleEdit = (video: Video) => {
    setEditingVideo(video);
    open();
  };

  // Guardar cambios en un video
  const handleSaveEdit = async () => {
    if (!editingVideo || !editingVideo.id) return;
    
    try {
      await updateVideo(editingVideo.id, {
        title: editingVideo.title,
        description: editingVideo.description
      });
      close();
      setEditingVideo(null);
    } catch (err) {
      console.error('Error al actualizar video:', err);
    }
  };

  // Eliminar un video
  const handleDelete = async (videoId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este video?')) return;
    
    try {
      await deleteVideo(videoId);
    } catch (err) {
      console.error('Error al eliminar video:', err);
    }
  };

  // Reproducir un video
  const handlePlay = (video: Video) => {
    setSelectedVideo(video);
    openPlayer();
  };


  // Formatear la fecha para mostrarla
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Fecha desconocida';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Obtener un color según el estado del video
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'processing': return 'blue';
      case 'pending': return 'yellow';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Paper p="lg" radius="lg" shadow="xl" withBorder={false} className="glass">
      <Group justify="space-between" mb="md">
        <Title order={3}>Mis Videos</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={() => {/* Implementar lógica para añadir video manualmente */}}
        >
          Nuevo Video
        </Button>
      </Group>

      <Tabs value={videoFilter} onChange={(value) => setVideoFilter(value as 'all' | 'original' | 'fragment')}>
        <Tabs.List mb="md">
          <Tabs.Tab value="all">Todos</Tabs.Tab>
          <Tabs.Tab value="original" leftSection={<IconVideo size={14} />}>Originales</Tabs.Tab>
          <Tabs.Tab value="fragment" leftSection={<IconScissors size={14} />}>Fragmentos</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {loading ? (
        <Group justify="center" p="xl">
          <Loader />
          <Text>Cargando videos...</Text>
        </Group>
      ) : error ? (
        <Text c="red">{error}</Text>
      ) : sortedVideos.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No hay videos disponibles. Sube un video o registra uno existente.
        </Text>
      ) : (
        <Stack>
          {sortedVideos.map((video) => (
            <Card key={video.id} withBorder padding="md" radius="md">
              <Group wrap="nowrap" align="flex-start">
                <Box w={120} h={80} style={{ overflow: 'hidden', borderRadius: '4px' }}>
                  {video.thumbnailUrl ? (
                    <Image
                      src={video.thumbnailUrl}
                      alt={video.title}
                      height={80}
                      fit="cover"
                    />
                  ) : (
                    <Box 
                      bg="dark.4" 
                      h={80} 
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconVideo size={32} color="gray" />
                    </Box>
                  )}
                </Box>

                <Stack style={{ flex: 1 }} gap="xs">
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={500} lineClamp={1}>{video.title}</Text>
                    <Group gap="xs">
                      <Badge color={getStatusColor(video.status)}>{video.status}</Badge>
                      <Badge variant="outline">{video.type}</Badge>
                      <Menu position="bottom-end" withArrow>
                        <Menu.Target>
                          <ActionIcon variant="subtle">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item 
                            leftSection={<IconPlayerPlay size={16} />}
                            onClick={() => handlePlay(video)}
                          >
                            Reproducir
                          </Menu.Item>
                          <Menu.Item 
                            leftSection={<IconEdit size={16} />}
                            onClick={() => handleEdit(video)}
                          >
                            Editar
                          </Menu.Item>
                          {video.type === 'original' && (
                            <Menu.Item 
                              leftSection={<IconPuzzle size={16} />}
                              onClick={() => {
                                setSelectedVideo(video);
                                openFragments();
                              }}
                            >
                              Ver Fragmentos
                            </Menu.Item>
                          )}
                          <Menu.Item 
                            leftSection={<IconCalendarEvent size={16} />}
                            onClick={() => {/* Implementar programación */}}
                          >
                            Programar publicación
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item 
                            leftSection={<IconTrash size={16} />}
                            color="red"
                            onClick={() => video.id && handleDelete(video.id)}
                          >
                            Eliminar
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Group>

                  <Text size="sm" c="dimmed" lineClamp={2}>
                    {video.description || 'Sin descripción'}
                  </Text>

                  <Group gap="xs">
                    <Text size="xs" c="dimmed">
                      Creado: {formatDate(video.createdAt)}
                    </Text>
                    {video.duration && (
                      <Text size="xs" c="dimmed">
                        Duración: {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {/* Modal para editar video */}
      <Modal opened={opened} onClose={close} title="Editar Video" centered>
        {editingVideo && (
          <Stack>
            <TextInput
              label="Título"
              value={editingVideo.title}
              onChange={(e) => setEditingVideo({...editingVideo, title: e.target.value})}
            />
            <Textarea
              label="Descripción"
              value={editingVideo.description}
              onChange={(e) => setEditingVideo({...editingVideo, description: e.target.value})}
              minRows={3}
            />
            <Group justify="flex-end" mt="md">
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={handleSaveEdit}>Guardar</Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Modal para reproducir video */}
      <Modal 
        opened={playerOpened} 
        onClose={closePlayer} 
        title={selectedVideo?.title || 'Reproducir Video'} 
        size="xl"
        centered
      >
        {selectedVideo && (
          <VideoPlayer videoUrl={selectedVideo.minioUrl} />
        )}
      </Modal>

      {/* Modal para ver fragmentos de video */}
      <Modal
        opened={fragmentsOpened}
        onClose={closeFragments}
        title={`Fragmentos de ${selectedVideo?.title || 'Video'}`}
        size="xl"
        centered
      >
        {selectedVideo?.id ? (
          <>
            <Group mb="md">
              <Badge color={getStatusColor(selectedVideo.status)}>{selectedVideo.status}</Badge>
              {selectedVideo.duration && (
                <Text size="sm">Duración: {Math.floor(selectedVideo.duration / 60)}:{(selectedVideo.duration % 60).toString().padStart(2, '0')}</Text>
              )}
            </Group>
            
            <Divider mb="md" />
            
            <VideoFragments 
              videoId={selectedVideo.id} 
              onFragmentSelect={() => {
                // Cerramos el modal al seleccionar un fragmento
                closeFragments();
              }} 
            />
          </>
        ) : (
          <Text>No se ha seleccionado ningún video</Text>
        )}
      </Modal>
    </Paper>
  );
}

import { useState } from 'react';
import { 
  Paper, 
  Title, 
  Group, 
  Button, 
  Text, 
  Stack, 
  Badge, 
  Modal, 
  Loader,
  ActionIcon,
  Menu,
  Box,
  Card,
  Tabs,
  Alert
} from '@mantine/core';
import { Calendar } from '@mantine/dates';
import { 
  IconCalendarEvent, 
  IconPlus, 
  IconDots, 
  IconTrash,
  IconX,
  IconAlertCircle
} from '@tabler/icons-react';
import { useVideo } from '../context/VideoContext';
import { useDisclosure } from '@mantine/hooks';
import { ScheduleForm } from './ScheduleForm';
import type { Video, Schedule } from '../services/videoService';
import { VideoPlayer } from './VideoPlayer';

export function ScheduleCalendar() {
  const { videos, schedules, loading, loadingSchedules, refreshSchedules, updateSchedule, deleteSchedule } = useVideo();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [playerOpened, { open: openPlayer, close: closePlayer }] = useDisclosure(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [error, setError] = useState<string | null>(null);

  // Fechas con publicaciones programadas para resaltar en el calendario
  const scheduleDates = schedules.map(schedule => {
    if (typeof schedule.scheduledDate === 'object' && schedule.scheduledDate !== null && 'toDate' in schedule.scheduledDate) {
      return schedule.scheduledDate.toDate();
    }
    return new Date(schedule.scheduledDate);
  });

  // Filtrar programaciones por la fecha seleccionada
  const filteredSchedules = schedules.filter(schedule => {
    if (!selectedDate) return false;
    
    const scheduleDate = typeof schedule.scheduledDate === 'object' && schedule.scheduledDate !== null && 'toDate' in schedule.scheduledDate
      ? schedule.scheduledDate.toDate()
      : new Date(schedule.scheduledDate);
    
    return scheduleDate.getDate() === selectedDate.getDate() &&
           scheduleDate.getMonth() === selectedDate.getMonth() &&
           scheduleDate.getFullYear() === selectedDate.getFullYear();
  });

  // Ordenar programaciones por hora
  const sortedSchedules = [...filteredSchedules].sort((a, b) => {
    const dateA = typeof a.scheduledDate === 'object' && a.scheduledDate !== null && 'toDate' in a.scheduledDate
      ? a.scheduledDate.toDate()
      : new Date(a.scheduledDate);
    const dateB = typeof b.scheduledDate === 'object' && b.scheduledDate !== null && 'toDate' in b.scheduledDate
      ? b.scheduledDate.toDate()
      : new Date(b.scheduledDate);
    return dateA.getTime() - dateB.getTime();
  });

  // Encontrar el video correspondiente a una programación
  const findVideoForSchedule = (schedule: Schedule): Video | undefined => {
    return videos.find(video => video.id === schedule.videoId);
  };

  // Manejar la cancelación de una programación
  const handleCancelSchedule = async (scheduleId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas cancelar esta programación?')) return;
    
    try {
      await updateSchedule(scheduleId, { status: 'cancelled' });
      setError(null);
    } catch (err) {
      console.error('Error al cancelar programación:', err);
      setError('Error al cancelar la programación. Intenta de nuevo.');
    }
  };

  // Manejar la eliminación de una programación
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta programación?')) return;
    
    try {
      await deleteSchedule(scheduleId);
      setError(null);
    } catch (err) {
      console.error('Error al eliminar programación:', err);
      setError('Error al eliminar la programación. Intenta de nuevo.');
    }
  };


  // Formatear la fecha para mostrarla
  const formatDate = (timestamp: any): string => {
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

  // Obtener un color según el estado de la programación
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'blue';
      case 'published': return 'green';
      case 'cancelled': return 'red';
      default: return 'gray';
    }
  };

  // Obtener un color según la plataforma
  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram': return 'grape';
      case 'facebook': return 'blue';
      case 'tiktok': return 'cyan';
      case 'youtube': return 'red';
      case 'twitter': return 'indigo';
      default: return 'gray';
    }
  };

  return (
    <Paper p="lg" radius="lg" shadow="xl" withBorder={false} className="glass">
      <Group justify="space-between" mb="md">
        <Title order={3}>Programación de Publicaciones</Title>
        <Button 
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            if (videos.length > 0) {
              setSelectedVideo(videos[0]);
              openForm();
            } else {
              setError('No hay videos disponibles para programar');
            }
          }}
        >
          Nueva Programación
        </Button>
      </Group>

      <Tabs value={viewMode} onChange={(value) => setViewMode(value as 'calendar' | 'list')}>
        <Tabs.List mb="md">
          <Tabs.Tab value="calendar" leftSection={<IconCalendarEvent size={14} />}>Calendario</Tabs.Tab>
          <Tabs.Tab value="list">Lista</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error" 
          color="red" 
          mb="md" 
          withCloseButton 
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {loading || loadingSchedules ? (
        <Group justify="center" p="xl">
          <Loader />
          <Text>Cargando programaciones...</Text>
        </Group>
      ) : viewMode === 'calendar' ? (
        <Group align="flex-start">
          <Box style={{ flex: '0 0 auto' }}>
            <Calendar 
              value={selectedDate} 
              onChange={setSelectedDate}
              renderDay={(date: Date) => {
                const day = date.getDate();
                const hasSchedule = scheduleDates.some(scheduleDate => 
                  scheduleDate.getDate() === date.getDate() &&
                  scheduleDate.getMonth() === date.getMonth() &&
                  scheduleDate.getFullYear() === date.getFullYear()
                );
                
                return (
                  <div style={{ position: 'relative' }}>
                    {day}
                    {hasSchedule && (
                      <div 
                        style={{ 
                          position: 'absolute', 
                          bottom: 2, 
                          left: '50%', 
                          transform: 'translateX(-50%)',
                          width: 4, 
                          height: 4, 
                          borderRadius: '50%', 
                          backgroundColor: 'var(--mantine-color-blue-filled)' 
                        }} 
                      />
                    )}
                  </div>
                );
              }}
            />
          </Box>

          <Stack style={{ flex: 1 }}>
            <Text fw={500}>
              {selectedDate ? selectedDate.toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : 'Selecciona una fecha'}
            </Text>

            {sortedSchedules.length === 0 ? (
              <Text c="dimmed" ta="center" py="md">
                No hay publicaciones programadas para esta fecha.
              </Text>
            ) : (
              <Stack>
                {sortedSchedules.map((schedule) => {
                  const video = findVideoForSchedule(schedule);
                  return (
                    <Card key={schedule.id} withBorder padding="md" radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap="xs">
                          <Group gap="xs">
                            <Badge color={getStatusColor(schedule.status)}>{schedule.status}</Badge>
                            <Badge color={getPlatformColor(schedule.platform)}>{schedule.platform}</Badge>
                            <Text size="sm" fw={500}>
                              {formatDate(schedule.scheduledDate)}
                            </Text>
                          </Group>
                          
                          <Text fw={500}>{video?.title || 'Video no encontrado'}</Text>
                          
                          {schedule.caption && (
                            <Text size="sm" lineClamp={2}>
                              {schedule.caption}
                            </Text>
                          )}
                          
                          {schedule.hashtags && schedule.hashtags.length > 0 && (
                            <Group gap="xs" mt={5}>
                              {schedule.hashtags.map((tag, index) => (
                                <Badge key={index} variant="outline" size="sm">
                                  #{tag}
                                </Badge>
                              ))}
                            </Group>
                          )}
                        </Stack>

                        <Menu position="bottom-end" withArrow>
                          <Menu.Target>
                            <ActionIcon variant="subtle">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {video && (
                              <Menu.Item 
                                leftSection={<IconCalendarEvent size={16} />}
                                onClick={() => {
                                  setSelectedVideo(video);
                                  openPlayer();
                                }}
                              >
                                Ver video
                              </Menu.Item>
                            )}
                            {schedule.status === 'scheduled' && (
                              <Menu.Item 
                                leftSection={<IconX size={16} />}
                                color="red"
                                onClick={() => schedule.id && handleCancelSchedule(schedule.id)}
                              >
                                Cancelar programación
                              </Menu.Item>
                            )}
                            <Menu.Item 
                              leftSection={<IconTrash size={16} />}
                              color="red"
                              onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                            >
                              Eliminar
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Group>
      ) : (
        <Stack>
          {schedules.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">
              No hay publicaciones programadas.
            </Text>
          ) : (
            schedules.map((schedule) => {
              const video = findVideoForSchedule(schedule);
              return (
                <Card key={schedule.id} withBorder padding="md" radius="md">
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap="xs">
                      <Group gap="xs">
                        <Badge color={getStatusColor(schedule.status)}>{schedule.status}</Badge>
                        <Badge color={getPlatformColor(schedule.platform)}>{schedule.platform}</Badge>
                        <Text size="sm" fw={500}>
                          {formatDate(schedule.scheduledDate)}
                        </Text>
                      </Group>
                      
                      <Text fw={500}>{video?.title || 'Video no encontrado'}</Text>
                      
                      {schedule.caption && (
                        <Text size="sm" lineClamp={2}>
                          {schedule.caption}
                        </Text>
                      )}
                      
                      {schedule.hashtags && schedule.hashtags.length > 0 && (
                        <Group gap="xs" mt={5}>
                          {schedule.hashtags.map((tag, index) => (
                            <Badge key={index} variant="outline" size="sm">
                              #{tag}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Stack>

                    <Menu position="bottom-end" withArrow>
                      <Menu.Target>
                        <ActionIcon variant="subtle">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {video && (
                          <Menu.Item 
                            leftSection={<IconCalendarEvent size={16} />}
                            onClick={() => {
                              setSelectedVideo(video);
                              openPlayer();
                            }}
                          >
                            Ver video
                          </Menu.Item>
                        )}
                        {schedule.status === 'scheduled' && (
                          <Menu.Item 
                            leftSection={<IconX size={16} />}
                            color="red"
                            onClick={() => schedule.id && handleCancelSchedule(schedule.id)}
                          >
                            Cancelar programación
                          </Menu.Item>
                        )}
                        <Menu.Item 
                          leftSection={<IconTrash size={16} />}
                          color="red"
                          onClick={() => schedule.id && handleDeleteSchedule(schedule.id)}
                        >
                          Eliminar
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Card>
              );
            })
          )}
        </Stack>
      )}

      {/* Modal para el formulario de programación */}
      <Modal 
        opened={formOpened} 
        onClose={closeForm} 
        title="Programar Publicación" 
        size="lg"
        centered
      >
        {selectedVideo && (
          <ScheduleForm 
            video={selectedVideo} 
            onClose={() => {
              closeForm();
              refreshSchedules();
            }} 
          />
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
    </Paper>
  );
}

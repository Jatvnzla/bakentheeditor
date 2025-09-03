import { useState } from 'react';
import { 
  Paper, 
  Title, 
  Stack, 
  TextInput, 
  Textarea, 
  Button, 
  Group, 
  Select, 
  TagsInput,
  Modal,
  Text,
  Box,
  Divider,
  Alert
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useVideo } from '../context/VideoContext';
import { useAuth } from '../context/AuthContext';
import { IconAlertCircle, IconCalendarEvent } from '@tabler/icons-react';
import { Timestamp } from 'firebase/firestore';
import type { Video, Schedule } from '../services/videoService';

interface ScheduleFormProps {
  video: Video;
  onClose: () => void;
}

export function ScheduleForm({ video, onClose }: ScheduleFormProps) {
  const { addSchedule } = useVideo();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState<{
    scheduledDate: Date;
    platform: string;
    caption: string;
    hashtags: string[];
  }>({
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Mañana por defecto
    platform: 'instagram',
    caption: '',
    hashtags: [],
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!user?.uid || !video.id) {
      setError('Error de autenticación o video inválido');
      return;
    }

    if (!formData.scheduledDate) {
      setError('Debes seleccionar una fecha y hora');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const scheduleData: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'> = {
        videoId: video.id,
        scheduledDate: Timestamp.fromDate(formData.scheduledDate),
        status: 'scheduled',
        platform: formData.platform,
        userId: user.uid,
        caption: formData.caption,
        hashtags: formData.hashtags
      };

      await addSchedule(scheduleData);
      setSuccess(true);
      
      // Cerrar el formulario después de 2 segundos
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error al programar publicación:', err);
      setError('Error al programar la publicación. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="lg" radius="md" withBorder>
      <Title order={3} mb="md">Programar Publicación</Title>
      
      {error && (
        <Alert 
          icon={<IconAlertCircle size={16} />} 
          title="Error" 
          color="red" 
          mb="md"
        >
          {error}
        </Alert>
      )}

      {success ? (
        <Alert 
          title="¡Programación exitosa!" 
          color="green" 
          mb="md"
        >
          La publicación ha sido programada correctamente.
        </Alert>
      ) : (
        <Stack>
          <Box mb="xs">
            <Text size="sm" fw={500} mb={5}>Video seleccionado</Text>
            <Text size="sm">{video.title}</Text>
          </Box>

          <Divider my="xs" />

          <DateTimePicker
            label="Fecha y hora de publicación"
            placeholder="Selecciona fecha y hora"
            value={formData.scheduledDate}
            onChange={(value) => handleChange('scheduledDate', value)}
            required
            minDate={new Date()}
            clearable={false}
          />

          <Select
            label="Plataforma"
            placeholder="Selecciona la plataforma"
            data={[
              { value: 'instagram', label: 'Instagram' },
              { value: 'facebook', label: 'Facebook' },
              { value: 'tiktok', label: 'TikTok' },
              { value: 'youtube', label: 'YouTube' },
              { value: 'twitter', label: 'Twitter' }
            ]}
            value={formData.platform}
            onChange={(value) => handleChange('platform', value)}
            required
          />

          <Textarea
            label="Texto de la publicación"
            placeholder="Escribe el texto que acompañará tu publicación"
            value={formData.caption}
            onChange={(e) => handleChange('caption', e.target.value)}
            minRows={3}
            autosize
          />

          <TagsInput
            label="Hashtags"
            placeholder="Añade hashtags (presiona Enter para añadir)"
            value={formData.hashtags}
            onChange={(value) => handleChange('hashtags', value)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button 
              onClick={handleSubmit} 
              loading={loading}
              leftSection={<IconCalendarEvent size={16} />}
            >
              Programar
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  );
}

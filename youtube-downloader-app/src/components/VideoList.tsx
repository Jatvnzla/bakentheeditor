import React from 'react';
import { Table, Progress, Badge, ActionIcon, Group, Text, Paper, Title, ScrollArea } from '@mantine/core';
import { IconTrash, IconExternalLink } from '@tabler/icons-react';
import { useAppContext } from '../context/AppContext';
import type { VideoInfo } from '../types';

const VideoList: React.FC = () => {
  const { videos, removeVideo } = useAppContext();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'gray';
      case 'downloading': return 'blue';
      case 'uploading': return 'indigo';
      case 'completed': return 'green';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'downloading': return 'Descargando';
      case 'uploading': return 'Subiendo';
      case 'completed': return 'Completado';
      case 'error': return 'Error';
      default: return 'Desconocido';
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Byte';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
  };

  return (
    <Paper shadow="xs" p="md" withBorder>
      <Title order={3} mb="md">Videos</Title>
      
      {videos.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No hay videos en la lista. Descarga un video o sube un archivo.
        </Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Título</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Progreso</Table.Th>
                <Table.Th>Formato</Table.Th>
                <Table.Th>Tamaño</Table.Th>
                <Table.Th>Fecha</Table.Th>
                <Table.Th>Acciones</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {videos.map((video: VideoInfo) => (
                <Table.Tr key={video.id}>
                  <Table.Td>
                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {video.title}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(video.status)}>
                      {getStatusText(video.status)}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ width: '120px' }}>
                    {(video.status === 'downloading' || video.status === 'uploading') && video.progress ? (
                      <Progress value={video.progress} size="sm" />
                    ) : (
                      '-'
                    )}
                  </Table.Td>
                  <Table.Td>{video.format || '-'}</Table.Td>
                  <Table.Td>{formatSize(video.size)}</Table.Td>
                  <Table.Td>{formatDate(video.createdAt)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {video.minioUrl && (
                        <ActionIcon 
                          color="blue" 
                          variant="subtle"
                          component="a"
                          href={video.minioUrl}
                          target="_blank"
                        >
                          <IconExternalLink size="1.125rem" />
                        </ActionIcon>
                      )}
                      <ActionIcon 
                        color="red" 
                        variant="subtle"
                        onClick={() => removeVideo(video.id!)}
                      >
                        <IconTrash size="1.125rem" />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Paper>
  );
};

export default VideoList;

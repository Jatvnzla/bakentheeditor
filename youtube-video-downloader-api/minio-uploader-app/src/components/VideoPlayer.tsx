import { useEffect, useRef, useState } from 'react';
import { Box, Text, Center, Loader } from '@mantine/core';

interface VideoPlayerProps {
  videoUrl: string;
  autoPlay?: boolean;
  controls?: boolean;
  width?: string | number;
  height?: string | number;
}

export function VideoPlayer({ 
  videoUrl, 
  autoPlay = false, 
  controls = true,
  width = '100%',
  height = 'auto'
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const handleCanPlay = () => {
      setLoading(false);
    };

    const handleError = () => {
      setLoading(false);
      setError('Error al cargar el video. Verifica la URL o intenta más tarde.');
    };

    const video = videoRef.current;
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [videoUrl]);

  if (!videoUrl) {
    return (
      <Center p="xl" h={200} bg="dark.6">
        <Text c="dimmed">No hay URL de video disponible</Text>
      </Center>
    );
  }

  return (
    <Box pos="relative">
      {loading && (
        <Center 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 1
          }}
        >
          <Loader />
        </Center>
      )}
      
      {error && (
        <Center p="xl" h={200} bg="dark.6">
          <Text c="red">{error}</Text>
        </Center>
      )}
      
      <video
        ref={videoRef}
        src={videoUrl}
        controls={controls}
        autoPlay={autoPlay}
        style={{ 
          width, 
          height,
          display: loading || error ? 'none' : 'block',
          maxHeight: '70vh'
        }}
      />
    </Box>
  );
}

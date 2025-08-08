import React from 'react';
import { Container, Tabs, Title, Space } from '@mantine/core';
import { IconDownload, IconUpload, IconList, IconWand } from '@tabler/icons-react';
import YoutubeDownloader from '../components/YoutubeDownloader';
import FileUploader from '../components/FileUploader';
import VideoList from '../components/VideoList';
import VideoTransformer from '../components/VideoTransformer';

const Home: React.FC = () => {
  return (
    <Container size="lg" py="xl">
      <Title order={1} mb="md" ta="center">YouTube Video Manager</Title>
      
      <Tabs defaultValue="download">
        <Tabs.List>
          <Tabs.Tab value="download" leftSection={<IconDownload size="0.8rem" />}>
            Descargar Video
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<IconUpload size="0.8rem" />}>
            Subir Archivo
          </Tabs.Tab>
          <Tabs.Tab value="videos" leftSection={<IconList size="0.8rem" />}>
            Mis Videos
          </Tabs.Tab>
          <Tabs.Tab value="transform" leftSection={<IconWand size="0.8rem" />}>
            Transformar Video
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="download" pt="xs">
          <Space h="md" />
          <YoutubeDownloader />
        </Tabs.Panel>

        <Tabs.Panel value="upload" pt="xs">
          <Space h="md" />
          <FileUploader />
        </Tabs.Panel>

        <Tabs.Panel value="videos" pt="xs">
          <Space h="md" />
          <VideoList />
        </Tabs.Panel>

        <Tabs.Panel value="transform" pt="xs">
          <Space h="md" />
          <VideoTransformer />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
};

export default Home;

import { useState } from 'react';
import { 
  Container, 
  Tabs, 
  Group, 
  Title, 
  Box,
  ActionIcon
} from '@mantine/core';
import { 
  IconArrowLeft, 
  IconVideo, 
  IconCalendarEvent, 
  IconChartBar 
} from '@tabler/icons-react';
import { VideoList } from './VideoList';
import { ScheduleCalendar } from './ScheduleCalendar';

interface VideoManagementPageProps {
  onBack: () => void;
}

export function VideoManagementPage({ onBack }: VideoManagementPageProps) {
  const [activeTab, setActiveTab] = useState<string | null>('videos');

  return (
    <Container fluid p={0}>
      <Group justify="space-between" mb="lg">
        <Group>
          <ActionIcon variant="subtle" onClick={onBack}>
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Title order={2}>Gestión de Videos</Title>
        </Group>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="videos" leftSection={<IconVideo size={16} />}>
            Videos
          </Tabs.Tab>
          <Tabs.Tab value="schedule" leftSection={<IconCalendarEvent size={16} />}>
            Programación
          </Tabs.Tab>
          <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
            Analíticas
          </Tabs.Tab>
        </Tabs.List>

        <Box mt="md">
          <Tabs.Panel value="videos">
            <VideoList />
          </Tabs.Panel>

          <Tabs.Panel value="schedule">
            <ScheduleCalendar />
          </Tabs.Panel>

          <Tabs.Panel value="analytics">
            <Box p="xl" ta="center">
              <Title order={3} c="dimmed">Próximamente</Title>
            </Box>
          </Tabs.Panel>
        </Box>
      </Tabs>
    </Container>
  );
}

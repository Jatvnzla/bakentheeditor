import { MantineProvider, Container, AppShell, Text, Box } from '@mantine/core';
import { FileUploader } from './components/FileUploader';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';

function App() {
  return (
    <MantineProvider>
      <AppShell
        header={{ height: 60 }}
        padding="md"
      >
        <AppShell.Header>
          <Box h="100%" px="md" style={{ display: 'flex', alignItems: 'center' }}>
            <Text size="xl" fw={700}>MinIO Uploader App</Text>
          </Box>
        </AppShell.Header>
        
        <AppShell.Main>
          <Container size="md" py="xl">
            <FileUploader />
          </Container>
        </AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}

export default App;

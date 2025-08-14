import { MantineProvider, Container, AppShell, Text, Box, Group } from '@mantine/core';
import { FileUploader } from './components/FileUploader';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthProvider } from './context/AuthContext';
import { AuthGate } from './components/AuthGate';
import { UserMenu } from './components/UserMenu';
import { TelegramGate } from './components/TelegramGate';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import { useState } from 'react';
import { SettingsPage } from './components/SettingsPage';

function App() {
  const [page, setPage] = useState<'home' | 'settings'>('home');
  const brand: [string, string, string, string, string, string, string, string, string, string] = [
    '#f9e9fd', // 0
    '#f3d2fb', // 1
    '#eaaef6', // 2
    '#de86ee', // 3
    '#cf66e3', // 4 -> close to color5
    '#b24cc6', // 5 -> close to color4
    '#8f3da1', // 6 -> between color3 & color4
    '#6f327f', // 7 -> near color3
    '#4d2c61', // 8 -> between color2 & color3
    '#121d3f', // 9 -> color1
  ];

  return (
    <MantineProvider
      defaultColorScheme="dark"
      theme={{
        primaryColor: 'brand',
        colors: { brand },
        fontFamily: 'system-ui, Avenir, Helvetica, Arial, sans-serif',
        defaultRadius: 'md',
      }}
    >
      <AuthProvider>
        <AppShell header={{ height: 60 }} padding="md">
          <AppShell.Header>
            <Box h="100%" px="md" className="glass" style={{ display: 'flex', alignItems: 'center' }}>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Text size="xl" fw={700}>Uploader</Text>
                <Group gap="xs">
                  <ThemeToggle />
                  <UserMenu onOpenSettings={() => setPage('settings')} />
                </Group>
              </Group>
            </Box>
          </AppShell.Header>

          <AppShell.Main>
            <Container fluid maw={960} mx="auto" py="xl" px="md">
              {page === 'settings' ? (
                // Página de configuración accesible sin el gate, para que el usuario pueda completar su perfil
                <AuthGate>
                  <SettingsPage onBack={() => setPage('home')} />
                </AuthGate>
              ) : (
                <AuthGate>
                  <TelegramGate>
                    <FileUploader />
                  </TelegramGate>
                </AuthGate>
              )}
            </Container>
          </AppShell.Main>
        </AppShell>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;

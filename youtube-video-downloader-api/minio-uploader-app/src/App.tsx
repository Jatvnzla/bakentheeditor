import { MantineProvider, Container, AppShell, Text, Box, Group, NavLink, rem, Burger } from '@mantine/core';
import { FileUploader } from './components/FileUploader';
import { ThemeToggle } from './components/ThemeToggle';
import { AuthProvider } from './context/AuthContext';
import { VideoProvider } from './context/VideoContext';
import { AuthGate } from './components/AuthGate';
import { UserMenu } from './components/UserMenu';
import { TelegramGate } from './components/TelegramGate';
import '@mantine/core/styles.css';
import '@mantine/dropzone/styles.css';
import '@mantine/dates/styles.css';
import { useState } from 'react';
import { SettingsPage } from './components/SettingsPage';
import { VideoManagementPage } from './components/VideoManagementPage';
import { IconVideo, IconUpload, IconSettings, IconHome } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

function App() {
  const [page, setPage] = useState<'home' | 'settings' | 'videos' | 'upload'>('home');
  const [mobileNavOpened, { toggle }] = useDisclosure(false);
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
        <VideoProvider>
          <AppShell
            header={{ height: 60 }}
            navbar={{
              width: 250,
              breakpoint: 'sm',
              collapsed: { mobile: !mobileNavOpened },
            }}
            padding="md"
          >
          <AppShell.Header>
            <Box h="100%" px="md" className="glass" style={{ display: 'flex', alignItems: 'center' }}>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap={8} align="center">
                  <Burger
                    opened={mobileNavOpened}
                    onClick={toggle}
                    hiddenFrom="sm"
                    size="sm"
                  />
                  <img
                    src="/brand/theeditor-logo.png"
                    alt="theeditor logo"
                    style={{ height: 28, display: 'block' }}
                  />
                  <Text size="xl" fw={700} style={{ display: 'none' }}>theeditor</Text>
                </Group>
                <Group gap="xs">
                  <ThemeToggle />
                  <UserMenu onOpenSettings={() => setPage('settings')} />
                </Group>
              </Group>
            </Box>
          </AppShell.Header>
          
          <AppShell.Navbar p="md" className="glass" style={{ borderRight: '1px solid var(--mantine-color-dark-4)' }}>
            <Box mb="md" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src="/brand/theeditor-logo.png"
                alt="theeditor logo"
                style={{ height: 40, display: 'block', marginBottom: 10 }}
              />
            </Box>
            <Box mb="xl">
              <Text size="sm" fw={500} c="dimmed" mb="xs" style={{ paddingLeft: 8 }}>MENÚ PRINCIPAL</Text>
            <NavLink
              label="Inicio"
              leftSection={<IconHome style={{ width: rem(16), height: rem(16) }} />}
              active={page === 'home'}
              onClick={() => setPage('home')}
              style={{ borderRadius: 8 }}
            />
            <NavLink
              label="Subir Videos"
              leftSection={<IconUpload style={{ width: rem(16), height: rem(16) }} />}
              active={page === 'upload'}
              onClick={() => setPage('upload')}
              style={{ borderRadius: 8 }}
            />
            <NavLink
              label="Gestionar Videos"
              leftSection={<IconVideo style={{ width: rem(16), height: rem(16) }} />}
              active={page === 'videos'}
              onClick={() => setPage('videos')}
              style={{ borderRadius: 8 }}
            />
            <NavLink
              label="Configuración"
              leftSection={<IconSettings style={{ width: rem(16), height: rem(16) }} />}
              active={page === 'settings'}
              onClick={() => setPage('settings')}
              style={{ borderRadius: 8 }}
            />
            </Box>
          </AppShell.Navbar>

          <AppShell.Main>
            <Container fluid maw={960} mx="auto" py="xl" px="md">
              {page === 'settings' ? (
                // Página de configuración accesible sin el gate, para que el usuario pueda completar su perfil
                <AuthGate>
                  <SettingsPage onBack={() => setPage('home')} />
                </AuthGate>
              ) : page === 'videos' ? (
                <AuthGate>
                  <TelegramGate>
                    <VideoManagementPage onBack={() => setPage('home')} />
                  </TelegramGate>
                </AuthGate>
              ) : page === 'upload' ? (
                <AuthGate>
                  <TelegramGate>
                    <FileUploader />
                  </TelegramGate>
                </AuthGate>
              ) : (
                <AuthGate>
                  <TelegramGate>
                    <Box>
                      <Text size="xl" fw={700} mb="lg">Bienvenido a theeditor</Text>
                      <Text mb="md">Selecciona una opción del menú lateral para comenzar:</Text>
                      
                      <Group>
                        <NavLink
                          label="Subir Videos"
                          description="Sube nuevos videos para procesar"
                          leftSection={<IconUpload style={{ width: rem(24), height: rem(24) }} />}
                          onClick={() => setPage('upload')}
                        />
                        
                        <NavLink
                          label="Gestionar Videos"
                          description="Administra y programa tus videos"
                          leftSection={<IconVideo style={{ width: rem(24), height: rem(24) }} />}
                          onClick={() => setPage('videos')}
                        />
                      </Group>
                    </Box>
                  </TelegramGate>
                </AuthGate>
              )}
            </Container>
          </AppShell.Main>
        </AppShell>
        </VideoProvider>
      </AuthProvider>
    </MantineProvider>
  );
}

export default App;

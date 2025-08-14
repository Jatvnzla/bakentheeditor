import { Center, Container, Loader, Stack, Text } from '@mantine/core';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from './AuthCard';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Center mih="60vh">
        <Stack align="center" gap="xs">
          <Loader color="brand" />
          <Text size="xs" c="dimmed">Cargando…</Text>
        </Stack>
      </Center>
    );
  }

  if (!user) {
    return (
      <Container size={420} py="xl">
        <AuthCard />
      </Container>
    );
  }

  return <>{children}</>;
}

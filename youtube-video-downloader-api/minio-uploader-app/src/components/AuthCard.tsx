import { useState } from 'react';
import { Paper, Title, Text, TextInput, PasswordInput, Button, Group, Anchor, Alert, Stack } from '@mantine/core';
import { IconLogin, IconUserPlus, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { FirebaseError } from 'firebase/app';

export function AuthCard() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // basic client-side validation
      if (!email || !email.includes('@')) {
        throw new Error('Ingresa un email válido');
      }
      if (password.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres');
      }
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err) {
      let msg = 'Error desconocido';
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/invalid-email':
            msg = 'Email inválido';
            break;
          case 'auth/email-already-in-use':
            msg = 'Este email ya está registrado';
            break;
          case 'auth/operation-not-allowed':
            msg = 'El método Email/Contraseña no está habilitado en Firebase';
            break;
          case 'auth/weak-password':
            msg = 'La contraseña es demasiado débil';
            break;
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
            msg = 'Credenciales inválidas';
            break;
          case 'auth/user-not-found':
            msg = 'Usuario no encontrado';
            break;
          default:
            msg = err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper p="xl" radius="lg" shadow="xl" className="glass" withBorder={false} style={{ maxWidth: 420, margin: '0 auto' }}>
      <Stack>
        <div>
          <Title order={3} mb="xs">{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</Title>
          <Text size="xs" c="dimmed">Accede para continuar</Text>
        </div>

        {error && (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>
        )}

        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
            />
            <PasswordInput
              label="Contraseña"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
            />

            <Button
              type="submit"
              color="brand"
              loading={loading}
              leftSection={mode === 'login' ? <IconLogin size={16} /> : <IconUserPlus size={16} />}
            >
              {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
            </Button>
          </Stack>
        </form>

        <Group justify="center" gap={6}>
          <Text size="xs" c="dimmed">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
          </Text>
          <Anchor size="xs" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Crear una' : 'Inicia sesión'}
          </Anchor>
        </Group>
      </Stack>
    </Paper>
  );
}

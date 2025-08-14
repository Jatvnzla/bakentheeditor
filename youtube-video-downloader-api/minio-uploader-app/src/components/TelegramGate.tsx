import { useEffect, useMemo, useState } from 'react';
import { Alert, Anchor, Button, Checkbox, Group, Paper, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface Props { children: React.ReactNode }

export function TelegramGate({ children }: Props) {
  const { user } = useAuth();
  const uid = user?.uid;

  const [loading, setLoading] = useState(true);
  const [present, setPresent] = useState(false); // true = must show gate
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waEnabled, setWaEnabled] = useState(false);
  const [waValue, setWaValue] = useState(''); // with + prefix in UI, but saved without '+'
  const [waError, setWaError] = useState<string | null>(null);

  const userDocRef = useMemo(() => (uid ? doc(db, 'users', uid) : null), [uid]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!userDocRef) { setLoading(false); return; }
      try {
        const snap = await getDoc(userDocRef);
        const data = snap.data() as { id_telegram?: string; whatsapp_number?: string; send_to_whatsapp?: boolean } | undefined;
        const missing = !data?.id_telegram;
        if (mounted) {
          setPresent(missing);
          setLoading(false);
          if (data?.send_to_whatsapp) setWaEnabled(true);
          if (data?.whatsapp_number) setWaValue(`+${data.whatsapp_number}`);
        }
      } catch (e) {
        if (mounted) {
          setError('No se pudo leer tu perfil');
          setPresent(true);
          setLoading(false);
        }
      }
    }
    load();
    return () => { mounted = false; };
  }, [userDocRef]);

  const save = async () => {
    if (!userDocRef) return;
    const trimmed = value.trim();
    if (!trimmed) { setError('Ingresa tu ID de Telegram'); return; }
    setSaving(true);
    setError(null);
    setWaError(null);
    try {
      // normalize WhatsApp: strip spaces and plus sign
      const waTrim = waValue.trim().replace(/\s+/g, '');
      const waStored = waTrim.startsWith('+') ? waTrim.slice(1) : waTrim;
      // Validate only if enabled
      if (waEnabled) {
        // Accept digits length 8-15, with optional leading '+' in UI
        const digitsOnly = waStored.replace(/\D/g, '');
        if (digitsOnly.length < 8 || digitsOnly.length > 15) {
          setWaError('Número inválido. Usa prefijo de país, 8-15 dígitos. Ej: +584140000000');
          setSaving(false);
          return;
        }
      }
      const payload: Record<string, any> = { id_telegram: trimmed, updatedAt: serverTimestamp() };
      payload.send_to_whatsapp = waEnabled;
      if (waStored) payload.whatsapp_number = waStored;
      await setDoc(userDocRef, payload, { merge: true });
      setPresent(false);
    } catch (e) {
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // While checking profile, just render children (App may also have its own loading UI)
  if (loading) return <>{children}</>;

  return (
    <>
      {children}
      {present && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backdropFilter: 'blur(10px) saturate(120%)', WebkitBackdropFilter: 'blur(10px) saturate(120%)',
          background: 'rgba(0,0,0,0.35)'
        }}>
          <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
            <Paper p="xl" radius="lg" shadow="xl" className="glass" withBorder={false} style={{ width: 420, maxWidth: '92vw' }}>
              <Stack>
                <div>
                  <Text fw={600} size="lg">Completa tu perfil</Text>
                  <Text size="xs" c="dimmed">
                    Escribe al bot de Telegram y te responderá con tu ID de chat. Copia ese número aquí para continuar.
                  </Text>
                </div>

                {error && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>{error}</Alert>
                )}

                <TextInput
                  label="ID de Telegram"
                  placeholder="Ej: 123456789"
                  value={value}
                  onChange={(e) => setValue(e.currentTarget.value)}
                  disabled={saving}
                  autoFocus
                />

                {/* WhatsApp optional */}
                <Stack gap="xs">
                  <Checkbox
                    checked={waEnabled}
                    onChange={(e) => setWaEnabled(e.currentTarget.checked)}
                    label="Enviar también por WhatsApp (opcional)"
                    disabled={saving}
                  />
                  {waEnabled && (
                    <TextInput
                      label="Número de WhatsApp"
                      description="Incluye el prefijo del país. Ej: +584140000000"
                      placeholder="+5841xxxxxxx"
                      value={waValue}
                      onChange={(e) => setWaValue(e.currentTarget.value)}
                      disabled={saving}
                      error={waError}
                    />
                  )}
                </Stack>

                <Group justify="space-between" align="center">
                  <Anchor
                    size="xs"
                    href="https://t.me/Elpublicadordeinstabot"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir bot y obtener ID
                  </Anchor>
                  <Button color="brand" onClick={save} loading={saving} leftSection={<IconCheck size={16} />}>Guardar</Button>
                </Group>

                <Text size="xs" c="dimmed">
                  Este paso es obligatorio para usar la aplicación. Envía un mensaje al bot y usa el ID que te devuelva.
                </Text>
              </Stack>
            </Paper>
          </div>
        </div>
      )}
    </>
  );
}

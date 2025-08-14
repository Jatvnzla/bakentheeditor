import { useEffect, useMemo, useState } from 'react';
import { Modal, Stack, TextInput, Checkbox, Group, Button, Alert, Text } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function SettingsModal({ opened, onClose }: SettingsModalProps) {
  const { user } = useAuth();
  const uid = user?.uid;
  const userDocRef = useMemo(() => (uid ? doc(db, 'users', uid) : null), [uid]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [telegramId, setTelegramId] = useState('');
  const [waEnabled, setWaEnabled] = useState(false);
  const [waNumber, setWaNumber] = useState(''); // UI with +
  const [waError, setWaError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookError, setWebhookError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    let mounted = true;
    async function load() {
      if (!userDocRef) return;
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const snap = await getDoc(userDocRef);
        const data = snap.data() as {
          id_telegram?: string;
          whatsapp_number?: string;
          send_to_whatsapp?: boolean;
          webhook_url?: string;
        } | undefined;
        if (!mounted || !data) { setLoading(false); return; }
        if (data.id_telegram) setTelegramId(data.id_telegram);
        if (data.whatsapp_number) setWaNumber(`+${data.whatsapp_number}`);
        setWaEnabled(!!(data.send_to_whatsapp && data.whatsapp_number));
        if (data.webhook_url) setWebhookUrl(data.webhook_url);
      } catch (e) {
        if (mounted) setError('No se pudieron cargar tus datos.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [opened, userDocRef]);

  function validateUrl(url: string) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }

  const handleSave = async () => {
    if (!userDocRef) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setWaError(null);
    setWebhookError(null);

    if (!telegramId.trim()) {
      setError('El ID de Telegram es obligatorio.');
      setSaving(false);
      return;
    }

    // Validate WhatsApp if enabled
    let waStored = '';
    if (waEnabled) {
      const waTrim = waNumber.trim().replace(/\s+/g, '');
      waStored = waTrim.startsWith('+') ? waTrim.slice(1) : waTrim;
      const digitsOnly = waStored.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        setWaError('Número inválido. Usa prefijo de país, 8-15 dígitos. Ej: +584140000000');
        setSaving(false);
        return;
      }
      waStored = digitsOnly;
    }

    // Validate webhook if provided
    if (webhookUrl && !validateUrl(webhookUrl)) {
      setWebhookError('URL inválida. Debe comenzar con http(s)://');
      setSaving(false);
      return;
    }

    try {
      const payload: Record<string, any> = {
        id_telegram: telegramId.trim(),
        send_to_whatsapp: waEnabled,
        updatedAt: serverTimestamp()
      };
      if (waStored) payload.whatsapp_number = waStored;
      if (webhookUrl) payload.webhook_url = webhookUrl.trim();

      await setDoc(userDocRef, payload, { merge: true });
      setSuccess('Configuración guardada.');
      onClose();
    } catch (e) {
      setError('No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Configuración" centered size="lg" radius="lg" className="glass">
      <Stack>
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">{error}</Alert>
        )}
        {success && (
          <Alert icon={<IconCheck size={16} />} color="green">{success}</Alert>
        )}

        <TextInput
          label="ID de Telegram"
          placeholder="Tu ID de Telegram"
          required
          value={telegramId}
          onChange={(e) => setTelegramId(e.currentTarget.value)}
          disabled={loading || saving}
        />

        <Checkbox
          label="Enviar también a WhatsApp"
          checked={waEnabled}
          onChange={(e) => setWaEnabled(e.currentTarget.checked)}
          disabled={loading || saving}
        />
        {waEnabled && (
          <TextInput
            label="Número de WhatsApp"
            placeholder="+584140000000"
            value={waNumber}
            onChange={(e) => setWaNumber(e.currentTarget.value)}
            error={waError}
            disabled={loading || saving}
          />
        )}

        <TextInput
          label="URL del webhook"
          description="Se usará esta URL si la especificas"
          placeholder="https://mi-servidor.com/webhook/video"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.currentTarget.value)}
          error={webhookError}
          disabled={loading || saving}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button color="brand" onClick={handleSave} loading={saving}>Guardar</Button>
        </Group>
        <Text size="xs" c="dimmed">Los cambios se aplicarán a los próximos trabajos.</Text>
      </Stack>
    </Modal>
  );
}

import { ActionIcon, Menu, Text, Tooltip } from '@mantine/core';
import { IconLogout, IconUser } from '@tabler/icons-react';
import { useAuth } from '../context/AuthContext';

export function UserMenu() {
  const { user, signOutUser } = useAuth();
  if (!user) return null;

  const email = user.email ?? 'Usuario';

  return (
    <Menu width={180} shadow="md">
      <Menu.Target>
        <Tooltip label={email} position="bottom">
          <ActionIcon variant="subtle" size="lg" aria-label="Usuario">
            <IconUser size={20} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" fw={500} lineClamp={1}>{email}</Text>
        </Menu.Label>
        <Menu.Item leftSection={<IconLogout size={16} />} onClick={signOutUser}>
          Cerrar sesión
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

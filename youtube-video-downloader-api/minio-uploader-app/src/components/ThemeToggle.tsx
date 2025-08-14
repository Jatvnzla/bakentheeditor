import { ActionIcon, Tooltip } from '@mantine/core';
import { useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const isDark = computedColorScheme === 'dark';

  const toggle = () => setColorScheme(isDark ? 'light' : 'dark');

  return (
    <Tooltip label={isDark ? 'Modo claro' : 'Modo oscuro'} position="bottom">
      <ActionIcon
        onClick={toggle}
        variant="subtle"
        size="lg"
        aria-label="Cambiar tema"
      >
        {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
      </ActionIcon>
    </Tooltip>
  );
}

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';

import { AppProvider } from './context/AppContext';
import Home from './pages/Home';

const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
});

function App() {
  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <AppProvider>
        <Home />
      </AppProvider>
    </MantineProvider>
  );
}

export default App;

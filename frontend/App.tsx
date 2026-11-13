import 'react-native-get-random-values';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeDatabase } from './src/database/database';
import ReportsScreen from './src/screens/reports';
import { queryClient } from './src/services/query-client';
import { startQueueRunner } from './src/services/queue-runner';

function App() {
  useEffect(() => {
    initializeDatabase()
      .then(() => {
        console.log('SQLite database initialized successfully.');
        startQueueRunner();
      })
      .catch(error => {
        console.error('SQLite initialization failed:', error);
      });
  }, []);


  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar barStyle={'dark-content'} />
        <ReportsScreen />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default App;

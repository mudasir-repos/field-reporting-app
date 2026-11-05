import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import 'react-native-get-random-values';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReportsScreen from './src/screens/reports';
import { queryClient } from './src/services/query-client';
import { useEffect } from 'react';
import { db, initializeDatabase } from './src/database/database';
import { getLocalReports } from './src/database/report-repository';

function App() {
  useEffect(() => {
    initializeDatabase()
      .then(() => {
        console.log('SQLite database initialized successfully.');
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

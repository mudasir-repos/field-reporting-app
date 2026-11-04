import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'react-native';
import 'react-native-get-random-values';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReportsScreen from './src/screens/reports';
import { queryClient } from './src/services/query-client';

function App() {
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

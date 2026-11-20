import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { queryClient } from '../api/queryClient';
import Toaster from '../components/ui/Toaster';
import AppRouter from './AppRouter';

export default function PrivateApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

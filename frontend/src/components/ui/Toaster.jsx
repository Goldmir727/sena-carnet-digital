import { Toaster as HotToaster } from 'react-hot-toast';

export default function Toaster() {
  return (
    <HotToaster
      position="top-right"
      containerStyle={{ zIndex: 99999 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#17212B',
          border: '1px solid #E2E8F0',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 24px rgba(23,33,43,0.12)',
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '0.75rem 1rem',
        },
        success: {
          iconTheme: { primary: '#0F7A4D', secondary: '#fff' },
          style: { borderLeft: '3px solid #0F7A4D' },
        },
        error: {
          iconTheme: { primary: '#DC2626', secondary: '#fff' },
          style: { borderLeft: '3px solid #DC2626' },
        },
      }}
    />
  );
}
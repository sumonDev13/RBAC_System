import type { Metadata } from 'next';
import './globals.css';
import ReduxProvider from '@/providers/ReduxProvider';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'RBAC System · Dynamic Permissions',
  description: 'Role-based access control with dynamic atomic permissions',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#0D1117',
                color:      '#EDF2F7',
                border:     '1px solid #1E2A35',
                borderRadius: '10px',
                fontFamily: 'DM Sans, sans-serif',
                fontSize:   '0.875rem',
              },
              success: { iconTheme: { primary: '#00E5A0', secondary: '#0D1117' } },
              error:   { iconTheme: { primary: '#FF5C5C', secondary: '#0D1117' } },
            }}
          />
        </ReduxProvider>
      </body>
    </html>
  );
}
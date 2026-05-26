'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import AvitoLiveBridge from '@/components/AvitoLiveBridge';
import NotificationPermissionPrompt from '@/components/NotificationPermissionPrompt';
import PwaBootstrap from '@/components/PwaBootstrap';
import PushSubscriptionSync from '@/components/PushSubscriptionSync';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <PwaBootstrap />
      <AvitoLiveBridge />
      <PushSubscriptionSync />
      <NotificationPermissionPrompt />
      <Toaster position="top-right" richColors />
      {children}
    </AuthProvider>
  );
}

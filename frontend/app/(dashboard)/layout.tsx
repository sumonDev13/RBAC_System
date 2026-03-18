'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector, selectUser, selectAccessToken } from '@/store/hooks';
import { fetchMeThunk } from '@/store/slices/authSlice';
import Sidebar from '@/components/Sidebar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dispatch     = useAppDispatch();
  const router       = useRouter();
  const user         = useAppSelector(selectUser);
  const accessToken  = useAppSelector(selectAccessToken);
  const isInitialized = useAppSelector(s => s.auth.isInitialized);

  useEffect(() => {
    if (accessToken) {
      dispatch(fetchMeThunk()).then(result => {
        if (fetchMeThunk.rejected.match(result)) {
          router.replace('/login');
        }
      });
    } else {
      router.replace('/login');
    }
  }, []);

  if (!isInitialized || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={32} className="animate-spin text-accent" />
          <span className="text-muted text-sm font-display">Loading session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="ml-[260px] flex-1 p-8 max-w-[1400px]">
        {children}
      </main>
    </div>
  );
}
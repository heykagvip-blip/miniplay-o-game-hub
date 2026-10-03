import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-500/95 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg shadow-amber-500/20 border border-amber-400">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Chế độ Offline — Toàn bộ game vẫn hoạt động trơn tru!</span>
    </div>
  );
};

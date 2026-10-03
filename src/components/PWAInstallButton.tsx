import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all game-btn-press"
        title="Cài đặt MiniPlay để chơi không cần Internet"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Cài đặt App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Cài trên iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl relative text-left">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                📱 Cài đặt trên iPhone / iPad
              </h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span>Nhấn vào nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.</span>
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

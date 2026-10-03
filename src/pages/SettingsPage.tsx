import React, { useState } from 'react';
import { AppSettings } from '../types';
import {
  Settings, 
  Volume2, 
  VolumeX, 
  Vibrate, 
  Moon, 
  Sun, 
  Trash2, 
  AlertTriangle, 
  Check, 
  X, 
  Smartphone, 
  HardDrive,
  Music2
} from 'lucide-react';
import { clearRecentHistory, resetAllData } from '../utils/storage';
import { playMoveSound, startBackgroundMusic, stopBackgroundMusic, triggerHaptic } from '../utils/sound';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onDataReset: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onDataReset,
}) => {
  const [showResetModal, setShowResetModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearHistory = () => {
    playMoveSound();
    triggerHaptic(20);
    clearRecentHistory();
    onDataReset();
    triggerToast('Đã xóa danh sách trò chơi vừa chơi gần đây!');
  };

  const handleConfirmResetAll = () => {
    playMoveSound();
    triggerHaptic(30);
    resetAllData();
    onDataReset();
    setShowResetModal(false);
    triggerToast('Đã khôi phục cài đặt gốc và xóa toàn bộ dữ liệu!');
  };

  return (
    <div className="space-y-8 text-left pb-16 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Cài đặt hệ thống</h1>
          <p className="text-xs text-slate-400">
            Tùy chỉnh giao diện, hiệu ứng âm thanh và quản trị dữ liệu lưu trữ
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Preferences Section */}
      <div className="theme-panel rounded-3xl p-5 sm:p-6 shadow-xl space-y-6">
        <h2 className="text-sm font-bold uppercase tracking-wider theme-muted">
          Tùy chọn trải nghiệm
        </h2>

        {/* Theme mode */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400">
              {settings.theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <div className="text-sm font-bold theme-text">Giao diện (Theme)</div>
              <p className="text-xs theme-muted">
                {settings.theme === 'dark' ? 'Chế độ tối (Dark Mode - mặc định gaming)' : 'Chế độ sáng (Light Mode)'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              playMoveSound();
              onUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
            }}
            className="px-4 py-2 rounded-xl theme-panel-soft text-xs font-bold theme-text border theme-border transition"
          >
            {settings.theme === 'dark' ? 'Đổi sang Sáng' : 'Đổi sang Tối'}
          </button>
        </div>

        {/* Sound Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400">
              {settings.sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <div className="text-sm font-bold theme-text">Hiệu ứng âm thanh (Audio Synthesizer)</div>
              <p className="text-xs theme-muted">
                Âm thanh vintage 8-bit tổng hợp bằng Web Audio API không tốn băng thông
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !settings.sound;
              onUpdateSettings({ sound: next });
              if (!next) {
                stopBackgroundMusic();
              } else if (settings.music) {
                startBackgroundMusic();
              }
              if (next) playMoveSound();
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.sound ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.sound ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="ml-[52px] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="effects-volume" className="theme-muted">Âm lượng hiệu ứng</label>
            <output htmlFor="effects-volume" className="theme-text font-semibold">{settings.soundVolume}%</output>
          </div>
          <input
            id="effects-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={settings.soundVolume}
            onChange={event => onUpdateSettings({ soundVolume: Number(event.target.value) })}
            className="audio-volume-slider w-full"
            aria-label="Âm lượng hiệu ứng âm thanh"
          />
        </div>

        {/* Background Music Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-cyan-400">
              {settings.music ? <Music2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
            </div>
            <div>
              <div className="text-sm font-bold theme-text">Nhạc nền 8-bit</div>
              <p className="text-xs theme-muted">
                Giai điệu nền nhẹ nhàng cho trải nghiệm arcade và không làm lộ phí dữ liệu
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !settings.music;
              onUpdateSettings({ music: next });
              if (next && settings.sound) {
                const style = settings.musicStyle === 'auto' || !settings.musicStyle ? settings.theme : settings.musicStyle;
                startBackgroundMusic(style);
              } else {
                stopBackgroundMusic();
              }
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.music ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.music ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="ml-[52px] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="music-volume" className="theme-muted">Âm lượng nhạc nền</label>
            <output htmlFor="music-volume" className="theme-text font-semibold">{settings.musicVolume}%</output>
          </div>
          <input
            id="music-volume"
            type="range"
            min="0"
            max="100"
            step="1"
            value={settings.musicVolume}
            onChange={event => onUpdateSettings({ musicVolume: Number(event.target.value) })}
            className="audio-volume-slider w-full"
            aria-label="Âm lượng nhạc nền"
          />
        </div>

        {/* Music Style Selector */}
        {settings.music && (
          <div className="ml-[52px] pt-1 space-y-2">
            <div className="text-xs font-semibold theme-text flex items-center justify-between">
              <span>Giai điệu nhạc nền</span>
              <span className="text-[11px] theme-muted font-normal">
                {(!settings.musicStyle || settings.musicStyle === 'auto')
                  ? (settings.theme === 'light' ? '☀️ Tự động: Vui tươi (Sáng)' : '🌙 Tự động: Du dương (Tối)')
                  : settings.musicStyle === 'calm' ? '🌙 Du dương êm đềm' : '☀️ Vui tươi Arcade'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  playMoveSound();
                  onUpdateSettings({ musicStyle: 'auto' });
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  (!settings.musicStyle || settings.musicStyle === 'auto')
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'theme-panel-soft theme-muted hover:theme-text theme-border'
                }`}
              >
                🔄 Tự động
              </button>

              <button
                type="button"
                onClick={() => {
                  playMoveSound();
                  onUpdateSettings({ musicStyle: 'upbeat' });
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  settings.musicStyle === 'upbeat'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'theme-panel-soft theme-muted hover:theme-text theme-border'
                }`}
              >
                ☀️ Vui tươi
              </button>

              <button
                type="button"
                onClick={() => {
                  playMoveSound();
                  onUpdateSettings({ musicStyle: 'calm' });
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  settings.musicStyle === 'calm'
                    ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/40'
                    : 'theme-panel-soft theme-muted hover:theme-text theme-border'
                }`}
              >
                🌙 Du dương
              </button>
            </div>
            <p className="text-[11px] theme-muted">
              Giao diện sáng phát nhạc arcade vui tươi; giao diện tối tự động phát nhạc du dương, êm dịu thư giãn.
            </p>
          </div>
        )}

        {/* Haptic Vibration Toggle */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-purple-400">
              <Vibrate className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold theme-text">Rung phản hồi điện thoại (Haptics)</div>
              <p className="text-xs theme-muted">
                Phản hồi rung nhẹ khi di chuyển, va chạm và ghi điểm trên thiết bị di động
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const next = !settings.vibration;
              onUpdateSettings({ vibration: next });
              if (next) triggerHaptic(30);
            }}
            className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.vibration ? 'bg-indigo-600' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.vibration ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* PWA & Offline Info */}
      <div className="theme-panel rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider theme-muted flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <span>Cài đặt ứng dụng PWA & Bộ nhớ Offline</span>
        </h2>
        <p className="text-xs theme-muted leading-relaxed">
          MiniPlay sử dụng LocalStorage và Service Worker cục bộ. Toàn bộ logic 10 mini game, kỷ lục điểm và thống kê được lưu trữ trực tiếp trên thiết bị của bạn.
        </p>
        <div>
          <PWAInstallButton />
        </div>
      </div>

      {/* Data Management Section */}
      <div className="theme-panel rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400">
          Vùng quản lý dữ liệu
        </h2>

        {/* Clear Recent History */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold theme-text">Xóa lịch sử chơi gần đây</div>
            <p className="text-xs theme-muted">
              Chỉ xóa danh sách các game vừa chơi ở trang chủ, giữ lại toàn bộ điểm kỷ lục
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            className="px-4 py-2 rounded-xl theme-panel-soft text-xs font-bold theme-text border theme-border transition game-btn-press"
          >
            Xóa lịch sử
          </button>
        </div>

        {/* Reset All Data */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
          <div>
            <div className="text-sm font-bold text-rose-400">Xóa toàn bộ dữ liệu</div>
            <p className="text-xs theme-muted">
              Đặt lại điểm cao, danh sách yêu thích, thành tích và lịch sử về trạng thái ban đầu
            </p>
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/40 text-xs font-bold transition game-btn-press"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset dữ liệu</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-rose-500/30 p-6 shadow-2xl text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-white">Xác nhận xóa toàn bộ?</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Hành động này sẽ xóa vĩnh viễn toàn bộ kỷ lục High Score, danh sách yêu thích và dữ liệu chơi của bạn. Bạn có chắc chắn muốn thực hiện?
            </p>

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Hủy bỏ
              </button>

              <button
                onClick={handleConfirmResetAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition"
              >
                Xóa sạch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

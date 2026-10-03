import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  RotateCcw, 
  Pause, 
  Play, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Trophy, 
  X, 
  Sparkles 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameMetadata } from '../types';
import { GameLogo } from './GameLogo';
import { 
  getHighScore, 
  saveHighScore, 
  recordRecentGame, 
  recordGameSession,
  getSettings,
  saveSettings
} from '../utils/storage';
import { 
  playVictorySound, 
  playGameOverSound, 
  playMoveSound, 
  triggerHaptic 
} from '../utils/sound';

interface GameShellProps {
  game: GameMetadata;
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
  onPauseToggle?: () => void;
  onRestart: () => void;
  onBackToHub: () => void;
  gameCustomStats?: React.ReactNode;
  children: React.ReactNode;
  isVictory?: boolean;
  isDraw?: boolean;
}

export const GameShell: React.FC<GameShellProps> = ({
  game,
  score,
  isGameOver,
  isPaused,
  onPauseToggle,
  onRestart,
  onBackToHub,
  gameCustomStats,
  children,
  isVictory = false,
  isDraw = false,
}) => {
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const recordedRef = useRef(false);

  // Initialize high score and settings
  useEffect(() => {
    const currentHigh = getHighScore(game.id);
    setHighScore(currentHigh);
    recordRecentGame(game.id);
    const settings = getSettings();
    setSoundEnabled(settings.sound);
  }, [game.id]);

  // Handle Game Over / Record update
  useEffect(() => {
    if (!isGameOver) {
      recordedRef.current = false;
      setIsNewRecord(false);
      return;
    }
    // A game can still touch its score after ending (toggles, late timers);
    // only settle the session once per game-over transition.
    if (recordedRef.current) return;
    recordedRef.current = true;
    recordGameSession(game.id, isDraw ? 'draw' : isVictory ? 'win' : 'loss');
    const { isNewRecord: newRec, highScore: latestHigh } = saveHighScore(game.id, score);
    setHighScore(latestHigh);
    setIsNewRecord(newRec);

    if (newRec || isVictory) {
      playVictorySound();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    } else if (isDraw) {
      playMoveSound();
    } else {
      playGameOverSound();
    }
  }, [isGameOver, score, game.id, isVictory, isDraw]);

  // Let the final move land on screen before the result card slides in.
  useEffect(() => {
    if (!isGameOver) {
      setShowResult(false);
      return;
    }
    const timer = window.setTimeout(() => setShowResult(true), 1100);
    return () => window.clearTimeout(timer);
  }, [isGameOver]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveSettings({ sound: next });
    playMoveSound();
  };

  const handleToggleFullscreen = () => {
    playMoveSound();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen theme-panel-strong theme-text flex flex-col">
      {/* Game Shell Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b theme-border px-4 py-2.5" style={{ background: 'var(--card-bg)' }}>
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Back button & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playMoveSound();
                onBackToHub();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl theme-panel-soft theme-text text-xs font-semibold border theme-border transition game-btn-press"
              title="Quay lại Game Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Game Hub</span>
            </button>

            <div className="flex items-center gap-2">
              <GameLogo game={game} size="header" />
              <div>
                <h1 className="text-sm sm:text-base font-bold theme-text leading-tight">
                  {game.name}
                </h1>
                <span className="text-[10px] theme-muted hidden sm:inline-block">
                  {game.vietnameseName}
                </span>
              </div>
            </div>
          </div>

          {/* Middle: Scoreboards */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="px-3 py-1 rounded-xl border theme-border flex items-center gap-2" style={{ background: 'var(--surface-strong)' }}>
              <span className="text-[10px] uppercase font-bold theme-muted">Điểm:</span>
              <span className="text-base sm:text-lg font-black text-indigo-400">
                {score.toLocaleString('vi-VN')}
              </span>
            </div>

            <div className="px-3 py-1 rounded-xl border theme-border flex items-center gap-2" style={{ background: 'var(--surface-strong)' }}>
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] uppercase font-bold theme-muted hidden sm:inline">Kỷ lục:</span>
              <span className="text-sm sm:text-base font-bold text-amber-400">
                {highScore.toLocaleString('vi-VN')}
              </span>
            </div>

            {gameCustomStats && (
              <div className="game-shell-status contents">
                {gameCustomStats}
              </div>
            )}
          </div>

          {/* Right: Actions (Pause, Restart, Sound, Rules, Fullscreen) */}
          <div className="flex items-center gap-1.5">
            {onPauseToggle && (
              <button
                onClick={() => {
                  playMoveSound();
                  triggerHaptic(20);
                  onPauseToggle();
                }}
                className={`p-2 rounded-xl border transition game-btn-press ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'theme-panel-soft theme-text border theme-border'
                }`}
                title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
              >
                {isPaused ? <Play className="w-4 h-4 fill-amber-400" /> : <Pause className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={() => {
                playMoveSound();
                triggerHaptic(20);
                onRestart();
              }}
              className="p-2 rounded-xl theme-panel-soft theme-text border theme-border transition game-btn-press"
              title="Chơi lại từ đầu"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleSound}
              className="p-2 rounded-xl theme-panel-soft theme-text border theme-border transition game-btn-press"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              onClick={() => {
                playMoveSound();
                setShowInstructions(true);
              }}
              className="p-2 rounded-xl theme-panel-soft theme-text border theme-border transition game-btn-press"
              title="Hướng dẫn chơi"
            >
              <HelpCircle className="w-4 h-4 text-indigo-400" />
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="hidden sm:flex p-2 rounded-xl theme-panel-soft theme-text border theme-border transition game-btn-press"
              title="Toàn màn hình"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Play Area */}
      <main className="game-play-area flex-1 relative flex flex-col items-center justify-center p-2 sm:p-4 max-w-6xl mx-auto w-full overflow-hidden">
        <div className="game-content contents">{children}</div>

        {/* Pause Overlay */}
        {isPaused && !isGameOver && (
          <div className="game-modal-backdrop absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm theme-panel rounded-3xl p-6 sm:p-8 text-center shadow-2xl space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Pause className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-2xl font-black theme-text">Đã tạm dừng</h2>
                <p className="mt-1 text-xs theme-muted">Trò chơi đang dừng lại, bấm tiếp tục để chơi tiếp.</p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    playMoveSound();
onPauseToggle?.();
                  }}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition game-btn-press flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Tiếp tục</span>
                </button>

                <button
                  onClick={() => {
                    playMoveSound();
                    onRestart();
                  }}
                  className="w-full py-2.5 rounded-xl theme-panel-soft theme-text font-semibold text-xs border theme-border transition game-btn-press flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>

                <button
                  onClick={() => {
                    playMoveSound();
                    onBackToHub();
                  }}
                  className="w-full py-2 theme-muted text-xs transition"
                >
                  ← Thoát ra Game Hub
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Game Over / Victory Modal */}
        {isGameOver && showResult && (
          <div className="game-modal-backdrop absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-sm theme-panel rounded-3xl p-6 sm:p-8 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
              {/* Highlight ribbon for new record */}
              {isNewRecord && (
                <div className="absolute top-3 left-0 right-0 py-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 text-xs font-black tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>🏆 Kỷ lục mới thiết lập!</span>
                </div>
              )}

              <div className={isNewRecord ? 'mt-6' : 'mt-0'}>
                <div className="text-5xl mb-2">{isDraw ? '🤝' : isVictory ? '🎉' : '💀'}</div>
                <h2 className="text-2xl font-black theme-text">
                  {isDraw ? 'Hòa rồi!' : isVictory ? 'Chiến thắng tuyệt vời!' : 'Game Over!'}
                </h2>
                <p className="mt-1 text-xs theme-muted">
                  {isDraw
                    ? 'Hai bên đã bất phân thắng bại — cùng điểm tuyệt vời!'
                    : isVictory
                      ? 'Bạn đã hoàn thành thử thách xuất sắc!'
                      : 'Rất tiếc! Đừng nản lòng, thử lại ngay nào.'}
                </p>
              </div>

              {/* Score breakdown */}
              <div className="my-6 grid grid-cols-2 gap-3 p-3.5 rounded-2xl border theme-border" style={{ background: 'var(--surface-strong)' }}>
                <div className="text-center">
                  <span className="text-[11px] theme-muted font-medium">Điểm của bạn</span>
                  <div className="text-xl font-black text-indigo-400 mt-0.5">
                    {score.toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="text-center border-l theme-border">
                  <span className="text-[11px] theme-muted font-medium">Điểm kỷ lục</span>
                  <div className="text-xl font-black text-amber-400 mt-0.5">
                    {highScore.toLocaleString('vi-VN')}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    playMoveSound();
                    triggerHaptic(25);
                    onRestart();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition game-btn-press flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>

                <button
                  onClick={() => {
                    playMoveSound();
                    onBackToHub();
                  }}
                  className="w-full py-2.5 rounded-xl theme-panel-soft theme-text font-semibold text-xs border theme-border transition game-btn-press"
                >
                  Quay về Game Hub
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Instructions Modal Drawer */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md theme-panel rounded-3xl p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowInstructions(false)}
              className="absolute top-4 right-4 p-2 theme-muted"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <GameLogo game={game} size="stat" />
              <div>
                <h3 className="text-lg font-bold theme-text">Cách chơi {game.name}</h3>
                <p className="text-xs text-indigo-400 font-medium">{game.vietnameseName}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider theme-muted mb-2">
                🎮 Phím điều khiển
              </h4>
              <ul className="space-y-1.5">
                {game.controls.map((ctrl, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    <span>{ctrl}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Rules */}
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider theme-muted mb-2">
                📜 Luật chơi & Mẹo ghi điểm
              </h4>
              <ul className="space-y-1.5">
                {game.instructions.map((ins, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-indigo-400">•</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
            >
              Đã hiểu, tiếp tục chơi!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

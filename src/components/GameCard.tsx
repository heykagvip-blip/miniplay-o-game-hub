import React from 'react';
import { Play, Star, Trophy, Sparkles } from 'lucide-react';
import { GameMetadata } from '../types';
import { GameLogo } from './GameLogo';
import { playMoveSound, triggerHaptic } from '../utils/sound';

interface GameCardProps {
  game: GameMetadata;
  highScore: number;
  isFav: boolean;
  onSelect: (gameId: string) => void;
  onToggleFav: (gameId: string, e: React.MouseEvent) => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  highScore,
  isFav,
  onSelect,
  onToggleFav,
}) => {
  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Dễ':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'Trung bình':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'Khó':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default:
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    }
  };

  const handlePlayClick = () => {
    playMoveSound();
    triggerHaptic(20);
    onSelect(game.id);
  };

  return (
    <div
      onClick={handlePlayClick}
      className="group relative flex flex-col justify-between rounded-2xl theme-panel p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer text-left"
    >
      {/* Top row: Icon, Category badge, Favorite button */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="relative">
            <GameLogo game={game} size="card" />
            {game.isFeatured && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold" title="Game nổi bật">
                ★
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${getDifficultyColor(game.difficulty)}`}>
              {game.difficulty}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playMoveSound();
                triggerHaptic(15);
                onToggleFav(game.id, e);
              }}
              className={`p-2 rounded-xl transition-colors ${
                isFav
                  ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                  : 'theme-panel-soft text-slate-500 hover:text-slate-300'
              }`}
              title={isFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Title and Vietnamese subtitle */}
        <div className="mt-4">
          <h3 className="text-lg font-bold theme-text group-hover:text-indigo-400 transition-colors flex items-center gap-2">
            <span>{game.name}</span>
            <span className="text-xs font-normal theme-muted">({game.vietnameseName})</span>
          </h3>
          <p className="mt-1.5 text-xs theme-muted line-clamp-2 leading-relaxed">
            {game.description}
          </p>
        </div>
      </div>

      {/* Bottom stats and Play CTA */}
      <div className="mt-5 pt-3.5 border-t theme-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium theme-muted">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Kỷ lục:</span>
          <span className="font-bold theme-text">
            {highScore > 0 ? highScore.toLocaleString('vi-VN') : '0'}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePlayClick();
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 group-hover:shadow-indigo-600/50 transition-all game-btn-press"
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          <span>Chơi ngay</span>
        </button>
      </div>
    </div>
  );
};

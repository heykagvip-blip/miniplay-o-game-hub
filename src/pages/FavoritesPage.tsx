import React from 'react';
import { GameMetadata } from '../types';
import { GAMES } from '../data/games';
import { GameCard } from '../components/GameCard';
import { Star, Gamepad2 } from 'lucide-react';
import { playMoveSound } from '../utils/sound';

interface FavoritesPageProps {
  favorites: string[];
  onSelectGame: (gameId: string) => void;
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  highScores: Record<string, number>;
  onExploreGames: () => void;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  favorites,
  onSelectGame,
  onToggleFavorite,
  highScores,
  onExploreGames,
}) => {
  const favoriteGames = GAMES.filter(g => favorites.includes(g.id));

  return (
    <div className="space-y-6 text-left pb-16">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Star className="w-5 h-5 fill-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black theme-text">Trò chơi yêu thích</h1>
          <p className="text-xs theme-muted">
            Danh sách các mini game bạn đã đánh dấu sao ({favoriteGames.length})
          </p>
        </div>
      </div>

      {favoriteGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {favoriteGames.map(game => (
            <GameCard
              key={game.id}
              game={game}
              highScore={highScores[game.id] || 0}
              isFav={true}
              onSelect={onSelectGame}
              onToggleFav={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 theme-panel rounded-3xl p-8 max-w-lg mx-auto">
          <div className="w-16 h-16 mx-auto rounded-3xl theme-panel-soft flex items-center justify-center text-3xl mb-4">
            ⭐
          </div>
          <h2 className="text-lg font-bold theme-text">Bạn chưa có game yêu thích</h2>
          <p className="text-xs theme-muted mt-2 leading-relaxed">
            Nhấn vào biểu tượng ngôi sao trên bất kỳ thẻ trò chơi nào để thêm vào danh sách truy cập nhanh của bạn.
          </p>
          <button
            onClick={() => {
              playMoveSound();
              onExploreGames();
            }}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition game-btn-press"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Khám phá trò chơi ngay</span>
          </button>
        </div>
      )}
    </div>
  );
};

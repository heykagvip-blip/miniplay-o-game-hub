import React, { useState, useMemo } from 'react';
import { GameMetadata } from '../types';
import { GAMES, CATEGORIES } from '../data/games';
import { GameCard } from '../components/GameCard';
import { CategoryTabs } from '../components/CategoryTabs';
import { Gamepad2, Search, SlidersHorizontal } from 'lucide-react';

interface GamesPageProps {
  onSelectGame: (gameId: string) => void;
  favorites: string[];
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  highScores: Record<string, number>;
  initialCategory?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const GamesPage: React.FC<GamesPageProps> = ({
  onSelectGame,
  favorites,
  onToggleFavorite,
  highScores,
  initialCategory = 'all',
  searchQuery,
  onSearchChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [sortBy, setSortBy] = useState<'popular' | 'name' | 'highscore'>('popular');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: GAMES.length };
    GAMES.forEach(g => {
      counts[g.category] = (counts[g.category] || 0) + 1;
    });
    return counts;
  }, []);

  const filtered = useMemo(() => {
    let list = [...GAMES];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        g =>
          g.name.toLowerCase().includes(q) ||
          g.vietnameseName.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (selectedCategory !== 'all') {
      list = list.filter(g => g.category === selectedCategory);
    }
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'highscore') {
      list.sort((a, b) => (highScores[b.id] || 0) - (highScores[a.id] || 0));
    } else {
      list.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    }
    return list;
  }, [searchQuery, selectedCategory, sortBy, highScores]);

  return (
    <div className="space-y-6 text-left pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black theme-text">Kho mini game ({filtered.length})</h1>
            <p className="text-xs theme-muted">
              Trọn bộ {GAMES.length} mini game offline chất lượng cao, chơi ngay không cần chờ tải
            </p>
          </div>
        </div>

        {/* Search & Sort inside page */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 theme-muted" />
            <input
              type="text"
              placeholder="Lọc trò chơi..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 theme-input rounded-xl text-xs theme-text focus:outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'popular' | 'name' | 'highscore')}
            className="theme-input rounded-xl px-3 py-1.5 text-xs theme-text focus:outline-none"
          >
            <option value="popular">Phổ biến</option>
            <option value="name">Tên A-Z</option>
            <option value="highscore">Điểm cao</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <CategoryTabs
        activeCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        categoryCounts={categoryCounts}
      />

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(game => (
            <GameCard
              key={game.id}
              game={game}
              highScore={highScores[game.id] || 0}
              isFav={favorites.includes(game.id)}
              onSelect={onSelectGame}
              onToggleFav={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 theme-panel rounded-3xl p-8">
          <h3 className="text-sm font-bold theme-text">Không tìm thấy game nào</h3>
          <p className="text-xs theme-muted mt-1">Vui lòng thử từ khóa khác.</p>
        </div>
      )}
    </div>
  );
};

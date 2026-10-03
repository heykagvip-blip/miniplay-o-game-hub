import React, { useState, useMemo } from 'react';
import { GameMetadata } from '../types';
import { GAMES, CATEGORIES } from '../data/games';
import { GameCard } from '../components/GameCard';
import { GameLogo } from '../components/GameLogo';
import { CategoryTabs } from '../components/CategoryTabs';
import { 
  Gamepad2, 
  Sparkles, 
  RotateCcw, 
  Trophy, 
  Flame, 
  ArrowRight, 
  Search, 
  SlidersHorizontal 
} from 'lucide-react';
import { playMoveSound, triggerHaptic } from '../utils/sound';

interface HomeProps {
  onSelectGame: (gameId: string) => void;
  recentGameIds: string[];
  favorites: string[];
  onToggleFavorite: (gameId: string, e: React.MouseEvent) => void;
  highScores: Record<string, number>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Home: React.FC<HomeProps> = ({
  onSelectGame,
  recentGameIds,
  favorites,
  onToggleFavorite,
  highScores,
  searchQuery,
  onSearchChange,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'popular' | 'name' | 'highscore'>('popular');

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: GAMES.length };
    GAMES.forEach(g => {
      counts[g.category] = (counts[g.category] || 0) + 1;
    });
    return counts;
  }, []);

  // Filtered & sorted games
  const filteredGames = useMemo(() => {
    let result = [...GAMES];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        g =>
          g.name.toLowerCase().includes(q) ||
          g.vietnameseName.toLowerCase().includes(q) ||
          g.description.toLowerCase().includes(q) ||
          g.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      result = result.filter(g => g.category === selectedCategory);
    }

    // Sort
    if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'highscore') {
      result.sort((a, b) => (highScores[b.id] || 0) - (highScores[a.id] || 0));
    } else {
      // Popular (featured first)
      result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
    }

    return result;
  }, [searchQuery, selectedCategory, sortBy, highScores]);

  // Recently played or suggested games
  const recentGames = useMemo(() => {
    if (recentGameIds.length > 0) {
      return recentGameIds
        .map(id => GAMES.find(g => g.id === id))
        .filter((g): g is GameMetadata => g !== undefined)
        .slice(0, 4);
    }
    // Fallback suggested
    return GAMES.filter(g => g.isFeatured).slice(0, 4);
  }, [recentGameIds]);

  const featuredGames = useMemo(() => {
    return GAMES.filter(g => g.isFeatured);
  }, []);

  const handleHeroPlay = () => {
    playMoveSound();
    triggerHaptic(20);
    // Launch first featured game or snake
    const target = recentGames[0] || GAMES[0];
    onSelectGame(target.id);
  };

  const scrollToGames = () => {
    const el = document.getElementById('all-games-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section
        className="relative overflow-hidden rounded-3xl border p-6 sm:p-10 lg:p-12 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(96, 104, 255, 0.18), var(--card-bg) 42%, rgba(110, 200, 255, 0.18) 100%)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-2xl text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-800 dark:text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>100% Offline • Không cần mạng • Chơi mượt mà</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black theme-text tracking-tight leading-tight">
            Chơi mọi lúc. <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Không cần Internet.
            </span>
          </h1>

          <p className="mt-3 sm:mt-4 text-sm sm:text-base theme-muted leading-relaxed max-w-xl">
            Kho mini game giải trí nhẹ nhàng, chơi ngay trên trình duyệt. Thư giãn cùng Snake, Tetris, 2048, Minesweeper và nhiều trò chơi hấp dẫn khác mọi lúc mọi nơi!
          </p>

          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-3 sm:gap-4">
            <button
              onClick={handleHeroPlay}
              className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all game-btn-press"
            >
              <Gamepad2 className="w-5 h-5" />
              <span>🎮 Chơi ngay</span>
            </button>

            <button
              onClick={scrollToGames}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl theme-panel-soft theme-text font-semibold text-sm border theme-border transition"
            >
              <span>Khám phá kho game</span>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        </div>
      </section>

      {/* "Chơi tiếp" (Continue Playing) / Recent Games */}
      <section className="text-left">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg sm:text-xl font-bold theme-text">
              {recentGameIds.length > 0 ? 'Chơi tiếp gần đây' : 'Gợi ý cho bạn'}
            </h2>
          </div>
          {recentGameIds.length > 0 && (
            <span className="text-xs theme-muted">Đã lưu tiến độ offline</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentGames.map(game => (
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
      </section>

      {/* Featured Games Spotlight */}
      <section className="text-left">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg sm:text-xl font-bold theme-text">Game nổi bật hàng đầu</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featuredGames.map(game => (
            <div
              key={`featured-${game.id}`}
              onClick={() => onSelectGame(game.id)}
              className="group relative overflow-hidden rounded-3xl theme-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 cursor-pointer text-left flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-colors" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <GameLogo game={game} size="card" />
                  <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    ★ NỔI BẬT
                  </span>
                </div>

                <h3 className="text-xl font-bold theme-text group-hover:text-indigo-400 transition-colors">
                  {game.name}
                </h3>
                <p className="text-xs text-indigo-400 font-semibold mb-2">{game.vietnameseName}</p>
                <p className="text-xs theme-muted leading-relaxed line-clamp-3">
                  {game.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t theme-border flex items-center justify-between">
                <div className="text-xs theme-muted">
                  Kỷ lục: <strong className="theme-text">{(highScores[game.id] || 0).toLocaleString('vi-VN')}</strong>
                </div>
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Chơi ngay →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* All Games Grid with Filters */}
      <section id="all-games-section" className="text-left space-y-6 pt-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black theme-text">
              Tất cả trò chơi ({filteredGames.length})
            </h2>
            <p className="text-xs theme-muted mt-0.5">
              Chọn một trò chơi để bắt đầu ngay lập tức
            </p>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'popular' | 'name' | 'highscore')}
              className="theme-input rounded-xl px-3 py-1.5 text-xs theme-text focus:outline-none focus:border-indigo-500"
            >
              <option value="popular">Sắp xếp: Phổ biến</option>
              <option value="name">Sắp xếp: Tên A-Z</option>
              <option value="highscore">Sắp xếp: Điểm cao nhất</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <CategoryTabs
          activeCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          categoryCounts={categoryCounts}
        />

        {/* Game Cards Grid */}
        {filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredGames.map(game => (
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
          <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800/80 p-8">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-bold text-white">Không tìm thấy trò chơi phù hợp</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để hiển thị toàn bộ danh sách.
            </p>
            <button
              onClick={() => {
                onSearchChange('');
                setSelectedCategory('all');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-400"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

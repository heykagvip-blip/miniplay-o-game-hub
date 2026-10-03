import React from 'react';
import { GAMES } from '../data/games';
import { GameLogo } from '../components/GameLogo';
import { getStatistics, getHighScores } from '../utils/storage';
import { Trophy, Medal, Flame, Play, Award, Sparkles } from 'lucide-react';
import { playMoveSound } from '../utils/sound';

interface AchievementsPageProps {
  onSelectGame: (gameId: string) => void;
}

export const AchievementsPage: React.FC<AchievementsPageProps> = ({ onSelectGame }) => {
  const stats = getStatistics();
  const highScores = getHighScores();

  // Aggregate stats
  let totalPlays = 0;
  let playedGamesCount = 0;
  let mostPlayedId = '';
  let maxPlays = 0;

  GAMES.forEach(game => {
    const s = stats[game.id];
    if (s && s.plays > 0) {
      totalPlays += s.plays;
      playedGamesCount++;
      if (s.plays > maxPlays) {
        maxPlays = s.plays;
        mostPlayedId = game.id;
      }
    }
  });

  const mostPlayedGame = GAMES.find(g => g.id === mostPlayedId);

  // Sorted leaderboard by high score
  const leaderboard = [...GAMES]
    .map(g => ({
      game: g,
      highScore: highScores[g.id] || 0,
      plays: stats[g.id]?.plays || 0,
    }))
    .sort((a, b) => b.highScore - a.highScore);

  // Milestone Badges
  const badges = [
    {
      id: 'first-step',
      name: 'Khởi đầu mới',
      desc: 'Chơi ít nhất 1 trò chơi bất kỳ',
      icon: '🌱',
      unlocked: totalPlays >= 1,
    },
    {
      id: 'enthusiast',
      name: 'Chiến thần giải trí',
      desc: 'Hoàn thành 10 lượt chơi',
      icon: '⚡',
      unlocked: totalPlays >= 10,
    },
    {
      id: 'veteran',
      name: 'Game thủ gạo cội',
      desc: 'Hoàn thành 30 lượt chơi',
      icon: '🔥',
      unlocked: totalPlays >= 30,
    },
    {
      id: 'explorer',
      name: 'Nhà thám hiểm',
      desc: 'Trải nghiệm ít nhất 5 trò chơi khác nhau',
      icon: '🧭',
      unlocked: playedGamesCount >= 5,
    },
    {
      id: 'master',
      name: 'Bậc thầy MiniPlay',
      desc: `Chơi qua ít nhất 10 trò chơi trên hệ thống (${GAMES.length} games)`,
      icon: '👑',
      unlocked: playedGamesCount >= 10,
    },
    {
      id: 'record-breaker',
      name: 'Thợ săn kỷ lục',
      desc: 'Đạt điểm kỷ lục trên 1,000 ở bất kỳ game nào',
      icon: '🏆',
      unlocked: Object.values(highScores).some(score => score >= 1000),
    },
  ];

  return (
    <div className="space-y-8 text-left pb-16">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Trophy className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black theme-text">Bảng thành tích & Kỷ lục</h1>
          <p className="text-xs theme-muted">
            Tổng hợp dữ liệu chơi offline và vinh danh các mốc điểm cao nhất
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Play className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs theme-muted font-medium">Tổng lượt chơi</span>
            <div className="text-2xl font-black theme-text">{totalPlays.toLocaleString('vi-VN')}</div>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs theme-muted font-medium">Số game đã trải nghiệm</span>
            <div className="text-2xl font-black theme-text">{playedGamesCount}/{GAMES.length}</div>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex items-center gap-4">
          {mostPlayedGame ? (
            <GameLogo game={mostPlayedGame} size="stat" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-black">MP</div>
          )}
          <div>
            <span className="text-xs theme-muted font-medium">Chơi nhiều nhất</span>
            <div className="text-base font-black theme-text truncate max-w-[150px]">
              {mostPlayedGame ? mostPlayedGame.name : 'Chưa có'}
            </div>
            {mostPlayedGame && (
              <span className="text-[10px] text-amber-400 font-semibold">{maxPlays} ván</span>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Badges */}
      <div>
        <h2 className="text-lg font-bold theme-text mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>Huy hiệu thành tựu</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {badges.map(b => (
            <div
              key={b.id}
              className={`p-3.5 rounded-2xl border text-center transition-all ${
                b.unlocked
                  ? 'theme-panel border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                  : 'theme-panel-soft opacity-40 grayscale'
              }`}
            >
              <div className="text-3xl mb-1.5">{b.icon}</div>
              <h3 className="text-xs font-bold theme-text truncate">{b.name}</h3>
              <p className="text-[10px] theme-muted mt-1 line-clamp-2">{b.desc}</p>
              <span
                className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  b.unlocked
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {b.unlocked ? 'ĐÃ ĐẠT' : 'CHƯA ĐẠT'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* High Scores Leaderboard */}
      <div>
        <h2 className="text-lg font-bold theme-text mb-4 flex items-center gap-2">
          <Medal className="w-4 h-4 text-amber-400" />
          <span>Bảng điểm cao nhất theo trò chơi</span>
        </h2>

        <div className="theme-panel rounded-3xl overflow-hidden shadow-xl">
          <div className="divide-y theme-border">
            {leaderboard.map((item, index) => {
              const medalColor =
                index === 0
                  ? 'text-yellow-400'
                  : index === 1
                  ? 'text-slate-300'
                  : index === 2
                  ? 'text-amber-600'
                  : 'text-slate-500';

              return (
                <div
                  key={item.game.id}
                  onClick={() => {
                    playMoveSound();
                    onSelectGame(item.game.id);
                  }}
                  className="flex items-center justify-between p-4 hover:bg-[var(--card-hover)] transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-6 text-center font-black text-sm ${medalColor}`}>
                      {index + 1}
                    </span>
                    <GameLogo game={item.game} size="list" />
                    <div>
                      <div className="text-sm font-bold theme-text hover:text-indigo-400 transition-colors">
                        {item.game.name}
                      </div>
                      <span className="text-xs theme-muted">{item.game.vietnameseName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] theme-muted block">Kỷ lục</span>
                      <span className="text-base font-black text-amber-400">
                        {item.highScore.toLocaleString('vi-VN')}
                      </span>
                    </div>
                    <button className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-white text-xs font-semibold transition">
                      Chơi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

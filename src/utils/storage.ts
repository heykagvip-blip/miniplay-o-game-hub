import { AppSettings, GameStatistics, HighScores } from '../types';

const KEYS = {
  HIGH_SCORES: 'miniplay_highscores',
  FAVORITES: 'miniplay_favorites',
  RECENT_GAMES: 'miniplay_recent_games',
  SETTINGS: 'miniplay_settings',
  STATISTICS: 'miniplay_statistics',
};

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  sound: true,
  music: true,
  soundVolume: 80,
  musicVolume: 85,
  vibration: true,
  musicStyle: 'auto',
};

// High Scores
export function getHighScores(): HighScores {
  try {
    const raw = localStorage.getItem(KEYS.HIGH_SCORES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getHighScore(gameId: string): number {
  const scores = getHighScores();
  return scores[gameId] || 0;
}

export function saveHighScore(gameId: string, score: number): { isNewRecord: boolean; highScore: number } {
  const scores = getHighScores();
  const current = scores[gameId] || 0;
  if (score > current) {
    scores[gameId] = score;
    try {
      localStorage.setItem(KEYS.HIGH_SCORES, JSON.stringify(scores));
    } catch {}
    return { isNewRecord: true, highScore: score };
  }
  return { isNewRecord: false, highScore: current };
}

// Favorites
export function getFavorites(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.FAVORITES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isFavorite(gameId: string): boolean {
  const favs = getFavorites();
  return favs.includes(gameId);
}

export function toggleFavorite(gameId: string): boolean {
  const favs = getFavorites();
  const index = favs.indexOf(gameId);
  let updated: string[];
  let isNowFav = false;
  if (index > -1) {
    updated = favs.filter(id => id !== gameId);
  } else {
    updated = [...favs, gameId];
    isNowFav = true;
  }
  try {
    localStorage.setItem(KEYS.FAVORITES, JSON.stringify(updated));
  } catch {}
  return isNowFav;
}

// Recent Games
export function getRecentGames(): string[] {
  try {
    const raw = localStorage.getItem(KEYS.RECENT_GAMES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function recordRecentGame(gameId: string): void {
  const recents = getRecentGames().filter(id => id !== gameId);
  const updated = [gameId, ...recents].slice(0, 10);
  try {
    localStorage.setItem(KEYS.RECENT_GAMES, JSON.stringify(updated));
  } catch {}
}

// Settings
export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const clampVolume = (value: unknown, fallback: number) => {
      const volume = Number(value);
      return Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : fallback;
    };
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      soundVolume: clampVolume(parsed.soundVolume, DEFAULT_SETTINGS.soundVolume),
      musicVolume: clampVolume(parsed.musicVolume, DEFAULT_SETTINGS.musicVolume),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  try {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(updated));
  } catch {}
  return updated;
}

// Statistics
export function getStatistics(): GameStatistics {
  try {
    const raw = localStorage.getItem(KEYS.STATISTICS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordGameSession(gameId: string, result?: 'win' | 'loss' | 'draw'): void {
  const stats = getStatistics();
  const current = stats[gameId] || { plays: 0 };
  const updated = {
    ...current,
    plays: (current.plays || 0) + 1,
    lastPlayed: Date.now(),
  };

  if (result === 'win') updated.wins = (updated.wins || 0) + 1;
  if (result === 'loss') updated.losses = (updated.losses || 0) + 1;
  if (result === 'draw') updated.draws = (updated.draws || 0) + 1;

  stats[gameId] = updated;
  try {
    localStorage.setItem(KEYS.STATISTICS, JSON.stringify(stats));
  } catch {}
}

// Reset data
export function clearRecentHistory(): void {
  try {
    localStorage.removeItem(KEYS.RECENT_GAMES);
  } catch {}
}

export function resetAllData(): void {
  try {
    localStorage.removeItem(KEYS.HIGH_SCORES);
    localStorage.removeItem(KEYS.FAVORITES);
    localStorage.removeItem(KEYS.RECENT_GAMES);
    localStorage.removeItem(KEYS.STATISTICS);
  } catch {}
}

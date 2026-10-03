import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MiniPlayLogo } from './components/MiniPlayLogo';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Home } from './pages/Home';
import { GamesPage } from './pages/GamesPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { AchievementsPage } from './pages/AchievementsPage';
import { SettingsPage } from './pages/SettingsPage';
import { GamePage } from './pages/GamePage';
import { 
  getFavorites, 
  toggleFavorite as toggleFavStorage, 
  getHighScores, 
  getRecentGames, 
  getSettings, 
  saveSettings 
} from './utils/storage';
import { AppSettings } from './types';
import { playMoveSound, setAudioVolumes, startBackgroundMusic, stopBackgroundMusic } from './utils/sound';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [recentGameIds, setRecentGameIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [rocketPaths] = useState(() => {
    const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum);

    return {
      ascending: {
        top: `${randomBetween(72, 86)}vh`,
        duration: `${randomBetween(18, 26)}s`,
        delay: `-${randomBetween(0, 20)}s`,
        midX: `${randomBetween(42, 66)}vw`,
        midY: `-${randomBetween(32, 54)}vh`,
        endX: `${randomBetween(98, 118)}vw`,
        endY: `-${randomBetween(72, 92)}vh`,
        startAngle: `${randomBetween(32, 42)}deg`,
        midAngle: `${randomBetween(38, 50)}deg`,
        endAngle: `${randomBetween(46, 58)}deg`,
      },
      descending: {
        top: `${randomBetween(2, 16)}vh`,
        duration: `${randomBetween(20, 28)}s`,
        delay: `-${randomBetween(0, 24)}s`,
        midX: `-${randomBetween(42, 66)}vw`,
        midY: `${randomBetween(32, 54)}vh`,
        endX: `-${randomBetween(98, 118)}vw`,
        endY: `${randomBetween(72, 92)}vh`,
        startAngle: `${randomBetween(212, 228)}deg`,
        midAngle: `${randomBetween(218, 232)}deg`,
        endAngle: `${randomBetween(224, 240)}deg`,
      },
    };
  });
  const isLightTheme = settings.theme === 'light';

  const getRocketStyle = (path: typeof rocketPaths.ascending): React.CSSProperties => ({
    top: path.top,
    animationDuration: path.duration,
    animationDelay: path.delay,
    '--rocket-mid-x': path.midX,
    '--rocket-mid-y': path.midY,
    '--rocket-end-x': path.endX,
    '--rocket-end-y': path.endY,
    '--rocket-start-angle': path.startAngle,
    '--rocket-mid-angle': path.midAngle,
    '--rocket-end-angle': path.endAngle,
  } as React.CSSProperties);

  // Sync data from localStorage
  const refreshStorageData = useCallback(() => {
    setFavorites(getFavorites());
    setHighScores(getHighScores());
    setRecentGameIds(getRecentGames());
    setSettings(getSettings());
  }, []);

  useEffect(() => {
    refreshStorageData();

    // Register Service Worker for offline support
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, [refreshStorageData]);

  // Sync theme with <html> class
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [settings.theme]);

  useEffect(() => {
    if (settings.sound && settings.music) {
      const activeStyle = settings.musicStyle === 'auto' || !settings.musicStyle ? settings.theme : settings.musicStyle;
      startBackgroundMusic(activeStyle);
    } else {
      stopBackgroundMusic();
    }

    return () => stopBackgroundMusic();
  }, [settings.sound, settings.music, settings.theme, settings.musicStyle]);

  // Hash-based routing sync for back/forward browser support and shareable URL
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || '/';
      if (hash.startsWith('/game/')) {
        const gameId = hash.replace('/game/', '');
        setActiveGameId(gameId);
      } else if (hash === '/games') {
        setActiveGameId(null);
        setCurrentTab('games');
      } else if (hash === '/favorites') {
        setActiveGameId(null);
        setCurrentTab('favorites');
      } else if (hash === '/achievements') {
        setActiveGameId(null);
        setCurrentTab('achievements');
      } else if (hash === '/settings') {
        setActiveGameId(null);
        setCurrentTab('settings');
      } else {
        setActiveGameId(null);
        setCurrentTab('home');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (tab: string) => {
    playMoveSound();
    setActiveGameId(null);
    setCurrentTab(tab);
    if (tab === 'home') {
      window.location.hash = '#/';
    } else {
      window.location.hash = `#/${tab}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGame = (gameId: string) => {
    setActiveGameId(gameId);
    window.location.hash = `#/game/${gameId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHub = () => {
    refreshStorageData();
    setActiveGameId(null);
    window.location.hash = '#/';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleFavorite = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavStorage(gameId);
    setFavorites(getFavorites());
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = saveSettings(newSettings);
    setSettings(updated);
    if (newSettings.musicVolume !== undefined || newSettings.soundVolume !== undefined) {
      setAudioVolumes(updated.musicVolume, updated.soundVolume);
    }
  };

  const handleToggleTheme = () => {
    playMoveSound();
    handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const backgroundDecor = isLightTheme ? (
    <>
      <span className="cloud cloud-1" />
      <span className="cloud cloud-2" />
      <span className="cloud cloud-3" />
      <span className="plane plane-1">
        <svg className="plane-illustration" viewBox="0 0 112 64" aria-hidden="true">
          <defs>
            <linearGradient id="planeBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff5a8" />
              <stop offset="0.48" stopColor="#f3c83f" />
              <stop offset="1" stopColor="#d79f20" />
            </linearGradient>
            <linearGradient id="planeWing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c9d4dc" />
              <stop offset="1" stopColor="#64798b" />
            </linearGradient>
            <linearGradient id="planeEngine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d7e0e6" />
              <stop offset="1" stopColor="#536779" />
            </linearGradient>
          </defs>
          <path d="M50 28 38 14q-4-4-8-2l11 17Z" fill="url(#planeWing)" stroke="#f5fcff" strokeWidth="1" strokeLinejoin="round" opacity="0.8" />
          <path d="M14 29 9 7q9 0 24 20l9 2Z" fill="url(#planeBody)" stroke="#fff8d0" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M14 31 3 25l5-1 22 5v5L8 39l-5-1Z" fill="url(#planeWing)" stroke="#f5fcff" strokeWidth="1" strokeLinejoin="round" />
          <path d="M8 28q9-2 19-2h67q13 0 18 6-5 6-18 6H27q-10 0-19-2-4-1-4-4t4-4Z" fill="url(#planeBody)" stroke="#fff8d0" strokeWidth="1.2" />
          <path d="M43 34q13-2 28 1L49 55q-7 4-15 1l13-16q-3-3-4-6Z" fill="url(#planeWing)" stroke="#f5fcff" strokeWidth="1.2" strokeLinejoin="round" />
          <ellipse cx="54" cy="43" rx="7" ry="3.8" fill="url(#planeEngine)" stroke="#f1f6f9" strokeWidth="1" />
          <ellipse cx="68" cy="41" rx="6.5" ry="3.5" fill="url(#planeEngine)" stroke="#f1f6f9" strokeWidth="0.8" />
          <ellipse cx="59" cy="43" rx="1.8" ry="2.3" fill="#354b5d" />
          <ellipse cx="73" cy="41" rx="1.6" ry="2" fill="#354b5d" />
          <path d="M91 29h6q6 1 9 3-3 2-9 3h-6Z" fill="#42566a" />
          <path d="M36 29.5h48" stroke="#fff9d7" strokeWidth="0.8" opacity="0.7" />
          <g fill="#45647d" stroke="#fff9db" strokeWidth="0.45">
            <circle cx="37" cy="32" r="1.1" /><circle cx="43" cy="32" r="1.1" />
            <circle cx="49" cy="32" r="1.1" /><circle cx="55" cy="32" r="1.1" />
            <circle cx="61" cy="32" r="1.1" /><circle cx="67" cy="32" r="1.1" />
            <circle cx="73" cy="32" r="1.1" /><circle cx="79" cy="32" r="1.1" />
            <circle cx="85" cy="32" r="1.1" />
          </g>
          <path d="M25 27v10m2-10v10" stroke="#b77721" strokeWidth="0.7" opacity="0.75" />
          <path d="M21 12h6l2 2h-8Z" fill="#d64148" />
        </svg>
      </span>
      <span className="bird bird-1" />
      <span className="bird bird-2" />
    </>
  ) : (
    <>
      <span className="moon" />
      <span className="rocket rocket-1" style={getRocketStyle(rocketPaths.ascending)}>
        <span className="rocket-flame"><span /></span>
        <span className="rocket-fin rocket-fin-left" />
        <span className="rocket-fin rocket-fin-right" />
        <span className="rocket-body"><span className="rocket-window" /></span>
      </span>
      <span className="rocket rocket-2" style={getRocketStyle(rocketPaths.descending)}>
        <span className="rocket-flame"><span /></span>
        <span className="rocket-fin rocket-fin-left" />
        <span className="rocket-fin rocket-fin-right" />
        <span className="rocket-body"><span className="rocket-window" /></span>
      </span>
    </>
  );

  const nightStarfield = !isLightTheme ? (
    <div className="starfield" aria-hidden="true">
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} className={`star star-${index + 1}`} />
      ))}
    </div>
  ) : null;

  // If inside an active game, render GamePage directly
  if (activeGameId) {
    return (
      <div
        className="min-h-screen font-sans antialiased relative overflow-hidden"
        style={{
          background: isLightTheme
            ? 'linear-gradient(180deg, #c4eaff 0%, #ddf2ff 38%, #ffffff 100%)'
            : 'linear-gradient(180deg, #0f0b13 0%, #17121d 100%)',
          color: isLightTheme ? '#12314d' : '#f1e8ff',
        }}
      >
        <div className="ambient-scene" aria-hidden="true">{backgroundDecor}</div>
        {nightStarfield}
        <GamePage gameId={activeGameId} onBackToHub={handleBackToHub} />
        <OfflineIndicator />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans antialiased relative overflow-hidden"
      style={{
        background: isLightTheme
          ? 'linear-gradient(180deg, #c4eaff 0%, #ddf2ff 38%, #ffffff 100%)'
          : 'linear-gradient(180deg, #0f0b13 0%, #17121d 100%)',
        color: isLightTheme ? '#12314d' : '#f1e8ff',
      }}
    >
      <div className="ambient-scene" aria-hidden="true">{backgroundDecor}</div>
      {nightStarfield}

      {/* Header */}
      <Header
        currentTab={currentTab}
        onNavigate={navigateTo}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          const hasQuery = q.trim().length > 0;
          const startingSearch = hasQuery && searchQuery.trim().length === 0;
          setSearchQuery(q);
          if (hasQuery && currentTab !== 'home' && currentTab !== 'games') {
            // Searching from any other tab opens the dedicated game catalog
            setCurrentTab('games');
          } else if (startingSearch && currentTab === 'home') {
            // On the home page the filtered grid lives further down,
            // so bring it into view the moment a search starts.
            window.requestAnimationFrame(() => {
              document.getElementById('all-games-section')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
            });
          }
        }}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 relative z-10">
        {currentTab === 'home' && (
          <Home
            onSelectGame={handleSelectGame}
            recentGameIds={recentGameIds}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            highScores={highScores}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentTab === 'games' && (
          <GamesPage
            onSelectGame={handleSelectGame}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            highScores={highScores}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}

        {currentTab === 'favorites' && (
          <FavoritesPage
            favorites={favorites}
            onSelectGame={handleSelectGame}
            onToggleFavorite={handleToggleFavorite}
            highScores={highScores}
            onExploreGames={() => navigateTo('games')}
          />
        )}

        {currentTab === 'achievements' && (
          <AchievementsPage onSelectGame={handleSelectGame} />
        )}

        {currentTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onDataReset={refreshStorageData}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t theme-border py-8 text-center text-xs theme-muted relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MiniPlayLogo
              size="sm"
              isLight={settings.theme === 'light'}
              onClick={() => navigateTo('home')}
            />
          </div>

          <div className="flex items-center gap-4 theme-muted">
            <button onClick={() => navigateTo('home')} className="theme-text transition">
              Trang chủ
            </button>
            <button onClick={() => navigateTo('games')} className="theme-text transition">
              Trò chơi
            </button>
            <button onClick={() => navigateTo('favorites')} className="theme-text transition">
              Yêu thích
            </button>
            <button onClick={() => navigateTo('achievements')} className="theme-text transition">
              Thành tích
            </button>
            <button onClick={() => navigateTo('settings')} className="theme-text transition">
              Cài đặt
            </button>
          </div>
        </div>
      </footer>

      {/* Offline Status Badge */}
      <OfflineIndicator />
    </div>
  );
}

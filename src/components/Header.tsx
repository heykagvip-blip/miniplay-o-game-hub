import React, { useState } from 'react';
import { 
  Gamepad2, 
  Home, 
  Sparkles, 
  Star, 
  Trophy, 
  Settings, 
  Search, 
  Moon, 
  Sun, 
  Menu, 
  X 
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { MiniPlayLogo } from './MiniPlayLogo';

interface HeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onNavigate,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchMobile, setShowSearchMobile] = useState(false);
  const isLightTheme = theme === 'light';

  const navItems = [
    { id: 'home', label: 'Trang chủ', icon: Home },
    { id: 'games', label: 'Trò chơi', icon: Gamepad2 },
    { id: 'favorites', label: 'Yêu thích', icon: Star },
    { id: 'achievements', label: 'Thành tích', icon: Trophy },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md border-b transition-colors"
      style={{
        background: isLightTheme ? 'rgba(255,255,255,0.7)' : 'rgba(27, 19, 35, 0.8)',
        borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
        boxShadow: isLightTheme
          ? '0 8px 24px -18px rgba(90, 170, 232, 0.35)'
          : '0 8px 24px -18px rgba(167, 128, 201, 0.35)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button
          onClick={() => {
            onNavigate('home');
            setMobileMenuOpen(false);
          }}
          className="focus:outline-none"
        >
          <MiniPlayLogo size="md" isLight={isLightTheme} />
        </button>

        {/* Desktop Navigation */}
        <nav
          className="hidden md:flex items-center gap-1 p-1 rounded-xl border shadow-inner"
          style={{
            background: isLightTheme ? 'rgba(255,255,255,0.55)' : 'rgba(42, 29, 52, 0.8)',
            borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
            boxShadow: isLightTheme ? 'inset 0 1px 0 rgba(255,255,255,0.8)' : 'inset 0 1px 0 rgba(0,0,0,0.2)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                style={{
                  background: isActive
                    ? isLightTheme
                      ? 'linear-gradient(135deg, #82c5ff 0%, #6aa9f0 100%)'
                      : 'linear-gradient(135deg, #7c5ad1 0%, #b492ff 100%)'
                    : 'transparent',
                  color: isActive ? '#ffffff' : isLightTheme ? '#1f4f76' : '#e9d9ff',
                  boxShadow: isActive ? '0 8px 18px -12px rgba(90, 170, 232, 0.65)' : 'none',
                }}
              >
                <Icon className="w-4 h-4" style={{ color: isActive ? '#ffffff' : isLightTheme ? '#4e9ad9' : '#d7c2ff' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Tools: Search, Theme Toggle, PWA Install, Mobile Hamburger */}
        <div className="flex items-center gap-2">
          {/* Desktop Search Input */}
          <div className="relative hidden lg:block w-48 xl:w-60">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: isLightTheme ? '#5083a8' : '#c8b9db' }}
            />
            <input
              type="text"
              placeholder="Tìm kiếm trò chơi..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs transition-all border"
              style={{
                background: isLightTheme ? 'rgba(255,255,255,0.8)' : 'rgba(42, 29, 52, 0.8)',
                borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
                color: isLightTheme ? '#1d3550' : '#f1e8ff',
                boxShadow: isLightTheme ? '0 0 0 1px rgba(90, 170, 232, 0.08)' : '0 0 0 1px rgba(167, 128, 201, 0.08)',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-violet-200 hover:text-violet-50 text-xs"
              >
                ×
              </button>
            )}
          </div>

          {/* Mobile search toggle button */}
          <button
            onClick={() => setShowSearchMobile(!showSearchMobile)}
            className="lg:hidden p-2 rounded-xl border"
            title="Tìm kiếm"
            style={{
              background: isLightTheme ? 'rgba(255,255,255,0.8)' : 'rgba(42, 29, 52, 0.8)',
              borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
              color: isLightTheme ? '#2d6a9a' : '#e7d9ff',
            }}
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl border transition-colors"
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            style={{
              background: isLightTheme ? 'rgba(255,255,255,0.8)' : 'rgba(42, 29, 52, 0.8)',
              borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
              color: isLightTheme ? '#2d6a9a' : '#e7d9ff',
            }}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-600" />
            )}
          </button>

          {/* PWA Install */}
          <div className="hidden sm:block">
            <PWAInstallButton />
          </div>

          {/* Mobile menu hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border"
            aria-label="Menu"
            style={{
              background: isLightTheme ? 'rgba(255,255,255,0.8)' : 'rgba(42, 29, 52, 0.8)',
              borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
              color: isLightTheme ? '#2d6a9a' : '#e7d9ff',
            }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Search input expander */}
      {showSearchMobile && (
        <div
          className="lg:hidden px-4 pb-3 pt-1 border-t"
          style={{
            borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
            background: isLightTheme ? 'rgba(255,255,255,0.7)' : 'rgba(27, 19, 35, 0.95)',
          }}
        >
          <div className="relative">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: isLightTheme ? '#5083a8' : '#c8b9db' }}
            />
            <input
              type="text"
              autoFocus
              placeholder="Nhập tên trò chơi (Snake, 2048, Tetris...)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl text-sm border"
              style={{
                background: isLightTheme ? 'rgba(255,255,255,0.8)' : 'rgba(42, 29, 52, 0.8)',
                borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
                color: isLightTheme ? '#1d3550' : '#f1e8ff',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 font-bold"
                style={{ color: isLightTheme ? '#2d6a9a' : '#e7d9ff' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-t px-4 py-3 space-y-1 shadow-2xl animate-in slide-in-from-top-2"
          style={{
            borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)',
            background: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(27, 19, 35, 0.95)',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: isActive
                    ? isLightTheme
                      ? 'linear-gradient(135deg, #82c5ff 0%, #6aa9f0 100%)'
                      : 'linear-gradient(135deg, #7c5ad1 0%, #b492ff 100%)'
                    : 'transparent',
                  color: isActive ? '#ffffff' : isLightTheme ? '#1f4f76' : '#e9d9ff'
                }}
              >
                <Icon className="w-5 h-5" style={{ color: isActive ? '#ffffff' : isLightTheme ? '#4e9ad9' : '#d7c2ff' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="pt-2 sm:hidden border-t" style={{ borderColor: isLightTheme ? 'rgba(185, 217, 238, 0.9)' : 'rgba(167, 128, 201, 0.2)' }}>
            <PWAInstallButton />
          </div>
        </div>
      )}
    </header>
  );
};

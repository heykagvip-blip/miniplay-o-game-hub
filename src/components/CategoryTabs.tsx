import React from 'react';
import { CATEGORIES } from '../data/games';
import { playMoveSound, triggerHaptic } from '../utils/sound';

interface CategoryTabsProps {
  activeCategory: string;
  onSelectCategory: (id: string) => void;
  categoryCounts: Record<string, number>;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({
  activeCategory,
  onSelectCategory,
  categoryCounts,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id;
        const count = categoryCounts[cat.id] ?? 0;
        return (
          <button
            key={cat.id}
            onClick={() => {
              playMoveSound();
              triggerHaptic(15);
              onSelectCategory(cat.id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-100'
                : 'theme-panel-soft theme-text border theme-border'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                isActive ? 'bg-white/20 text-white' : 'theme-panel-strong theme-muted'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export type GameCategory = 'all' | 'arcade' | 'puzzle' | 'board' | 'casual' | 'strategy';

export type Difficulty = 'Dễ' | 'Trung bình' | 'Khó';

export interface GameMetadata {
  id: string;
  name: string;
  vietnameseName: string;
  description: string;
  category: GameCategory;
  difficulty: Difficulty;
  icon: string;
  color: string;
  controls: string[];
  instructions: string[];
  isFeatured?: boolean;
  tags: string[];
}

export interface AppSettings {
  theme: 'dark' | 'light';
  sound: boolean;
  music: boolean;
  soundVolume: number;
  musicVolume: number;
  vibration: boolean;
  musicStyle?: 'auto' | 'upbeat' | 'calm';
}

export interface GameStats {
  plays: number;
  wins?: number;
  losses?: number;
  draws?: number;
  lastPlayed?: number;
}

export type HighScores = Record<string, number>;
export type GameStatistics = Record<string, GameStats>;

import React, { useState, useEffect, useCallback } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { Clock, MousePointerClick, Star } from 'lucide-react';

interface CardItem {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

const EMOJI_POOL = ['🦁', '🚀', '💎', '🍕', '🎸', '🏀', '🎨', '🌈', '👑', '🦄', '⚡', '🍀'];

interface MemoryCardProps {
  onBackToHub: () => void;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('memory')!;

  const [cards, setCards] = useState<CardItem[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const initGame = useCallback(() => {
    // 8 pairs = 16 cards
    const selectedEmojis = EMOJI_POOL.slice(0, 8);
    const deck: CardItem[] = [];

    selectedEmojis.forEach((emoji, index) => {
      deck.push({ id: index * 2, emoji, isFlipped: false, isMatched: false });
      deck.push({ id: index * 2 + 1, emoji, isFlipped: false, isMatched: false });
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
    setMatches(0);
    setTimer(0);
    setIsTimerActive(false);
    setIsGameOver(false);
    setScore(0);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerActive && !isGameOver && !isPaused) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerActive, isGameOver, isPaused]);

  const handleCardClick = (index: number) => {
    if (isPaused || isGameOver) return;
    if (flippedIndices.length >= 2) return;
    if (cards[index].isFlipped || cards[index].isMatched) return;

    if (!isTimerActive) setIsTimerActive(true);

    playMoveSound();
    triggerHaptic(15);

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(m => m + 1);
      const [firstIdx, secondIdx] = newFlipped;
      const firstCard = newCards[firstIdx];
      const secondCard = newCards[secondIdx];

      if (firstCard.emoji === secondCard.emoji) {
        // Match!
        setTimeout(() => {
          playClearSound();
          triggerHaptic(30);
          setCards(prev => {
            const updated = [...prev];
            updated[firstIdx].isMatched = true;
            updated[secondIdx].isMatched = true;
            return updated;
          });
          setFlippedIndices([]);

          setMatches(m => {
            const nextMatch = m + 1;
            if (nextMatch === 8) {
              // Game Won!
              setIsGameOver(true);
              setIsTimerActive(false);
              const finalScore = Math.max(100, 2000 - (moves + 1) * 35 - timer * 5);
              setScore(finalScore);
            }
            return nextMatch;
          });
        }, 350);
      } else {
        // No match, flip back
        setTimeout(() => {
          setCards(prev => {
            const updated = [...prev];
            updated[firstIdx].isFlipped = false;
            updated[secondIdx].isFlipped = false;
            return updated;
          });
          setFlippedIndices([]);
        }, 900);
      }
    }
  };

  // Star rating calculation
  const getStars = () => {
    if (moves <= 12) return 3;
    if (moves <= 18) return 2;
    return 1;
  };

  return (
    <GameShell
      game={gameMeta}
      score={score}
      isGameOver={isGameOver}
      isPaused={isPaused}
      onPauseToggle={() => setIsPaused(p => !p)}
      onRestart={initGame}
      onBackToHub={onBackToHub}
      isVictory={matches === 8}
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <MousePointerClick className="w-3.5 h-3.5 text-indigo-400" />
 <span className="font-bold text-white">{moves}</span>
          </div>
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <Clock className="w-3.5 h-3.5 text-amber-400" />
 <span className="font-bold text-white">{timer}s</span>
          </div>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
        {/* Progress Bar */}
 <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-4 flex items-center justify-between">
 <div className="text-xs text-slate-400 font-medium">
 Đã tìm thấy: <strong className="text-indigo-400">{matches}/8 cặp</strong>
          </div>
 <div className="flex items-center gap-1">
            {[1, 2, 3].map(s => (
              <Star
                key={s}
 className={`w-4 h-4 ${
                  s <= getStars() ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 4x4 Card Grid */}
 <div className="grid grid-cols-4 gap-2.5 sm:gap-3 w-full p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-3xl ">
          {cards.map((card, index) => {
            const isRevealed = card.isFlipped || card.isMatched;
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(index)}
                aria-label={`Lá bài ${card.id + 1}`}
 className="aspect-square rounded-2xl flex items-center justify-center text-3xl sm:text-4xl select-none cursor-pointer game-btn-press [perspective:900px]"
              >
                {/* Inner layer flips on Y so the card reads as a real flip. */}
                <span
 className="relative grid place-items-center w-full h-full rounded-2xl transition-transform duration-500"
                  style={{
                    transform: isRevealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Back (shown when face down) */}
                  <span
 className="absolute inset-0 grid place-items-center rounded-2xl border border-indigo-400/40 text-xl font-black text-indigo-200/80 transition-opacity duration-300"
                    style={{
                      backfaceVisibility: 'hidden',
                      background: '#6d28d9',
                      
                      opacity: isRevealed ? 0 : 1,
                    }}
                  >
                    ?
                  </span>

                  {/* Face */}
                  <span
 className={`absolute inset-0 grid place-items-center rounded-2xl border-2 transition-all duration-300 ${
                      card.isMatched
                        ? 'scale-95 border-emerald-400 text-emerald-200'
                        : 'border-indigo-400/70 text-white'
                    }`}
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      background: card.isMatched
                        ? '#047857'
                        : '#0f172a',
                    }}
                  >
                    {card.emoji}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
};

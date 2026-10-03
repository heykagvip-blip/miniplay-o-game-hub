import React, { useEffect, useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playMoveSound } from '../utils/sound';

type Color = 'red' | 'blue' | 'green' | 'yellow';
type CardValue = number | 'skip' | 'reverse' | '+2' | 'wild' | '+4';
type UnoCard = { id: number; color: Color | 'wild'; value: CardValue };
type Player = 0 | 1 | 2 | 3;
type Direction = 1 | -1;
type UnoState = { hands: [UnoCard[], UnoCard[], UnoCard[], UnoCard[]]; drawPile: UnoCard[]; discard: UnoCard[]; color: Color; turn: Player; direction: Direction; over: boolean; winner: Player | null; message: string };
const COLORS: Color[] = ['red', 'blue', 'green', 'yellow'];
const COLOR_NAMES: Record<Color, string> = { red: 'Đỏ', blue: 'Xanh dương', green: 'Xanh lá', yellow: 'Vàng' };
const CARD_STYLES: Record<Color, string> = { red: 'bg-rose-600', blue: 'bg-sky-600', green: 'bg-emerald-600', yellow: 'bg-amber-400 text-slate-950' };
const PLAYER_NAMES = ['Bạn', 'Máy 1', 'Máy 2', 'Máy 3'];
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const nextPlayer = (player: number, direction: Direction, steps = 1): Player => ((player + direction * steps + 8) % 4) as Player;

const makeDeck = (): UnoCard[] => {
  let id = 0;
  const cards: UnoCard[] = [];
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: 0 });
    for (let number = 1; number <= 9; number++) for (let copy = 0; copy < 2; copy++) cards.push({ id: id++, color, value: number });
    for (const value of ['skip', 'reverse', '+2'] as const) for (let copy = 0; copy < 2; copy++) cards.push({ id: id++, color, value });
  }
  for (let copy = 0; copy < 4; copy++) {
    cards.push({ id: id++, color: 'wild', value: 'wild' }, { id: id++, color: 'wild', value: '+4' });
  }
  return shuffle(cards);
};

const freshGame = (): UnoState => {
  const deck = makeDeck();
  const hands: UnoState['hands'] = [deck.splice(0, 7), deck.splice(0, 7), deck.splice(0, 7), deck.splice(0, 7)];
  const openingIndex = deck.findIndex(card => typeof card.value === 'number');
  const [opening] = deck.splice(openingIndex, 1);
  return { hands, drawPile: deck, discard: [opening], color: opening.color as Color, turn: 0, direction: 1, over: false, winner: null, message: 'Lượt của bạn. Đánh lá trùng màu hoặc số.' };
};

const canPlay = (card: UnoCard, game: UnoState, hand: UnoCard[]) => {
  if (card.value === '+4' && hand.some(other => other.id !== card.id && other.color === game.color)) return false;
  return card.color === 'wild' || card.color === game.color || card.value === game.discard[game.discard.length - 1].value;
};
const chooseAiColor = (hand: UnoCard[]) => COLORS.map(color => ({ color, count: hand.filter(card => card.color === color).length })).sort((a, b) => b.count - a.count)[0].color;

const playCard = (game: UnoState, player: Player, cardId: number, wildColor?: Color): UnoState => {
  const cardIndex = game.hands[player].findIndex(card => card.id === cardId);
  if (cardIndex < 0) return game;
  const card = game.hands[player][cardIndex];
  const hands = game.hands.map(hand => [...hand]) as UnoState['hands'];
  hands[player].splice(cardIndex, 1);
  const discard = [...game.discard, card];
  const color = card.color === 'wild' ? wildColor ?? (hands[player].length ? chooseAiColor(hands[player]) : game.color) : card.color;
  if (hands[player].length === 0) return { ...game, hands, discard, color, over: true, winner: player, message: `${PLAYER_NAMES[player]} đã hết bài!` };

  const direction: Direction = card.value === 'reverse' ? game.direction === 1 ? -1 : 1 : game.direction;
  const drawCount = card.value === '+2' ? 2 : card.value === '+4' ? 4 : 0;
  let drawPile = [...game.drawPile];
  if (drawPile.length < drawCount) {
    const recyclable = shuffle(discard.slice(0, -1));
    discard.splice(0, Math.max(0, discard.length - 1));
    drawPile = [...drawPile, ...recyclable];
  }
  const target = nextPlayer(player, direction);
  if (drawCount) {
    hands[target].push(...drawPile.splice(0, drawCount));
    return { ...game, hands, drawPile, discard, color, direction, turn: nextPlayer(player, direction, 2), message: `${PLAYER_NAMES[target]} rút ${drawCount} lá và mất lượt.` };
  }
  const turn = nextPlayer(player, direction, card.value === 'skip' ? 2 : 1);
  const message = hands[player].length === 1 ? `${PLAYER_NAMES[player]} còn 1 lá! UNO!` : turn === 0 ? 'Lượt của bạn.' : `Đến lượt ${PLAYER_NAMES[turn]}.`;
  return { ...game, hands, discard, color, direction, turn, message };
};

const drawCards = (game: UnoState, count: number): UnoState => {
  const drawPile = [...game.drawPile];
  const discard = [...game.discard];
  if (drawPile.length < count && discard.length > 1) {
    drawPile.push(...shuffle(discard.splice(0, discard.length - 1)));
  }
  const hands = game.hands.map(hand => [...hand]) as UnoState['hands'];
  hands[game.turn].push(...drawPile.splice(0, count));
  return { ...game, hands, drawPile, discard, message: `${PLAYER_NAMES[game.turn]} đã rút ${count} lá.` };
};

export const UnoGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('uno')!;
  const [game, setGame] = useState<UnoState>(freshGame);
  const [pendingWild, setPendingWild] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (game.turn === 0 || game.over) return;
    const timer = setTimeout(() => {
      setGame(current => {
        const player = current.turn;
        if (player === 0 || current.over) return current;
        const hand = current.hands[player];
        const legal = hand.filter(card => canPlay(card, current, hand));
        if (legal.length) {
          const colorCounts = COLORS.map(color => hand.filter(card => card.color === color).length);
          legal.sort((a, b) => {
            const aAction = a.value === '+4' || a.value === '+2' ? 4 : a.value === 'skip' || a.value === 'reverse' ? 2 : 0;
            const bAction = b.value === '+4' || b.value === '+2' ? 4 : b.value === 'skip' || b.value === 'reverse' ? 2 : 0;
            const aColor = a.color === 'wild' ? Math.max(...colorCounts) : colorCounts[COLORS.indexOf(a.color)];
            const bColor = b.color === 'wild' ? Math.max(...colorCounts) : colorCounts[COLORS.indexOf(b.color)];
            return (bAction + bColor * 0.3) - (aAction + aColor * 0.3);
          });
          const card = legal[0];
          playMoveSound();
          return playCard(current, player, card.id, card.color === 'wild' ? chooseAiColor(hand) : undefined);
        }
        const drawn = drawCards(current, 1);
        const nextHand = drawn.hands[player];
        const drawnCard = nextHand[nextHand.length - 1];
        if (drawnCard && canPlay(drawnCard, drawn, nextHand)) {
          return playCard(drawn, player, drawnCard.id, drawnCard.color === 'wild' ? chooseAiColor(nextHand) : undefined);
        }
        const turn = nextPlayer(player, drawn.direction);
        return { ...drawn, turn, message: `${PLAYER_NAMES[player]} rút bài và bỏ lượt. Đến lượt ${PLAYER_NAMES[turn]}.` };
      });
    }, 650);
    return () => clearTimeout(timer);
  }, [game]);

  const commitCard = (card: UnoCard, color?: Color) => {
    if (game.turn !== 0 || !canPlay(card, game, game.hands[0])) return;
    if (card.color === 'wild' && !color) { setPendingWild(card.id); return; }
    const next = playCard(game, 0, card.id, color);
    setGame(next);
    setPendingWild(null);
    if (next.winner === 0) {
      const remainingPoints = game.hands.slice(1).flat().reduce((sum, item) => sum + (typeof item.value === 'number' ? item.value : 20), 0);
      setScore(remainingPoints);
      playClearSound();
    } else playMoveSound();
  };

  const draw = () => {
    if (game.turn !== 0 || game.over || pendingWild !== null) return;
    const next = drawCards(game, 1);
    const drawnCard = next.hands[0][next.hands[0].length - 1];
    const canUse = drawnCard && canPlay(drawnCard, next, next.hands[0]);
    setGame(canUse ? next : { ...next, turn: nextPlayer(0, next.direction), message: 'Bạn rút một lá không thể đánh. Máy tiếp theo đến lượt.' });
    playMoveSound();
  };

  const restart = () => { setGame(freshGame()); setPendingWild(null); setScore(0); };
  const top = game.discard[game.discard.length - 1];
 const renderCard = (card: UnoCard) => <button key={card.id} disabled={game.turn !== 0 || game.over || pendingWild !== null || !canPlay(card, game, game.hands[0])} onClick={() => commitCard(card)} aria-label={`${card.color === 'wild' ? 'Đổi màu' : COLOR_NAMES[card.color]} ${card.value}`} className={`flex h-24 w-14 shrink-0 flex-col items-center justify-between rounded-lg border-2 border-white p-1.5 transition enabled:hover:-translate-y-2 enabled:active:scale-95 disabled:opacity-45 ${card.color === 'wild' ? 'bg-slate-900 text-white' : CARD_STYLES[card.color]}`}><span className="self-start text-[10px] font-black">{card.value}</span><span className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-xs font-black text-slate-950">{card.value === 'wild' ? 'W' : card.value === 'reverse' ? '↻' : card.value === 'skip' ? '⊘' : card.value}</span><span className="self-end text-[10px] font-black">{card.value}</span></button>;

  return (
 <GameShell game={gameMeta} score={score} isGameOver={game.over} isVictory={game.winner === 0} isPaused={false} onRestart={restart} onBackToHub={onBackToHub} gameCustomStats={<span className="text-xs text-slate-300">Bạn {game.hands[0].length} · 3 máy</span>}>
 <div className="flex w-full max-w-3xl flex-col items-center gap-3 sm:gap-4">
 <div className="relative aspect-square min-h-[360px] w-full max-w-[620px] overflow-hidden rounded-[42%] border-2 border-emerald-800 bg-emerald-950/60 sm:min-h-[500px]">
 <div className="pointer-events-none absolute inset-[58px] rounded-full border border-dashed border-emerald-700/50 sm:inset-[86px]" />
          {([1, 2, 3, 0] as Player[]).map(player => {
            const isSide = player === 1 || player === 3;
            const position = player === 1 ? 'right-2 top-1/2 -translate-y-1/2' : player === 2 ? 'left-1/2 top-2 -translate-x-1/2' : player === 3 ? 'left-2 top-1/2 -translate-y-1/2' : 'bottom-2 left-1/2 -translate-x-1/2';
            const alignment = player === 1 ? 'items-end text-right' : player === 3 ? 'items-start text-left' : 'items-center text-center';
            const activeOffset = player === 1 ? 'translate-x-1' : player === 3 ? '-translate-x-1' : player === 2 ? '-translate-y-1' : 'translate-y-1';
            const rotation = player === 1 ? 12 : player === 3 ? -12 : 0;
            return (
 <div key={player} className={`absolute z-10 flex w-[72px] flex-col gap-1 rounded-xl border p-1.5 transition-all duration-300 ease-out sm:w-[104px] sm:gap-1.5 sm:p-2 ${position} ${alignment} ${game.turn === player ? `scale-105 ${activeOffset} border-amber-300 bg-amber-400/15 ` : 'border-emerald-900/80 bg-slate-950/50 opacity-80'}`}>
 <p className="w-full truncate text-[9px] font-black sm:text-xs">{PLAYER_NAMES[player]} · {game.hands[player].length}</p>
 <div className={`relative ${isSide ? 'h-14 w-7 sm:h-16 sm:w-9' : 'h-8 w-16 sm:h-9 sm:w-20'}`}>
 {Array.from({ length: Math.min(3, game.hands[player].length) }, (_, index) => <span key={index} className={`absolute grid place-items-center rounded-sm border border-indigo-300/50 bg-indigo-950 text-[8px] text-indigo-200 ${isSide ? 'left-0 h-7 w-5 sm:h-8 sm:w-6' : 'top-0 h-7 w-5 sm:h-8 sm:w-6'}`} style={isSide ? { top: `${index * 12}px`, transform: `rotate(${rotation}deg)` } : { left: `${index * 13}px`, transform: `rotate(${rotation}deg)` }}>◆</span>)}
                </div>
              </div>
            );
          })}
 <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-emerald-950/95 p-1.5 sm:gap-3 sm:p-3">
 <div className="grid h-14 w-9 place-items-center rounded-lg border-2 border-dashed border-white/30 text-[8px] font-bold text-slate-300 sm:h-20 sm:w-12 sm:text-[10px]">RÚT<br />{game.drawPile.length}</div>
 <div className={`flex h-16 w-11 flex-col items-center justify-between rounded-lg border-2 border-white p-1 text-sm font-black sm:h-20 sm:w-14 sm:p-1.5 sm:text-base ${top.color === 'wild' ? 'bg-slate-900 text-white' : CARD_STYLES[top.color]}`}><span>{top.value}</span><span className="grid h-7 w-7 place-items-center rounded-full bg-white/80 text-xs text-slate-950 sm:h-8 sm:w-8">{top.value === 'reverse' ? '↻' : top.value === 'skip' ? '⊘' : top.value}</span><span className="text-[8px] sm:text-[10px]">{top.color === 'wild' ? 'WILD' : COLOR_NAMES[top.color]}</span></div>
 <span className="text-base text-slate-300 sm:text-xl">{game.direction === 1 ? '↻' : '↺'}</span>
          </div>
        </div>
 <p className="min-h-5 text-center text-xs font-semibold text-amber-200 sm:text-sm">{game.message}</p>
 {pendingWild !== null && <div className="flex flex-wrap justify-center gap-2">{COLORS.map(color => <button key={color} onClick={() => { const card = game.hands[0].find(item => item.id === pendingWild); if (card) commitCard(card, color); }} className={`rounded-md px-3 py-2 text-xs font-bold text-white ${CARD_STYLES[color]}`}>{COLOR_NAMES[color]}</button>)}</div>}
 {game.hands[0].length === 1 && !game.over && <p className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-black text-white">UNO! CÒN 1 LÁ</p>}
 <div className={`flex w-full flex-wrap justify-center gap-1.5 rounded-xl p-2 transition-all duration-300 ease-out sm:p-3 ${game.turn === 0 ? '-translate-y-2 bg-slate-800/90 ring-1 ring-amber-300/60 ' : 'translate-y-1 bg-slate-900/70 opacity-80'}`}>
 <p className="w-full text-center text-[10px] font-bold uppercase text-slate-300">Bài của bạn · {game.hands[0].length} lá</p>{game.hands[0].map(renderCard)}
        </div>
 {game.turn === 0 && !game.over && pendingWild === null && <button onClick={draw} className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-bold hover:bg-indigo-500">Rút một lá</button>}
 {game.over && <div className="flex flex-col items-center gap-3"><p className={`text-lg font-black ${game.winner === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{game.winner === 0 ? 'UNO! Bạn thắng!' : `${PLAYER_NAMES[game.winner ?? 1]} đã hết bài, bạn thua.`}</p><button onClick={restart} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold">Ván mới</button></div>}
      </div>
    </GameShell>
  );
};
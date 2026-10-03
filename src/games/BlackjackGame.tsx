import React, { useState } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playClearSound, playGameOverSound, playMoveSound } from '../utils/sound';

type Card = { rank: number; suit: string; id: number };
type Result = 'win' | 'lose' | 'push' | null;
type Seat = { name: string; hand: Card[]; stood: boolean };
type DealTarget = { seat: number | 'dealer'; card: Card };
const SUITS = ['♠', '♥', '♦', '♣'];
const makeDeck = (): Card[] => SUITS.flatMap(suit => Array.from({ length: 13 }, (_, index) => ({ rank: index + 1, suit, id: SUITS.indexOf(suit) * 13 + index }))).sort(() => Math.random() - 0.5);
const cardValue = (rank: number) => rank === 1 ? 11 : Math.min(rank, 10);
const handValue = (hand: Card[]) => {
  let value = hand.reduce((sum, card) => sum + cardValue(card.rank), 0);
  let aces = hand.filter(card => card.rank === 1).length;
  while (value > 21 && aces > 0) { value -= 10; aces--; }
  return value;
};
const label = (rank: number) => rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);

export const BlackjackGame: React.FC<{ onBackToHub: () => void }> = ({ onBackToHub }) => {
  const gameMeta = getGameById('blackjack')!;
  const [deck, setDeck] = useState<Card[]>([]);
  const [seats, setSeats] = useState<Seat[]>([
    { name: 'Bạn', hand: [], stood: false },
    { name: 'Máy 1', hand: [], stood: false },
    { name: 'Máy 2', hand: [], stood: false },
  ]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [dealQueue, setDealQueue] = useState<DealTarget[]>([]);
  const [phase, setPhase] = useState<'ready' | 'dealing' | 'playing' | 'dealer' | 'results'>('ready');
  const [activeSeat, setActiveSeat] = useState(0);
  const [score, setScore] = useState(0);

  const nextTurn = (nextSeats: Seat[], currentSeat: number) => {
    const nextSeat = nextSeats.findIndex((seat, index) => index > currentSeat && !seat.stood);
    if (nextSeat < 0) setPhase('dealer');
    else setActiveSeat(nextSeat);
  };

  const standSeat = (seatIndex: number) => {
    const nextSeats = seats.map((seat, index) => index === seatIndex ? { ...seat, stood: true } : seat);
    setSeats(nextSeats);
    nextTurn(nextSeats, seatIndex);
  };

  const hitSeat = (seatIndex: number) => {
    if (deck.length === 0) { standSeat(seatIndex); return; }
    const nextDeck = deck.slice(1);
    const nextSeats = seats.map((seat, index) => index === seatIndex ? { ...seat, hand: [...seat.hand, deck[0]] } : seat);
    const handTotal = handValue(nextSeats[seatIndex].hand);
    setDeck(nextDeck);
    setSeats(nextSeats);
    playMoveSound();
    if (handTotal >= 21) {
      nextSeats[seatIndex] = { ...nextSeats[seatIndex], stood: true };
      setSeats(nextSeats);
      nextTurn(nextSeats, seatIndex);
    }
  };

  const start = () => {
    const cards = makeDeck();
    const order: (number | 'dealer')[] = [0, 1, 2, 'dealer', 0, 1, 2, 'dealer'];
    setSeats([{ name: 'Bạn', hand: [], stood: false }, { name: 'Máy 1', hand: [], stood: false }, { name: 'Máy 2', hand: [], stood: false }]);
    setDealer([]);
    setDealQueue(order.map((seat, index) => ({ seat, card: cards[index] })));
    setDeck(cards.slice(order.length));
    setActiveSeat(0);
    setScore(0);
    setPhase('dealing');
    playMoveSound();
  };

  React.useEffect(() => {
    if (phase !== 'dealing' || dealQueue.length === 0) return;
    const timer = setTimeout(() => {
      const [nextDeal, ...remaining] = dealQueue;
      let nextSeats = seats;
      let nextDealer = dealer;
      if (nextDeal.seat === 'dealer') nextDealer = [...dealer, nextDeal.card];
      else nextSeats = seats.map((seat, index) => index === nextDeal.seat ? { ...seat, hand: [...seat.hand, nextDeal.card] } : seat);
      setSeats(nextSeats);
      setDealer(nextDealer);
      setDealQueue(remaining);
      playMoveSound();
      if (remaining.length === 0) {
        const readySeats = nextSeats.map(seat => handValue(seat.hand) === 21 ? { ...seat, stood: true } : seat);
        setSeats(readySeats);
        const firstActive = readySeats.findIndex(seat => !seat.stood);
        if (firstActive < 0) setPhase('dealer');
        else { setActiveSeat(firstActive); setPhase('playing'); }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [phase, dealQueue, seats, dealer]);

  React.useEffect(() => {
    if (phase !== 'playing' || activeSeat === 0) return;
    const timer = setTimeout(() => {
      if (handValue(seats[activeSeat].hand) < 17) hitSeat(activeSeat);
      else standSeat(activeSeat);
    }, 700);
    return () => clearTimeout(timer);
  }, [phase, activeSeat, seats, deck]);

  React.useEffect(() => {
    if (phase !== 'dealer') return;
    if (handValue(dealer) >= 17 || deck.length === 0) {
      setPhase('results');
      return;
    }
    const timer = setTimeout(() => {
      setDealer(current => [...current, deck[0]]);
      setDeck(current => current.slice(1));
      playMoveSound();
    }, 650);
    return () => clearTimeout(timer);
  }, [phase, dealer, deck]);

  const resultFor = (hand: Card[]): Result => {
    const playerTotal = handValue(hand);
    const dealerTotal = handValue(dealer);
    if (playerTotal > 21) return 'lose';
    if (dealerTotal > 21 || playerTotal > dealerTotal) return 'win';
    if (playerTotal < dealerTotal) return 'lose';
    return 'push';
  };

  React.useEffect(() => {
    if (phase !== 'results') return;
    const humanResult = resultFor(seats[0].hand);
    setScore(humanResult === 'win' ? 500 : humanResult === 'push' ? 100 : 0);
    if (humanResult === 'win') playClearSound();
    else if (humanResult === 'lose') playGameOverSound();
  }, [phase]);

 const renderHand = (hand: Card[], hidden = false) => <div className="flex min-h-24 flex-wrap justify-center gap-1.5">{hand.map((card, index) => <div key={card.id} style={{ animationDelay: `${index * 90}ms` }} className={`flex h-20 w-12 animate-in slide-in-from-top-3 fade-in flex-col justify-between rounded-lg border-2 p-1.5 duration-300 sm:h-24 sm:w-16 sm:p-2 ${card.suit === '♥' || card.suit === '♦' ? 'text-rose-600' : 'text-slate-900'} ${hidden && index === 1 && phase !== 'results' ? 'border-indigo-400 bg-indigo-950 text-white' : 'border-white bg-white'}`}><span className="text-sm font-black">{hidden && index === 1 && phase !== 'results' ? '★' : label(card.rank)}</span><span className="self-end text-lg">{hidden && index === 1 && phase !== 'results' ? '◆' : card.suit}</span></div>)}</div>;

  const statusFor = (seat: Seat) => {
    if (phase === 'results') {
      const result = resultFor(seat.hand);
      return result === 'win' ? 'Thắng' : result === 'push' ? 'Hòa' : 'Thua';
    }
    if (handValue(seat.hand) > 21) return 'Quắc';
    if (seat.stood) return handValue(seat.hand) === 21 ? '21 điểm' : 'Đã dừng';
    if (phase === 'playing' && seats[activeSeat] === seat) return 'Đang lượt';
    return 'Chờ lượt';
  };

  const humanResult = phase === 'results' ? resultFor(seats[0].hand) : null;

  return (
    <GameShell game={gameMeta} score={score} isGameOver={phase === 'results'} isVictory={humanResult === 'win'} isPaused={false} onRestart={start} onBackToHub={onBackToHub}>
 <div className="flex w-full max-w-4xl flex-col items-center gap-3 sm:gap-5 rounded-2xl border border-emerald-800 bg-emerald-950/60 p-3 sm:p-5">
 <section className="w-full rounded-xl bg-emerald-950/70 p-2 text-center sm:p-3"><p className="mb-1 text-[10px] uppercase text-emerald-200 sm:text-xs">Nhà cái · {phase === 'playing' || phase === 'dealing' ? '?' : handValue(dealer)}</p>{renderHand(dealer, true)}</section>
 <div className="grid w-full grid-cols-3 gap-2 sm:gap-4">
 {seats.map((seat, index) => <section key={seat.name} className={`min-w-0 rounded-xl border p-2 text-center transition sm:p-3 ${phase === 'playing' && activeSeat === index ? 'border-amber-300 bg-amber-400/10' : 'border-emerald-900 bg-emerald-950/50'}`}><p className="truncate text-[10px] font-bold text-emerald-100 sm:text-xs">{seat.name} · {seat.hand.length ? handValue(seat.hand) : '—'}</p><div className="my-1 text-[9px] text-amber-200 sm:my-2 sm:text-xs">{statusFor(seat)}</div>{renderHand(seat.hand)}</section>)}
        </div>
 {phase === 'ready' && <button onClick={start} className="rounded-md bg-amber-500 px-5 py-2 font-bold text-slate-950">Chia bài</button>}
 {phase === 'dealing' && <p className="text-xs font-semibold text-amber-200">Đang chia bài theo lượt...</p>}
 {phase === 'playing' && activeSeat === 0 && <div className="flex gap-3"><button onClick={() => hitSeat(0)} className="rounded-md bg-emerald-600 px-5 py-2 font-bold">Rút bài</button><button onClick={() => standSeat(0)} className="rounded-md bg-slate-700 px-5 py-2 font-bold">Dừng</button></div>}
 {phase === 'playing' && activeSeat > 0 && <p className="animate-pulse text-xs font-semibold text-amber-200">{seats[activeSeat].name} đang suy nghĩ...</p>}
 {phase === 'dealer' && <p className="animate-pulse text-xs font-semibold text-amber-200">Nhà cái đang rút bài...</p>}
 {phase === 'results' && <div className="flex flex-col items-center gap-2"><p className="font-bold text-amber-200">{humanResult === 'win' ? 'Bạn thắng nhà cái!' : humanResult === 'push' ? 'Bạn hòa nhà cái.' : 'Nhà cái thắng ván này.'}</p><button onClick={start} className="rounded-md bg-amber-500 px-4 py-2 font-bold text-slate-950">Ván mới</button></div>}
      </div>
    </GameShell>
  );
};
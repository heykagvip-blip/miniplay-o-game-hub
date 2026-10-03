import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameShell } from '../components/GameShell';
import { getGameById } from '../data/games';
import { playMoveSound, playScoreSound, playClearSound, triggerHaptic } from '../utils/sound';
import { RotateCcw, Undo2, Clock, Sparkles, Zap, CheckCircle2, HelpCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type Color = 'red' | 'black';

interface Card {
  id: string;
  suit: Suit;
  rank: number; // 1 (A) to 13 (K)
  faceUp: boolean;
}

const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};

const SUIT_NAMES: Record<Suit, string> = {
  spades: 'Bích',
  hearts: 'Cơ',
  diamonds: 'Rô',
  clubs: 'Tép',
};

const SUIT_COLORS: Record<Suit, Color> = {
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
  clubs: 'black',
};

const RANK_LABELS: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

// 4 foundation piles mapped to specific suits
const FOUNDATION_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

interface SelectedCardInfo {
  source: 'waste' | 'tableau';
  tableauColIndex?: number;
  cardIndex?: number;
  cards: Card[]; // Single card or sequence
}

interface DragState {
  source: 'waste' | 'tableau';
  tableauColIndex?: number;
  cardIndex?: number;
  cards: Card[];
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isDragging: boolean;
}

interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles: 0: Spades, 1: Hearts, 2: Diamonds, 3: Clubs
  tableau: Card[][]; // 7 columns
  score: number;
  moves: number;
}

interface SolitaireGameProps {
  onBackToHub: () => void;
}

export const SolitaireGame: React.FC<SolitaireGameProps> = ({ onBackToHub }) => {
  const gameMeta = getGameById('solitaire')!;

  const [state, setState] = useState<GameState>({
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: [[], [], [], [], [], [], []],
    score: 0,
    moves: 0,
  });

  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<SelectedCardInfo | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [isAutoFinishing, setIsAutoFinishing] = useState(false);

  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isVictory, setIsVictory] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Refs for drag tracking
  const dragRef = useRef<DragState | null>(null);

  // Track double taps for touch / fast clicks
  const lastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

  // Initialize deck and deal
  const initGame = useCallback(() => {
    const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
    const deck: Card[] = [];

    suits.forEach(suit => {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({
          id: `${suit}-${rank}`,
          suit,
          rank,
          faceUp: false,
        });
      }
    });

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal to 7 tableau piles
    const tableau: Card[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) {
        const card = deck.pop()!;
        if (i === j) card.faceUp = true;
        tableau[j].push(card);
      }
    }

    const initialState: GameState = {
      stock: deck,
      waste: [],
      foundations: [[], [], [], []],
      tableau,
      score: 0,
      moves: 0,
    };

    setState(initialState);
    setHistory([]);
    setSelected(null);
    setDragState(null);
    setTimer(0);
    setIsTimerRunning(true);
    setIsVictory(false);
    setIsAutoFinishing(false);
    setStatusMessage('Chạm lá bài để chọn, kéo thả hoặc nhấp đúp để tự động xếp!');
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  // Timer loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && !isVictory) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, isVictory]);

  const saveHistorySnapshot = useCallback(() => {
    setHistory(prev => [JSON.parse(JSON.stringify(state)), ...prev].slice(0, 20));
  }, [state]);

  const handleUndo = () => {
    if (history.length === 0 || isAutoFinishing) return;
    playMoveSound();
    triggerHaptic(15);
    const prev = history[0];
    setState(prev);
    setHistory(h => h.slice(1));
    setSelected(null);
    setDragState(null);
    setStatusMessage('Đã hoàn tác bước trước');
  };

  // 1. Draw card from stock into waste
  const handleStockClick = () => {
    if (isAutoFinishing) return;
    saveHistorySnapshot();
    playMoveSound();
    triggerHaptic(15);
    setSelected(null);

    setState(prev => {
      const nextStock = [...prev.stock];
      const nextWaste = [...prev.waste];

      if (nextStock.length === 0) {
        // Recycle waste back into stock
        if (nextWaste.length === 0) return prev;
        const recycled = nextWaste.reverse().map(c => ({ ...c, faceUp: false }));
        return {
          ...prev,
          stock: recycled,
          waste: [],
          moves: prev.moves + 1,
        };
      } else {
        const drawn = nextStock.pop()!;
        drawn.faceUp = true;
        nextWaste.push(drawn);
        return {
          ...prev,
          stock: nextStock,
          waste: nextWaste,
          moves: prev.moves + 1,
        };
      }
    });
  };

  // Helper validation: can card be placed on specific foundation pile
  const canPlaceOnFoundation = useCallback((card: Card, fIdx: number, pile: Card[]): boolean => {
    const requiredSuit = FOUNDATION_SUITS[fIdx];
    if (card.suit !== requiredSuit) return false;
    if (pile.length === 0) {
      return card.rank === 1; // Ace
    }
    const top = pile[pile.length - 1];
    return card.rank === top.rank + 1;
  }, []);

  // Helper validation: can card sequence be placed on top of tableau pile
  const canPlaceOnTableau = useCallback((movingBottomCard: Card, targetPile: Card[]): boolean => {
    if (targetPile.length === 0) {
      return movingBottomCard.rank === 13; // Only King can fill empty column
    }
    const top = targetPile[targetPile.length - 1];
    if (!top.faceUp) return false;
    return (
      SUIT_COLORS[movingBottomCard.suit] !== SUIT_COLORS[top.suit] &&
      top.rank === movingBottomCard.rank + 1
    );
  }, []);

  // Move selected card(s) to target tableau column
  const executeMoveToTableau = useCallback(
    (source: 'waste' | 'tableau', cards: Card[], targetColIdx: number, fromColIdx?: number, fromCardIdx?: number) => {
      saveHistorySnapshot();
      playMoveSound();
      triggerHaptic(15);

      setState(prev => {
        const nextTableau = prev.tableau.map(p => [...p]);
        const nextWaste = [...prev.waste];

        if (source === 'waste') {
          nextWaste.pop();
          nextTableau[targetColIdx].push(...cards);
        } else {
          const fromCol = fromColIdx!;
          const sourcePile = nextTableau[fromCol];
          sourcePile.splice(fromCardIdx!);
          // Flip newly exposed top card if face-down
          if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
            sourcePile[sourcePile.length - 1].faceUp = true;
          }
          nextTableau[targetColIdx].push(...cards);
        }

        return {
          ...prev,
          waste: nextWaste,
          tableau: nextTableau,
          score: prev.score + 5,
          moves: prev.moves + 1,
        };
      });

      setSelected(null);
      setDragState(null);
    },
    [saveHistorySnapshot]
  );

  // Move selected single card to foundation pile
  const executeMoveToFoundation = useCallback(
    (source: 'waste' | 'tableau', card: Card, fIdx: number, fromColIdx?: number) => {
      saveHistorySnapshot();
      playScoreSound();
      triggerHaptic(25);

      setState(prev => {
        const nextFoundations = prev.foundations.map(p => [...p]);
        const nextTableau = prev.tableau.map(p => [...p]);
        const nextWaste = [...prev.waste];

        if (source === 'waste') {
          nextWaste.pop();
          nextFoundations[fIdx].push(card);
        } else {
          const sourcePile = nextTableau[fromColIdx!];
          sourcePile.pop();
          if (sourcePile.length > 0 && !sourcePile[sourcePile.length - 1].faceUp) {
            sourcePile[sourcePile.length - 1].faceUp = true;
          }
          nextFoundations[fIdx].push(card);
        }

        // Check victory
        const totalCards = nextFoundations.reduce((acc, p) => acc + p.length, 0);
        if (totalCards === 52) {
          setIsVictory(true);
          playClearSound();
          try {
            confetti({
              particleCount: 120,
              spread: 80,
              origin: { y: 0.6 },
            });
          } catch {
            // ignore
          }
        }

        return {
          ...prev,
          waste: nextWaste,
          tableau: nextTableau,
          foundations: nextFoundations,
          score: prev.score + 10,
          moves: prev.moves + 1,
        };
      });

      setSelected(null);
      setDragState(null);
    },
    [saveHistorySnapshot]
  );

  // Quick auto-move for any exposed card
  const tryQuickAutoMove = useCallback(
    (card: Card, source: 'waste' | 'tableau', colIdx?: number, cardIdx?: number): boolean => {
      // 1. Try Foundation first (only top-most card can go to foundation)
      const isTopCard = source === 'waste' || cardIdx === state.tableau[colIdx!].length - 1;
      if (isTopCard) {
        const targetFIdx = FOUNDATION_SUITS.indexOf(card.suit);
        if (targetFIdx !== -1 && canPlaceOnFoundation(card, targetFIdx, state.foundations[targetFIdx])) {
          executeMoveToFoundation(source, card, targetFIdx, colIdx);
          setStatusMessage(`Đã chuyển ${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]} lên cọc ${SUIT_NAMES[card.suit]}`);
          return true;
        }
      }

      // 2. Try Tableau piles
      const movingCards = source === 'waste' ? [card] : state.tableau[colIdx!].slice(cardIdx!);
      for (let t = 0; t < 7; t++) {
        if (source === 'tableau' && colIdx === t) continue;
        if (canPlaceOnTableau(movingCards[0], state.tableau[t])) {
          executeMoveToTableau(source, movingCards, t, colIdx, cardIdx);
          setStatusMessage(`Đã chuyển sang cột ${t + 1}`);
          return true;
        }
      }

      return false;
    },
    [state.tableau, state.foundations, canPlaceOnFoundation, canPlaceOnTableau, executeMoveToFoundation, executeMoveToTableau]
  );

  // Manual auto-place button for currently selected card
  const handleAutoPlaceSelected = () => {
    if (!selected) return;
    const baseCard = selected.cards[0];
    const success = tryQuickAutoMove(
      baseCard,
      selected.source,
      selected.tableauColIndex,
      selected.cardIndex
    );
    if (!success) {
      triggerHaptic(40);
      setStatusMessage('Không có vị trí hợp lệ nào để tự động xếp lá bài này!');
    }
  };

  // Find all valid target columns for the selected/dragged card
  const getValidDestinations = useCallback(() => {
    const activeInfo = dragState || selected;
    if (!activeInfo) {
      return { tableauColumns: [] as number[], foundationIdx: null as number | null };
    }

    const baseCard = activeInfo.cards[0];
    const isSingleCard = activeInfo.cards.length === 1;

    // Check Tableau columns
    const tableauColumns: number[] = [];
    for (let i = 0; i < 7; i++) {
      if (activeInfo.source === 'tableau' && activeInfo.tableauColIndex === i) continue;
      if (canPlaceOnTableau(baseCard, state.tableau[i])) {
        tableauColumns.push(i);
      }
    }

    // Check Foundation
    let foundationIdx: number | null = null;
    if (isSingleCard) {
      const fIdx = FOUNDATION_SUITS.indexOf(baseCard.suit);
      if (fIdx !== -1 && canPlaceOnFoundation(baseCard, fIdx, state.foundations[fIdx])) {
        foundationIdx = fIdx;
      }
    }

    return { tableauColumns, foundationIdx };
  }, [dragState, selected, canPlaceOnTableau, canPlaceOnFoundation, state.tableau, state.foundations]);

  const { tableauColumns: validTableauCols, foundationIdx: validFoundationIdx } = getValidDestinations();

  // Click on waste card
  const handleWasteClick = () => {
    if (state.waste.length === 0 || isAutoFinishing) return;
    const topCard = state.waste[state.waste.length - 1];

    const now = Date.now();
    const isDoubleTap = lastTapRef.current.id === topCard.id && now - lastTapRef.current.time < 350;
    lastTapRef.current = { id: topCard.id, time: now };

    if (isDoubleTap) {
      if (tryQuickAutoMove(topCard, 'waste')) return;
    }

    if (selected && selected.source === 'waste') {
      // Toggle auto move on second tap or deselect
      if (!tryQuickAutoMove(topCard, 'waste')) {
        setSelected(null);
        setStatusMessage('Đã bỏ chọn');
      }
      return;
    }

    playMoveSound();
    triggerHaptic(15);
    setSelected({
      source: 'waste',
      cards: [topCard],
    });
    setStatusMessage(`Đang chọn ${RANK_LABELS[topCard.rank]}${SUIT_SYMBOLS[topCard.suit]} • Chạm vào cột đích hoặc cọc để đặt`);
  };

  // Click on a tableau card
  const handleCardClick = (colIdx: number, cardIdx: number, card: Card) => {
    if (isAutoFinishing) return;

    // 1. If face-down card at the top: flip it!
    if (!card.faceUp) {
      if (cardIdx === state.tableau[colIdx].length - 1) {
        saveHistorySnapshot();
        playMoveSound();
        triggerHaptic(20);
        setState(prev => {
          const nextTableau = prev.tableau.map(p => [...p]);
          nextTableau[colIdx][cardIdx].faceUp = true;
          return { ...prev, tableau: nextTableau, score: prev.score + 5 };
        });
        setStatusMessage('Đã lật lá bài mới!');
      }
      return;
    }

    // 2. Check double tap for instant auto-move
    const now = Date.now();
    const isDoubleTap = lastTapRef.current.id === card.id && now - lastTapRef.current.time < 350;
    lastTapRef.current = { id: card.id, time: now };

    if (isDoubleTap) {
      if (tryQuickAutoMove(card, 'tableau', colIdx, cardIdx)) {
        return;
      }
    }

    // 3. If a card is already selected:
    if (selected) {
      // Clicking the exact same card -> try auto move, otherwise deselect
      if (
        selected.source === 'tableau' &&
        selected.tableauColIndex === colIdx &&
        selected.cardIndex === cardIdx
      ) {
        if (!tryQuickAutoMove(card, 'tableau', colIdx, cardIdx)) {
          setSelected(null);
          setStatusMessage('Đã bỏ chọn');
        }
        return;
      }

      // If clicked on another column: check if selected cards can move to this column!
      if (selected.tableauColIndex !== colIdx || selected.source === 'waste') {
        const targetPile = state.tableau[colIdx];
        const movingBase = selected.cards[0];
        if (canPlaceOnTableau(movingBase, targetPile)) {
          executeMoveToTableau(
            selected.source,
            selected.cards,
            colIdx,
            selected.tableauColIndex,
            selected.cardIndex
          );
          setStatusMessage(`Đã chuyển sang cột ${colIdx + 1}`);
          return;
        }
      }

      // If move not legal to this column, switch selection to this clicked card!
      playMoveSound();
      triggerHaptic(15);
      const sequence = state.tableau[colIdx].slice(cardIdx);
      setSelected({
        source: 'tableau',
        tableauColIndex: colIdx,
        cardIndex: cardIdx,
        cards: sequence,
      });
      setStatusMessage(`Đang chọn ${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]} (${sequence.length} lá)`);
      return;
    }

    // 4. No card selected: select this card (and stack)
    playMoveSound();
    triggerHaptic(15);
    const sequence = state.tableau[colIdx].slice(cardIdx);
    setSelected({
      source: 'tableau',
      tableauColIndex: colIdx,
      cardIndex: cardIdx,
      cards: sequence,
    });
    setStatusMessage(`Đang chọn ${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]} (${sequence.length} lá) • Chạm cột đích hoặc cọc để đặt`);
  };

  // Click anywhere on a column (card, bottom space, empty column)
  const handleColumnAreaClick = (colIdx: number) => {
    if (isAutoFinishing) return;
    if (selected) {
      const targetPile = state.tableau[colIdx];
      const movingBase = selected.cards[0];
      if (canPlaceOnTableau(movingBase, targetPile)) {
        executeMoveToTableau(
          selected.source,
          selected.cards,
          colIdx,
          selected.tableauColIndex,
          selected.cardIndex
        );
        setStatusMessage(`Đã chuyển sang cột ${colIdx + 1}`);
      } else {
        triggerHaptic(30);
        setStatusMessage('Nước đi không hợp lệ vào cột này!');
      }
    }
  };

  // Click on a foundation pile
  const handleFoundationClick = (fIdx: number) => {
    if (isAutoFinishing) return;
    if (selected) {
      if (selected.cards.length !== 1) {
        triggerHaptic(30);
        setStatusMessage('Cọc chuẩn chỉ nhận từng lá bài một!');
        return;
      }
      const card = selected.cards[0];
      const targetPile = state.foundations[fIdx];
      if (canPlaceOnFoundation(card, fIdx, targetPile)) {
        executeMoveToFoundation(selected.source, card, fIdx, selected.tableauColIndex);
        setStatusMessage(`Đã đưa ${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]} lên cọc ${SUIT_NAMES[card.suit]}`);
      } else {
        triggerHaptic(30);
        setStatusMessage(`Lá bài này không thể đặt lên cọc ${SUIT_NAMES[FOUNDATION_SUITS[fIdx]]}!`);
      }
    }
  };

  // Pointer drag event handlers for direct tactile card dragging
  const handlePointerDown = (
    e: React.PointerEvent,
    source: 'waste' | 'tableau',
    colIdx?: number,
    cardIdx?: number,
    card?: Card
  ) => {
    if (isAutoFinishing || e.button !== 0) return;
    if (card && !card.faceUp) return;

    const cards =
      source === 'waste'
        ? [card || state.waste[state.waste.length - 1]]
        : state.tableau[colIdx!].slice(cardIdx!);

    const initialDrag: DragState = {
      source,
      tableauColIndex: colIdx,
      cardIndex: cardIdx,
      cards,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      isDragging: false,
    };

    dragRef.current = initialDrag;
    setDragState(initialDrag);

    const onPointerMove = (moveEvt: PointerEvent) => {
      const currentDrag = dragRef.current;
      if (!currentDrag) return;

      const dist = Math.hypot(
        moveEvt.clientX - currentDrag.startX,
        moveEvt.clientY - currentDrag.startY
      );

      const nextDrag: DragState = {
        ...currentDrag,
        currentX: moveEvt.clientX,
        currentY: moveEvt.clientY,
        isDragging: currentDrag.isDragging || dist > 7,
      };

      if (!currentDrag.isDragging && nextDrag.isDragging) {
        triggerHaptic(10);
      }

      dragRef.current = nextDrag;
      setDragState(nextDrag);
    };

    const onPointerUp = (upEvt: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const finalDrag = dragRef.current;
      dragRef.current = null;
      setDragState(null);

      if (!finalDrag || !finalDrag.isDragging) {
        return; // Regular tap handled by click handlers
      }

      // Drag drop detection via elementsFromPoint
      const elements = document.elementsFromPoint(upEvt.clientX, upEvt.clientY);
      let dropped = false;

      // 1. Check Foundation drop targets
      for (const el of elements) {
        const fAttr = el.getAttribute('data-foundation-idx');
        if (fAttr !== null) {
          const fIdx = parseInt(fAttr, 10);
          if (finalDrag.cards.length === 1) {
            const card = finalDrag.cards[0];
            if (canPlaceOnFoundation(card, fIdx, state.foundations[fIdx])) {
              executeMoveToFoundation(finalDrag.source, card, fIdx, finalDrag.tableauColIndex);
              setStatusMessage(`Đã kéo ${RANK_LABELS[card.rank]}${SUIT_SYMBOLS[card.suit]} lên cọc`);
              dropped = true;
              break;
            }
          }
        }
      }

      // 2. Check Tableau column drop targets
      if (!dropped) {
        for (const el of elements) {
          const colAttr = el.getAttribute('data-tableau-col');
          if (colAttr !== null) {
            const targetCol = parseInt(colAttr, 10);
            if (finalDrag.source === 'tableau' && finalDrag.tableauColIndex === targetCol) {
              break;
            }
            if (canPlaceOnTableau(finalDrag.cards[0], state.tableau[targetCol])) {
              executeMoveToTableau(
                finalDrag.source,
                finalDrag.cards,
                targetCol,
                finalDrag.tableauColIndex,
                finalDrag.cardIndex
              );
              setStatusMessage(`Đã chuyển sang cột ${targetCol + 1}`);
              dropped = true;
              break;
            }
          }
        }
      }

      if (!dropped) {
        triggerHaptic(25);
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Check if all cards on tableau are face up and stock is empty -> can Auto-Finish!
  const canAutoFinish = useCallback(() => {
    if (isVictory || isAutoFinishing) return false;
    const hasFaceDownCards = state.tableau.some(pile => pile.some(c => !c.faceUp));
    return !hasFaceDownCards && state.stock.length === 0;
  }, [state.tableau, state.stock, isVictory, isAutoFinishing]);

  // Animated auto-finish function
  const handleAutoFinish = () => {
    if (isAutoFinishing) return;
    setIsAutoFinishing(true);
    setSelected(null);
    setStatusMessage('Đang tự động chuyển toàn bộ lá bài lên cọc chuẩn...');

    const stepInterval = setInterval(() => {
      setState(prev => {
        const nextFoundations = prev.foundations.map(p => [...p]);
        const nextTableau = prev.tableau.map(p => [...p]);
        const nextWaste = [...prev.waste];

        let moved = false;

        // Try Waste first
        if (nextWaste.length > 0) {
          const topWaste = nextWaste[nextWaste.length - 1];
          const fIdx = FOUNDATION_SUITS.indexOf(topWaste.suit);
          if (canPlaceOnFoundation(topWaste, fIdx, nextFoundations[fIdx])) {
            nextWaste.pop();
            nextFoundations[fIdx].push(topWaste);
            playScoreSound();
            moved = true;
          }
        }

        // Try Tableau
        if (!moved) {
          for (let col = 0; col < 7; col++) {
            const pile = nextTableau[col];
            if (pile.length > 0) {
              const top = pile[pile.length - 1];
              const fIdx = FOUNDATION_SUITS.indexOf(top.suit);
              if (canPlaceOnFoundation(top, fIdx, nextFoundations[fIdx])) {
                pile.pop();
                nextFoundations[fIdx].push(top);
                playScoreSound();
                moved = true;
                break;
              }
            }
          }
        }

        const totalCards = nextFoundations.reduce((acc, p) => acc + p.length, 0);
        if (totalCards === 52 || !moved) {
          clearInterval(stepInterval);
          setIsAutoFinishing(false);
          if (totalCards === 52) {
            setIsVictory(true);
            playClearSound();
            try {
              confetti({
                particleCount: 150,
                spread: 90,
                origin: { y: 0.6 },
              });
            } catch {
              // ignore
            }
          }
        }

        return {
          ...prev,
          waste: nextWaste,
          tableau: nextTableau,
          foundations: nextFoundations,
          score: prev.score + (moved ? 10 : 0),
          moves: prev.moves + (moved ? 1 : 0),
        };
      });
    }, 180);
  };

  const isCardSelected = (source: 'waste' | 'tableau', colIdx?: number, cardIdx?: number): boolean => {
    if (!selected) return false;
    if (selected.source !== source) return false;
    if (source === 'waste') return true;
    if (selected.tableauColIndex !== colIdx) return false;
    return (cardIdx ?? -1) >= (selected.cardIndex ?? 0);
  };

  return (
    <GameShell
      game={gameMeta}
      score={state.score}
      isGameOver={isVictory}
      isPaused={false}
      onRestart={initGame}
      onBackToHub={onBackToHub}
      isVictory={isVictory}
      gameCustomStats={
 <div className="flex items-center gap-2">
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs flex items-center gap-1.5 text-slate-400">
 <Clock className="w-3.5 h-3.5 text-amber-400" />
 <span className="font-bold text-white">{timer}s</span>
          </div>
 <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800 text-xs text-indigo-400 font-bold">
            {state.moves} bước
          </div>
        </div>
      }
    >
 <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto select-none touch-none">
        {/* Top Control Bar: Active Selection, Auto-Place, Undo */}
 <div className="w-full flex items-center justify-between mb-2.5 px-1 min-h-[34px]">
 <div className="flex items-center gap-2 flex-wrap text-xs">
            {selected ? (
 <div className="flex items-center gap-1.5 bg-indigo-950/80 border border-indigo-700/60 px-2.5 py-1 rounded-xl text-indigo-200 ">
 <span className="font-bold">
                  {RANK_LABELS[selected.cards[0].rank]}
                  {SUIT_SYMBOLS[selected.cards[0].suit]}
                </span>
 <span className="text-[11px] text-indigo-300">({selected.cards.length} lá)</span>
                <button
                  type="button"
                  onClick={handleAutoPlaceSelected}
 className="ml-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition active:scale-95"
                  title="Tự động xếp vào vị trí hợp lệ"
                >
 <Zap className="w-3 h-3" />
                  <span>Tự xếp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
 className="ml-1 px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
                >
                  Bỏ chọn
                </button>
              </div>
            ) : canAutoFinish() ? (
              <button
                type="button"
                onClick={handleAutoFinish}
                disabled={isAutoFinishing}
 className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold animate-pulse active:scale-95 transition"
              >
 <Sparkles className="w-3.5 h-3.5" />
                <span>Hoàn thành tự động!</span>
              </button>
            ) : (
 <span className="text-[11px] sm:text-xs text-slate-400 line-clamp-1">
                {statusMessage}
              </span>
            )}
          </div>

 <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0 || isAutoFinishing}
 className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 disabled:opacity-40 transition active:scale-95"
              aria-label="Hoàn tác bước đi"
            >
 <Undo2 className="w-3.5 h-3.5" />
 <span className="hidden sm:inline">Hoàn tác</span>
 <span className="text-[10px] text-slate-400">({history.length})</span>
            </button>
          </div>
        </div>

        {/* Top Arena: Stock, Waste, Space, 4 Foundations */}
 <div className="w-full grid grid-cols-7 gap-1.5 sm:gap-3 mb-4 p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl ">
          {/* Stock */}
 <div className="flex justify-center">
            {state.stock.length > 0 ? (
              <button
                type="button"
                onClick={handleStockClick}
 className="w-10 sm:w-14 h-14 sm:h-20 rounded-xl bg-gradient-to-br from-indigo-700 to-purple-900 border-2 border-indigo-400/40 flex items-center justify-center cursor-pointer select-none active:scale-95 transition"
                aria-label="Rút bài từ cọc"
              >
 <div className="w-5 sm:w-7 h-7 sm:h-10 rounded border border-indigo-400/30 bg-indigo-950/50 flex items-center justify-center text-[10px] sm:text-xs font-black text-indigo-200">
                  {state.stock.length}
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStockClick}
 className="w-10 sm:w-14 h-14 sm:h-20 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 active:scale-95 transition"
                aria-label="Thu lại các lá bài đã rút"
              >
 <RotateCcw className="w-4 h-4 text-indigo-400" />
 <span className="text-[9px] mt-0.5 font-bold">Lật lại</span>
              </button>
            )}
          </div>

          {/* Waste */}
 <div className="flex justify-center">
            {state.waste.length > 0 ? (
              (() => {
                const topCard = state.waste[state.waste.length - 1];
                const isSelected = isCardSelected('waste');
                const isRed = SUIT_COLORS[topCard.suit] === 'red';

                return (
                  <div
                    onClick={handleWasteClick}
                    onPointerDown={e => handlePointerDown(e, 'waste', undefined, undefined, topCard)}
 className={`w-10 sm:w-14 h-14 sm:h-20 rounded-xl bg-white border-2 flex flex-col justify-between p-1 sm:p-1.5 select-none cursor-grab active:cursor-grabbing transition-all duration-150 ${
                      isRed ? 'text-rose-600' : 'text-slate-950'
                    } ${
                      isSelected
                        ? 'ring-4 ring-emerald-400 scale-105   -translate-y-1 z-20 border-emerald-500'
                        : 'border-slate-300 hover:border-indigo-400'
                    }`}
                  >
 <div className="text-[10px] sm:text-xs font-black leading-none flex items-center justify-between">
                      <span>{RANK_LABELS[topCard.rank]}</span>
 <span className="text-[10px] sm:text-xs">{SUIT_SYMBOLS[topCard.suit]}</span>
                    </div>
 <div className="text-center text-sm sm:text-xl leading-none font-black">
                      {SUIT_SYMBOLS[topCard.suit]}
                    </div>
 <div className="text-[9px] sm:text-[11px] font-black self-end leading-none">
                      {RANK_LABELS[topCard.rank]}
                    </div>
                  </div>
                );
              })()
            ) : (
 <div className="w-10 sm:w-14 h-14 sm:h-20 rounded-xl border border-dashed border-slate-800 bg-slate-950/40" />
            )}
          </div>

          {/* Spacer */}
          <div />

          {/* 4 Foundations */}
          {state.foundations.map((fPile, idx) => {
            const top = fPile[fPile.length - 1];
            const suit = FOUNDATION_SUITS[idx];
            const suitSymbol = SUIT_SYMBOLS[suit];
            const isRedSuit = SUIT_COLORS[suit] === 'red';
            const isValidTarget = validFoundationIdx === idx;

            return (
              <div
                key={`foundation-${idx}`}
                data-foundation-idx={idx}
 className="flex justify-center"
              >
                <button
                  type="button"
                  data-foundation-idx={idx}
                  onClick={() => handleFoundationClick(idx)}
 className={`relative w-10 sm:w-14 h-14 sm:h-20 rounded-xl border-2 flex flex-col justify-between p-1 sm:p-1.5 select-none cursor-pointer transition-all duration-150 ${
                    top
                      ? `bg-white ${isRedSuit ? 'text-rose-600' : 'text-slate-950'} border-slate-300`
                      : 'border-dashed border-slate-700 bg-slate-950/60 hover:border-indigo-500/50'
                  } ${
                    isValidTarget
                      ? 'ring-4 ring-emerald-400 border-emerald-400 animate-pulse bg-emerald-950/30'
                      : ''
                  }`}
                  aria-label={`Cọc ${SUIT_NAMES[suit]}`}
                >
                  {isValidTarget && (
 <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1 rounded bg-emerald-500 text-slate-950 text-[8px] font-black z-30 uppercase tracking-wider">
                      Đặt
                    </span>
                  )}
                  {top ? (
                    <>
 <div className="text-[10px] sm:text-xs font-black leading-none flex items-center justify-between">
                        <span>{RANK_LABELS[top.rank]}</span>
 <span className="text-[10px] sm:text-xs">{SUIT_SYMBOLS[top.suit]}</span>
                      </div>
 <div className="text-center text-sm sm:text-xl leading-none font-black">
                        {SUIT_SYMBOLS[top.suit]}
                      </div>
 <div className="text-[9px] sm:text-[11px] font-black self-end leading-none">
                        {RANK_LABELS[top.rank]}
                      </div>
                    </>
                  ) : (
 <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
 <span className={`text-base sm:text-xl ${isRedSuit ? 'text-rose-500/50' : 'text-slate-500'}`}>
                        {suitSymbol}
                      </span>
 <span className="text-[9px] font-extrabold text-slate-500">A</span>
                    </div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Bottom Tableau Piles (7 Columns) */}
 <div className="w-full grid grid-cols-7 gap-1 sm:gap-2.5 min-h-[380px] sm:min-h-[440px] p-2 sm:p-3 bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl ">
          {state.tableau.map((pile, colIdx) => {
            const isValidColumn = validTableauCols.includes(colIdx);

            return (
              <div
                key={`col-${colIdx}`}
                data-tableau-col={colIdx}
                onClick={() => handleColumnAreaClick(colIdx)}
 className={`relative flex flex-col items-center min-h-[260px] sm:min-h-[320px] rounded-xl transition cursor-pointer p-0.5 ${
                  isValidColumn
                    ? 'ring-2 ring-dashed ring-emerald-400/80 bg-emerald-950/20'
                    : 'hover:bg-slate-800/20'
                }`}
              >
                {/* Column validity badge when a card is selected */}
                {isValidColumn && (
 <div className="absolute top-1 z-30 px-1 py-0.5 rounded bg-emerald-500 text-slate-950 text-[8px] font-black uppercase tracking-wider animate-pulse ">
                    Đặt vào
                  </div>
                )}

                {/* Empty column placeholder */}
                {pile.length === 0 ? (
                  <button
                    type="button"
                    data-tableau-col={colIdx}
                    onClick={() => handleColumnAreaClick(colIdx)}
 className={`w-10 sm:w-14 h-14 sm:h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition ${
                      isValidColumn
                        ? 'border-emerald-400 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-800 text-slate-600 hover:border-indigo-500/50 hover:text-slate-400'
                    }`}
                    aria-label="Cột trống nhận quân K"
                  >
 <span className="text-xs sm:text-sm font-black">K</span>
 <span className="text-[7px] sm:text-[8px] font-bold text-slate-500">Trống</span>
                  </button>
                ) : (
                  pile.map((card, cardIdx) => {
                    const isSelected = isCardSelected('tableau', colIdx, cardIdx);
                    const isRed = SUIT_COLORS[card.suit] === 'red';
                    // Responsive stack spacing
                    const topOffset = cardIdx * (window.innerWidth < 640 ? 17 : 22);

                    return (
                      <div
                        key={card.id}
                        data-tableau-col={colIdx}
                        onClick={e => {
                          e.stopPropagation();
                          handleCardClick(colIdx, cardIdx, card);
                        }}
                        onPointerDown={e => {
                          if (card.faceUp) {
                            handlePointerDown(e, 'tableau', colIdx, cardIdx, card);
                          }
                        }}
 className={`absolute transition-transform duration-100 ${
                          isSelected ? 'z-30' : `z-[${cardIdx + 1}]`
                        }`}
                        style={{
                          top: `${topOffset}px`,
                          zIndex: isSelected ? 40 + cardIdx : cardIdx + 1,
                        }}
                      >
                        {!card.faceUp ? (
 <div className="w-10 sm:w-14 h-14 sm:h-20 rounded-xl bg-gradient-to-br from-indigo-700 to-purple-900 border border-indigo-400/40 flex items-center justify-center cursor-pointer select-none">
 <div className="w-4 sm:w-6 h-6 sm:h-9 rounded border border-indigo-400/30 bg-indigo-950/40" />
                          </div>
                        ) : (
                          <div
 className={`w-10 sm:w-14 h-14 sm:h-20 rounded-xl bg-white border-2 flex flex-col justify-between p-1 sm:p-1.5 select-none cursor-grab active:cursor-grabbing transition-all duration-150 ${
                              isRed ? 'text-rose-600' : 'text-slate-950'
                            } ${
                              isSelected
                                ? 'ring-4 ring-emerald-400 scale-105   -translate-y-1 border-emerald-500'
                                : 'border-slate-300 hover:border-indigo-400'
                            }`}
                          >
 <div className="text-[10px] sm:text-xs font-black leading-none flex items-center justify-between">
                              <span>{RANK_LABELS[card.rank]}</span>
 <span className="text-[9px] sm:text-xs">{SUIT_SYMBOLS[card.suit]}</span>
                            </div>
 <div className="text-center text-xs sm:text-lg leading-none font-black">
                              {SUIT_SYMBOLS[card.suit]}
                            </div>
 <div className="text-[9px] sm:text-[11px] font-black self-end leading-none">
                              {RANK_LABELS[card.rank]}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* Floating preview of dragged cards */}
        {dragState && dragState.isDragging && (
          <div
 className="fixed pointer-events-none z-50 transition-none"
            style={{
              left: `${dragState.currentX - 25}px`,
              top: `${dragState.currentY - 35}px`,
            }}
          >
            {dragState.cards.map((card, idx) => {
              const isRed = SUIT_COLORS[card.suit] === 'red';
              return (
                <div
                  key={`drag-${card.id}`}
 className={`w-12 h-16 rounded-xl bg-white border-2 border-emerald-400 p-1 flex flex-col justify-between select-none ${
                    isRed ? 'text-rose-600' : 'text-slate-950'
                  }`}
                  style={{
                    position: idx === 0 ? 'relative' : 'absolute',
                    top: idx === 0 ? 0 : `${idx * 18}px`,
                    transform: 'scale(1.05) rotate(2deg)',
                  }}
                >
 <div className="text-[10px] font-black leading-none flex justify-between">
                    <span>{RANK_LABELS[card.rank]}</span>
                    <span>{SUIT_SYMBOLS[card.suit]}</span>
                  </div>
 <div className="text-center text-sm font-black">
                    {SUIT_SYMBOLS[card.suit]}
                  </div>
 <div className="text-[9px] font-black self-end leading-none">
                    {RANK_LABELS[card.rank]}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Helpful instructions footer */}
 <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400 px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
 <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
 <strong className="text-slate-200">Cách chơi:</strong> Kéo thả lá bài hoặc chạm chọn rồi chạm cột đích • Nhấp đúp để tự động xếp lên cọc hoặc cột hợp lệ.
          </span>
        </div>
      </div>
    </GameShell>
  );
};

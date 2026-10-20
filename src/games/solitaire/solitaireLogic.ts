export type Suit = 'H' | 'D' | 'C' | 'S';
export type Card = { id: string; suit: Suit; rank: number; faceUp: boolean };

export type DiffKey = 'easy' | 'hard' | 'extraHard';

export function isRed(suit: Suit) {
  return suit === 'H' || suit === 'D';
}

export function rankLabel(rank: number) {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function suitGlyph(suit: Suit) {
  if (suit === 'H') return '♥';
  if (suit === 'D') return '♦';
  if (suit === 'C') return '♣';
  return '♠';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

let seq = 0;

export function newDeck(): Card[] {
  const suits: Suit[] = ['H', 'D', 'C', 'S'];
  const cards: Card[] = [];
  for (const suit of suits) {
    for (let rank = 1; rank <= 13; rank += 1) {
      seq += 1;
      cards.push({ id: `c-${seq}`, suit, rank, faceUp: false });
    }
  }
  return shuffle(cards);
}

export type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: Card[][];
  tableau: Card[][];
  recyclesLeft: number;
};

export function deal(diff: DiffKey): GameState {
  const deck = newDeck();
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let i = 0;
  for (let col = 0; col < 7; col += 1) {
    for (let n = 0; n <= col; n += 1) {
      const card = deck[i++]!;
      card.faceUp = n === col;
      tableau[col]!.push(card);
    }
  }
  const stock = deck.slice(i).map((c) => ({ ...c, faceUp: false }));
  const recycles = diff === 'easy' ? 99 : diff === 'hard' ? 2 : 1;
  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    recyclesLeft: recycles,
  };
}

export function canStackTableau(a: Card, b: Card) {
  return a.faceUp && b.faceUp && isRed(a.suit) !== isRed(b.suit) && a.rank === b.rank - 1;
}

export function canStackFoundation(card: Card, pile: Card[]) {
  if (!pile.length) return card.rank === 1;
  const top = pile[pile.length - 1]!;
  return top.suit === card.suit && card.rank === top.rank + 1;
}

export function cardsHome(state: GameState) {
  return state.foundations.reduce((n, p) => n + p.length, 0);
}

export function isWon(state: GameState) {
  return cardsHome(state) === 52;
}

export type Sel =
  | { where: 'waste' }
  | { where: 'foundation'; i: number }
  | { where: 'tableau'; col: number; index: number };

export function peekCard(state: GameState, sel: Sel): Card | null {
  if (sel.where === 'waste') return state.waste[state.waste.length - 1] ?? null;
  if (sel.where === 'foundation') {
    const p = state.foundations[sel.i]!;
    return p[p.length - 1] ?? null;
  }
  return state.tableau[sel.col]![sel.index] ?? null;
}

export function drawStock(state: GameState): GameState {
  if (state.stock.length) {
    const stock = [...state.stock];
    const card = { ...stock.pop()!, faceUp: true };
    return { ...state, stock, waste: [...state.waste, card] };
  }
  if (state.recyclesLeft <= 0 || !state.waste.length) return state;
  const recycled = state.waste.map((c) => ({ ...c, faceUp: false })).reverse();
  return {
    ...state,
    stock: recycled,
    waste: [],
    recyclesLeft: state.recyclesLeft - 1,
  };
}

/** Try move selection onto target; returns null if illegal. */
export function tryMove(state: GameState, from: Sel, to: Sel): GameState | null {
  if (from.where === 'tableau' && to.where === 'tableau' && from.col === to.col) return null;

  let moving: Card[] = [];
  if (from.where === 'waste') {
    const c = state.waste[state.waste.length - 1];
    if (!c) return null;
    moving = [c];
  } else if (from.where === 'foundation') {
    const p = state.foundations[from.i]!;
    const c = p[p.length - 1];
    if (!c) return null;
    moving = [c];
  } else {
    const col = state.tableau[from.col]!;
    if (!col[from.index]?.faceUp) return null;
    moving = col.slice(from.index);
  }

  const head = moving[0]!;

  if (to.where === 'foundation') {
    if (moving.length !== 1) return null;
    const pile = state.foundations[to.i]!;
    if (!canStackFoundation(head, pile)) return null;
  } else if (to.where === 'tableau') {
    const pile = state.tableau[to.col]!;
    if (!pile.length) {
      if (head.rank !== 13) return null;
    } else {
      const top = pile[pile.length - 1]!;
      if (!canStackTableau(head, top)) return null;
    }
  } else {
    return null;
  }

  const next: GameState = {
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: state.foundations.map((p) => [...p]),
    tableau: state.tableau.map((p) => [...p]),
    recyclesLeft: state.recyclesLeft,
  };

  if (from.where === 'waste') next.waste.pop();
  else if (from.where === 'foundation') next.foundations[from.i]!.pop();
  else {
    next.tableau[from.col] = next.tableau[from.col]!.slice(0, from.index);
    const left = next.tableau[from.col]!;
    if (left.length && !left[left.length - 1]!.faceUp) {
      left[left.length - 1] = { ...left[left.length - 1]!, faceUp: true };
    }
  }

  if (to.where === 'foundation') next.foundations[to.i]!.push(moving[0]!);
  else next.tableau[to.col]!.push(...moving);

  return next;
}

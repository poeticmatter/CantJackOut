import { type CampaignState, allocateId, findDie } from './campaign';
import {
  COLORS, type Color, type DataFace, type Die, FIREWALL_FACE, type Face, PAYDAY_FACE, colorFace, createStandardDie, replaceFace,
} from './dice';
import { PROGRAMS, type ProgramId } from './programs';

export const MAX_DICE_SOCKETS = 6;
export const MAX_PROGRAM_SLOTS = 3;
const SOCKET_PRICES: Record<number, number> = { 4: 450, 5: 1000, 6: 2000 };
const PROGRAM_SLOT_PRICES: Record<number, number> = { 2: 600, 3: 1400 };
export const SPARE_DIE_PRICE = 200;
export const OVERCLOCK_PRICE = 350;
export const ANCHOR_PRICE = 300;

/** Rarer colors cost more to flash onto a face. A dual-color face costs both its colors. */
const COLOR_PRICES: Record<Color, number> = { green: 60, blue: 120, red: 250 };
const WILD_PRICE = 600;
const FIREWALL_PRICE = 350;
const PAYDAY_PRICE = 200;

/** What a face can be reflashed into at the dice maker's bench. */
export type FaceDesign =
  | { readonly kind: 'single'; readonly color: Color }
  | { readonly kind: 'dual'; readonly colors: readonly [Color, Color] }
  | { readonly kind: 'wild' }
  | { readonly kind: 'firewall' }
  | { readonly kind: 'payday' };

export const FACE_DESIGNS: readonly FaceDesign[] = [
  ...COLORS.map((color): FaceDesign => ({ kind: 'single', color })),
  { kind: 'dual', colors: ['red', 'blue'] },
  { kind: 'dual', colors: ['red', 'green'] },
  { kind: 'dual', colors: ['blue', 'green'] },
  { kind: 'wild' },
  { kind: 'firewall' },
  { kind: 'payday' },
];

export function designPrice(design: FaceDesign): number {
  switch (design.kind) {
    case 'single': return COLOR_PRICES[design.color];
    case 'dual': return COLOR_PRICES[design.colors[0]] + COLOR_PRICES[design.colors[1]];
    case 'wild': return WILD_PRICE;
    case 'firewall': return FIREWALL_PRICE;
    case 'payday': return PAYDAY_PRICE;
  }
}

function designColors(design: FaceDesign): readonly Color[] | null {
  switch (design.kind) {
    case 'single': return [design.color];
    case 'dual': return design.colors;
    case 'wild': return COLORS;
    default: return null;
  }
}

/** The face a design produces. A data face keeps its overclock and anchor when it changes color. */
export function faceFromDesign(design: FaceDesign, previous: Face): Face {
  if (design.kind === 'firewall') return FIREWALL_FACE;
  if (design.kind === 'payday') return PAYDAY_FACE;
  const colors = designColors(design) ?? [];
  const recolored = colorFace(...colors);
  return previous.kind === 'data' ? { ...recolored, boost: previous.boost, isAnchored: previous.isAnchored } : recolored;
}

export function isFaceOfDesign(face: Face, design: FaceDesign): boolean {
  if (face.kind !== 'data') return face.kind === design.kind;
  const colors = designColors(design);
  return colors !== null && colors.length === face.colors.length && colors.every((color) => face.colors.includes(color));
}

export function canShop(state: CampaignState): boolean {
  return state.phase === 'net';
}

function pay(state: CampaignState, price: number, item: string): CampaignState {
  if (!canShop(state)) throw new Error('The market is only open between runs');
  if (state.money < price) throw new Error(`${item} costs $${price}; you have $${state.money}`);
  return { ...state, money: state.money - price };
}

export function nextSocketPrice(state: CampaignState): number | null {
  return SOCKET_PRICES[state.diceSockets + 1] ?? null;
}

export function nextProgramSlotPrice(state: CampaignState): number | null {
  return PROGRAM_SLOT_PRICES[state.programSlots + 1] ?? null;
}

/** A new socket comes with a standard die already seated in it. */
export function buySocket(state: CampaignState): CampaignState {
  const price = nextSocketPrice(state);
  if (price === null) throw new Error('Your deck already has every socket it can hold');
  const [id, paid] = allocateId(pay(state, price, 'A dice socket'), 'die');
  const hasFreeSocket = paid.loadout.diceIds.length <= paid.diceSockets;
  return {
    ...paid,
    diceSockets: paid.diceSockets + 1,
    dice: [...paid.dice, createStandardDie(id)],
    loadout: hasFreeSocket ? { ...paid.loadout, diceIds: [...paid.loadout.diceIds, id] } : paid.loadout,
  };
}

export function buyProgramSlot(state: CampaignState): CampaignState {
  const price = nextProgramSlotPrice(state);
  if (price === null) throw new Error('Your deck already runs as many programs as it can');
  return { ...pay(state, price, 'A program slot'), programSlots: state.programSlots + 1 };
}

export function buySpareDie(state: CampaignState): CampaignState {
  const [id, paid] = allocateId(pay(state, SPARE_DIE_PRICE, 'A spare die'), 'die');
  return { ...paid, dice: [...paid.dice, createStandardDie(id)] };
}

export function buyProgram(state: CampaignState, program: ProgramId): CampaignState {
  if (state.ownedPrograms.includes(program)) throw new Error(`You already own ${PROGRAMS[program].name}`);
  const paid = pay(state, PROGRAMS[program].price, PROGRAMS[program].name);
  const hasFreeSlot = paid.loadout.programIds.length < paid.programSlots;
  return {
    ...paid,
    ownedPrograms: [...paid.ownedPrograms, program],
    loadout: hasFreeSlot ? { ...paid.loadout, programIds: [...paid.loadout.programIds, program] } : paid.loadout,
  };
}

function updateDie(state: CampaignState, dieId: string, update: (die: Die) => Die): CampaignState {
  return { ...state, dice: state.dice.map((die) => (die.id === dieId ? update(die) : die)) };
}

export function flashFace(state: CampaignState, dieId: string, faceIndex: number, design: FaceDesign): CampaignState {
  const face = findDie(state, dieId).faces[faceIndex];
  if (isFaceOfDesign(face, design)) throw new Error('That face is already flashed that way');
  const paid = pay(state, designPrice(design), 'Flashing a face');
  return updateDie(paid, dieId, (die) => replaceFace(die, faceIndex, faceFromDesign(design, face)));
}

function dataFaceAt(state: CampaignState, dieId: string, faceIndex: number, upgrade: string): DataFace {
  const face = findDie(state, dieId).faces[faceIndex];
  if (face.kind !== 'data') throw new Error(`Only a face that downloads data can be ${upgrade}`);
  return face;
}

export function overclockFace(state: CampaignState, dieId: string, faceIndex: number): CampaignState {
  const face = dataFaceAt(state, dieId, faceIndex, 'overclocked');
  if (face.boost === 2) throw new Error('That face is already overclocked');
  const paid = pay(state, OVERCLOCK_PRICE, 'Overclocking a face');
  return updateDie(paid, dieId, (die) => replaceFace(die, faceIndex, { ...face, boost: 2 }));
}

export function anchorFace(state: CampaignState, dieId: string, faceIndex: number): CampaignState {
  const face = dataFaceAt(state, dieId, faceIndex, 'anchored');
  if (face.isAnchored) throw new Error('That face is already anchored');
  const paid = pay(state, ANCHOR_PRICE, 'Anchoring a face');
  return updateDie(paid, dieId, (die) => replaceFace(die, faceIndex, { ...face, isAnchored: true }));
}

export function toggleDieInLoadout(state: CampaignState, dieId: string): CampaignState {
  findDie(state, dieId);
  const { diceIds } = state.loadout;
  if (diceIds.includes(dieId)) {
    return { ...state, loadout: { ...state.loadout, diceIds: diceIds.filter((id) => id !== dieId) } };
  }
  if (diceIds.length >= state.diceSockets) throw new Error('Every dice socket is full. Pull a die out first.');
  return { ...state, loadout: { ...state.loadout, diceIds: [...diceIds, dieId] } };
}

export function toggleProgramInLoadout(state: CampaignState, program: ProgramId): CampaignState {
  if (!state.ownedPrograms.includes(program)) throw new Error(`You don't own ${PROGRAMS[program].name}`);
  const { programIds } = state.loadout;
  if (programIds.includes(program)) {
    return { ...state, loadout: { ...state.loadout, programIds: programIds.filter((id) => id !== program) } };
  }
  if (programIds.length >= state.programSlots) throw new Error('Every program slot is full. Unload one first.');
  return { ...state, loadout: { ...state.loadout, programIds: [...programIds, program] } };
}

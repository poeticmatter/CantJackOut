import { type CampaignState, allocateId, findDie } from './campaign';
import { type Die, type FaceColor, createStandardDie, replaceFace } from './dice';
import { PROGRAMS, type ProgramId } from './programs';

export const MAX_DICE_SOCKETS = 6;
export const MAX_PROGRAM_SLOTS = 3;
const SOCKET_PRICES: Record<number, number> = { 4: 450, 5: 1000, 6: 2000 };
const PROGRAM_SLOT_PRICES: Record<number, number> = { 2: 600, 3: 1400 };
export const SPARE_DIE_PRICE = 200;
export const OVERCLOCK_PRICE = 350;

/** Rarer colors cost more to flash onto a face; a wild face matches anything. */
export const RECOLOR_PRICES: Record<FaceColor, number> = { green: 60, blue: 120, red: 250, wild: 600 };

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

export function recolorFace(state: CampaignState, dieId: string, faceIndex: number, color: FaceColor): CampaignState {
  const face = findDie(state, dieId).faces[faceIndex];
  if (face.color === color) throw new Error('That face is already that color');
  const paid = pay(state, RECOLOR_PRICES[color], 'Flashing a face');
  return updateDie(paid, dieId, (die) => replaceFace(die, faceIndex, { ...face, color }));
}

export function overclockFace(state: CampaignState, dieId: string, faceIndex: number): CampaignState {
  const face = findDie(state, dieId).faces[faceIndex];
  if (face.boost === 2) throw new Error('That face is already overclocked');
  const paid = pay(state, OVERCLOCK_PRICE, 'Overclocking a face');
  return updateDie(paid, dieId, (die) => replaceFace(die, faceIndex, { ...face, boost: 2 }));
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

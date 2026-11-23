import type { CampaignState } from './campaign';
import { PROGRAMS, type ProgramId } from './programs';

/** The dice-pairing experiment sells no dice: Moth's back room only has programs and slots. */
export const MAX_PROGRAM_SLOTS = 3;
const PROGRAM_SLOT_PRICES: Record<number, number> = { 2: 600, 3: 1400 };

export function canShop(state: CampaignState): boolean {
  return state.phase === 'net';
}

function pay(state: CampaignState, price: number, item: string): CampaignState {
  if (!canShop(state)) throw new Error('The market is only open between runs');
  if (state.money < price) throw new Error(`${item} costs $${price}; you have $${state.money}`);
  return { ...state, money: state.money - price };
}

export function nextProgramSlotPrice(state: CampaignState): number | null {
  return PROGRAM_SLOT_PRICES[state.programSlots + 1] ?? null;
}

export function buyProgramSlot(state: CampaignState): CampaignState {
  const price = nextProgramSlotPrice(state);
  if (price === null) throw new Error('Your deck already runs as many programs as it can');
  return { ...pay(state, price, 'A program slot'), programSlots: state.programSlots + 1 };
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

export function toggleProgramInLoadout(state: CampaignState, program: ProgramId): CampaignState {
  if (!state.ownedPrograms.includes(program)) throw new Error(`You don't own ${PROGRAMS[program].name}`);
  const { programIds } = state.loadout;
  if (programIds.includes(program)) {
    return { ...state, loadout: { ...state.loadout, programIds: programIds.filter((id) => id !== program) } };
  }
  if (programIds.length >= state.programSlots) throw new Error('Every program slot is full. Unload one first.');
  return { ...state, loadout: { ...state.loadout, programIds: [...programIds, program] } };
}

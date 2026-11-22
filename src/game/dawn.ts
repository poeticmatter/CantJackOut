import { replaceWithFreshServer } from './actions';
import { BOARD_SIZE } from './board';
import { type CampaignState, FINAL_NIGHT, MAX_STRIKES, fullCharges, vigForNight, withRng } from './campaign';
import { hasBankedProgress } from './server';

/** Untouched servers drift off the net overnight, making room for harder targets. */
const UNTOUCHED_SERVER_REPLACE_CHANCE = 0.5;

export interface DawnOutcome {
  readonly vig: number;
  readonly isPaid: boolean;
  readonly isFinalNight: boolean;
}

export function previewDawn(state: CampaignState): DawnOutcome {
  const vig = vigForNight(state.night);
  return { vig, isPaid: state.money >= vig, isFinalNight: state.night >= FINAL_NIGHT };
}

/**
 * Vesna collects. Paying in full keeps you in good standing; coming up short means she
 * takes everything you have and marks a strike. Three strikes and she takes the deck.
 */
export function settleDawn(state: CampaignState): CampaignState {
  if (state.phase !== 'dawn') throw new Error('Vesna only collects at dawn');
  const { vig, isPaid, isFinalNight } = previewDawn(state);
  const strikes = state.strikes + (isPaid ? 0 : 1);
  const money = isPaid ? state.money - vig : 0;
  if (strikes >= MAX_STRIKES || (isFinalNight && !isPaid)) return { ...state, money, strikes, phase: 'lost' };
  if (isFinalNight) return { ...state, money, strikes, phase: 'won' };
  return startNextNight({ ...state, money, strikes });
}

function startNextNight(state: CampaignState): CampaignState {
  const nextNight: CampaignState = { ...state, night: state.night + 1, minutes: 0, phase: 'net', charges: fullCharges() };
  return withRng(nextNight, (rng) => {
    let refreshed = nextNight;
    for (const server of nextNight.board.slice(0, BOARD_SIZE)) {
      if (!hasBankedProgress(server) && rng.next() < UNTOUCHED_SERVER_REPLACE_CHANCE) {
        refreshed = replaceWithFreshServer(refreshed, server.id, rng);
      }
    }
    return refreshed;
  });
}

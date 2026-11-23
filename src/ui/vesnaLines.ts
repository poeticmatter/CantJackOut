import { type CampaignState, FINAL_NIGHT, MAX_STRIKES, vigForNight } from '../game/campaign';
import { previewDawn } from '../game/dawn';
import { money } from './dom';

/** One line of colour per night, so the calls don't repeat. Night 1 is the introduction. */
const NIGHT_COLOUR: Record<number, string> = {
  2: 'Still breathing. Good. The deck likes you.',
  3: 'Word is the red vaults are opening up. They pay well. They also bite.',
  4: 'Don’t camp on one server. Sysadmins notice the same face twice.',
  5: 'Halfway. I’m starting to like your odds. Don’t make me stop.',
  6: 'Rates went up. So did mine.',
  7: 'Spend on the deck, not on luck. Luck doesn’t take payments.',
  8: 'You’re good. Be better.',
  9: 'Second to last. Don’t flinch now.',
  10: 'Last night. Pay this one and we never speak again.',
};

function strikeWarning(strikes: number): string | null {
  if (strikes === 0) return null;
  const left = MAX_STRIKES - strikes;
  return left === 1 ? 'One more short payment and the deck comes home to me.' : `You’re carrying ${strikes} strike. I stop at ${MAX_STRIKES}.`;
}

export function nightBriefing(state: CampaignState): string[] {
  const cut = money(vigForNight(state.night));
  if (state.night === 1) {
    return [
      'You owe me for that deck. Ten nights.',
      `Every dawn I take my cut. Tonight it’s ${cut}.`,
      'Pull data, sell it, pay me. Come up short three times and I take the deck back.',
    ];
  }
  return [`Night ${state.night}. ${cut} at dawn.`, NIGHT_COLOUR[state.night] ?? 'You know the drill.', strikeWarning(state.strikes)]
    .filter((line): line is string => line !== null);
}

export function dawnLines(state: CampaignState): string[] {
  const { vig, isPaid, isFinalNight } = previewDawn(state);
  const opener = `Sun’s up. ${money(vig)}.`;
  if (isPaid && isFinalNight) return [opener, `You’ve got ${money(state.money)}.`, 'Pay me and the deck is yours. Free and clear.'];
  if (isPaid) return [opener, `You’ve got ${money(state.money)}. I’ll take mine.`];
  if (isFinalNight) return [opener, `You’ve got ${money(state.money)}. That’s short, on the last night.`, 'The deck is mine.'];
  const strike = state.strikes + 1;
  const verdict = strike >= MAX_STRIKES ? 'That’s three. The deck is mine.' : `That’s strike ${strike} of ${MAX_STRIKES}.`;
  return [opener, `You’ve got ${money(state.money)}. I’ll take all of it.`, verdict];
}

export function isFinalNight(state: CampaignState): boolean {
  return state.night >= FINAL_NIGHT;
}

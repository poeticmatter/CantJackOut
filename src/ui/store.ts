import { type CampaignState, newCampaign } from '../game/campaign';
import { showToast } from './toast';

const SAVE_KEY = 'cant-jack-out:save';
/** Version 3: the dice-pairing experiment (six files per server, streams) changed the shape of a save. */
const SAVE_VERSION = 3;

interface SaveFile {
  readonly version: number;
  readonly state: CampaignState;
}

export type Transition = (state: CampaignState) => CampaignState;
type Listener = (state: CampaignState, previous: CampaignState) => void;

function isSaveFile(value: unknown): value is SaveFile {
  if (typeof value !== 'object' || value === null) return false;
  return 'version' in value && value.version === SAVE_VERSION && 'state' in value;
}

function loadSave(): CampaignState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isSaveFile(parsed) ? parsed.state : null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.error('Discarding an unreadable save file', error);
    return null;
  }
}

function persist(state: CampaignState): void {
  const save: SaveFile = { version: SAVE_VERSION, state };
  localStorage.setItem(SAVE_KEY, JSON.stringify(save));
}

function freshSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export interface Store {
  readonly current: () => CampaignState;
  /** Applies a game transition. Rule violations surface as a toast and leave state unchanged. */
  readonly apply: (transition: Transition) => boolean;
  readonly subscribe: (listener: Listener) => void;
  readonly startNewGame: () => void;
  readonly hasSavedGame: boolean;
}

export function createStore(): Store {
  const saved = loadSave();
  let state = saved ?? newCampaign(freshSeed());
  const listeners: Listener[] = [];

  const commit = (next: CampaignState) => {
    const previous = state;
    state = next;
    persist(state);
    for (const listener of listeners) listener(state, previous);
  };

  return {
    current: () => state,
    apply: (transition) => {
      try {
        commit(transition(state));
        return true;
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        console.error('Action rejected', error);
        showToast(error.message);
        return false;
      }
    },
    subscribe: (listener) => listeners.push(listener),
    startNewGame: () => commit(newCampaign(freshSeed())),
    hasSavedGame: saved !== null,
  };
}

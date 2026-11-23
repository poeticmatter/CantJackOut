export type ProgramId = 'bounce' | 'failsafe' | 'proxy' | 'deepScan';

export interface ProgramDefinition {
  readonly id: ProgramId;
  readonly name: string;
  readonly summary: string;
  readonly chargesPerNight: number;
  readonly price: number;
}

export const PROGRAMS: Record<ProgramId, ProgramDefinition> = {
  bounce: {
    id: 'bounce',
    name: 'Bounce',
    summary: 'When a roll misses, reroll every die instead of getting jacked out.',
    chargesPerNight: 1,
    price: 500,
  },
  failsafe: {
    id: 'failsafe',
    name: 'Failsafe',
    summary: 'When a roll misses, keep half of this run’s unbanked download.',
    chargesPerNight: 2,
    price: 350,
  },
  proxy: {
    id: 'proxy',
    name: 'Proxy chain',
    summary: 'Halves the time a run costs. Choose it before you jack in.',
    chargesPerNight: 2,
    price: 450,
  },
  deepScan: {
    id: 'deepScan',
    name: 'Deep scan',
    summary: 'Reveal a server’s files and security without spending time.',
    chargesPerNight: 3,
    price: 200,
  },
};

export const PROGRAM_IDS = Object.keys(PROGRAMS) as ProgramId[];

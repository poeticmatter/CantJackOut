import { describe, expect, it } from 'vitest';
import { bankAndJackOut, jackIn, reroutePrice, rerouteRun, waitForDawn } from './actions';
import { type CampaignState, MAX_STRIKES, findServer, newCampaign, vigForNight } from './campaign';
import { settleDawn } from './dawn';
import { buyProgram, buyProgramSlot } from './shop';

const fresh = (): CampaignState => newCampaign(42);

describe('dawn', () => {
  it('takes the vig and starts the next night when you can pay', () => {
    const state = waitForDawn({ ...fresh(), money: 1000 });
    const next = settleDawn(state);
    expect([next.night, next.money, next.strikes]).toEqual([2, 1000 - vigForNight(1), 0]);
  });

  it('takes everything and adds a strike when you come up short', () => {
    const state = waitForDawn({ ...fresh(), money: 20 });
    const next = settleDawn(state);
    expect([next.money, next.strikes]).toEqual([0, 1]);
  });

  it('ends the game on the last strike', () => {
    const state = waitForDawn({ ...fresh(), money: 0, strikes: MAX_STRIKES - 1 });
    expect(settleDawn(state).phase).toBe('lost');
  });
});

describe('jacking in', () => {
  it('reveals the server you connect to', () => {
    const state = fresh();
    const target = state.board[0];
    const connected = jackIn(state, target.id, false);
    expect(connected.board[0].isRevealed).toBe(true);
  });
});

describe('rerouting', () => {
  it('charges the reroute price for the server', () => {
    const start = { ...fresh(), money: 500 };
    const connected = jackIn(start, start.board[0].id, false);
    if (connected.run === null) throw new Error('Jacking in should start a run');
    const afterHit = { ...connected, run: { ...connected.run, buffer: connected.run.buffer.map((steps) => steps + 1), status: 'hit' as const } };
    const rerouted = rerouteRun(afterHit);
    expect(afterHit.money - rerouted.money).toBe(reroutePrice(findServer(afterHit, connected.run.serverId)));
  });
});

describe('selling files', () => {
  it('pays for each file a run finishes', () => {
    const connected = jackIn(fresh(), fresh().board[0].id, false);
    if (connected.run === null) throw new Error('Jacking in should start a run');
    const rr = connected.board[0].files[0];
    const buffer = connected.run.buffer.map((steps, index) => (index === 0 ? rr.length : steps));
    const done = bankAndJackOut({ ...connected, run: { ...connected.run, buffer, status: 'hit' } });
    expect(done.money - connected.money).toBe(rr.payout);
  });

  it('pays nothing for a file left unfinished', () => {
    const connected = jackIn(fresh(), fresh().board[0].id, false);
    if (connected.run === null) throw new Error('Jacking in should start a run');
    const buffer = connected.run.buffer.map((steps, index) => (index === 5 ? 1 : steps));
    expect(bankAndJackOut({ ...connected, run: { ...connected.run, buffer, status: 'hit' } }).money).toBe(connected.money);
  });
});

describe('shop', () => {
  it('loads a bought program into a free slot', () => {
    expect(buyProgram({ ...fresh(), money: 1000 }, 'bounce').loadout.programIds).toEqual(['bounce']);
  });

  it('refuses a purchase you cannot afford', () => {
    expect(() => buyProgramSlot({ ...fresh(), money: 10 })).toThrow(/costs/);
  });
});

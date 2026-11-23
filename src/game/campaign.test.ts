import { describe, expect, it } from 'vitest';
import { jackIn, reroutePrice, rerouteRun, waitForDawn } from './actions';
import { type CampaignState, MAX_STRIKES, findServer, newCampaign, vigForNight } from './campaign';
import { settleDawn } from './dawn';
import { colorFace } from './dice';
import { anchorFace, buySocket, buySpareDie, flashFace, toggleDieInLoadout } from './shop';

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

describe('shop and loadout', () => {
  it('seats a standard die in a newly bought socket', () => {
    const next = buySocket({ ...fresh(), money: 1000 });
    expect([next.diceSockets, next.loadout.diceIds.length]).toEqual([4, 4]);
  });

  it('refuses a purchase you cannot afford', () => {
    expect(() => buySocket({ ...fresh(), money: 10 })).toThrow(/costs/);
  });

  it('flashes a face to a new color', () => {
    const state = { ...fresh(), money: 1000 };
    const next = flashFace(state, state.dice[0].id, 5, { kind: 'single', color: 'red' });
    expect(next.dice[0].faces[5]).toEqual(colorFace('red'));
  });

  it('charges a dual-color face the price of both its colors', () => {
    const state = { ...fresh(), money: 1000 };
    const next = flashFace(state, state.dice[0].id, 5, { kind: 'dual', colors: ['red', 'blue'] });
    expect(state.money - next.money).toBe(370);
  });

  it('keeps an anchor when the face changes color', () => {
    const state = anchorFace({ ...fresh(), money: 1000 }, fresh().dice[0].id, 5);
    const next = flashFace(state, state.dice[0].id, 5, { kind: 'single', color: 'red' });
    expect(next.dice[0].faces[5]).toEqual({ ...colorFace('red'), isAnchored: true });
  });

  it('refuses to anchor a face that never downloads', () => {
    const state = flashFace({ ...fresh(), money: 1000 }, fresh().dice[0].id, 5, { kind: 'payday' });
    expect(() => anchorFace(state, state.dice[0].id, 5)).toThrow(/downloads data/);
  });

  it('refuses to seat more dice than the deck has sockets', () => {
    const withSpare = buySpareDie({ ...fresh(), money: 1000 });
    const spareId = withSpare.dice[withSpare.dice.length - 1].id;
    expect(() => toggleDieInLoadout(withSpare, spareId)).toThrow(/socket is full/);
  });
});

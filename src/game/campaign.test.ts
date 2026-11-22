import { describe, expect, it } from 'vitest';
import { jackIn, waitForDawn } from './actions';
import { type CampaignState, MAX_STRIKES, newCampaign, vigForNight } from './campaign';
import { settleDawn } from './dawn';
import { buySocket, buySpareDie, recolorFace, toggleDieInLoadout } from './shop';

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
    const dieId = state.dice[0].id;
    const next = recolorFace(state, dieId, 5, 'red');
    expect(next.dice[0].faces[5].color).toBe('red');
  });

  it('refuses to seat more dice than the deck has sockets', () => {
    const withSpare = buySpareDie({ ...fresh(), money: 1000 });
    const spareId = withSpare.dice[withSpare.dice.length - 1].id;
    expect(() => toggleDieInLoadout(withSpare, spareId)).toThrow(/socket is full/);
  });
});

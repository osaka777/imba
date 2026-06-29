import {
  detectTennisPointWinner,
  formatTennisGameScoreDisplay,
  inferTennisGameClosingPointWinner,
  isTennisGameStartScore,
  parseTennisGameScore,
  tennisGameScoreHadDeuce,
} from './tennis-game-score.util';

describe('tennisGameScoreHadDeuce', () => {
  it('detects 40:40', () => {
    expect(tennisGameScoreHadDeuce('40:40')).toBe(true);
  });

  it('detects advantage as proof of deuce', () => {
    expect(tennisGameScoreHadDeuce('40:50')).toBe(true);
    expect(tennisGameScoreHadDeuce('50:40')).toBe(true);
    expect(tennisGameScoreHadDeuce('40:A')).toBe(true);
  });

  it('returns false for pre-deuce scores', () => {
    expect(tennisGameScoreHadDeuce('40:30')).toBe(false);
    expect(tennisGameScoreHadDeuce('40:0')).toBe(false);
  });

  it('parses server marker asterisks', () => {
    expect(parseTennisGameScore('40*:30')).toEqual({ home: 40, away: 30 });
  });
});

describe('detectTennisPointWinner', () => {
  it('detects home point from 0:0 to 15:0', () => {
    expect(detectTennisPointWinner('0:0', '15:0')).toBe('home');
  });

  it('detects away point from 30:15 to 30:30', () => {
    expect(detectTennisPointWinner('30:15', '30:30')).toBe('away');
  });

  it('detects deuce cycle advantage loss', () => {
    expect(detectTennisPointWinner('50:40', '40:40')).toBe('away');
  });

  it('detects game-winning point when feed resets to 0:0', () => {
    expect(detectTennisPointWinner('40:15', '0:0')).toBe('home');
  });
});

describe('inferTennisGameClosingPointWinner', () => {
  it('infers from 40:30', () => {
    expect(inferTennisGameClosingPointWinner({ home: 40, away: 30 })).toBe('home');
  });

  it('infers from advantage', () => {
    expect(inferTennisGameClosingPointWinner({ home: 50, away: 40 })).toBe('home');
  });
});

describe('formatTennisGameScoreDisplay', () => {
  it('formats standard and advantage scores', () => {
    expect(formatTennisGameScoreDisplay('40:15')).toBe('40:15');
    expect(formatTennisGameScoreDisplay('40:50')).toBe('40:A');
    expect(formatTennisGameScoreDisplay('50:40')).toBe('A:40');
  });
});

describe('isTennisGameStartScore', () => {
  it('recognizes 0:0', () => {
    expect(isTennisGameStartScore('0:0')).toBe(true);
    expect(isTennisGameStartScore('15:0')).toBe(false);
  });
});

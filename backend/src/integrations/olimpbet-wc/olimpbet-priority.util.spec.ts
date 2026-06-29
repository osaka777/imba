import {
  OLIMP_TAG_SUPER_TOP,
  OLIMP_TAG_TOP,
  resolveOlimpbetPriorityLevel,
} from './olimpbet-priority.util';

describe('resolveOlimpbetPriorityLevel', () => {
  it('returns 2 for SuperTop on event or tournament', () => {
    expect(resolveOlimpbetPriorityLevel([OLIMP_TAG_SUPER_TOP], [])).toBe(2);
    expect(resolveOlimpbetPriorityLevel([], [OLIMP_TAG_SUPER_TOP])).toBe(2);
  });

  it('returns 1 for TOP when SuperTop is absent', () => {
    expect(resolveOlimpbetPriorityLevel([OLIMP_TAG_TOP], [])).toBe(1);
    expect(resolveOlimpbetPriorityLevel([], [OLIMP_TAG_TOP])).toBe(1);
  });

  it('prefers SuperTop over TOP', () => {
    expect(resolveOlimpbetPriorityLevel([OLIMP_TAG_TOP], [OLIMP_TAG_SUPER_TOP])).toBe(2);
  });

  it('returns 0 when no priority tags', () => {
    expect(resolveOlimpbetPriorityLevel([], [])).toBe(0);
    expect(resolveOlimpbetPriorityLevel([35], [35])).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { clamp } from './index';

describe('clamp', () => {
  it('clamps value into range', () => {
    expect(clamp(12, 0, 10)).toBe(10);
  });
});

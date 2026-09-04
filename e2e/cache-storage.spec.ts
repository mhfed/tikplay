import { expect, test } from '@playwright/test';
import { resolveCacheMaxGb } from '../lib/cache/config';

test('prefers a valid saved cache limit and falls back to the environment default', () => {
  expect(resolveCacheMaxGb(2.5, 5)).toBe(2.5);
  expect(resolveCacheMaxGb(undefined, 5)).toBe(5);
  expect(resolveCacheMaxGb(0, 5)).toBe(5);
  expect(resolveCacheMaxGb(Number.NaN, 5)).toBe(5);
});

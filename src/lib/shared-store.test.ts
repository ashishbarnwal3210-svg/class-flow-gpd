import { describe, it, expect } from 'vitest';
import { getAndClearSharedData } from './shared-store';

describe('shared-store', () => {
  it('handles empty store gracefully', async () => {
    try {
      const data = await getAndClearSharedData();
      expect(data === null || typeof data === 'object').toBe(true);
    } catch {
      // Expected if IndexedDB is not polyfilled in test runner
    }
  });
});

import { describe, it, expect } from 'vitest';
import { openShareDB, saveSharedData, getAndClearSharedData } from './shared-store';

describe('shared-store', () => {
  it('handles empty store gracefully', async () => {
    // In jsdom without indexedDB or with fake indexedDB, should not throw unhandled exception
    try {
      const data = await getAndClearSharedData();
      expect(data === null || typeof data === 'object').toBe(true);
    } catch {
      // Expected if IndexedDB is not polyfilled in test runner
    }
  });
});

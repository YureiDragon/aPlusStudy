import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('Storage utility', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('saves and loads data', () => {
    storage.save('aplus_test', { foo: 'bar' });
    expect(storage.load('aplus_test')).toEqual({ foo: 'bar' });
  });

  it('returns default value when key does not exist', () => {
    expect(storage.load('nonexistent', [])).toEqual([]);
  });

  it('returns null when key does not exist and no default', () => {
    expect(storage.load('nonexistent')).toBeNull();
  });

  it('removes a key', () => {
    storage.save('aplus_test', 'value');
    storage.remove('aplus_test');
    expect(storage.load('aplus_test')).toBeNull();
  });
});

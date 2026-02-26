import { storage, STORAGE_KEYS } from './storage.ts';

const SYNC_PREFIX = 'aPS_';

const SYNC_KEYS = [
  STORAGE_KEYS.PROGRESS,
  STORAGE_KEYS.QUIZ_HISTORY,
  STORAGE_KEYS.FLASHCARD_SCHEDULE,
  STORAGE_KEYS.STREAK,
  STORAGE_KEYS.EXAM_RESULTS,
] as const;

export async function generateSyncCode(): Promise<string> {
  const data: Record<string, unknown> = {};
  for (const key of SYNC_KEYS) {
    const value = storage.load(key);
    if (value !== null) {
      data[key] = value;
    }
  }

  const json = JSON.stringify(data);
  const encoded = new TextEncoder().encode(json);

  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(encoded);
  writer.close();

  const compressed = await new Response(cs.readable).arrayBuffer();
  const bytes = new Uint8Array(compressed);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return SYNC_PREFIX + base64;
}

export async function restoreSyncCode(code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith(SYNC_PREFIX)) {
      return { success: false, error: 'Invalid sync code. Must start with "aPS_".' };
    }

    const base64 = trimmed.slice(SYNC_PREFIX.length);

    let binary: string;
    try {
      binary = atob(base64);
    } catch {
      return { success: false, error: 'Invalid sync code. Could not decode.' };
    }

    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();

    const decompressed = await new Response(ds.readable).arrayBuffer();
    const json = new TextDecoder().decode(decompressed);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(json);
    } catch {
      return { success: false, error: 'Invalid sync code. Could not parse data.' };
    }

    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Invalid sync code. Unexpected data format.' };
    }

    const validKeys = new Set<string>(SYNC_KEYS);
    const restoredKeys = Object.keys(data).filter(k => validKeys.has(k));
    if (restoredKeys.length === 0) {
      return { success: false, error: 'Invalid sync code. No recognizable data found.' };
    }

    for (const key of restoredKeys) {
      storage.save(key, data[key]);
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Failed to restore sync code. The code may be corrupted.' };
  }
}

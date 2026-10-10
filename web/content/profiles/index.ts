import type { DynastyProfile } from './types';
import { SONG_W } from './song-w';

/** 所有朝代档案（逐步补齐）*/
export const PROFILES: Record<string, DynastyProfile> = {
  'song-w': SONG_W,
};

export function getProfile(id: string): DynastyProfile | undefined {
  return PROFILES[id];
}

export type { DynastyProfile } from './types';

import type { DynastyProfile } from './types';
import { SONG_W } from './song-w';
import { QIN } from './qin';
import { HAN_W } from './han-w';
import { HAN_E } from './han-e';
import { TANG } from './tang';
import { MING } from './ming';
import { QING } from './qing';

/** 所有朝代档案（逐步补齐）*/
export const PROFILES: Record<string, DynastyProfile> = {
  qin: QIN,
  'han-w': HAN_W,
  'han-e': HAN_E,
  tang: TANG,
  'song-w': SONG_W,
  ming: MING,
  qing: QING,
};

export function getProfile(id: string): DynastyProfile | undefined {
  return PROFILES[id];
}

export type { DynastyProfile } from './types';

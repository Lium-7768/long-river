import type { DynastyProfile } from './types';

// 远古 / 先秦
import { XIA } from './xia';
import { SHANG } from './shang';
import { ZHOU_W } from './zhou-w';
import { ZHOU_E } from './zhou-e';
// 秦汉
import { QIN } from './qin';
import { HAN_W } from './han-w';
import { XIN } from './xin';
import { HAN_E } from './han-e';
// 魏晋南北朝
import { SANGUO } from './sanguo';
import { JIN } from './jin';
import { NANBEI } from './nanbei';
// 隋唐
import { SUI } from './sui';
import { TANG } from './tang';
import { WUDAI } from './wudai';
// 宋辽金夏
import { SONG_W } from './song-w';
import { SONG_E } from './song-e';
import { LIAO } from './liao';
import { JIN_CHAO } from './jin-chao';
import { XIXIA } from './xixia';
// 元明清
import { YUAN } from './yuan';
import { MING } from './ming';
import { QING } from './qing';

/** 所有朝代档案 */
export const PROFILES: Record<string, DynastyProfile> = {
  xia: XIA,
  shang: SHANG,
  'zhou-w': ZHOU_W,
  'zhou-e': ZHOU_E,
  qin: QIN,
  'han-w': HAN_W,
  xin: XIN,
  'han-e': HAN_E,
  sanguo: SANGUO,
  jin: JIN,
  nanbei: NANBEI,
  sui: SUI,
  tang: TANG,
  wudai: WUDAI,
  'song-w': SONG_W,
  'song-e': SONG_E,
  liao: LIAO,
  'jin-chao': JIN_CHAO,
  xixia: XIXIA,
  yuan: YUAN,
  ming: MING,
  qing: QING,
};

export function getProfile(id: string): DynastyProfile | undefined {
  return PROFILES[id];
}

export type { DynastyProfile } from './types';

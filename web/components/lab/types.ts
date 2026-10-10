import type { DYNASTIES } from '@/content/dynasties';

export type Dynasty = (typeof DYNASTIES)[number];
export type SelectHandler = (d: Dynasty) => void;

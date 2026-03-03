export const BURNOUT_LEVELS = {
  1: { zh: "还行", en: "Surviving" },
  2: { zh: "有点废", en: "Meh" },
  3: { zh: "很废", en: "Burned" },
  4: { zh: "彻底废了", en: "Fried" },
  5: { zh: "已灭", en: "Gone" },
} as const;

export type BurnoutLevel = keyof typeof BURNOUT_LEVELS;

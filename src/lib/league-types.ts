export type Gender = "M" | "F" | "U"; // 남, 여, 미지정

export type Student = {
  id: string;
  grade: number; // 1-6
  classNum: number; // 1-10
  number: number; // 출석번호
  name: string;
  gender: Gender;
  rp: number;
  recent: ("W" | "L")[]; // most recent first, max 5
  wins: number;
  losses: number;
  demotionShields?: number; // 횟수제 강등 보호막 (기본값 0)
  lastMatchDate?: string;   // 마지막으로 경기를 치른 날짜 (ISO 8601 형식)
};

export type Match = {
  id: string;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  date: string;
  rpDeltaA?: number;
  rpDeltaB?: number;
};

export type TierName = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function getTier(rp: number, thresholds?: Record<TierName, number>): TierName {
  const t = thresholds || { Bronze: 0, Silver: 1000, Gold: 1200, Platinum: 1400, Diamond: 1600 };
  if (rp >= (t.Diamond ?? 1600)) return "Diamond";
  if (rp >= (t.Platinum ?? 1400)) return "Platinum";
  if (rp >= (t.Gold ?? 1200)) return "Gold";
  if (rp >= (t.Silver ?? 1000)) return "Silver";
  return "Bronze";
}

export function getTierSubdivision(rp: number, thresholds?: Record<TierName, number>): number {
  const t = thresholds || { Bronze: 0, Silver: 1000, Gold: 1200, Platinum: 1400, Diamond: 1600 };
  const tier = getTier(rp, thresholds);
  
  if (tier === "Diamond") {
    const diff = rp - (t.Diamond ?? 1600);
    if (diff >= 300) return 1;
    if (diff >= 200) return 2;
    if (diff >= 100) return 3;
    return 4;
  }
  
  let currentCutoff = 0;
  let nextCutoff = 1000;
  
  if (tier === "Bronze") {
    currentCutoff = t.Bronze ?? 0;
    nextCutoff = t.Silver ?? 1000;
  } else if (tier === "Silver") {
    currentCutoff = t.Silver ?? 1000;
    nextCutoff = t.Gold ?? 1200;
  } else if (tier === "Gold") {
    currentCutoff = t.Gold ?? 1200;
    nextCutoff = t.Platinum ?? 1400;
  } else if (tier === "Platinum") {
    currentCutoff = t.Platinum ?? 1400;
    nextCutoff = t.Diamond ?? 1600;
  }
  
  const range = nextCutoff - currentCutoff;
  if (range <= 0) return 4;
  
  const step = range / 4;
  const relativeRp = rp - currentCutoff;
  
  if (relativeRp < step) return 4;
  if (relativeRp < 2 * step) return 3;
  if (relativeRp < 3 * step) return 2;
  return 1;
}

export function getFullTierLabel(rp: number, thresholds?: Record<TierName, number>): string {
  const tier = getTier(rp, thresholds);
  const sub = getTierSubdivision(rp, thresholds);
  const style = TIER_STYLES[tier];
  return `${style.label} ${sub}`;
}

export const TIER_ORDER: TierName[] = ["Diamond", "Platinum", "Gold", "Silver", "Bronze"];

export const TIER_STYLES: Record<TierName, { bg: string; text: string; ring: string; label: string }> = {
  Bronze:   { bg: "bg-tier-bronze/15",   text: "text-tier-bronze",   ring: "ring-tier-bronze/40",   label: "브론즈" },
  Silver:   { bg: "bg-tier-silver/15",   text: "text-tier-silver",   ring: "ring-tier-silver/40",   label: "실버" },
  Gold:     { bg: "bg-tier-gold/15",     text: "text-tier-gold",     ring: "ring-tier-gold/40",     label: "골드" },
  Platinum: { bg: "bg-tier-platinum/15", text: "text-tier-platinum", ring: "ring-tier-platinum/40", label: "플래티넘" },
  Diamond:  { bg: "bg-tier-diamond/15",  text: "text-tier-diamond",  ring: "ring-tier-diamond/40",  label: "다이아몬드" },
};

export function studentKey(s: { grade: number; classNum: number; number: number; name: string }) {
  return `${s.grade}-${s.classNum}-${s.number}-${s.name}`;
}

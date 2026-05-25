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
};

export type Match = {
  id: string;
  playerAId: string;
  playerBId: string;
  scoreA: number;
  scoreB: number;
  date: string;
};

export type TierName = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export function getTier(rp: number): TierName {
  if (rp >= 1600) return "Diamond";
  if (rp >= 1400) return "Platinum";
  if (rp >= 1200) return "Gold";
  if (rp >= 1000) return "Silver";
  return "Bronze";
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

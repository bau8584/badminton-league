import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TierBadge } from "./TierBadge";
import { GenderMark } from "./GenderMark";
import { cn } from "@/lib/utils";
import { Trophy, X, Lock, Sparkles, User, Users } from "lucide-react";
import type { Student, Match } from "@/lib/league-types";
import { getTier, getTierSubdivision, TIER_ORDER } from "@/lib/league-types";
import { toast } from "sonner";

const GRADES = [1, 2, 3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Selection = { grade: number | null; classNum: number | null; studentId: string | null };
const empty: Selection = { grade: null, classNum: null, studentId: null };

type PlayerResult = {
  name: string;
  grade: number;
  classNum: number;
  number: number;
  gender: "M" | "F" | "U";
  prevRp: number;
  prevTier: string;
  finalRp: number;
  finalTier: string;
  promoted: boolean;
  score: number;
  rpDelta: number;
  // Stored bonuses
  underdogBonus: number;
  scoreDiffBonus: number;
  rivalBonus: number;
  firstWinBonus: number;
  revengeBonus: number;
};

type MatchResultData = {
  matchType: "single" | "double";
  winner: PlayerResult;
  winner2?: PlayerResult;
  loser: PlayerResult;
  loser2?: PlayerResult;
};

export function RecordMatch({
  students,
  onRecord,
  isLocked,
  initials,
  onClearInitials,
  thresholds,
  rpVariables,
  onUpdateGender,
}: {
  students: Student[];
  onRecord: (
    playerAId: string, 
    playerBId: string, 
    scoreA: number, 
    scoreB: number, 
    playerA2Id?: string, 
    playerB2Id?: string, 
    matchType?: "single" | "double"
  ) => Match;
  isLocked?: boolean;
  initials?: { playerAId: string; playerBId: string } | null;
  onClearInitials?: () => void;
  thresholds?: Record<string, number>;
  rpVariables?: { winDelta: number; loseDelta: number };
  onUpdateGender?: (studentId: string, gender: "M" | "F" | "U") => void;
}) {
  const [matchType, setMatchType] = useState<"single" | "double">("single");
  const [a, setA] = useState<Selection>(empty);
  const [a2, setA2] = useState<Selection>(empty);
  const [b, setB] = useState<Selection>(empty);
  const [b2, setB2] = useState<Selection>(empty);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [resultData, setResultData] = useState<MatchResultData | null>(null);

  // 성별 정보 누락 자동 완성을 위한 상태
  const [genderModalOpen, setGenderModalOpen] = useState(false);
  const [genderTargetId, setGenderTargetId] = useState<string | null>(null);

  // Auto-populate recommended match selections when redirected
  useEffect(() => {
    if (initials) {
      const studentA = students.find((s) => s.id === initials.playerAId);
      const studentB = students.find((s) => s.id === initials.playerBId);
      if (studentA && studentB) {
        setMatchType("single");
        setA({ grade: studentA.grade, classNum: studentA.classNum, studentId: studentA.id });
        setB({ grade: studentB.grade, classNum: studentB.classNum, studentId: studentB.id });
        setA2(empty);
        setB2(empty);
        setScoreA(0);
        setScoreB(0);
      }
      onClearInitials?.();
    }
  }, [initials, students, onClearInitials]);

  // A선수 또는 B선수 및 파트너 선택 시 성별이 "U"이거나 없을 때 모달 팝업 트리거
  useEffect(() => {
    const activePlayerIds = [a.studentId, a2.studentId, b.studentId, b2.studentId].filter(Boolean) as string[];
    for (const id of activePlayerIds) {
      const student = students.find((s) => s.id === id);
      if (student && (student.gender === "U" || !student.gender)) {
        setGenderTargetId(student.id);
        setGenderModalOpen(true);
        return;
      }
    }
  }, [a.studentId, a2.studentId, b.studentId, b2.studentId, students]);

  if (isLocked) {
    return (
      <Card className="flex flex-col items-center justify-center border-border/60 bg-card/60 p-10 text-center backdrop-blur shadow-2xl relative overflow-hidden min-h-[450px]">
        <div className="absolute inset-0 bg-gradient-to-tr from-destructive/10 via-background/5 to-neon-blue/10 pointer-events-none opacity-60" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30 text-destructive shadow-[0_0_40px_rgba(239,68,68,0.25)] animate-pulse mb-6">
            <Lock className="size-10" />
          </div>
          <h3 className="text-2xl font-black tracking-tight mb-2 text-foreground">경기 결과 등록 잠김</h3>
          <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
            현재 체육 교사에 의해 경기 기록 입력이 잠금처리 되었습니다.<br />
            선생님의 지시에 따라 활동에 참여해주세요.
          </p>
        </div>
      </Card>
    );
  }

  const playerA = students.find((s) => s.id === a.studentId) ?? null;
  const playerB = students.find((s) => s.id === b.studentId) ?? null;
  const playerA2 = matchType === "double" ? (students.find((s) => s.id === a2.studentId) ?? null) : null;
  const playerB2 = matchType === "double" ? (students.find((s) => s.id === b2.studentId) ?? null) : null;

  const submit = () => {
    const playerAId = playerA?.id;
    const playerBId = playerB?.id;
    const playerA2Id = playerA2?.id;
    const playerB2Id = playerB2?.id;

    // 1차 검증 (Pre-flight Validation): 타입 및 누락 여부 확인
    if (matchType === "single") {
      if (!playerAId || !playerBId || typeof scoreA !== "number" || isNaN(scoreA) || typeof scoreB !== "number" || isNaN(scoreB)) {
        toast.error("입력된 데이터에 오류가 있습니다. 다시 확인해 주세요.");
        return;
      }
    } else {
      if (!playerAId || !playerA2Id || !playerBId || !playerB2Id || typeof scoreA !== "number" || isNaN(scoreA) || typeof scoreB !== "number" || isNaN(scoreB)) {
        toast.error("입력된 데이터에 오류가 있습니다. 다시 확인해 주세요.");
        return;
      }
    }

    if (matchType === "single") {
      if (!playerA || !playerB) return toast.error("두 선수를 모두 선택해주세요");
      if (playerA.id === playerB.id) return toast.error("같은 선수끼리 경기할 수 없습니다");
    } else {
      if (!playerA || !playerA2 || !playerB || !playerB2) {
        return toast.error("복식 경기 등록을 위해 4명의 선수를 모두 선택해주세요");
      }
      const selectedIds = [playerA.id, playerA2.id, playerB.id, playerB2.id];
      const uniqueIds = new Set(selectedIds);
      if (uniqueIds.size < 4) {
        return toast.error("같은 선수를 여러 자리에 중복 선택할 수 없습니다");
      }
    }

    if (scoreA === scoreB) return toast.error("무승부는 등록할 수 없습니다");

    const aWon = scoreA > scoreB;
    const winnerScore = aWon ? scoreA : scoreB;
    const loserScore = aWon ? scoreB : scoreA;

    // 2. Save to store and capture match object with calculated deltas
    const matchObj = onRecord(
      playerA.id, 
      playerB.id, 
      scoreA, 
      scoreB,
      playerA2?.id || undefined,
      playerB2?.id || undefined,
      matchType
    );
    if (!matchObj) return;

    const winnerNameText = matchType === "double" 
      ? `${aWon ? playerA.name : playerB.name} & ${aWon ? playerA2!.name : playerB2!.name}`
      : `${aWon ? playerA.name : playerB.name}`;
    toast.success(`${winnerNameText} 팀 승리! 결과가 등록되었습니다.`);

    // 3. Extract exact custom deltas & bonuses calculated in league-store
    const getPlayerResult = (student: Student, role: "A" | "A2" | "B" | "B2", won: boolean, score: number): PlayerResult => {
      const prevRp = student.rp;
      let rpDelta = 0;
      let underdogBonus = 0;
      let scoreDiffBonus = 0;
      let rivalBonus = 0;
      let firstWinBonus = 0;
      let revengeBonus = 0;

      if (role === "A") {
        rpDelta = matchObj.rpDeltaA ?? 0;
        underdogBonus = matchObj.underdogBonusA ?? 0;
        scoreDiffBonus = matchObj.scoreDiffBonusA ?? 0;
        rivalBonus = matchObj.rivalBonusA ?? 0;
        firstWinBonus = matchObj.firstWinBonusA ?? 0;
        revengeBonus = matchObj.revengeBonusA ?? 0;
      } else if (role === "A2") {
        rpDelta = matchObj.rpDeltaA2 ?? 0;
        underdogBonus = matchObj.underdogBonusA2 ?? 0;
        scoreDiffBonus = matchObj.scoreDiffBonusA2 ?? 0;
        rivalBonus = matchObj.rivalBonusA2 ?? 0;
        firstWinBonus = matchObj.firstWinBonusA2 ?? 0;
        revengeBonus = matchObj.revengeBonusA2 ?? 0;
      } else if (role === "B") {
        rpDelta = matchObj.rpDeltaB ?? 0;
        underdogBonus = matchObj.underdogBonusB ?? 0;
        scoreDiffBonus = matchObj.scoreDiffBonusB ?? 0;
        rivalBonus = matchObj.rivalBonusB ?? 0;
        firstWinBonus = matchObj.firstWinBonusB ?? 0;
        revengeBonus = matchObj.revengeBonusB ?? 0;
      } else if (role === "B2") {
        rpDelta = matchObj.rpDeltaB2 ?? 0;
        underdogBonus = matchObj.underdogBonusB2 ?? 0;
        scoreDiffBonus = matchObj.scoreDiffBonusB2 ?? 0;
        rivalBonus = matchObj.rivalBonusB2 ?? 0;
        firstWinBonus = matchObj.firstWinBonusB2 ?? 0;
        revengeBonus = matchObj.revengeBonusB2 ?? 0;
      }

      const finalRp = Math.max(0, prevRp + rpDelta);
      const prevTier = getTier(prevRp, thresholds);
      const finalTier = getTier(finalRp, thresholds);

      const prevSub = getTierSubdivision(prevRp, thresholds);
      const finalSub = getTierSubdivision(finalRp, thresholds);
      const basePromoted = TIER_ORDER.indexOf(finalTier) < TIER_ORDER.indexOf(prevTier);
      const subPromoted = finalTier === prevTier && finalSub < prevSub;
      const promoted = won && (basePromoted || subPromoted);

      return {
        name: student.name,
        grade: student.grade,
        classNum: student.classNum,
        number: student.number,
        gender: student.gender,
        prevRp,
        prevTier,
        finalRp,
        finalTier,
        promoted,
        score,
        rpDelta,
        underdogBonus,
        scoreDiffBonus,
        rivalBonus,
        firstWinBonus,
        revengeBonus
      };
    };

    const w1 = aWon ? playerA : playerB;
    const w2 = aWon ? playerA2 : playerB2;
    const l1 = aWon ? playerB : playerA;
    const l2 = aWon ? playerB2 : playerA2;

    // 4. Set match result details for the modal
    setResultData({
      matchType,
      winner: getPlayerResult(w1, aWon ? "A" : "B", true, winnerScore),
      winner2: w2 ? getPlayerResult(w2, aWon ? "A2" : "B2", true, winnerScore) : undefined,
      loser: getPlayerResult(l1, aWon ? "B" : "A", false, loserScore),
      loser2: l2 ? getPlayerResult(l2, aWon ? "B2" : "A2", false, loserScore) : undefined,
    });

    // 5. Open popup modal
    setShowModal(true);

    // 6. Reset name selectors and scores but retain grade & class selections
    setA({ grade: a.grade, classNum: a.classNum, studentId: null });
    setA2({ grade: a2.grade, classNum: a2.classNum, studentId: null });
    setB({ grade: b.grade, classNum: b.classNum, studentId: null });
    setB2({ grade: b2.grade, classNum: b2.classNum, studentId: null });
    setScoreA(0); 
    setScoreB(0);
  };

  const handleUpdateGender = (gender: "M" | "F") => {
    if (genderTargetId) {
      onUpdateGender?.(genderTargetId, gender);
      setGenderModalOpen(false);
      setGenderTargetId(null);
      toast.success("선수의 성별이 정상 등록되었습니다!");
    }
  };

  const handleCancelGender = () => {
    if (genderTargetId) {
      if (a.studentId === genderTargetId) setA((prev) => ({ ...prev, studentId: null }));
      if (a2.studentId === genderTargetId) setA2((prev) => ({ ...prev, studentId: null }));
      if (b.studentId === genderTargetId) setB((prev) => ({ ...prev, studentId: null }));
      if (b2.studentId === genderTargetId) setB2((prev) => ({ ...prev, studentId: null }));
    }
    setGenderModalOpen(false);
    setGenderTargetId(null);
    toast.warning("성별을 입력하지 않아 선수 선택이 취소되었습니다.");
  };

  const hasBonuses = (p: PlayerResult) => {
    return p.underdogBonus > 0 || p.scoreDiffBonus > 0 || p.rivalBonus > 0 || p.firstWinBonus > 0 || p.revengeBonus > 0;
  };

  const renderBonuses = (p: PlayerResult) => {
    return (
      <>
        {p.firstWinBonus > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 font-extrabold text-[10px] px-2.5 py-1 shadow-[0_0_8px_rgba(245,158,11,0.1)]">
            🌟 오늘의 첫 승 (+15 RP)
          </span>
        )}
        {p.revengeBonus > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-extrabold text-[10px] px-2.5 py-1 shadow-[0_0_8px_rgba(168,85,247,0.1)]">
            😈 복수전 성공! (+10 RP)
          </span>
        )}
        {p.underdogBonus > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-extrabold text-[10px] px-2.5 py-1 shadow-[0_0_8px_rgba(59,130,246,0.15)]">
            🛡️ 언더독 격파 (+{p.underdogBonus} RP)
          </span>
        )}
        {p.scoreDiffBonus > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-extrabold text-[10px] px-2.5 py-1 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
            🔥 압승 보너스 (+{p.scoreDiffBonus} RP)
          </span>
        )}
        {p.rivalBonus > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-extrabold text-[10px] px-2.5 py-1 shadow-[0_0_8px_rgba(6,182,212,0.15)]">
            ⚔️ 라이벌 격파! (+5 RP)
          </span>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* 단식 / 복식 경기 방식 선택 토글 */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/30 backdrop-blur">
          <button
            type="button"
            onClick={() => setMatchType("single")}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-black transition-all duration-200 flex items-center gap-2",
              matchType === "single"
                ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="size-4" />
            단식 (1:1)
          </button>
          <button
            type="button"
            onClick={() => setMatchType("double")}
            className={cn(
              "px-6 py-2.5 rounded-lg text-sm font-black transition-all duration-200 flex items-center gap-2",
              matchType === "double"
                ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="size-4" />
      복식 (2:2)
          </button>
        </div>
      </div>

      <div className={cn(
        "grid gap-4",
        matchType === "double" 
          ? "md:grid-cols-2 lg:grid-cols-4" 
          : "md:grid-cols-2"
      )}>
        <PlayerSelector label={matchType === "double" ? "팀 A - 선수 1" : "선수 A"} accent="blue" students={students} value={a} onChange={setA} player={playerA} />
        {matchType === "double" && (
          <PlayerSelector label="팀 A - 선수 2 (파트너)" accent="blue" students={students} value={a2} onChange={setA2} player={playerA2} />
        )}
        <PlayerSelector label={matchType === "double" ? "팀 B - 선수 1" : "선수 B (상대)"} accent="green" students={students} value={b} onChange={setB} player={playerB} />
        {matchType === "double" && (
          <PlayerSelector label="팀 B - 선수 2 (파트너)" accent="green" students={students} value={b2} onChange={setB2} player={playerB2} />
        )}
      </div>

      <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">스코어보드</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <ScorePad 
            name={matchType === "double" 
              ? `${playerA?.name ?? "선수 A1"} & ${playerA2?.name ?? "선수 A2"}` 
              : (playerA?.name ?? "선수 A")
            } 
            value={scoreA} 
            onChange={setScoreA} 
            accent="blue" 
          />
          <div className="pt-12 text-center text-3xl font-black text-muted-foreground">VS</div>
          <ScorePad 
            name={matchType === "double" 
              ? `${playerB?.name ?? "선수 B1"} & ${playerB2?.name ?? "선수 B2"}` 
              : (playerB?.name ?? "선수 B")
            } 
            value={scoreB} 
            onChange={setScoreB} 
            accent="green" 
          />
        </div>
      </Card>

      <Button
        size="lg"
        onClick={submit}
        className="h-14 w-full bg-gradient-to-r from-neon-blue to-tier-diamond text-base font-bold text-primary-foreground shadow-[0_0_32px_oklch(0.78_0.18_230/0.4)] hover:opacity-90"
      >
        <Trophy className="mr-2 size-5" /> 경기 결과 등록
      </Button>

      {/* Match Result Modal Popup */}
      {showModal && resultData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-3xl overflow-hidden border border-neon-blue/30 bg-background/95 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,180,216,0.15)] flex flex-col items-center animate-in zoom-in duration-300">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
            <div className="absolute -top-40 -left-40 size-80 rounded-full bg-neon-blue/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-40 -right-40 size-80 rounded-full bg-neon-green/10 blur-[100px] pointer-events-none" />

            {/* Trophy & Title */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.2)] mb-4 animate-bounce shrink-0">
                <Trophy className="size-7" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-glow-gold text-gold mb-1">
                경기 결과 등록 완료!
              </h2>
              <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
                방금 완료된 경기의 스코어보드 결과가 정상 반영되었습니다.<br />
                아래에서 변동된 RP 및 최종 랭킹 티어를 확인해 보세요.
              </p>
            </div>

            {/* Main Details Panel */}
            <div className="relative z-10 w-full space-y-4 my-2">
              
              {/* Winner Stripe */}
              <div className="relative overflow-hidden rounded-xl border border-win/30 bg-win/5 p-4 shadow-[0_0_15px_rgba(34,197,94,0.05)]">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-win" />
                
                <div className="flex flex-col gap-4 pl-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Winner 1 profile */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center justify-center px-2.5 py-1 rounded bg-win/15 text-win text-xs font-black tracking-widest border border-win/30 uppercase">
                        WINNER
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <GenderMark gender={resultData.winner.gender} className="size-4 text-[10px]" />
                          <span className="text-lg font-black">{resultData.winner.name}</span>
                          {resultData.winner.promoted && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-[9px] px-2 py-0.5 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse">
                              ▲ 승급! 🎉
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {resultData.winner.grade}학년 {resultData.winner.classNum}반 · {resultData.winner.number}번
                        </div>
                      </div>
                    </div>

                    {/* Score box */}
                    <div className="flex items-center justify-center md:justify-end gap-1 shrink-0 font-mono font-black text-2xl px-4 py-1.5 rounded-lg bg-background/50 border border-border/30">
                      <span className="text-win">{resultData.winner.score}</span>
                      <span className="text-muted-foreground text-sm font-normal mx-1">:</span>
                      <span className="text-loss">{resultData.loser.score}</span>
                    </div>

                    {/* RP Flow Visualizer for Winner 1 */}
                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 bg-background/30 rounded-xl p-3 border border-border/20 md:min-w-[320px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground font-medium mb-1">이전</span>
                        <TierBadge rp={resultData.winner.prevRp} />
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground mt-0.5">{resultData.winner.prevRp} RP</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span className="text-muted-foreground text-sm font-semibold">➔</span>
                        <span className="text-[9px] font-black text-win bg-win/15 px-1.5 py-0.5 rounded border border-win/30 font-mono mt-1">+{resultData.winner.rpDelta} RP</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-neon-blue font-bold mb-1">최종</span>
                        <TierBadge rp={resultData.winner.finalRp} />
                        <span className="font-mono text-xs font-black text-neon-blue mt-0.5">{resultData.winner.finalRp} RP</span>
                      </div>
                    </div>
                  </div>

                  {/* 🌟 Winner 1 Bonuses */}
                  {hasBonuses(resultData.winner) && (
                    <div className="pt-2 border-t border-win/10 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-win/80 mr-1">{resultData.winner.name} 보상:</span>
                      {renderBonuses(resultData.winner)}
                    </div>
                  )}

                  {/* Winner 2 Profile & RP (if present) */}
                  {resultData.winner2 && (
                    <div className="border-t border-win/10 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center justify-center px-2.5 py-1 rounded bg-win/15 text-win text-xs font-black tracking-widest border border-win/30 uppercase">
                          PARTNER
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <GenderMark gender={resultData.winner2.gender} className="size-4 text-[10px]" />
                            <span className="text-lg font-black">{resultData.winner2.name}</span>
                            {resultData.winner2.promoted && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-extrabold text-[9px] px-2 py-0.5 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse">
                                ▲ 승급! 🎉
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {resultData.winner2.grade}학년 {resultData.winner2.classNum}반 · {resultData.winner2.number}번
                          </div>
                        </div>
                      </div>

                      {/* Symmetrical empty space for score layout alignment */}
                      <div className="hidden md:block w-[72px]" />

                      {/* RP Flow Visualizer for Winner 2 */}
                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 bg-background/30 rounded-xl p-3 border border-border/20 md:min-w-[320px]">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground font-medium mb-1">이전</span>
                          <TierBadge rp={resultData.winner2.prevRp} />
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground mt-0.5">{resultData.winner2.prevRp} RP</span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center shrink-0">
                          <span className="text-muted-foreground text-sm font-semibold">➔</span>
                          <span className="text-[9px] font-black text-win bg-win/15 px-1.5 py-0.5 rounded border border-win/30 font-mono mt-1">+{resultData.winner2.rpDelta} RP</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-neon-blue font-bold mb-1">최종</span>
                          <TierBadge rp={resultData.winner2.finalRp} />
                          <span className="font-mono text-xs font-black text-neon-blue mt-0.5">{resultData.winner2.finalRp} RP</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🌟 Winner 2 Bonuses */}
                  {resultData.winner2 && hasBonuses(resultData.winner2) && (
                    <div className="pt-2 border-t border-win/10 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-win/80 mr-1">{resultData.winner2.name} 보상:</span>
                      {renderBonuses(resultData.winner2)}
                    </div>
                  )}
                </div>
              </div>

              {/* Loser Stripe */}
              <div className="relative overflow-hidden rounded-xl border border-loss/30 bg-loss/5 p-4 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-loss" />
                
                <div className="flex flex-col gap-4 pl-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Loser 1 profile */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center justify-center px-2.5 py-1 rounded bg-loss/15 text-loss text-xs font-black tracking-widest border border-loss/30 uppercase">
                        DEFEAT
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <GenderMark gender={resultData.loser.gender} className="size-4 text-[10px]" />
                          <span className="text-lg font-black">{resultData.loser.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {resultData.loser.grade}학년 {resultData.loser.classNum}반 · {resultData.loser.number}번
                        </div>
                      </div>
                    </div>

                    {/* Symmetrical alignment space placeholder */}
                    <div className="hidden md:flex items-center justify-center opacity-0 pointer-events-none select-none font-mono font-black text-2xl px-4 py-1.5">
                      <span>0 : 0</span>
                    </div>

                    {/* RP Flow Visualizer */}
                    <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 bg-background/30 rounded-xl p-3 border border-border/20 md:min-w-[320px]">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground font-medium mb-1">이전</span>
                        <TierBadge rp={resultData.loser.prevRp} />
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground mt-0.5">{resultData.loser.prevRp} RP</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center shrink-0">
                        <span className="text-muted-foreground text-sm font-semibold">➔</span>
                        <span className="text-[9px] font-black text-loss bg-loss/15 px-1.5 py-0.5 rounded border border-loss/30 font-mono mt-1">{resultData.loser.rpDelta} RP</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground font-semibold mb-1">최종</span>
                        <TierBadge rp={resultData.loser.finalRp} />
                        <span className="font-mono text-xs font-bold text-muted-foreground mt-0.5">{resultData.loser.finalRp} RP</span>
                      </div>
                    </div>
                  </div>

                  {/* Loser 2 Profile & RP (if present) */}
                  {resultData.loser2 && (
                    <div className="border-t border-loss/10 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="flex items-center justify-center px-2.5 py-1 rounded bg-loss/15 text-loss text-xs font-black tracking-widest border border-loss/30 uppercase">
                          PARTNER
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <GenderMark gender={resultData.loser2.gender} className="size-4 text-[10px]" />
                            <span className="text-lg font-black">{resultData.loser2.name}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {resultData.loser2.grade}학년 {resultData.loser2.classNum}반 · {resultData.loser2.number}번
                          </div>
                        </div>
                      </div>

                      {/* Symmetrical align space */}
                      <div className="hidden md:block w-[72px]" />

                      {/* RP Flow Visualizer for Loser 2 */}
                      <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 bg-background/30 rounded-xl p-3 border border-border/20 md:min-w-[320px]">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground font-medium mb-1">이전</span>
                          <TierBadge rp={resultData.loser2.prevRp} />
                          <span className="font-mono text-[11px] font-semibold text-muted-foreground mt-0.5">{resultData.loser2.prevRp} RP</span>
                        </div>
                        
                        <div className="flex flex-col items-center justify-center shrink-0">
                          <span className="text-muted-foreground text-sm font-semibold">➔</span>
                          <span className="text-[9px] font-black text-loss bg-loss/15 px-1.5 py-0.5 rounded border border-loss/30 font-mono mt-1">{resultData.loser2.rpDelta} RP</span>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-muted-foreground font-semibold mb-1">최종</span>
                          <TierBadge rp={resultData.loser2.finalRp} />
                          <span className="font-mono text-xs font-bold text-muted-foreground mt-0.5">{resultData.loser2.finalRp} RP</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Confirmation Close Button */}
            <div className="relative z-10 w-full mt-6 flex justify-center shrink-0">
              <Button
                onClick={() => {
                  setShowModal(false);
                  setResultData(null);
                }}
                className="h-12 px-10 bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground font-black tracking-wide shadow-lg active:scale-95 transition-all w-full sm:w-auto"
              >
                확인 (다음 경기 입력)
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* 성별 정보 보완 팝업창 (LoL 테크니컬 디자인 다크모드) */}
      {genderModalOpen && genderTargetId && (() => {
        const targetStudent = students.find((s) => s.id === genderTargetId);
        if (!targetStudent) return null;
        return (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden border border-neon-blue/30 bg-background/95 rounded-2xl p-6 md:p-8 shadow-[0_0_50px_rgba(0,180,216,0.2)] flex flex-col items-center animate-in zoom-in duration-300">
              {/* Grid Background Effect */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.2)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
              
              {/* Close Button */}
              <button 
                onClick={handleCancelGender}
                className="absolute right-4 top-4 text-muted-foreground hover:text-foreground hover:bg-muted/40 p-1.5 rounded-lg transition-all"
                title="취소 및 뒤로가기"
              >
                <X className="size-5" />
              </button>

              {/* Title & Info */}
              <div className="relative z-10 flex flex-col items-center text-center w-full">
                <div className="flex size-14 items-center justify-center rounded-full bg-neon-blue/15 border border-neon-blue/30 text-neon-blue shadow-[0_0_30px_rgba(0,180,216,0.3)] mb-4 animate-pulse">
                  <Sparkles className="size-6 text-neon-blue" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-wider text-glow-blue text-neon-blue mb-1">
                  선수 성별 정보 보완
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                  <span className="font-bold text-foreground">[{targetStudent.name}]</span> 선수의 성별 정보(M/F)가 지정되지 않았습니다.<br />
                  리그 경기 결과를 등록하기 위해 성별을 입력해주세요.
                </p>
              </div>

              {/* Gender Selection Grid */}
              <div className="relative z-10 grid grid-cols-2 gap-4 w-full">
                {/* Male Option */}
                <button
                  onClick={() => handleUpdateGender("M")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-neon-blue/30 bg-neon-blue/5 hover:bg-neon-blue/15 hover:border-neon-blue/60 transition-all active:scale-95 group shadow-[0_0_15px_rgba(0,180,216,0.05)]"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce">♂</span>
                  <span className="text-sm font-black text-neon-blue tracking-wider">남성 (M)</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Male Athlete</span>
                </button>

                {/* Female Option */}
                <button
                  onClick={() => handleUpdateGender("F")}
                  className="flex flex-col items-center justify-center p-5 rounded-xl border border-loss/30 bg-loss/5 hover:bg-loss/15 hover:border-loss/60 transition-all active:scale-95 group shadow-[0_0_15px_rgba(239,68,68,0.05)]"
                >
                  <span className="text-4xl mb-2 group-hover:animate-bounce text-loss">♀</span>
                  <span className="text-sm font-black text-loss tracking-wider">여성 (F)</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Female Athlete</span>
                </button>
              </div>

              {/* Notice Footer */}
              <p className="relative z-10 text-[10px] text-muted-foreground mt-6 text-center leading-relaxed">
                입력하신 성별 데이터는 로컬 브라우저 캐시는 물론,<br />
                교사 전용 구글 스프레드시트 클라우드 데이터베이스에 실시간 영속 동기화됩니다.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function PlayerSelector({
  label, accent, students, value, onChange, player,
}: {
  label: string;
  accent: "blue" | "green";
  students: Student[];
  value: Selection;
  onChange: (s: Selection) => void;
  player: Student | null;
}) {
  const accentCls = accent === "blue"
    ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue shadow-[0_0_14px_oklch(0.78_0.18_230/0.35)]"
    : "border-neon-green/60 bg-neon-green/15 text-neon-green shadow-[0_0_14px_oklch(0.85_0.22_150/0.35)]";

  const headerCls = accent === "blue" ? "text-neon-blue" : "text-neon-green";

  const classes = useMemo(() => {
    if (value.grade == null) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === value.grade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, value.grade]);

  const roster = useMemo(() => {
    if (value.grade == null || value.classNum == null) return [];
    return students
      .filter((s) => s.grade === value.grade && s.classNum === value.classNum)
      .sort((a, b) => a.number - b.number);
  }, [students, value.grade, value.classNum]);

  return (
    <Card className="border-border/60 bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className={cn("text-sm font-bold uppercase tracking-wider", headerCls)}>{label}</h3>
        {player && (
          <button
            onClick={() => onChange({ grade: value.grade, classNum: value.classNum, studentId: null })}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" /> 선수 다시 선택
          </button>
        )}
      </div>

      {player ? (
        <div className={cn("rounded-lg border p-4", accentCls)}>
          <div className="text-xs opacity-80">{player.grade}학년 {player.classNum}반 · {player.number}번</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-black">
            <GenderMark gender={player.gender} className="size-5 text-xs" />
            {player.name}
          </div>
          <div className="mt-2 flex items-center gap-2"><TierBadge rp={player.rp} /><span className="font-mono text-xs opacity-80">{player.rp} RP</span></div>
        </div>
      ) : (
        <div className="space-y-4">
          <Step n={1} title="학년">
            <div className="flex flex-wrap gap-3 mt-2">
              {GRADES.map((g) => (
                <Chip key={g} active={value.grade === g} accent={accent} onClick={() => onChange({ grade: g, classNum: null, studentId: null })}>
                  {g}학년
                </Chip>
              ))}
            </div>
          </Step>
          {value.grade != null && (
            <Step n={2} title="반">
              <div className="flex flex-wrap gap-3 mt-2">
                {CLASSES.filter((c) => classes.includes(c)).map((c) => (
                  <Chip key={c} active={value.classNum === c} accent={accent} onClick={() => onChange({ ...value, classNum: c, studentId: null })}>
                    {c}반
                  </Chip>
                ))}
                {classes.length === 0 && <span className="text-xs text-muted-foreground block py-2">학생이 없습니다</span>}
              </div>
            </Step>
          )}
          {value.classNum != null && (
            <Step n={3} title="선수 선택">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {roster.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onChange({ ...value, studentId: s.id })}
                    className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-left transition-all hover:border-neon-blue/60 hover:bg-accent/50"
                  >
                    <div className="text-[10px] text-muted-foreground">{s.number}번</div>
                    <div className="flex items-center gap-1.5 text-sm font-bold">
                      <GenderMark gender={s.gender} />
                      {s.name}
                    </div>
                  </button>
                ))}
              </div>
            </Step>
          )}
        </div>
      )}
    </Card>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-2xl font-extrabold text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, accent, onClick, children }: { active: boolean; accent: "blue" | "green"; onClick: () => void; children: React.ReactNode }) {
  const activeCls = accent === "blue"
    ? "border-neon-blue bg-neon-blue/20 text-neon-blue shadow-[0_0_18px_rgba(0,180,216,0.35)]"
    : "border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_18px_rgba(34,197,94,0.35)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-20 h-16 rounded-2xl border text-base font-black transition-all active:scale-95 flex items-center justify-center shadow-md",
        active ? activeCls : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/30",
      )}
    >
      {children}
    </button>
  );
}

function ScorePad({ name, value, onChange, accent }: { name: string; value: number; onChange: (v: number) => void; accent: "blue" | "green" }) {
  const colorText = accent === "blue" ? "text-neon-blue text-glow-blue" : "text-neon-green";
  const plusCls = accent === "blue"
    ? "border-neon-blue/50 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
    : "border-neon-green/50 bg-neon-green/10 text-neon-green hover:bg-neon-green/20";
  const minusCls = "border-loss/40 bg-loss/10 text-loss hover:bg-loss/20";
  const set = (delta: number) => onChange(Math.max(0, value + delta));

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-center">
      <div className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{name}</div>
      <div className={cn("my-3 font-mono text-6xl font-black tabular-nums", colorText)}>{value}</div>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[1, 5, 10].map((d) => (
            <QuickBtn key={`p${d}`} className={plusCls} onClick={() => set(d)}>+{d}</QuickBtn>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 5, 10].map((d) => (
            <QuickBtn key={`m${d}`} className={minusCls} onClick={() => set(-d)}>-{d}</QuickBtn>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(0)}
          className="mt-1 h-7 w-full text-[11px] text-muted-foreground hover:text-foreground"
        >
          0으로 초기화
        </Button>
      </div>
    </div>
  );
}

function QuickBtn({ className, onClick, children }: { className?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border py-2.5 font-mono text-lg font-black tabular-nums transition-all active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}

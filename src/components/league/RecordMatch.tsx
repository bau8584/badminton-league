import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TierBadge } from "./TierBadge";
import { GenderMark } from "./GenderMark";
import { cn } from "@/lib/utils";
import { Trophy, X, Lock } from "lucide-react";
import type { Student } from "@/lib/league-types";
import { getTier, TIER_ORDER } from "@/lib/league-types";
import { toast } from "sonner";

const GRADES = [1, 2, 3, 4, 5, 6];
const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type Selection = { grade: number | null; classNum: number | null; studentId: string | null };
const empty: Selection = { grade: null, classNum: null, studentId: null };

type MatchResultData = {
  winner: {
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
  };
  loser: {
    name: string;
    grade: number;
    classNum: number;
    number: number;
    gender: "M" | "F" | "U";
    prevRp: number;
    prevTier: string;
    finalRp: number;
    finalTier: string;
    score: number;
  };
};

export function RecordMatch({
  students,
  onRecord,
  isLocked,
  initials,
  onClearInitials,
}: {
  students: Student[];
  onRecord: (a: string, b: string, sa: number, sb: number) => void;
  isLocked?: boolean;
  initials?: { playerAId: string; playerBId: string } | null;
  onClearInitials?: () => void;
}) {
  const [a, setA] = useState<Selection>(empty);
  const [b, setB] = useState<Selection>(empty);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [resultData, setResultData] = useState<MatchResultData | null>(null);

  // Auto-populate recommended match selections when redirected
  useEffect(() => {
    if (initials) {
      const studentA = students.find((s) => s.id === initials.playerAId);
      const studentB = students.find((s) => s.id === initials.playerBId);
      if (studentA && studentB) {
        setA({ grade: studentA.grade, classNum: studentA.classNum, studentId: studentA.id });
        setB({ grade: studentB.grade, classNum: studentB.classNum, studentId: studentB.id });
        setScoreA(0);
        setScoreB(0);
      }
      onClearInitials?.();
    }
  }, [initials, students, onClearInitials]);

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

  const submit = () => {
    if (!playerA || !playerB) return toast.error("두 선수를 모두 선택해주세요");
    if (playerA.id === playerB.id) return toast.error("같은 선수끼리 경기할 수 없습니다");
    if (scoreA === scoreB) return toast.error("무승부는 등록할 수 없습니다");

    // 1. Determine winner and loser
    const aWon = scoreA > scoreB;
    const winnerPlayer = aWon ? playerA : playerB;
    const loserPlayer = aWon ? playerB : playerA;
    const winnerScore = aWon ? scoreA : scoreB;
    const loserScore = aWon ? scoreB : scoreA;

    // 2. Pre-calculate values
    const winPrevRp = winnerPlayer.rp;
    const winPrevTier = getTier(winPrevRp);
    const winFinalRp = winPrevRp + 25;
    const winFinalTier = getTier(winFinalRp);

    const losePrevRp = loserPlayer.rp;
    const losePrevTier = getTier(losePrevRp);
    const loseFinalRp = Math.max(0, losePrevRp - 20);
    const loseFinalTier = getTier(loseFinalRp);

    // Promotion check: higher rank means index in TIER_ORDER is lower
    const promoted = TIER_ORDER.indexOf(winFinalTier) < TIER_ORDER.indexOf(winPrevTier);

    // 3. Set match result details for the modal
    setResultData({
      winner: {
        name: winnerPlayer.name,
        grade: winnerPlayer.grade,
        classNum: winnerPlayer.classNum,
        number: winnerPlayer.number,
        gender: winnerPlayer.gender,
        prevRp: winPrevRp,
        prevTier: winPrevTier,
        finalRp: winFinalRp,
        finalTier: winFinalTier,
        promoted,
        score: winnerScore,
      },
      loser: {
        name: loserPlayer.name,
        grade: loserPlayer.grade,
        classNum: loserPlayer.classNum,
        number: loserPlayer.number,
        gender: loserPlayer.gender,
        prevRp: losePrevRp,
        prevTier: losePrevTier,
        finalRp: loseFinalRp,
        finalTier: loseFinalTier,
        score: loserScore,
      }
    });

    // 4. Save to store
    onRecord(playerA.id, playerB.id, scoreA, scoreB);
    toast.success(`${winnerPlayer.name} 승리! 결과가 등록되었습니다.`);

    // 5. Open popup modal
    setShowModal(true);

    // 6. Reset name selectors and scores but retain grade & class selections
    setA({ grade: a.grade, classNum: a.classNum, studentId: null });
    setB({ grade: b.grade, classNum: b.classNum, studentId: null });
    setScoreA(0); 
    setScoreB(0);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <PlayerSelector label="선수 A" accent="blue" students={students} value={a} onChange={setA} player={playerA} />
        <PlayerSelector label="선수 B (상대)" accent="green" students={students} value={b} onChange={setB} player={playerB} />
      </div>

      <Card className="border-border/60 bg-card/60 p-6 backdrop-blur">
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">스코어보드</div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <ScorePad name={playerA?.name ?? "선수 A"} value={scoreA} onChange={setScoreA} accent="blue" />
          <div className="pt-12 text-center text-3xl font-black text-muted-foreground">VS</div>
          <ScorePad name={playerB?.name ?? "선수 B"} value={scoreB} onChange={setScoreB} accent="green" />
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
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-2">
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

                  {/* RP Flow Visualizer */}
                  <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 bg-background/30 rounded-xl p-3 border border-border/20 md:min-w-[320px]">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground font-medium mb-1">이전</span>
                      <TierBadge rp={resultData.winner.prevRp} />
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground mt-0.5">{resultData.winner.prevRp} RP</span>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center shrink-0">
                      <span className="text-muted-foreground text-sm font-semibold">➔</span>
                      <span className="text-[9px] font-black text-win bg-win/15 px-1.5 py-0.5 rounded border border-win/30 font-mono mt-1">+25 RP</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-neon-blue font-bold mb-1">최종</span>
                      <TierBadge rp={resultData.winner.finalRp} />
                      <span className="font-mono text-xs font-black text-neon-blue mt-0.5">{resultData.winner.finalRp} RP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Loser Stripe */}
              <div className="relative overflow-hidden rounded-xl border border-loss/30 bg-loss/5 p-4 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-loss" />
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-2">
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
                      <span className="text-[9px] font-black text-loss bg-loss/15 px-1.5 py-0.5 rounded border border-loss/30 font-mono mt-1">-20 RP</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground font-semibold mb-1">최종</span>
                      <TierBadge rp={resultData.loser.finalRp} />
                      <span className="font-mono text-xs font-bold text-muted-foreground mt-0.5">{resultData.loser.finalRp} RP</span>
                    </div>
                  </div>
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
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <Chip key={g} active={value.grade === g} accent={accent} onClick={() => onChange({ grade: g, classNum: null, studentId: null })}>
                  {g}학년
                </Chip>
              ))}
            </div>
          </Step>
          {value.grade != null && (
            <Step n={2} title="반">
              <div className="flex flex-wrap gap-2">
                {CLASSES.filter((c) => classes.includes(c)).map((c) => (
                  <Chip key={c} active={value.classNum === c} accent={accent} onClick={() => onChange({ ...value, classNum: c, studentId: null })}>
                    {c}반
                  </Chip>
                ))}
                {classes.length === 0 && <span className="text-xs text-muted-foreground">학생이 없습니다</span>}
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
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-muted-foreground">
        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px]">{n}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, accent, onClick, children }: { active: boolean; accent: "blue" | "green"; onClick: () => void; children: React.ReactNode }) {
  const activeCls = accent === "blue"
    ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
    : "border-neon-green/60 bg-neon-green/15 text-neon-green";
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold transition-all",
        active ? activeCls : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground",
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

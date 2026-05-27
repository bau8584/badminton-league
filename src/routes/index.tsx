import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useLeagueStore } from "@/lib/league-store";
import { Leaderboard } from "@/components/league/Leaderboard";
import { RecordMatch } from "@/components/league/RecordMatch";
import { AdminPanel } from "@/components/league/AdminPanel";
import { MatchRecommend } from "@/components/league/MatchRecommend";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Crown, Swords, Trophy, Users, Pencil, Target } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "초등 배드민턴 리그 · 티어 시스템" },
      { name: "description", content: "전국 초등학교 체육 수업과 반 대항전을 위한 배드민턴 리그 & 티어 랭킹 시스템." },
    ],
  }),
  component: Index,
});

type Tab = "leaderboard" | "recommend" | "record" | "admin";

function Index() {
  const {
    hydrated,
    students,
    matches,
    title,
    setTitle,
    recordMatch,
    upsertStudents,
    isLocked,
    setIsLocked,
    deleteMatch,
    resetStudent,
    resetAllData,
    updateStudentRP,
    isSyncing,
  } = useLeagueStore();

  const [tab, setTab] = useState<Tab>("leaderboard");
  const [editingTitle, setEditingTitle] = useState(false);
  const [recommendInitials, setRecommendInitials] = useState<{ playerAId: string; playerBId: string } | null>(null);

  // Persistent Match Recommendation States
  const [recommendSel, setRecommendSel] = useState<{ grade: number | null; classNum: number | null; studentId: string | null }>({ grade: null, classNum: null, studentId: null });
  const [recommendMode, setRecommendMode] = useState<"class" | "otherClass" | "otherGrade">("class");
  const [recommendTargetGrade, setRecommendTargetGrade] = useState<number | null>(null);
  const [recommendTargetClass, setRecommendTargetClass] = useState<number | null>(null);

  const handleSelectRecommendedMatch = (playerAId: string, playerBId: string) => {
    setRecommendInitials({ playerAId, playerBId });
    setTab("record");
  };

  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-neon-blue to-tier-diamond shadow-[0_0_18px_oklch(0.78_0.18_230/0.5)]">
                <Crown className="size-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-neon-blue">Elementary Badminton</p>
                {editingTitle ? (
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
                    className="h-8 border-neon-blue/60 bg-background/60 text-lg font-bold"
                  />
                ) : (
                  <button onClick={() => setEditingTitle(true)} className="flex items-center gap-2 text-lg font-bold tracking-tight hover:text-neon-blue sm:text-xl">
                    {title}
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {isSyncing && (
                <div className="flex items-center gap-1.5 rounded-full border border-neon-blue/40 bg-neon-blue/5 px-3 py-1 text-xs text-neon-blue animate-pulse">
                  <span className="size-1.5 rounded-full bg-neon-blue animate-ping" />
                  <span className="font-bold text-[10px] tracking-wider">🔄 구글 DB 동기화 중...</span>
                </div>
              )}
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-4 py-1.5 text-xs">
                <Users className="size-3.5 text-neon-green" />
                <span className="font-mono text-muted-foreground">등록 선수</span>
                <span className="font-bold text-neon-green">{students.length}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="mt-5 flex gap-1 overflow-x-auto">
            <TabButton active={tab === "leaderboard"} onClick={() => setTab("leaderboard")} icon={<Trophy className="size-4" />}>티어 순위표</TabButton>
            <TabButton active={tab === "recommend"} onClick={() => setTab("recommend")} icon={<Target className="size-4" />}>🎯 매치 추천</TabButton>
            <TabButton active={tab === "record"} onClick={() => setTab("record")} icon={<Swords className="size-4" />}>경기 기록 입력</TabButton>
            <TabButton active={tab === "admin"} onClick={() => setTab("admin")} icon={<Users className="size-4" />}>교사 관리자</TabButton>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {tab === "leaderboard" && <Leaderboard students={students} />}
        {tab === "recommend" && (
          <MatchRecommend
            students={students}
            matches={matches}
            onSelectRecommendedMatch={handleSelectRecommendedMatch}
            sel={recommendSel}
            onSelChange={setRecommendSel}
            mode={recommendMode}
            onModeChange={setRecommendMode}
            targetGrade={recommendTargetGrade}
            onTargetGradeChange={setRecommendTargetGrade}
            targetClass={recommendTargetClass}
            onTargetClassChange={setRecommendTargetClass}
          />
        )}
        {tab === "record" && (
          <RecordMatch
            students={students}
            onRecord={recordMatch}
            isLocked={isLocked}
            initials={recommendInitials}
            onClearInitials={() => setRecommendInitials(null)}
          />
        )}
        {tab === "admin" && (
          <AdminPanel 
            students={students}
            matches={matches}
            onUpsert={upsertStudents} 
            count={students.length}
            isLocked={isLocked}
            onToggleLock={setIsLocked}
            onDeleteMatch={deleteMatch}
            onResetStudent={resetStudent}
            onResetAll={resetAllData}
            onUpdateRP={updateStudentRP}
          />
        )}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-semibold transition-all",
        active
          ? "border-neon-blue bg-neon-blue/10 text-neon-blue text-glow-blue"
          : "border-transparent text-muted-foreground hover:bg-accent/30 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

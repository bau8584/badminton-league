import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  AlertCircle, 
  Database, 
  Lock, 
  Unlock, 
  Search, 
  Trash2, 
  RotateCcw, 
  Download, 
  User, 
  ShieldAlert,
  Save
} from "lucide-react";
import type { Gender, Student, Match, TierName } from "@/lib/league-types";
import { getTier, TIER_STYLES, getFullTierLabel } from "@/lib/league-types";
import { GenderMark } from "./GenderMark";
import { TierBadge } from "./TierBadge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Row = { grade: number; classNum: number; number: number; name: string; gender?: Gender };

function detectGender(token: string): Gender | null {
  const t = token.trim();
  if (t === "남" || t === "M" || t === "m" || t === "남자") return "M";
  if (t === "여" || t === "F" || t === "f" || t === "여자") return "F";
  return null;
}

function parsePaste(text: string): { rows: Row[]; errors: number } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  let errors = 0;
  for (const line of lines) {
    const parts = line.split(/[\t,\s]+/).filter(Boolean);
    if (parts.length < 4) { errors++; continue; }
    const [g, c, n, ...rest] = parts;
    let gender: Gender | undefined;
    for (let i = rest.length - 1; i >= 0; i--) {
      const gd = detectGender(rest[i]);
      if (gd) {
        gender = gd;
        rest.splice(i, 1);
        break;
      }
    }
    const grade = parseInt(g, 10);
    const classNum = parseInt(c, 10);
    const number = parseInt(n, 10);
    const name = rest.join(" ").trim();
    if (!grade || !classNum || !number || !name || grade < 1 || grade > 6) { errors++; continue; }
    rows.push({ grade, classNum, number, name, gender });
  }
  return { rows, errors };
}

export function AdminPanel({
  students,
  matches,
  onUpsert,
  count,
  isLocked,
  onToggleLock,
  onDeleteMatch,
  onResetStudent,
  onResetAll,
  onUpdateRP,
  thresholds,
  rpVariables,
  onUpdateSettings,
  onDeleteStudent,
  onRestoreFromCSV,
}: {
  students: Student[];
  matches: Match[];
  onUpsert: (rows: Row[]) => { added: number; kept: number };
  count: number;
  isLocked: boolean;
  onToggleLock: (locked: boolean) => void;
  onDeleteMatch: (matchId: string) => void;
  onResetStudent: (studentId: string) => void;
  onResetAll: () => void;
  onUpdateRP: (studentId: string, nextRp: number) => void;
  thresholds?: Record<TierName, number>;
  rpVariables?: { winDelta: number; loseDelta: number };
  onUpdateSettings?: (thresholds: Record<TierName, number>, rpVars: { winDelta: number; loseDelta: number }) => void;
  onDeleteStudent?: (studentId: string) => void;
  onRestoreFromCSV?: (students: Student[], matches: Match[]) => void;
}) {
  // CSV 롤백 복원 상태
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Student[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk upload states
  const [text, setText] = useState("");
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const parsed = useMemo(() => parsePaste(text), [text]);

  // Student editor states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editRpInput, setEditRpInput] = useState<string>("");

  // 학년/반 대형 필터 브라우저 상태
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [filterClassNum, setFilterClassNum] = useState<number | null>(null);

  // 티어 및 RP 수동 설정 폼 상태
  const [inputBronze, setInputBronze] = useState(thresholds?.Bronze?.toString() ?? "0");
  const [inputSilver, setInputSilver] = useState(thresholds?.Silver?.toString() ?? "1000");
  const [inputGold, setInputGold] = useState(thresholds?.Gold?.toString() ?? "1200");
  const [inputPlatinum, setInputPlatinum] = useState(thresholds?.Platinum?.toString() ?? "1400");
  const [inputDiamond, setInputDiamond] = useState(thresholds?.Diamond?.toString() ?? "1600");

  const [inputWinDelta, setInputWinDelta] = useState(rpVariables?.winDelta?.toString() ?? "25");
  const [inputLoseDelta, setInputLoseDelta] = useState(rpVariables?.loseDelta?.toString() ?? "20");

  useEffect(() => {
    if (thresholds) {
      setInputBronze(thresholds.Bronze?.toString() ?? "0");
      setInputSilver(thresholds.Silver?.toString() ?? "1000");
      setInputGold(thresholds.Gold?.toString() ?? "1200");
      setInputPlatinum(thresholds.Platinum?.toString() ?? "1400");
      setInputDiamond(thresholds.Diamond?.toString() ?? "1600");
    }
  }, [thresholds]);

  useEffect(() => {
    if (rpVariables) {
      setInputWinDelta(rpVariables.winDelta?.toString() ?? "25");
      setInputLoseDelta(rpVariables.loseDelta?.toString() ?? "20");
    }
  }, [rpVariables]);

  const handleSaveSettings = () => {
    const b = parseInt(inputBronze, 10);
    const s = parseInt(inputSilver, 10);
    const g = parseInt(inputGold, 10);
    const p = parseInt(inputPlatinum, 10);
    const d = parseInt(inputDiamond, 10);

    const winD = parseInt(inputWinDelta, 10);
    const loseD = parseInt(inputLoseDelta, 10);

    if (isNaN(b) || isNaN(s) || isNaN(g) || isNaN(p) || isNaN(d) || isNaN(winD) || isNaN(loseD)) {
      return toast.error("모든 설정값은 유효한 정수여야 합니다.");
    }

    if (b < 0 || s < 0 || g < 0 || p < 0 || d < 0 || winD < 0 || loseD < 0) {
      return toast.error("점수 설정은 0점 이상이어야 합니다.");
    }

    onUpdateSettings?.(
      { Bronze: b, Silver: s, Gold: g, Platinum: p, Diamond: d },
      { winDelta: winD, loseDelta: loseD }
    );
    toast.success("티어 기준 및 RP 변동폭 설정이 리그 전체에 즉시 반영되었습니다!");
  };

  // 한 학급에 속한 학생들 목록 필터링
  const classFilteredStudents = useMemo(() => {
    if (filterGrade == null || filterClassNum == null) return [];
    return students
      .filter((s) => s.grade === filterGrade && s.classNum === filterClassNum)
      .sort((a, b) => a.number - b.number);
  }, [students, filterGrade, filterClassNum]);
  
  // 해당 학년에서 실제로 존재하는 반들을 추출
  const availableClassesForFilter = useMemo(() => {
    if (filterGrade == null) return [];
    const set = new Set<number>();
    students.filter((s) => s.grade === filterGrade).forEach((s) => set.add(s.classNum));
    return Array.from(set).sort((a, b) => a - b);
  }, [students, filterGrade]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId) ?? null;
  }, [students, selectedStudentId]);

  // Handle select student
  const handleSelectStudent = (s: Student) => {
    setSelectedStudentId(s.id);
    setEditRpInput(s.rp.toString());
    setSearchQuery(""); // Clear search query after selection
    toast.info(`${s.name} 학생의 프로필을 로드했습니다.`);
  };

  // Search filtered students list for editor select
  const searchFilteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || `${s.grade}-${s.classNum}`.includes(q)
    );
  }, [students, searchQuery]);

  // Save manual RP changes
  const saveRpChanges = () => {
    if (!selectedStudent) return;
    const parsedRp = parseInt(editRpInput, 10);
    if (isNaN(parsedRp) || parsedRp < 0) {
      return toast.error("올바른 RP 점수 값을 입력해주세요 (0점 이상)");
    }
    onUpdateRP(selectedStudent.id, parsedRp);
    toast.success(`${selectedStudent.name} 학생의 RP를 ${parsedRp}점으로 수동 조정했습니다.`);
  };

  // Apply RP presets instantly
  const applyRpPreset = (delta: number) => {
    if (!selectedStudent) return;
    const nextRp = Math.max(0, selectedStudent.rp + delta);
    setEditRpInput(nextRp.toString());
    onUpdateRP(selectedStudent.id, nextRp);
    toast.success(`${selectedStudent.name} 학생의 RP를 ${delta > 0 ? "+" : ""}${delta} 조정했습니다. (${nextRp} RP)`);
  };

  // Student specific matches timeline
  const studentMatches = useMemo(() => {
    if (!selectedStudentId) return [];
    return matches
      .filter((m) => m.playerAId === selectedStudentId || m.playerBId === selectedStudentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, selectedStudentId]);

  // Bulk NEIS commit
  const commit = () => {
    if (parsed.rows.length === 0) return toast.error("등록할 학생이 없습니다");
    const { added, kept } = onUpsert(parsed.rows);
    setText("");
    toast.success(`신규 ${added}명 등록, 기존 ${kept}명 전적 유지`);
  };

  // CSV download function with UTF-8 BOM
  const downloadCSV = () => {
    const sortedStudents = [...students].sort((a, b) => b.rp - a.rp);
    
    // Headers
    const headers = ["순위", "학년", "반", "번호", "이름", "성별", "RP 점수", "티어", "승리", "패배", "승률"];
    
    // Rows
    const rows = sortedStudents.map((s, index) => {
      const total = s.wins + s.losses;
      const winRate = total === 0 ? 0 : Math.round((s.wins / total) * 100);
      const tierLabel = getFullTierLabel(s.rp, thresholds);
      const genderLabel = s.gender === "M" ? "남" : s.gender === "F" ? "여" : "미지정";
      
      return [
        index + 1,
        s.grade,
        s.classNum,
        s.number,
        s.name,
        genderLabel,
        s.rp,
        tierLabel,
        s.wins,
        s.losses,
        `${winRate}%`
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((val) => `"${val}"`).join(","))
      .join("\n");
      
    // Excel UTF-8 BOM prefix
    const BOM = "\ufeff";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sports_league_rankings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("전체 학생 순위표 CSV 백업 다운로드가 완료되었습니다!");
  };

  // CSV 백업 파일을 업로드하여 파싱 및 롤백 복원 수행 헬퍼 함수
  const handleCSVRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        if (!csvText) return;

        // 줄 단위 분리
        const lines = csvText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        if (lines.length <= 1) {
          return toast.error("CSV 파일에 복구할 데이터가 부족하거나 비어있습니다.");
        }

        const parsedStudents: Student[] = [];

        // 두 번째 줄부터 데이터 파싱
        for (let i = 1; i < lines.length; i++) {
          // 따옴표로 감싸진 필드 파싱 정규식 적용 (쉼표 분할)
          const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
          if (parts.length < 10) continue; // 필수 컬럼 부족 시 스킵

          const grade = parseInt(parts[1], 10);
          const classNum = parseInt(parts[2], 10);
          const number = parseInt(parts[3], 10);
          const name = parts[4];
          const genderRaw = parts[5];
          const rp = parseInt(parts[6], 10);
          const wins = parseInt(parts[8], 10);
          const losses = parseInt(parts[9], 10);

          if (isNaN(grade) || isNaN(classNum) || isNaN(number) || !name || isNaN(rp) || isNaN(wins) || isNaN(losses)) {
            continue; // 유효성 검사 실패 스킵
          }

          let gender: Gender = "U";
          if (genderRaw === "남" || genderRaw === "M" || genderRaw === "m" || genderRaw === "남자") gender = "M";
          if (genderRaw === "여" || genderRaw === "F" || genderRaw === "f" || genderRaw === "여자") gender = "F";

          parsedStudents.push({
            id: Math.random().toString(36).slice(2, 10), // 새로운 임시 ID 발급
            grade,
            classNum,
            number,
            name,
            gender,
            rp,
            recent: [], // 복원 시 최근 경기 최근 목록은 빈 배열로 초기화
            wins,
            losses
          });
        }

        if (parsedStudents.length === 0) {
          return toast.error("파싱 가능한 유효한 학생 데이터가 없습니다. 순위표 백업 CSV 규격이 맞는지 확인해주세요.");
        }

        // 파싱된 데이터 보존 및 확인 AlertDialog 개방
        setPendingRestoreData(parsedStudents);
        setRestoreDialogOpen(true);
      } catch (err) {
        console.error("CSV restore parsing failed:", err);
        toast.error("CSV 백업 파일을 로드하여 정적 분석하는 중에 오류가 발생했습니다.");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = ""; // Input 초기화
  };

  // Global reset check
  const handleGlobalReset = () => {
    const password = window.prompt("모든 데이터를 완전히 리셋하고 새 시즌을 시작하려면 교사 비밀번호('admin1234')를 입력하세요:");
    if (password === null) return;
    if (password === "admin1234") {
      if (window.confirm("정말로 모든 경기 기록을 삭제하고 전교생의 점수를 1000점(0승 0패)으로 일괄 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.")) {
        onResetAll();
        setSelectedStudentId(null);
        toast.success("새 시즌이 활성화되었습니다. 모든 리그 기록이 성공적으로 일괄 초기화되었습니다.");
      }
    } else {
      toast.error("비밀번호가 일치하지 않습니다. 전체 리셋이 취소되었습니다.");
    }
  };

  // Individual student reset check
  const handleStudentReset = () => {
    if (!selectedStudent) return;
    if (window.confirm(`정말로 [${selectedStudent.name}] 학생의 모든 전적(0승 0패, 1000 RP)을 초기화하시겠습니까? 이 학생이 치른 모든 경기 기록도 자동으로 삭제 및 처리됩니다.`)) {
      onResetStudent(selectedStudent.id);
      setEditRpInput("1000");
      toast.success(`${selectedStudent.name} 학생의 기록을 완전 초기화했습니다.`);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Class Control: Lock Switch */}
      <Card className={cn(
        "border transition-all duration-300 p-5 backdrop-blur shadow-lg relative overflow-hidden",
        isLocked 
          ? "border-destructive/40 bg-destructive/5 shadow-[0_0_20px_rgba(239,68,68,0.1)]" 
          : "border-neon-green/30 bg-neon-green/5 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2">
              {isLocked ? (
                <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-bold text-destructive">
                  <Lock className="size-3" /> 경기 입력 비활성화 (잠금됨)
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-neon-green/15 px-2.5 py-0.5 text-xs font-bold text-neon-green">
                  <Unlock className="size-3" /> 경기 입력 활성화 (입력 가능)
                </span>
              )}
            </div>
            <h3 className="mt-2 text-lg font-black tracking-tight">수업 경기 등록 통제 스위치</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              스위치를 '잠금'으로 변경하면 학생들이 [경기 기록 입력] 탭에서 경기 결과를 직접 등록할 수 없도록 입력 폼이 완벽히 차단됩니다.
            </p>
          </div>
          
          <div className="flex items-center gap-2 self-end sm:self-center">
            <Button
              onClick={() => {
                onToggleLock(!isLocked);
                toast.success(isLocked ? "학생 경기 입력을 활성화했습니다!" : "학생 경기 입력을 비활성화(잠금)했습니다!");
              }}
              size="lg"
              className={cn(
                "h-12 px-6 font-black tracking-wide shadow-md transition-all active:scale-95",
                isLocked 
                  ? "bg-neon-green text-primary-foreground hover:bg-neon-green/90" 
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isLocked ? (
                <><Unlock className="mr-2 size-4" /> 경기 등록 해제</>
              ) : (
                <><Lock className="mr-2 size-4" /> 경기 등록 잠금</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Individual Student Management Dashboard */}
      <Card className="border-border/60 bg-card/60 p-6 backdrop-blur shadow-xl">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-neon-blue">
            <User className="size-5" />
            <h3 className="font-black text-lg">개별 학생 관리 대시보드</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            학생 이름을 검색하여 개별 프로필을 조회하고, RP 점수를 임의 수정하거나 과거 경기 내역을 추적하여 양방향 롤백(삭제)을 관리할 수 있습니다.
          </p>
        </div>

        {/* Student Search Box */}
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="관리하고 싶은 학생 이름을 입력하세요..."
            className="h-10 border-border/60 bg-background/60 pl-9 text-sm"
          />
          
          {/* Autocomplete Search Dropdown */}
          {searchQuery.trim() !== "" && (
            <Card className="absolute left-0 right-0 top-[44px] z-50 max-h-[220px] overflow-y-auto border-border/80 bg-popover p-2 shadow-2xl backdrop-blur-xl">
              {searchFilteredStudents.length > 0 ? (
                <div className="space-y-1">
                  {searchFilteredStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <GenderMark gender={s.gender} />
                        <span className="font-bold">{s.name}</span>
                        <span className="text-xs text-muted-foreground">({s.grade}학년 {s.classNum}반 {s.number}번)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TierBadge rp={s.rp} thresholds={thresholds} />
                        <span className="font-mono text-xs text-neon-blue font-bold">{s.rp} RP</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-muted-foreground">일치하는 학생을 찾을 수 없습니다.</div>
              )}
            </Card>
          )}
        </div>

        {/* Grade/Class Selector */}
        <div className="rounded-xl border border-border/40 bg-muted/10 p-5 mt-4 space-y-4">
          <div>
            <span className="text-xs text-neon-blue font-bold uppercase tracking-wider">학년 선택</span>
            <div className="flex flex-wrap gap-2 mt-2">
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setFilterGrade(g);
                    setFilterClassNum(null);
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95",
                    filterGrade === g
                      ? "border-neon-blue bg-neon-blue/20 text-neon-blue shadow-[0_0_12px_rgba(0,180,216,0.25)]"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {g}학년
                </button>
              ))}
            </div>
          </div>

          {filterGrade != null && (
            <div className="animate-in fade-in duration-300">
              <span className="text-xs text-neon-green font-bold uppercase tracking-wider">반 선택</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter((c) => availableClassesForFilter.includes(c)).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilterClassNum(c)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95",
                      filterClassNum === c
                        ? "border-neon-green bg-neon-green/20 text-neon-green shadow-[0_0_12px_rgba(34,197,94,0.25)]"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {c}반
                  </button>
                ))}
                {availableClassesForFilter.length === 0 && (
                  <span className="text-xs text-muted-foreground py-2 block">해당 학년에 등록된 학생이 없습니다. 명렬표를 등록해주세요.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Class Students Roster Grid Card */}
        {filterGrade != null && filterClassNum != null && (
          <div className="mt-5 pt-4 border-t border-border/30 animate-in fade-in duration-300">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block mb-2">
              학급 명단 브라우저 ({filterGrade}학년 {filterClassNum}반 · {classFilteredStudents.length}명)
            </span>
            
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {classFilteredStudents.map((s) => (
                <Card 
                  key={s.id} 
                  className={cn(
                    "p-4 border border-border/40 bg-background/40 hover:bg-accent/10 hover:border-neon-blue/40 transition-all duration-200 cursor-pointer flex items-center justify-between group relative overflow-hidden",
                    selectedStudentId === s.id && "border-neon-blue bg-neon-blue/5 shadow-[0_0_15px_rgba(0,180,216,0.1)]"
                  )}
                  onClick={() => handleSelectStudent(s)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-bold text-muted-foreground bg-muted/40 size-8 rounded-full flex items-center justify-center shrink-0">
                      {s.number}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <GenderMark gender={s.gender} />
                        <span>{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <TierBadge rp={s.rp} thresholds={thresholds} />
                        <span className="font-mono text-[11px] text-neon-blue font-bold">{s.rp} RP</span>
                      </div>
                    </div>
                  </div>

                  {/* Delete Student Button wrapped in AlertDialog trigger */}
                  <div className="flex items-center gap-1 relative z-20" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 opacity-80 hover:opacity-100 transition-all"
                          title="선수 삭제"
                        >
                          <Trash2 className="size-4.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-destructive/30 bg-background/95 max-w-md shadow-2xl rounded-2xl backdrop-blur-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black text-destructive flex items-center gap-2">
                            <ShieldAlert className="size-5 shrink-0" /> 정말 학생을 삭제하시겠습니까?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
                            정말 <span className="font-black text-foreground">[{s.name}] ({s.grade}학년 {s.classNum}반 {s.number}번)</span> 학생의 모든 데이터를 영구 삭제하시겠습니까?<br /><br />
                            이 학생이 치른 <span className="font-bold text-destructive">모든 과거 경기 기록도 자동으로 제거</span>되며, 상대방 학생들의 승패와 RP 수치도 경기 전 상태로 부분 롤백됩니다. 이 작업은 되돌릴 수 없습니다.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6 gap-2">
                          <AlertDialogCancel className="font-bold border-border/80 text-foreground hover:bg-accent/40 active:scale-95 transition-all rounded-xl h-11 px-5">
                            취소
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => {
                              onDeleteStudent?.(s.id);
                              if (selectedStudentId === s.id) {
                                setSelectedStudentId(null);
                              }
                              toast.success(`[${s.name}] 학생 및 연계 경기 전적이 리그에서 성공적으로 완전 삭제되었습니다.`);
                            }}
                            className="font-black bg-destructive hover:bg-destructive/80 active:scale-95 transition-all text-white rounded-xl h-11 px-5 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                          >
                            예, 안전 삭제합니다
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
              {classFilteredStudents.length === 0 && (
                <div className="col-span-full py-6 text-center text-xs text-muted-foreground border border-dashed border-border/30 rounded-xl bg-muted/5">
                  선택하신 학급에 등록된 학생이 없습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Student Detail Panel */}
        {selectedStudent ? (
          <div className="grid gap-6 md:grid-cols-5 mt-6 pt-6 border-t border-border/40">
            
            {/* Profile Info & RP Adjuster (Left Side) */}
            <div className="md:col-span-2 space-y-4">
              <div className="rounded-xl border border-border/40 bg-muted/20 p-5 relative overflow-hidden">
                <div className="absolute right-4 top-4 opacity-15">
                  <User className="size-20 text-muted-foreground" />
                </div>
                
                <span className="text-xs text-muted-foreground font-semibold">
                  {selectedStudent.grade}학년 {selectedStudent.classNum}반 · {selectedStudent.number}번
                </span>
                
                <div className="mt-1 flex items-center gap-2 text-2xl font-black">
                  <GenderMark gender={selectedStudent.gender} />
                  {selectedStudent.name}
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <TierBadge rp={selectedStudent.rp} thresholds={thresholds} />
                  <span className="font-mono text-sm font-bold text-neon-blue">{selectedStudent.rp} RP</span>
                  <span className="text-xs text-muted-foreground">({selectedStudent.wins}승 {selectedStudent.losses}패)</span>
                </div>

                {/* Individual Student Reset Button */}
                <div className="mt-5 pt-4 border-t border-border/30">
                  <Button
                    onClick={handleStudentReset}
                    variant="destructive"
                    size="sm"
                    className="w-full bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 font-bold active:scale-95 transition-all"
                  >
                    <RotateCcw className="mr-2 size-3.5" /> 개인 데이터 초기화
                  </Button>
                </div>
              </div>

              {/* RP Editor */}
              <div className="rounded-xl border border-border/40 bg-muted/20 p-5">
                <h4 className="text-sm font-bold mb-3 text-muted-foreground">RP 수동 조정 및 편집</h4>
                
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={editRpInput}
                    onChange={(e) => setEditRpInput(e.target.value)}
                    className="font-mono font-bold text-lg text-neon-blue bg-background/60"
                  />
                  <Button onClick={saveRpChanges} className="bg-neon-blue text-primary-foreground font-black px-4 hover:opacity-90">
                    <Save className="size-4 mr-1" /> 저장
                  </Button>
                </div>

                {/* Instant adjustment presets */}
                <div className="mt-4">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-2">실시간 빠른 미세 조정 (즉시 반영)</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[-50, -10, +10, +50].map((delta) => (
                      <button
                        key={delta}
                        onClick={() => applyRpPreset(delta)}
                        className={cn(
                          "py-1.5 text-xs font-mono font-bold rounded-lg border transition-all active:scale-95",
                          delta > 0 
                            ? "border-neon-green/40 bg-neon-green/5 text-neon-green hover:bg-neon-green/15" 
                            : "border-loss/40 bg-loss/5 text-loss hover:bg-loss/15"
                        )}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Timeline Match Logs (Right Side) */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-muted-foreground flex items-center gap-1.5">
                경기 내역 타임라인 <span className="font-mono text-xs rounded-full bg-muted/80 px-2 py-0.5 text-foreground">{studentMatches.length}</span>
              </h4>

              <div className="max-h-[340px] overflow-y-auto space-y-2 border border-border/30 rounded-xl p-3 bg-muted/10">
                {studentMatches.length > 0 ? (
                  studentMatches.map((m) => {
                    const isPlayerA = m.playerAId === selectedStudent.id;
                    const opponentId = isPlayerA ? m.playerBId : m.playerAId;
                    const opponent = students.find((s) => s.id === opponentId) ?? {
                      name: "알 수 없는 선수",
                      grade: 0,
                      classNum: 0,
                      number: 0,
                      gender: "U" as Gender
                    };

                    const scoreSelf = isPlayerA ? m.scoreA : m.scoreB;
                    const scoreOpp = isPlayerA ? m.scoreB : m.scoreA;
                    const isWin = scoreSelf > scoreOpp;
                    const matchDateStr = new Date(m.date).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    return (
                      <div key={m.id} className="flex items-center justify-between border border-border/30 bg-background/40 p-3 rounded-lg hover:border-border/60 transition-all gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            "flex size-7 items-center justify-center rounded-full text-xs font-black select-none shrink-0",
                            isWin 
                              ? "bg-win/15 text-win ring-1 ring-win/30" 
                              : "bg-loss/15 text-loss ring-1 ring-loss/30"
                          )}>
                            {isWin ? "승" : "패"}
                          </span>
                          
                          <div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>VS</span>
                              <GenderMark gender={opponent.gender} className="size-3.5 text-[9px]" />
                              <span className="font-bold text-foreground">{opponent.name}</span>
                              <span>({opponent.grade}-{opponent.classNum})</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{matchDateStr}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="font-mono text-sm font-black tracking-wider text-muted-foreground shrink-0 bg-muted/40 px-2 py-0.5 rounded">
                            <span className={cn(isWin ? "text-win" : "text-loss")}>{scoreSelf}</span>
                            <span> : </span>
                            <span className={cn(!isWin ? "text-win" : "text-loss")}>{scoreOpp}</span>
                          </span>

                          {/* Bilateral rollback button */}
                          <Button
                            onClick={() => {
                              const deltaWinner = isPlayerA ? (m.rpDeltaA !== undefined ? Math.abs(m.rpDeltaA) : 25) : (m.rpDeltaB !== undefined ? Math.abs(m.rpDeltaB) : 25);
                              const deltaLoser = !isPlayerA ? (m.rpDeltaA !== undefined ? Math.abs(m.rpDeltaA) : 20) : (m.rpDeltaB !== undefined ? Math.abs(m.rpDeltaB) : 20);
                              
                              if (window.confirm(`정말로 이 경기(VS ${opponent.name}) 기록을 완벽히 삭제하고, 두 학생의 RP 변동 수치를 경기 이전 상태로 양방향 롤백하시겠습니까?\n\n- 승자: RP -${deltaWinner}, 1승 차감\n- 패자: RP +${deltaLoser}, 1패 차감`)) {
                                onDeleteMatch(m.id);
                                toast.success("경기 기록이 완벽히 삭제되었으며 두 학생의 RP가 경기 이전으로 안전하게 복구되었습니다!");
                              }
                            }}
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            title="이 경기 기록 삭제 및 양방향 롤백"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-10 text-center text-xs text-muted-foreground">경기 내역이 전혀 존재하지 않습니다.</div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border/40 rounded-xl bg-muted/5">
            <User className="size-10 text-muted-foreground/60 mb-2" />
            <div className="text-xs text-muted-foreground">조회하고 싶은 학생을 검색창에 입력하여 선택해 주세요.</div>
          </div>
        )}
      </Card>

      {/* 3. CSV Backup Download & Collapsible NEIS Paste */}
      <div className="grid gap-6 md:grid-cols-3">
        
        {/* CSV Backup Card */}
        <Card className="border-border/60 bg-card/60 p-5 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-neon-green">
              <Download className="size-5" />
              <h3 className="font-bold">전체 데이터 CSV 다운로드</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              현재 등록된 모든 선수들의 순위, 소속 학년/반/번호, 이름, 성별, 최종 RP 점수, 티어, 경기 승패 전적 기록을 담은 엑셀 호환형 CSV 백업 파일을 생성하여 로컬 PC에 즉시 다운로드합니다.
            </p>
          </div>
          <Button
            onClick={downloadCSV}
            size="lg"
            className="mt-5 w-full bg-gradient-to-r from-neon-green to-tier-platinum text-primary-foreground font-black tracking-wide shadow-md active:scale-95 transition-all"
          >
            <Download className="mr-2 size-4" /> 전체 데이터 CSV 백업 내보내기
          </Button>
        </Card>

        {/* CSV Restore / Rollback Card */}
        <Card className="border-border/60 bg-card/60 p-5 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-destructive">
              <RotateCcw className="size-5" />
              <h3 className="font-bold text-foreground">CSV 업로드하여 데이터 롤백</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              교사가 이전에 백업해 둔 CSV 파일을 업로드하면, 해당 파일을 기반으로 전체 학생 명단과 RP 및 전적 점수를 완전히 해당 시점의 데이터로 롤백 복원합니다.
            </p>
          </div>
          <div className="mt-5">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleCSVRestoreUpload} 
              accept=".csv" 
              className="hidden" 
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="lg"
              className="w-full bg-gradient-to-r from-destructive to-amber-600 text-white font-black tracking-wide shadow-md active:scale-95 transition-all"
            >
              <RotateCcw className="mr-2 size-4" /> CSV 데이터 롤백 복원
            </Button>
          </div>
        </Card>

        {/* Bulk upload toggler */}
        <Card className="border-border/60 bg-card/60 p-5 backdrop-blur shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="size-5" />
              <h3 className="font-bold text-foreground">나이스(NEIS) 명렬표 일괄 등록</h3>
            </div>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              체육 수업을 시작하거나 새 학기에 여러 반 학생 정보를 동시에 간편히 대량 업로드하여 등록할 때 사용할 수 있습니다. 기존 전적 정보는 완벽하게 보호됩니다.
            </p>
          </div>
          <Button
            onClick={() => setShowBulkUpload(!showBulkUpload)}
            variant="outline"
            size="lg"
            className="mt-5 w-full border-border/80 text-foreground font-bold hover:bg-accent/40 active:scale-95 transition-all"
          >
            <Database className="mr-2 size-4" /> 일괄 등록/갱신 패널 {showBulkUpload ? "닫기" : "열기"}
          </Button>
        </Card>
      </div>

      {/* Bulk Upload panel (Conditional) */}
      {showBulkUpload && (
        <Card className="border-border/60 bg-card/60 p-5 backdrop-blur shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="mb-3">
            <h3 className="font-bold text-sm">나이스(NEIS) 명렬표 일괄 복사/붙여넣기</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              엑셀에서 <span className="font-mono text-foreground bg-muted px-1 rounded">학년 / 반 / 번호 / 이름 / (성별)</span> 순으로 정렬된 셀을 복사 후 붙여넣으세요. 성별(남/여)은 없어도 되며 누락 시 미지정 처리됩니다. 이미 등록된 학생의 전적은 철저히 유지됩니다.
            </p>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`5\t1\t1\t홍길동\t남\n5\t1\t2\t김민지\t여\n6\t2\t3\t이영희\t여\n6\t2\t4\t박민수\t남`}
            className="min-h-[160px] resize-y border-border/60 bg-background/60 font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="rounded bg-muted/60 px-2 py-0.5">
              현재 등록 인원: <span className="font-bold text-foreground">{count}명</span>
            </span>
            <span className="rounded bg-neon-blue/15 px-2 py-0.5 text-neon-blue">
              인식된 행: <span className="font-bold">{parsed.rows.length}</span>
            </span>
            {parsed.errors > 0 && (
              <span className="flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-destructive">
                <AlertCircle className="size-3" /> 무시된 줄: {parsed.errors}
              </span>
            )}
          </div>

          {parsed.rows.length > 0 && (
            <Card className="overflow-hidden border-border/40 bg-card/40 p-0 mt-4">
              <div className="border-b border-border/40 px-4 py-2 text-xs font-semibold">파싱 결과 미리보기 ({parsed.rows.length}명)</div>
              <div className="max-h-[220px] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left">#</th>
                      <th className="px-3 py-1.5 text-left">학년</th>
                      <th className="px-3 py-1.5 text-left">반</th>
                      <th className="px-3 py-1.5 text-left">번호</th>
                      <th className="px-3 py-1.5 text-left">이름</th>
                      <th className="px-3 py-1.5 text-left">성별</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/20">
                        <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.grade}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.classNum}</td>
                        <td className="px-3 py-1.5 tabular-nums">{r.number}</td>
                        <td className="px-3 py-1.5 font-medium">{r.name}</td>
                        <td className="px-3 py-1.5"><GenderMark gender={r.gender ?? "U"} className="size-3.5 text-[9px]" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Button
            size="lg"
            onClick={commit}
            disabled={parsed.rows.length === 0}
            className="h-10 w-full mt-4 bg-gradient-to-r from-neon-green to-neon-blue font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:shadow-none"
          >
            <Database className="mr-2 size-4" /> 명단 업로드 실행 ({parsed.rows.length}명)
          </Button>
        </Card>
      )}

      {/* 3.5. League Settings Calibration: Custom Tier Thresholds & RP Deltas */}
      <Card className="border-border/60 bg-card/60 p-6 backdrop-blur shadow-xl">
        <div className="mb-4">
          <div className="flex items-center gap-2 text-neon-blue">
            <Save className="size-5" />
            <h3 className="font-black text-lg">티어 및 RP 설정 (League Settings Calibration)</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            티어 등급별 최소 진입 RP 커트라인 기준점과 경기 승/패 시 가감되는 기본 변동 RP 점수를 자유롭게 미세 조율하여 리그 밸런스를 커스텀 설정합니다.
          </p>
        </div>

        <div className="space-y-6 pt-2">
          {/* Tier Thresholds Inputs Group with Sliders */}
          <div>
            <span className="text-xs text-neon-blue font-bold uppercase tracking-wider block mb-3">티어별 최저 RP 기준점 (Tier Cutoffs Sliders)</span>
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 bg-card/40 p-5 rounded-2xl border border-border/30">
              
              {/* Bronze */}
              <div className="space-y-2 rounded-xl bg-background/30 p-3 border border-border/20">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-tier-bronze">브론즈</label>
                  <span className="font-mono text-xs font-bold text-tier-bronze bg-tier-bronze/10 px-2 py-0.5 rounded">{inputBronze} RP</span>
                </div>
                <Slider
                  value={[parseInt(inputBronze, 10) || 0]}
                  onValueChange={(val) => setInputBronze(val[0].toString())}
                  min={0}
                  max={1000}
                  step={10}
                  className="py-2"
                />
              </div>

              {/* Silver */}
              <div className="space-y-2 rounded-xl bg-background/30 p-3 border border-border/20">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-tier-silver">실버</label>
                  <span className="font-mono text-xs font-bold text-tier-silver bg-tier-silver/10 px-2 py-0.5 rounded">{inputSilver} RP</span>
                </div>
                <Slider
                  value={[parseInt(inputSilver, 10) || 0]}
                  onValueChange={(val) => setInputSilver(val[0].toString())}
                  min={500}
                  max={2000}
                  step={10}
                  className="py-2"
                />
              </div>

              {/* Gold */}
              <div className="space-y-2 rounded-xl bg-background/30 p-3 border border-border/20">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-tier-gold">골드</label>
                  <span className="font-mono text-xs font-bold text-tier-gold bg-tier-gold/10 px-2 py-0.5 rounded">{inputGold} RP</span>
                </div>
                <Slider
                  value={[parseInt(inputGold, 10) || 0]}
                  onValueChange={(val) => setInputGold(val[0].toString())}
                  min={800}
                  max={2500}
                  step={10}
                  className="py-2"
                />
              </div>

              {/* Platinum */}
              <div className="space-y-2 rounded-xl bg-background/30 p-3 border border-border/20">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-tier-platinum">플래티넘</label>
                  <span className="font-mono text-xs font-bold text-tier-platinum bg-tier-platinum/10 px-2 py-0.5 rounded">{inputPlatinum} RP</span>
                </div>
                <Slider
                  value={[parseInt(inputPlatinum, 10) || 0]}
                  onValueChange={(val) => setInputPlatinum(val[0].toString())}
                  min={1000}
                  max={3000}
                  step={10}
                  className="py-2"
                />
              </div>

              {/* Diamond */}
              <div className="space-y-2 rounded-xl bg-background/30 p-3 border border-border/20">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-tier-diamond">다이아몬드</label>
                  <span className="font-mono text-xs font-bold text-tier-diamond bg-tier-diamond/10 px-2 py-0.5 rounded">{inputDiamond} RP</span>
                </div>
                <Slider
                  value={[parseInt(inputDiamond, 10) || 0]}
                  onValueChange={(val) => setInputDiamond(val[0].toString())}
                  min={1200}
                  max={3500}
                  step={10}
                  className="py-2"
                />
              </div>

            </div>
          </div>

          {/* RP Deltas Inputs Group */}
          <div className="border-t border-border/30 pt-4">
            <span className="text-xs text-neon-green font-bold uppercase tracking-wider block mb-3">승/패 RP 변동폭 설정 (Delta Variables)</span>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Win Delta */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-win">경기 이겼을 때 상승 RP</label>
                  <span className="text-[10px] text-muted-foreground font-mono">(기본값: +25)</span>
                </div>
                <Input
                  type="number"
                  value={inputWinDelta}
                  onChange={(e) => setInputWinDelta(e.target.value)}
                  className="font-mono font-bold bg-background/60 border-win/30 text-win focus-visible:ring-win"
                  placeholder="예: 25"
                />
              </div>

              {/* Lose Delta */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-loss">경기 졌을 때 하락 RP</label>
                  <span className="text-[10px] text-muted-foreground font-mono">(기본값: -20)</span>
                </div>
                <Input
                  type="number"
                  value={inputLoseDelta}
                  onChange={(e) => setInputLoseDelta(e.target.value)}
                  className="font-mono font-bold bg-background/60 border-loss/30 text-loss focus-visible:ring-loss"
                  placeholder="예: 20"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSaveSettings}
              className="w-full bg-gradient-to-r from-neon-blue to-neon-green text-primary-foreground font-black tracking-wide h-12 shadow-lg active:scale-95 transition-all"
            >
              <Save className="size-4.5 mr-2" /> 캘리브레이션 리그 설정 저장 및 반영
            </Button>
          </div>
        </div>
      </Card>

      {/* 4. Danger Zone: Global Reset with Password Verification */}
      <Card className="border border-destructive/40 bg-destructive/5 p-5 backdrop-blur shadow-lg">
        <div className="flex items-center gap-2 text-destructive mb-3">
          <ShieldAlert className="size-5" />
          <h3 className="font-black text-base">위험 구역 (Danger Zone)</h3>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <h4 className="text-sm font-bold text-foreground">새 시즌 시작 (전체 기록 리셋)</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              이 작업은 시스템 상의 **모든 등록된 학생들의 경기 타임라인 및 결과 기록을 완벽히 소멸**시키고, 전체 학생의 RP 점수 및 전적 데이터를 **초기값(1000점, 0승 0패, 최근기록 없음)**으로 일괄 초기화합니다. 실행 시 교사 승인 비밀번호 입력이 필요합니다.
            </p>
          </div>
          
          <div className="shrink-0 self-end sm:self-center">
            <Button
              onClick={handleGlobalReset}
              variant="destructive"
              className="bg-destructive font-black tracking-wide hover:bg-destructive/80 active:scale-95 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)]"
            >
              <RotateCcw className="mr-2 size-4" /> 새 시즌 일괄 리셋 시작
            </Button>
          </div>
        </div>
      </Card>

      {/* CSV 롤백 복원 경고 팝업 */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent className="border-destructive/30 bg-background/95 max-w-md shadow-2xl rounded-2xl backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-destructive flex items-center gap-2">
              <ShieldAlert className="size-5 shrink-0" /> 데이터 복구 경고
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
              기존 데이터가 모두 삭제되고 업로드한 파일 기준으로 복구됩니다. 진행하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel 
              onClick={() => {
                setRestoreDialogOpen(false);
                setPendingRestoreData(null);
              }}
              className="font-bold border-border/80 text-foreground hover:bg-accent/40 active:scale-95 transition-all rounded-xl h-11 px-5"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (pendingRestoreData) {
                  onRestoreFromCSV?.(pendingRestoreData, []);
                  toast.success("성공적으로 데이터가 롤백되었습니다!");
                }
                setRestoreDialogOpen(false);
                setPendingRestoreData(null);
              }}
              className="font-black bg-destructive hover:bg-destructive/80 active:scale-95 transition-all text-white rounded-xl h-11 px-5 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
            >
              진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

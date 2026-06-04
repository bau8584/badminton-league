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
  Save,
  Pencil,
  Swords,
  Calendar,
  Users,
  Settings
} from "lucide-react";
import type { Gender, Student, Match, TierName } from "@/lib/league-types";
import { useLeagueStore, type ActiveBonuses } from "@/lib/league-store";
import { getTier, TIER_STYLES, getFullTierLabel } from "@/lib/league-types";
import { GenderMark } from "./GenderMark";
import { TierBadge } from "./TierBadge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { SecurityModal } from "./SecurityModal";
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
  onBulkDecay,
  teacherAccessCode,
  onUpdateMatchScore,
  title,
  activeBonuses,
  onSaveLeagueSettings,
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
  onBulkDecay?: (inactiveDays: number, decayAmount: number) => number;
  teacherAccessCode: string;
  onUpdateMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  title?: string;
  activeBonuses?: ActiveBonuses;
  onSaveLeagueSettings?: (title: string, bonuses: ActiveBonuses) => Promise<void>;
}) {
  // CSV 롤백 복원 상태
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<Student[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이중 보안 상태 및 자동 잠금 훅
  const [isUnlocked, setIsUnlocked] = useState(false);
  const { session } = useLeagueStore();
  const isDemo = session?.loginId === "guest" || session?.schoolName?.includes("꿈나무");

  // 경기 점수 세부 수정 기능 상태
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScoreA, setEditScoreA] = useState<string>("");
  const [editScoreB, setEditScoreB] = useState<string>("");

  // 경기 기록 필터링 관련 카테고리 상태
  const [matchFilterType, setMatchFilterType] = useState<"recent" | "student" | "date" | "class">("recent");
  const [matchSearchStudent, setMatchSearchStudent] = useState("");
  const [matchSearchDate, setMatchSearchDate] = useState("");
  const [matchSearchGradeClass, setMatchSearchGradeClass] = useState("");

  // 실제 필터에 적용되는 검색어 상태 (버튼 클릭 / 엔터 시점에만 갱신하여 렉 발생 방지)
  const [appliedSearchStudent, setAppliedSearchStudent] = useState("");
  const [appliedSearchDate, setAppliedSearchDate] = useState("");
  const [appliedSearchGradeClass, setAppliedSearchGradeClass] = useState("");
  const [isMatchListOpen, setIsMatchListOpen] = useState(false);

  // 리그 환경 설정 상태
  const [localTitle, setLocalTitle] = useState(title || "");
  const [localBonuses, setLocalBonuses] = useState<ActiveBonuses>({
    firstWin: activeBonuses?.firstWin ?? true,
    revenge: activeBonuses?.revenge ?? true,
    underdog: activeBonuses?.underdog ?? true,
    scoreDiff: activeBonuses?.scoreDiff ?? true,
    rival: activeBonuses?.rival ?? true,
  });

  useEffect(() => {
    if (title) setLocalTitle(title);
  }, [title]);

  useEffect(() => {
    if (activeBonuses) {
      setLocalBonuses(activeBonuses);
    }
  }, [activeBonuses]);

  useEffect(() => {
    setIsUnlocked(false);
    return () => {
      setIsUnlocked(false);
    };
  }, []);

  const handleSaveScoreEdit = () => {
    if (!editingMatchId) return;
    const sA = parseInt(editScoreA, 10);
    const sB = parseInt(editScoreB, 10);

    if (isNaN(sA) || sA < 0 || isNaN(sB) || sB < 0) {
      return toast.error("올바른 점수 값을 입력해 주세요 (0점 이상).");
    }

    if (sA === sB) {
      return toast.error("경기는 동점으로 끝날 수 없습니다. 승패가 결정되는 점수를 입력해 주세요.");
    }

    onUpdateMatchScore(editingMatchId, sA, sB);
    setEditingMatchId(null);
    toast.success("경기 점수가 수정되었으며 두 학생의 보너스 및 최종 RP가 오차 없이 즉시 재계산되어 덮어씌워졌습니다!");
  };

  // 3.9. All Match Records Filtered Matches Computing
  const filteredMatches = useMemo(() => {
    if (!matches) return [];

    let result = [...matches];

    // Sort all matches initially by date descending (most recent first)
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (matchFilterType === "recent") {
      return result.slice(0, 20);
    }

    if (matchFilterType === "student") {
      const query = appliedSearchStudent.trim().toLowerCase();
      if (!query) return []; // 검색하기 전에는 빈 배열 반환하여 버벅임 방지
      return result.filter((m) => {
        const playerA = students.find((s) => s.id === m.playerAId);
        const playerB = students.find((s) => s.id === m.playerBId);
        return (
          (playerA && playerA.name.toLowerCase().includes(query)) ||
          (playerB && playerB.name.toLowerCase().includes(query))
        );
      });
    }

    if (matchFilterType === "date") {
      const query = appliedSearchDate.trim();
      if (!query) return []; // 검색하기 전에는 빈 배열 반환하여 버벅임 방지
      return result.filter((m) => {
        const mDate = new Date(m.date);
        const mMonth = mDate.getMonth() + 1;
        const mDay = mDate.getDate();

        // 1. Month/Day combo formats: "6/2", "6-2", "6.2", "6 2"
        const parts = query.split(/[\/\-\.\s]+/);
        if (parts.length === 2) {
          const qMonth = parseInt(parts[0], 10);
          const qDay = parseInt(parts[1], 10);
          if (!isNaN(qMonth) && !isNaN(qDay)) {
            return mMonth === qMonth && mDay === qDay;
          }
        }

        // 2. Single digit e.g. "2" -> match month OR day
        if (/^\d+$/.test(query)) {
          const qNum = parseInt(query, 10);
          return mMonth === qNum || mDay === qNum;
        }

        // 3. String representations (e.g. "6월 2일", "2026-06-02")
        const localDateStr = mDate.toLocaleString("ko-KR", { month: "long", day: "numeric" });
        const localDateShort = mDate.toLocaleString("ko-KR", { month: "short", day: "numeric" });
        const isoStr = mDate.toISOString().split("T")[0];

        return (
          localDateStr.toLowerCase().includes(query.toLowerCase()) ||
          localDateShort.toLowerCase().includes(query.toLowerCase()) ||
          isoStr.includes(query)
        );
      });
    }

    if (matchFilterType === "class") {
      const query = appliedSearchGradeClass.trim();
      if (!query) return []; // 검색하기 전에는 빈 배열 반환하여 버벅임 방지

      // 1. Grade-Class format like "6-1", "6 1", "6/1", "6학년 1반"
      const parts = query.split(/[\-\s\/학년반]+/);
      if (parts.length >= 2) {
        const qGrade = parseInt(parts[0], 10);
        const qClass = parseInt(parts[1], 10);
        if (!isNaN(qGrade) && !isNaN(qClass)) {
          return result.filter((m) => {
            const playerA = students.find((s) => s.id === m.playerAId);
            const playerB = students.find((s) => s.id === m.playerBId);
            const aMatch = playerA && playerA.grade === qGrade && playerA.classNum === qClass;
            const bMatch = playerB && playerB.grade === qGrade && playerB.classNum === qClass;
            return aMatch || bMatch;
          });
        }
      }

      // 2. Just a single number like "6" -> match grade OR class
      const qNum = parseInt(query, 10);
      if (!isNaN(qNum)) {
        return result.filter((m) => {
          const playerA = students.find((s) => s.id === m.playerAId);
          const playerB = students.find((s) => s.id === m.playerBId);
          return (
            (playerA && (playerA.grade === qNum || playerA.classNum === qNum)) ||
            (playerB && (playerB.grade === qNum || playerB.classNum === qNum))
          );
        });
      }

      // 3. String representation
      return result.filter((m) => {
        const playerA = students.find((s) => s.id === m.playerAId);
        const playerB = students.find((s) => s.id === m.playerBId);
        const aStr = playerA ? `${playerA.grade}-${playerA.classNum}` : "";
        const bStr = playerB ? `${playerB.grade}-${playerB.classNum}` : "";
        return aStr.includes(query) || bStr.includes(query);
      });
    }

    return result;
  }, [matches, students, matchFilterType, appliedSearchStudent, appliedSearchDate, appliedSearchGradeClass]);



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

  // 휴면 강등(RP Decay) 관리 상태
  const [inactiveDays, setInactiveDays] = useState("7");
  const [decayAmount, setDecayAmount] = useState("15");

  const handleBulkDecay = () => {
    const days = parseInt(inactiveDays, 10);
    const amount = parseInt(decayAmount, 10);

    if (isNaN(days) || days <= 0) {
      return toast.error("기준 미활동 일수는 1일 이상이어야 합니다.");
    }
    if (isNaN(amount) || amount <= 0) {
      return toast.error("차감할 RP는 1점 이상이어야 합니다.");
    }

    if (!onBulkDecay) return;

    // 골드 커트라인 획득
    const goldCutoff = thresholds?.Gold ?? 1200;
    const now = new Date().getTime();
    const msThreshold = days * 24 * 60 * 60 * 1000;

    const dormantStudents = students.filter((s) => {
      if (s.rp < goldCutoff) return false;
      if (!s.lastMatchDate) return false;
      const lastTime = new Date(s.lastMatchDate).getTime();
      return (now - lastTime) >= msThreshold;
    });

    if (dormantStudents.length === 0) {
      return toast.info(`최근 ${days}일 동안 경기가 없고 골드 등급 이상인 휴면 감점 대상 학생이 없습니다.`);
    }

    const confirmMsg = `골드 등급 이상이면서 최근 ${days}일 이상 경기를 치르지 않은 휴면 학생 ${dormantStudents.length}명에게서 각각 -${amount} RP를 일괄 감점 차감하시겠습니까?\n\n[차감 대상 학생]\n${dormantStudents.map((s) => `- ${s.grade}학년 ${s.classNum}반 ${s.name} (${s.rp} RP)`).join("\n")}`;

    if (!confirm(confirmMsg)) return;

    const decayCount = onBulkDecay(days, amount);
    toast.success(`휴면 유저 일괄 감점이 반영되었습니다! 총 ${decayCount}명의 학생 RP가 정상적으로 차감 처리되었습니다.`);
  };

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

  // 보안 잠금 가드 렌더링
  if (!isUnlocked && !isDemo) {
    return (
      <SecurityModal
        correctCode={teacherAccessCode}
        onSuccess={() => setIsUnlocked(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. League Configuration: Title and Bonus Toggles (리그 환경 설정) */}
      <Card className="border border-border/60 bg-card/60 p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-neon-blue">
              <Settings className="size-5" />
              <h3 className="font-black text-lg">리그 환경 설정 (League Configurations)</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              리그의 이름과 경기 진행 시 지급할 각종 보너스 RP 규칙을 설정하고 관리합니다.
            </p>
          </div>
          <Button
            onClick={async () => {
              if (onSaveLeagueSettings) {
                try {
                  await onSaveLeagueSettings(localTitle, localBonuses);
                  toast.success("리그 환경 설정이 클라우드 및 로컬에 성공적으로 저장되었습니다!");
                } catch (e) {
                  toast.error("설정 저장에 실패했습니다.");
                }
              }
            }}
            className="bg-neon-blue hover:bg-neon-blue/80 text-primary-foreground font-black px-6 h-10 transition-all active:scale-95 rounded-xl shadow-md font-sans text-xs shrink-0 self-end md:self-center"
          >
            <Save className="size-4 mr-1.5" /> 설정 저장
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* League Title Setting */}
          <div className="space-y-2 rounded-xl bg-background/30 p-5 border border-border/20">
            <label className="text-xs font-bold text-neon-blue block uppercase tracking-wider">리그 이름 설정</label>
            <div className="relative">
              <Input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                placeholder="예: 2026 초등 리그전"
                className="pr-12 h-10 border-border/50 bg-background/40 hover:bg-background/60 focus:bg-background/80 transition-all font-sans text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
              학생들이 로그인했을 때 화면 상단에 표시되는 공식 리그 명칭입니다.
            </p>
          </div>

          {/* Bonus RP Toggles */}
          <div className="space-y-4 rounded-xl bg-background/30 p-5 border border-border/20">
            <span className="text-xs font-bold text-neon-blue block uppercase tracking-wider">보너스 RP 스위치</span>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              
              {/* firstWin */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/25">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">🌟 오늘의 첫 승</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">+15 RP 보너스</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalBonuses(prev => ({ ...prev, firstWin: !prev.firstWin }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5",
                    localBonuses.firstWin ? "bg-neon-blue" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white transition-transform shadow-sm",
                    localBonuses.firstWin ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

              {/* revenge */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/25">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">😈 복수전 성공</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">+10 RP 보너스</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalBonuses(prev => ({ ...prev, revenge: !prev.revenge }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5",
                    localBonuses.revenge ? "bg-neon-blue" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white transition-transform shadow-sm",
                    localBonuses.revenge ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

              {/* underdog */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/25">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">🛡️ 언더독 격파</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">점수 차 비례(10%)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalBonuses(prev => ({ ...prev, underdog: !prev.underdog }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5",
                    localBonuses.underdog ? "bg-neon-blue" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white transition-transform shadow-sm",
                    localBonuses.underdog ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

              {/* scoreDiff */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/25">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">🔥 압승 보너스</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">대승 시 추가 보너스</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalBonuses(prev => ({ ...prev, scoreDiff: !prev.scoreDiff }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5",
                    localBonuses.scoreDiff ? "bg-neon-blue" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white transition-transform shadow-sm",
                    localBonuses.scoreDiff ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

              {/* rival */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-background/25">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-foreground">⚔️ 라이벌 격파</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">+5 RP 보너스</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLocalBonuses(prev => ({ ...prev, rival: !prev.rival }))}
                  className={cn(
                    "w-10 h-6 rounded-full transition-colors relative flex items-center px-0.5",
                    localBonuses.rival ? "bg-neon-blue" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded-full bg-white transition-transform shadow-sm",
                    localBonuses.rival ? "translate-x-4" : "translate-x-0"
                  )} />
                </button>
              </div>

            </div>
          </div>
        </div>
      </Card>

      {/* 3.9. All Match Records Integrated Management Section (전체 경기 기록 통합 관리) */}
      <Card className="border border-border/60 bg-card/60 p-6 backdrop-blur shadow-xl relative overflow-hidden">
        {/* Clickable Header for Collapsible Toggle */}
        <div 
          onClick={() => setIsMatchListOpen(!isMatchListOpen)}
          className="flex items-center justify-between cursor-pointer select-none group"
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 text-neon-blue group-hover:text-neon-blue/80 transition-colors">
              <Swords className="size-5 animate-pulse" />
              <h3 className="font-black text-lg">전체 경기 기록 통합 관리</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
              리그에 기록된 모든 매치 데이터를 조회하고, 경기 점수를 소급 수정하거나 완전 삭제하여 RP 및 전적을 안전하게 롤백 복원합니다. (태블릿 환경 최적화)
            </p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/40 border border-border/20 text-xs font-black text-muted-foreground group-hover:text-foreground group-hover:bg-muted/80 group-hover:border-neon-blue/30 transition-all shrink-0">
            <span>전체 경기 기록 {isMatchListOpen ? "닫기" : "열기"}</span>
            <span className="text-xs transition-transform duration-300">
              {isMatchListOpen ? "▲" : "▼"}
            </span>
          </div>
        </div>

        {/* Smooth transition collapsible content wrapper */}
        <div className={cn(
          "grid transition-all duration-300 ease-in-out",
          isMatchListOpen ? "grid-rows-[1fr] opacity-100 mt-5" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden min-h-0">
            {/* Category Selector Tabs & Inputs for Dynamic Loading/Filtering */}
        <div className="mb-5 space-y-3">
          <div className="p-1 bg-muted/40 border border-border/20 rounded-xl flex flex-wrap gap-1.5 w-full md:w-max">
            <button
              onClick={() => {
                setMatchFilterType("recent");
                setMatchSearchStudent("");
                setMatchSearchDate("");
                setMatchSearchGradeClass("");
                setAppliedSearchStudent("");
                setAppliedSearchDate("");
                setAppliedSearchGradeClass("");
              }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all active:scale-95",
                matchFilterType === "recent"
                  ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/35 shadow-sm shadow-neon-blue/10"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/50"
              )}
            >
              <Swords className="size-3.5" />
              최근 20경기
            </button>
            <button
              onClick={() => {
                setMatchFilterType("student");
                setMatchSearchStudent("");
                setMatchSearchDate("");
                setMatchSearchGradeClass("");
                setAppliedSearchStudent("");
                setAppliedSearchDate("");
                setAppliedSearchGradeClass("");
              }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all active:scale-95",
                matchFilterType === "student"
                  ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/35 shadow-sm shadow-neon-blue/10"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/50"
              )}
            >
              <Search className="size-3.5" />
              학생 이름 검색
            </button>
            <button
              onClick={() => {
                setMatchFilterType("date");
                setMatchSearchStudent("");
                setMatchSearchDate("");
                setMatchSearchGradeClass("");
                setAppliedSearchStudent("");
                setAppliedSearchDate("");
                setAppliedSearchGradeClass("");
              }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all active:scale-95",
                matchFilterType === "date"
                  ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/35 shadow-sm shadow-neon-blue/10"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/50"
              )}
            >
              <Calendar className="size-3.5" />
              날짜 검색 (6/2 등)
            </button>
            <button
              onClick={() => {
                setMatchFilterType("class");
                setMatchSearchStudent("");
                setMatchSearchDate("");
                setMatchSearchGradeClass("");
                setAppliedSearchStudent("");
                setAppliedSearchDate("");
                setAppliedSearchGradeClass("");
              }}
              className={cn(
                "px-3.5 py-2 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all active:scale-95",
                matchFilterType === "class"
                  ? "bg-neon-blue/15 text-neon-blue border border-neon-blue/35 shadow-sm shadow-neon-blue/10"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/50"
              )}
            >
              <Users className="size-3.5" />
              학년·반 검색 (6-1 등)
            </button>
          </div>

          {/* Conditional search inputs with premium glass style */}
          {matchFilterType === "student" && (
            <div className="flex gap-2 max-w-md w-full animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/75" />
                <Input
                  type="text"
                  placeholder="조회할 학생 이름을 입력하세요..."
                  value={matchSearchStudent}
                  onChange={(e) => setMatchSearchStudent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAppliedSearchStudent(matchSearchStudent);
                    }
                  }}
                  className="pl-10 pr-16 h-10 border-border/50 bg-background/40 hover:bg-background/60 focus:bg-background/80 transition-all font-sans text-xs"
                />
                {matchSearchStudent && (
                  <button
                    onClick={() => {
                      setMatchSearchStudent("");
                      setAppliedSearchStudent("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/65 hover:bg-muted px-2 py-1 rounded-md transition-colors"
                  >
                    지우기
                  </button>
                )}
              </div>
              <Button
                onClick={() => setAppliedSearchStudent(matchSearchStudent)}
                className="bg-neon-blue hover:bg-neon-blue/80 text-primary-foreground font-bold h-10 px-4 shrink-0 transition-all active:scale-95 rounded-xl shadow-md font-sans text-xs"
              >
                검색
              </Button>
            </div>
          )}

          {matchFilterType === "date" && (
            <div className="flex gap-2 max-w-md w-full animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex-1">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/75" />
                <Input
                  type="text"
                  placeholder="조회할 날짜를 입력하세요 (예: 6/2, 6월 2일)..."
                  value={matchSearchDate}
                  onChange={(e) => setMatchSearchDate(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAppliedSearchDate(matchSearchDate);
                    }
                  }}
                  className="pl-10 pr-16 h-10 border-border/50 bg-background/40 hover:bg-background/60 focus:bg-background/80 transition-all font-sans text-xs"
                />
                {matchSearchDate && (
                  <button
                    onClick={() => {
                      setMatchSearchDate("");
                      setAppliedSearchDate("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/65 hover:bg-muted px-2 py-1 rounded-md transition-colors"
                  >
                    지우기
                  </button>
                )}
              </div>
              <Button
                onClick={() => setAppliedSearchDate(matchSearchDate)}
                className="bg-neon-blue hover:bg-neon-blue/80 text-primary-foreground font-bold h-10 px-4 shrink-0 transition-all active:scale-95 rounded-xl shadow-md font-sans text-xs"
              >
                검색
              </Button>
            </div>
          )}

          {matchFilterType === "class" && (
            <div className="flex gap-2 max-w-md w-full animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="relative flex-1">
                <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/75" />
                <Input
                  type="text"
                  placeholder="조회할 학년-반을 입력하세요 (예: 6-1, 6)..."
                  value={matchSearchGradeClass}
                  onChange={(e) => setMatchSearchGradeClass(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setAppliedSearchGradeClass(matchSearchGradeClass);
                    }
                  }}
                  className="pl-10 pr-16 h-10 border-border/50 bg-background/40 hover:bg-background/60 focus:bg-background/80 transition-all font-sans text-xs"
                />
                {matchSearchGradeClass && (
                  <button
                    onClick={() => {
                      setMatchSearchGradeClass("");
                      setAppliedSearchGradeClass("");
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground hover:text-foreground bg-muted/65 hover:bg-muted px-2 py-1 rounded-md transition-colors"
                  >
                    지우기
                  </button>
                )}
              </div>
              <Button
                onClick={() => setAppliedSearchGradeClass(matchSearchGradeClass)}
                className="bg-neon-blue hover:bg-neon-blue/80 text-primary-foreground font-bold h-10 px-4 shrink-0 transition-all active:scale-95 rounded-xl shadow-md font-sans text-xs"
              >
                검색
              </Button>
            </div>
          )}
        </div>

        {/* Matches table container with horizontal scroll for smaller screens / tablets */}
        <div className="overflow-x-auto rounded-xl border border-border/30 bg-muted/5">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <tr>
                <th className="px-4 py-3">경기 일시</th>
                <th className="px-4 py-3">대결 학생 A</th>
                <th className="px-4 py-3 text-center">점수</th>
                <th className="px-4 py-3">대결 학생 B</th>
                <th className="px-4 py-3">RP 및 획득 보상 변동 내역</th>
                <th className="px-4 py-3 text-right">관리 작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredMatches && filteredMatches.length > 0 ? (
                filteredMatches.map((m) => {
                    const playerA = students.find((s) => s.id === m.playerAId) ?? {
                      name: "알 수 없는 학생",
                      grade: 0,
                      classNum: 0,
                      number: 0,
                      gender: "U" as Gender
                    };
                    const playerB = students.find((s) => s.id === m.playerBId) ?? {
                      name: "알 수 없는 학생",
                      grade: 0,
                      classNum: 0,
                      number: 0,
                      gender: "U" as Gender
                    };

                    const aWon = m.scoreA > m.scoreB;
                    const matchDateStr = new Date(m.date).toLocaleString("ko-KR", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    });

                    // Gather individual bonuses to display as premium badges
                    const bonusesA = [];
                    if (m.rivalBonusA && m.rivalBonusA > 0) bonusesA.push("⚔️ 라이벌 (+5)");
                    if (m.firstWinBonusA && m.firstWinBonusA > 0) bonusesA.push("🌟 첫승 (+15)");
                    if (m.revengeBonusA && m.revengeBonusA > 0) bonusesA.push("😈 복수 (+10)");
                    if (m.underdogBonusA && m.underdogBonusA > 0) bonusesA.push(`🛡️ 언더독 (+${m.underdogBonusA})`);
                    if (m.scoreDiffBonusA && m.scoreDiffBonusA > 0) bonusesA.push(`🔥 압승 (+${m.scoreDiffBonusA})`);

                    const bonusesB = [];
                    if (m.rivalBonusB && m.rivalBonusB > 0) bonusesB.push("⚔️ 라이벌 (+5)");
                    if (m.firstWinBonusB && m.firstWinBonusB > 0) bonusesB.push("🌟 첫승 (+15)");
                    if (m.revengeBonusB && m.revengeBonusB > 0) bonusesB.push("😈 복수 (+10)");
                    if (m.underdogBonusB && m.underdogBonusB > 0) bonusesB.push(`🛡️ 언더독 (+${m.underdogBonusB})`);
                    if (m.scoreDiffBonusB && m.scoreDiffBonusB > 0) bonusesB.push(`🔥 압승 (+${m.scoreDiffBonusB})`);

                    return (
                      <tr key={m.id} className="border-b border-border/20 hover:bg-accent/10 transition-colors">
                        {/* 1. Date */}
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{matchDateStr}</td>
                        
                        {/* 2. Player A */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <GenderMark gender={playerA.gender} className="size-3.5 text-[9px]" />
                            <span className={cn("font-bold", aWon && "text-neon-blue")}>{playerA.name}</span>
                            <span className="text-[10px] text-muted-foreground">({playerA.grade}-{playerA.classNum})</span>
                          </div>
                        </td>

                        {/* 3. Score */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className="font-mono font-bold bg-muted/60 px-2.5 py-1 rounded text-sm select-none">
                            <span className={cn(aWon ? "text-win" : "text-loss")}>{m.scoreA}</span>
                            <span className="text-muted-foreground mx-1">:</span>
                            <span className={cn(!aWon ? "text-win" : "text-loss")}>{m.scoreB}</span>
                          </span>
                        </td>

                        {/* 4. Player B */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <GenderMark gender={playerB.gender} className="size-3.5 text-[9px]" />
                            <span className={cn("font-bold", !aWon && "text-neon-blue")}>{playerB.name}</span>
                            <span className="text-[10px] text-muted-foreground">({playerB.grade}-{playerB.classNum})</span>
                          </div>
                        </td>

                        {/* 5. RP Deltas and Audited Bonuses */}
                        <td className="px-4 py-3 max-w-[240px] sm:max-w-xs md:max-w-md lg:max-w-lg">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn("font-mono font-bold text-[10px]", aWon ? "text-win" : "text-loss")}>
                                {playerA.name}: {m.rpDeltaA !== undefined ? (m.rpDeltaA > 0 ? `+${m.rpDeltaA}` : m.rpDeltaA) : 0} RP
                              </span>
                              <span className="text-muted-foreground/45 text-[10px]">|</span>
                              <span className={cn("font-mono font-bold text-[10px]", !aWon ? "text-win" : "text-loss")}>
                                {playerB.name}: {m.rpDeltaB !== undefined ? (m.rpDeltaB > 0 ? `+${m.rpDeltaB}` : m.rpDeltaB) : 0} RP
                              </span>
                            </div>

                            {/* Render visual badges for bonuses A */}
                            {bonusesA.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                <span className="text-[9px] text-muted-foreground font-semibold shrink-0">{playerA.name} 보상:</span>
                                {bonusesA.map((b, idx) => (
                                  <span key={idx} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/20 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Render visual badges for bonuses B */}
                            {bonusesB.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap mt-1">
                                <span className="text-[9px] text-muted-foreground font-semibold shrink-0">{playerB.name} 보상:</span>
                                {bonusesB.map((b, idx) => (
                                  <span key={idx} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/20 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 6. Tablet Actions panel */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Score Edit Button */}
                            <Button
                              onClick={() => {
                                setEditingMatchId(m.id);
                                setEditScoreA(m.scoreA.toString());
                                setEditScoreB(m.scoreB.toString());
                              }}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 rounded-lg border-border/80 text-foreground hover:bg-accent/40 active:scale-95 transition-all text-[11px] font-bold"
                              title="경기 점수 수정"
                            >
                              <Pencil className="size-3.5 mr-1" /> 수정
                            </Button>

                            {/* Record Delete & RP Rollback Button */}
                            <Button
                              onClick={() => {
                                const deltaWinner = aWon ? (m.rpDeltaA !== undefined ? Math.abs(m.rpDeltaA) : 25) : (m.rpDeltaB !== undefined ? Math.abs(m.rpDeltaB) : 25);
                                const deltaLoser = !aWon ? (m.rpDeltaA !== undefined ? Math.abs(m.rpDeltaA) : 20) : (m.rpDeltaB !== undefined ? Math.abs(m.rpDeltaB) : 20);

                                if (window.confirm(`정말로 이 경기 기록(VS ${playerB.name})을 삭제하시겠습니까?\n\n두 학생의 RP가 경기 이전 상태로 완벽하게 롤백 복원됩니다.\n- ${playerA.name}: RP ${aWon ? "-" : "+"}${deltaWinner}\n- ${playerB.name}: RP ${!aWon ? "-" : "+"}${deltaLoser}`)) {
                                  onDeleteMatch(m.id);
                                  toast.success("경기 기록이 완벽히 삭제되었으며 두 학생의 RP 및 전적이 경기 이전으로 롤백 복구되었습니다!");
                                }
                              }}
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg active:scale-95 transition-all shrink-0"
                              title="이 경기 삭제 및 안전 롤백"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground font-medium bg-muted/5 font-sans text-xs">
                    {(() => {
                      if (matchFilterType === "recent") {
                        return "기록된 전체 경기 매치 내역이 전혀 존재하지 않습니다.";
                      }
                      
                      const hasApplied = 
                        (matchFilterType === "student" && appliedSearchStudent) ||
                        (matchFilterType === "date" && appliedSearchDate) ||
                        (matchFilterType === "class" && appliedSearchGradeClass);
                        
                      if (!hasApplied) {
                        return "검색어를 입력하고 '검색' 버튼(또는 엔터)을 누르면 매치 기록을 불러옵니다.";
                      }
                      
                      return "선택한 필터 조건과 일치하는 경기 기록이 존재하지 않습니다.";
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          </div>
        </div>
      </Card>

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

      {/* 3.8. Inactivity RP Decay (Dormant User Control) */}
      <Card className="border border-amber-500/30 bg-amber-500/5 p-6 backdrop-blur shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
          <ShieldAlert className="size-48 text-amber-500" />
        </div>
        
        <div className="mb-4">
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldAlert className="size-5" />
            <h3 className="font-black text-lg">휴면 유저 관리 (Dormant User Control)</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            골드 등급 이상이면서 오랫동안 대결에 참여하지 않은 학생들의 RP를 일괄 감점하여 리그 활성도를 보존합니다.
          </p>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 bg-background/30 p-4 rounded-xl border border-border/30 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">기준 미활동 일수</label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                className="h-10 border-border/60 bg-background/50 focus:border-amber-500 font-sans"
              />
              <span className="absolute right-3 top-2 text-xs text-muted-foreground font-bold">일 이상</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">차감할 RP</label>
            <div className="relative">
              <Input
                type="number"
                min={1}
                value={decayAmount}
                onChange={(e) => setDecayAmount(e.target.value)}
                className="h-10 border-border/60 bg-background/50 focus:border-amber-500 font-sans text-destructive"
              />
              <span className="absolute right-3 top-2 text-xs text-destructive font-bold">RP 감점</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleBulkDecay}
            disabled={!onBulkDecay}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-black tracking-wide h-10 px-6 shadow-md shadow-amber-500/10 active:scale-95 transition-all"
          >
            <ShieldAlert className="size-4.5 mr-2" /> 휴면 유저 일괄 차감 실행
          </Button>
        </div>
      </Card>

      {/* 전체 경기 기록 통합 관리 섹션이 최상단으로 이동되었습니다. */}
      {/* Inline Score Edit Modal Overlaid (Radix Dialog style custom state overlay) */}
      {editingMatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="max-w-sm w-full border border-border/80 bg-background p-6 shadow-2xl rounded-2xl relative z-50 animate-in zoom-in-95 duration-200">
            <h4 className="text-base font-black mb-1 flex items-center gap-1.5 text-foreground">
              <Pencil className="size-4.5 text-neon-blue" /> 경기 세부 점수 수정
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              경기 결과를 수정하면 바뀐 점수를 기반으로 점수차 비례 보상 등의 보너스 및 최종 RP가 오차 없이 다시 자동 계산되어 두 학생에게 즉시 덮어씌워집니다.
            </p>

            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/30 mb-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  A 선수 점수
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editScoreA}
                  onChange={(e) => setEditScoreA(e.target.value)}
                  className="font-mono font-bold text-center text-lg h-12 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  B 선수 점수
                </label>
                <Input
                  type="number"
                  min={0}
                  value={editScoreB}
                  onChange={(e) => setEditScoreB(e.target.value)}
                  className="font-mono font-bold text-center text-lg h-12 bg-background"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => setEditingMatchId(null)}
                variant="outline"
                className="w-1/2 h-10 font-bold border-border/80 text-foreground rounded-xl"
              >
                취소
              </Button>
              <Button
                type="button"
                onClick={handleSaveScoreEdit}
                className="w-1/2 h-10 font-black bg-neon-blue text-primary-foreground hover:opacity-90 rounded-xl"
              >
                저장 및 재계산
              </Button>
            </div>
          </Card>
        </div>
      )}

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

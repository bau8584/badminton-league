import { useEffect, useState, useCallback } from "react";
import type { Student, Match, Gender, TierName } from "./league-types";
import { studentKey, getTier } from "./league-types";

const TIER_RANKING: Record<TierName, number> = {
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5
};

const STUDENTS_KEY = "bdm.students.v2";
const MATCHES_KEY = "bdm.matches.v1";
const TITLE_KEY = "bdm.title.v1";
const LOCKED_KEY = "bdm.locked.v1";
const SETTINGS_KEY = "bdm.settings.v1";

// 세션 영속 저장을 위한 로컬스토리지 키
const SESSION_KEY = "bdm.session.v1";

// 마스터 DB 구글 Apps Script Web App API 주소
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzcu1d1T8pHvzwvcPn2qPFIg8YtCQxsspvfQ6Koa-ie6wWE9UhEvtPzurK92SVeJEMvyQ/exec";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const SEED_STUDENTS: Student[] = [
  { id: uid(), grade: 5, classNum: 1, number: 3,  name: "홍길동", gender: "M", rp: 1320, recent: ["W","W","L","W","W"], wins: 8, losses: 3 },
  { id: uid(), grade: 5, classNum: 1, number: 7,  name: "김철수", gender: "M", rp: 1180, recent: ["L","W","W","L","W"], wins: 6, losses: 5 },
  { id: uid(), grade: 6, classNum: 2, number: 2,  name: "이영희", gender: "F", rp: 1620, recent: ["W","W","W","W","L"], wins: 12, losses: 2 },
  { id: uid(), grade: 6, classNum: 2, number: 9,  name: "박민수", gender: "M", rp: 1450, recent: ["W","L","W","W","W"], wins: 9, losses: 3 },
  { id: uid(), grade: 4, classNum: 3, number: 5,  name: "최서연", gender: "F", rp: 980,  recent: ["L","L","W","L","W"], wins: 3, losses: 6 },
  { id: uid(), grade: 3, classNum: 1, number: 11, name: "정우진", gender: "M", rp: 1050, recent: ["W","L","L","W","L"], wins: 4, losses: 5 },
  { id: uid(), grade: 6, classNum: 1, number: 4,  name: "강하늘", gender: "F", rp: 1530, recent: ["W","W","L","W","W"], wins: 10, losses: 4 },
];

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

type UserSession = {
  loginId: string;
  role: "MASTER" | "TEACHER" | "STUDENT";
  schoolName: string;
  userName: string;
  scriptUrl: string;
  studentId?: string;
} | null;

export function useLeagueStore() {
  const [hydrated, setHydrated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [title, setTitle] = useState<string>("2026 초등 리그전");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 3대 역할 로그인 세션 상태
  const [session, setSession] = useState<UserSession>(null);

  // 리그전 커스텀 설정 상태 추가
  const [tierThresholds, setTierThresholds] = useState<Record<TierName, number>>({
    Bronze: 0,
    Silver: 1000,
    Gold: 1200,
    Platinum: 1400,
    Diamond: 1600
  });
  const [rpVariables, setRpVariables] = useState<{ winDelta: number; loseDelta: number }>({
    winDelta: 25,
    loseDelta: 20
  });

  // 1. 구글 스프레드시트 데이터베이스 전체 일괄 동기화 (POST)
  const syncWithGoogleSheets = useCallback(async (currentStudents: Student[], currentMatches: Match[]) => {
    // 세션에 개인 scriptUrl이 없으면 동기화 생략 (로컬 저장만 적용 - 게스트 모드 포함)
    if (!session || !session.scriptUrl) return;
    setIsSyncing(true);
    try {
      await fetch(session.scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "SYNC_ALL",
          students: currentStudents,
          matches: currentMatches
        })
      });
      console.log("Successfully synced all league data to tenant Google Sheets!");
    } catch (error) {
      console.error("Failed to sync database to Google Sheets:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  // 2. 로그인 수행 함수 (간편 로그인 시스템 도입 - 이메일/PW 제거, 동명이인 방지 추가)
  const loginUser = useCallback(async (
    schoolName: string, 
    accessCodeOrName: string, 
    role: "MASTER" | "TEACHER" | "STUDENT",
    studentGrade?: number,
    studentClass?: number
  ) => {
    const cleanedSchool = schoolName.trim();
    const cleanedCode = accessCodeOrName.trim();

    // A. 🎮 게스트(체험용) 모드 예외 처리 - 구글 통신 없이 즉시 로컬 실행 가동
    if (cleanedSchool.toLowerCase() === "guest") {
      const guestSession = {
        loginId: "guest",
        role: "TEACHER" as const,
        schoolName: "꿈나무 초등학교 (체험용 스포츠 리그)",
        userName: "게스트 교사",
        scriptUrl: ""
      };
      setSession(guestSession);
      saveJSON(SESSION_KEY, guestSession);
      
      const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
      if (!localStudents || localStudents.length === 0) {
        setStudents(SEED_STUDENTS);
        saveJSON(STUDENTS_KEY, SEED_STUDENTS);
      }
      return { success: true };
    }

    setIsSyncing(true);
    try {
      // 1. 청림초등학교 교사 바로 로그인 매핑 지름길 (최우선 처리)
      if (role === "TEACHER" && (cleanedSchool === "청림초" || cleanedSchool === "청림초등학교") && cleanedCode === "1234") {
        const targetSession = {
          loginId: "bau8584",
          role: "TEACHER" as const,
          schoolName: "청림초등학교",
          userName: "박주현",
          scriptUrl: "https://script.google.com/macros/s/AKfycbxXC4J6zKWq_vEEbh_CnARl9V6SD9Dtt_nk1oMcmIZHTJVU5XdqV8xYM5d5YkOu6COEYA/exec"
        };
        setSession(targetSession);
        saveJSON(SESSION_KEY, targetSession);

        // 구글 시트에서 즉시 전적 데이터 끌어오기 (Hydration)
        try {
          const remoteRes = await fetch(targetSession.scriptUrl);
          const remoteData = await remoteRes.json();
          if (remoteData.status === "success") {
            if (remoteData.students) {
              setStudents(remoteData.students);
              saveJSON(STUDENTS_KEY, remoteData.students);
            }
            if (remoteData.matches) {
              setMatches(remoteData.matches);
              saveJSON(MATCHES_KEY, remoteData.matches);
            }
          }
        } catch (err) {
          console.warn("Could not download remote sheet data for Cheonglim. Using cache:", err);
          const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
          if (!localStudents || localStudents.length === 0) {
            setStudents(SEED_STUDENTS);
            saveJSON(STUDENTS_KEY, SEED_STUDENTS);
          }
        }
        return { success: true };
      }

      // 2. 청림초등학교 학생 바로 로그인 매핑 지름길 (원격 명렬 자동 하이드레이션 + 동명이인 대응)
      if (role === "STUDENT" && (cleanedSchool === "청림초" || cleanedSchool === "청림초등학교")) {
        let activeStudents = students;
        const 청림초_scriptUrl = "https://script.google.com/macros/s/AKfycbxXC4J6zKWq_vEEbh_CnARl9V6SD9Dtt_nk1oMcmIZHTJVU5XdqV8xYM5d5YkOu6COEYA/exec";
        
        try {
          const res = await fetch(청림초_scriptUrl);
          const remoteData = await res.json();
          if (remoteData.status === "success" && remoteData.students) {
            activeStudents = remoteData.students;
            setStudents(remoteData.students);
            saveJSON(STUDENTS_KEY, remoteData.students);
            if (remoteData.matches) {
              setMatches(remoteData.matches);
              saveJSON(MATCHES_KEY, remoteData.matches);
            }
          }
        } catch (err) {
          console.warn("Offline or failed fetching student roster from scriptUrl:", err);
        }

        if (activeStudents.length === 0) {
          activeStudents = loadJSON<Student[]>(STUDENTS_KEY, SEED_STUDENTS);
        }

        const matchStudent = activeStudents.find((s) => 
          s.name === cleanedCode && 
          (studentGrade === undefined || s.grade === studentGrade) &&
          (studentClass === undefined || s.classNum === studentClass)
        );

        if (matchStudent) {
          const studentSession = {
            loginId: "student_" + cleanedCode + "_" + matchStudent.id,
            role: "STUDENT" as const,
            schoolName: "청림초등학교",
            userName: cleanedCode,
            studentId: matchStudent.id,
            scriptUrl: 청림초_scriptUrl
          };
          setSession(studentSession);
          saveJSON(SESSION_KEY, studentSession);
          return { success: true };
        } else {
          return { success: false, message: `청림초등학교 명단에 '${studentGrade}학년 ${studentClass}반 ${cleanedCode}' 학생이 존재하지 않습니다. 교사에게 문의하세요.` };
        }
      }

      // 3. MASTER 최고 관리자 또는 기타 등록 계정 로그인 시도 (마스터 API 통신)
      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "LOGIN",
          loginId: role === "MASTER" ? cleanedSchool : (role === "TEACHER" ? cleanedSchool : `student_${cleanedCode}`),
          password: cleanedCode,
          role
        })
      });
      const data = await response.json();
      
      if (data.status === "success" && data.user) {
        setSession(data.user);
        saveJSON(SESSION_KEY, data.user);
        
        if (data.user.scriptUrl) {
          try {
            const remoteRes = await fetch(data.user.scriptUrl);
            const remoteData = await remoteRes.json();
            if (remoteData.status === "success") {
              if (remoteData.students) {
                setStudents(remoteData.students);
                saveJSON(STUDENTS_KEY, remoteData.students);
              }
              if (remoteData.matches) {
                setMatches(remoteData.matches);
                saveJSON(MATCHES_KEY, remoteData.matches);
              }
            }
          } catch (err) {
            console.warn("Could not download remote sheet data upon login. Using cached data:", err);
          }
        }
        return { success: true };
      } else {
        // Fallback for other default teacher (1234) locally
        if (role === "TEACHER" && cleanedCode === "1234") {
          const teacherSession = {
            loginId: "teacher_" + cleanedSchool,
            role: "TEACHER" as const,
            schoolName: cleanedSchool,
            userName: "선생님",
            scriptUrl: ""
          };
          setSession(teacherSession);
          saveJSON(SESSION_KEY, teacherSession);
          
          const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
          if (!localStudents || localStudents.length === 0) {
            setStudents(SEED_STUDENTS);
            saveJSON(STUDENTS_KEY, SEED_STUDENTS);
          }
          return { success: true };
        } else if (role === "STUDENT") {
          // Fallback student local check (동명이인 대응)
          const activeStudents = students.length > 0 ? students : loadJSON<Student[]>(STUDENTS_KEY, SEED_STUDENTS);
          const matchStudent = activeStudents.find((s) => 
            s.name === cleanedCode &&
            (studentGrade === undefined || s.grade === studentGrade) &&
            (studentClass === undefined || s.classNum === studentClass)
          );
          if (matchStudent) {
            const studentSession = {
              loginId: "student_" + cleanedCode + "_" + matchStudent.id,
              role: "STUDENT" as const,
              schoolName: cleanedSchool,
              userName: cleanedCode,
              studentId: matchStudent.id,
              scriptUrl: ""
            };
            setSession(studentSession);
            saveJSON(SESSION_KEY, studentSession);
            return { success: true };
          }
        }
        return { success: false, message: data.message || "로그인 인증 정보가 올바르지 않습니다." };
      }
    } catch (error) {
      console.warn("Master API login offline. Falling back to local validation:", error);
      // Offline fallback
      if (role === "TEACHER") {
        if (cleanedCode === "1234") {
          const teacherSession = {
            loginId: "teacher_" + cleanedSchool,
            role: "TEACHER" as const,
            schoolName: cleanedSchool,
            userName: "선생님",
            scriptUrl: ""
          };
          setSession(teacherSession);
          saveJSON(SESSION_KEY, teacherSession);
          return { success: true };
        } else {
          return { success: false, message: "교사 인증코드가 오프라인 상태에서 일치하지 않습니다. (기본 코드: 1234)" };
        }
      } else if (role === "STUDENT") {
        const activeStudents = students.length > 0 ? students : loadJSON<Student[]>(STUDENTS_KEY, SEED_STUDENTS);
        const matchStudent = activeStudents.find((s) => 
          s.name === cleanedCode &&
          (studentGrade === undefined || s.grade === studentGrade) &&
          (studentClass === undefined || s.classNum === studentClass)
        );
        if (matchStudent) {
          const studentSession = {
            loginId: "student_" + cleanedCode + "_" + matchStudent.id,
            role: "STUDENT" as const,
            schoolName: cleanedSchool,
            userName: cleanedCode,
            studentId: matchStudent.id,
            scriptUrl: ""
          };
          setSession(studentSession);
          saveJSON(SESSION_KEY, studentSession);
          return { success: true };
        }
      }
      return { success: false, message: "마스터 서버 통신 및 로컬 검증에 모두 실패했습니다." };
    } finally {
      setIsSyncing(false);
    }
  }, [students]);

  // 3. 신규 회원가입 수행 함수 (마스터 DB 등록 복원)
  const registerUser = useCallback(async (details: {
    loginId: string;
    password: string;
    role: "TEACHER" | "STUDENT";
    schoolName: string;
    userName: string;
    scriptUrl?: string;
  }) => {
    setIsSyncing(true);
    try {
      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "REGISTER",
          ...details
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || "가입 처리에 실패했습니다." };
      }
    } catch (error) {
      console.error("Registration request failed:", error);
      return { success: false, message: "마스터 가입 서버에 접속할 수 없습니다." };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 4. 로그아웃 수행 함수
  const logoutUser = useCallback(() => {
    setSession(null);
    saveJSON(SESSION_KEY, null);
    // 상태 초기화
    setStudents(SEED_STUDENTS);
    setMatches([]);
    saveJSON(STUDENTS_KEY, SEED_STUDENTS);
    saveJSON(MATCHES_KEY, []);
  }, []);

  // 5. 초기 기동 시 세션 및 로컬 데이터 Hydration
  useEffect(() => {
    const initData = async () => {
      // A. 교사 세션 로딩
      const cachedSession = loadJSON<UserSession>(SESSION_KEY, null);
      setSession(cachedSession);

      // B. 로컬 스토리지 리그 전적 로드
      const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
      const localMatches = loadJSON<Match[]>(MATCHES_KEY, []);
      const localTitle = loadJSON<string>(TITLE_KEY, "2026 초등 리그전");
      const localLocked = loadJSON<boolean>(LOCKED_KEY, false);

      const activeStudents = localStudents && localStudents.length > 0 ? localStudents : SEED_STUDENTS;
      setStudents(activeStudents);
      setMatches(localMatches);
      setTitle(localTitle);
      setIsLocked(localLocked);

      // 설정 로드
      const localSettings = loadJSON<{ thresholds: Record<TierName, number>; rpVars: { winDelta: number; loseDelta: number } } | null>(SETTINGS_KEY, null);
      if (localSettings) {
        if (localSettings.thresholds) setTierThresholds(localSettings.thresholds);
        if (localSettings.rpVars) setRpVariables(localSettings.rpVars);
      }

      setHydrated(true);

      // C. 세션이 살아있는 경우 개인 구글 시트 연동 갱신 (GET)
      if (cachedSession && cachedSession.scriptUrl) {
        setIsSyncing(true);
        try {
          const response = await fetch(cachedSession.scriptUrl);
          const data = await response.json();
          if (data.status === "success") {
            if (data.students && data.students.length > 0) {
              setStudents(data.students);
              saveJSON(STUDENTS_KEY, data.students);
            }
            if (data.matches) {
              setMatches(data.matches);
              saveJSON(MATCHES_KEY, data.matches);
            }
            console.log("Google Sheets database synchronized on session load!");
          }
        } catch (error) {
          console.warn("Could not sync with remote sheet on initialization. Local cache utilized:", error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    initData();
  }, []);

  // 로컬 영속 캐싱 리스너
  useEffect(() => { if (hydrated) saveJSON(STUDENTS_KEY, students); }, [students, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(MATCHES_KEY, matches); }, [matches, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(TITLE_KEY, title); }, [title, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(LOCKED_KEY, isLocked); }, [isLocked, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(SETTINGS_KEY, { thresholds: tierThresholds, rpVars: rpVariables }); }, [tierThresholds, rpVariables, hydrated]);

  // 경기 기록 및 동기화 (언더독 보너스 및 점수차 비례 보상 적용)
  const recordMatch = useCallback((playerAId: string, playerBId: string, scoreA: number, scoreB: number) => {
    if (playerAId === playerBId) return;
    const aWon = scoreA > scoreB;

    const playerA = students.find((s) => s.id === playerAId);
    const playerB = students.find((s) => s.id === playerBId);
    if (!playerA || !playerB) return;

    const preRpA = playerA.rp;
    const preRpB = playerB.rp;

    // 1. 언더독 보너스 (최대 15점 캡)
    let underdogBonus = 0;
    if (aWon && preRpA < preRpB) {
      underdogBonus = Math.min(15, Math.floor((preRpB - preRpA) * 0.1));
    } else if (!aWon && preRpB < preRpA) {
      underdogBonus = Math.min(15, Math.floor((preRpA - preRpB) * 0.1));
    }

    // 2. 점수차 비례 보상 (최대 10점 캡)
    const scoreDiff = Math.abs(scoreA - scoreB);
    const scoreDiffBonus = Math.min(10, scoreDiff);

    // 3. 최종 변동 RP 계산
    const winDeltaTotal = rpVariables.winDelta + underdogBonus + scoreDiffBonus;
    const loseDeltaTotal = -rpVariables.loseDelta; // 패자 보호: 감점 방어

    const deltaA = aWon ? winDeltaTotal : loseDeltaTotal;
    const deltaB = aWon ? loseDeltaTotal : winDeltaTotal;

    const match: Match = { 
      id: uid(), 
      playerAId, 
      playerBId, 
      scoreA, 
      scoreB, 
      date: new Date().toISOString(),
      rpDeltaA: deltaA,
      rpDeltaB: deltaB
    };
    
    let nextMatches: Match[] = [];
    setMatches((prev) => {
      nextMatches = [match, ...prev];
      return nextMatches;
    });

    setStudents((prev) => {
      const nextStudents = prev.map((s) => {
        if (s.id !== playerAId && s.id !== playerBId) return s;
        const isA = s.id === playerAId;
        const won = isA ? aWon : !aWon;
        const delta = isA ? deltaA : deltaB;

        const preRp = s.rp;
        const preTier = getTier(preRp, tierThresholds);
        const preTierRank = TIER_RANKING[preTier] ?? 1;

        let nextRp = preRp + delta;
        let nextShields = s.demotionShields ?? 0;

        if (won) {
          const tentativeTier = getTier(nextRp, tierThresholds);
          const tentativeTierRank = TIER_RANKING[tentativeTier] ?? 1;
          if (tentativeTierRank > preTierRank) {
            nextShields = 3; // 승급 시 방어막 3회 완충
          }
          nextRp = Math.max(0, nextRp);
        } else {
          const minThreshold = tierThresholds[preTier] ?? 0;
          if (nextRp < minThreshold && preTier !== "Bronze") {
            if (nextShields >= 1) {
              nextRp = minThreshold; // 강등 방어막 가동 (티어 최하단선으로 락인)
              nextShields = nextShields - 1;
            } else {
              nextRp = Math.max(0, nextRp); // 방어막이 소진되어 강등
            }
          } else {
            nextRp = Math.max(0, nextRp);
          }
        }

        return {
          ...s,
          rp: nextRp,
          wins: s.wins + (won ? 1 : 0),
          losses: s.losses + (won ? 0 : 1),
          recent: [(won ? "W" : "L") as "W" | "L", ...s.recent].slice(0, 5),
          demotionShields: nextShields,
          lastMatchDate: new Date().toISOString(),
        };
      });

      syncWithGoogleSheets(nextStudents, nextMatches);
      return nextStudents;
    });
  }, [students, syncWithGoogleSheets, rpVariables, tierThresholds]);

  // 경기 삭제(롤백) 및 동기화
  const deleteMatch = useCallback((matchId: string) => {
    setMatches((prevMatches) => {
      const match = prevMatches.find((m) => m.id === matchId);
      if (!match) return prevMatches;

      const nextMatches = prevMatches.filter((m) => m.id !== matchId);

      setStudents((prevStudents) => {
        const playerAId = match.playerAId;
        const playerBId = match.playerBId;
        const aWon = match.scoreA > match.scoreB;

        const nextStudents = prevStudents.map((s) => {
          if (s.id !== playerAId && s.id !== playerBId) return s;

          const isA = s.id === playerAId;
          const won = isA ? aWon : !aWon;
          
          let rpDelta = 0;
          if (isA) {
            rpDelta = match.rpDeltaA !== undefined ? -match.rpDeltaA : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
          } else {
            rpDelta = match.rpDeltaB !== undefined ? -match.rpDeltaB : (won ? -rpVariables.winDelta : rpVariables.loseDelta);
          }
          const newRp = Math.max(0, s.rp + rpDelta);
          const newWins = Math.max(0, s.wins - (won ? 1 : 0));
          const newLosses = Math.max(0, s.losses - (won ? 0 : 1));

          const sMatches = nextMatches
            .filter((m) => m.playerAId === s.id || m.playerBId === s.id)
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
            .slice(0, 5);

          const newRecent = sMatches.map((m) => {
            const mIsA = m.playerAId === s.id;
            const mAWon = m.scoreA > m.scoreB;
            const mWon = mIsA ? mAWon : !mAWon;
            return mWon ? "W" : "L";
          });

          return {
            ...s,
            rp: newRp,
            wins: newWins,
            losses: newLosses,
            recent: newRecent,
          };
        });

        syncWithGoogleSheets(nextStudents, nextMatches);
        return nextStudents;
      });

      return nextMatches;
    });
  }, [syncWithGoogleSheets, rpVariables]);

  // 개별 학생 전적 리셋 및 동기화
  const resetStudent = useCallback((studentId: string) => {
    setMatches((prevMatches) => {
      const nextMatches = prevMatches.filter(
        (m) => m.playerAId !== studentId && m.playerBId !== studentId
      );

      const playedOpponents = new Set<string>();
      prevMatches.forEach((m) => {
        if (m.playerAId === studentId) playedOpponents.add(m.playerBId);
        if (m.playerBId === studentId) playedOpponents.add(m.playerAId);
      });

      setStudents((prevStudents) => {
        const nextStudents = prevStudents.map((s) => {
          if (s.id === studentId) {
            return {
              ...s,
              rp: 1000,
              wins: 0,
              losses: 0,
              recent: [],
            };
          }

          if (playedOpponents.has(s.id)) {
            const sMatches = nextMatches
              .filter((m) => m.playerAId === s.id || m.playerBId === s.id)
              .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
              .slice(0, 5);

            const newRecent = sMatches.map((m) => {
              const mIsA = m.playerAId === s.id;
              const mAWon = m.scoreA > m.scoreB;
              const mWon = mIsA ? mAWon : !mAWon;
              return mWon ? "W" : "L";
            });

            return {
              ...s,
              recent: newRecent,
            };
          }

          return s;
        });

        syncWithGoogleSheets(nextStudents, nextMatches);
        return nextStudents;
      });

      return nextMatches;
    });
  }, [syncWithGoogleSheets]);

  // 시즌 전체 초기화 및 동기화
  const resetAllData = useCallback(() => {
    const nextMatches: Match[] = [];
    setMatches(nextMatches);
    
    setStudents((prev) => {
      const nextStudents = prev.map((s) => ({
        ...s,
        rp: 1000,
        wins: 0,
        losses: 0,
        recent: [],
      }));

      syncWithGoogleSheets(nextStudents, nextMatches);
      return nextStudents;
    });
  }, [syncWithGoogleSheets]);

  // 교사 관리자 수동 RP 수정 및 동기화
  const updateStudentRP = useCallback((studentId: string, nextRp: number) => {
    setStudents((prev) => {
      const nextStudents = prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          rp: Math.max(0, nextRp),
        };
      });

      syncWithGoogleSheets(nextStudents, matches);
      return nextStudents;
    });
  }, [matches, syncWithGoogleSheets]);

  // 새로운 명렬표 대량 업서트 및 동기화
  const upsertStudents = useCallback(
    (rows: { grade: number; classNum: number; number: number; name: string; gender?: Gender }[]) => {
      let added = 0, kept = 0;
      let targetStudents: Student[] = [];

      setStudents((prev) => {
        const byKey = new Map(prev.map((s) => [studentKey(s), s]));
        const next: Student[] = [];
        const seenKeys = new Set<string>();
        for (const r of rows) {
          const k = studentKey(r);
          if (seenKeys.has(k)) continue;
          seenKeys.add(k);
          const exists = byKey.get(k);
          if (exists) {
            kept++;
            next.push({ ...exists, gender: r.gender ?? exists.gender });
          } else {
            added++;
            next.push({
              id: uid(),
              grade: r.grade,
              classNum: r.classNum,
              number: r.number,
              name: r.name,
              gender: r.gender ?? "U",
              rp: 1000,
              recent: [],
              wins: 0,
              losses: 0,
              demotionShields: 0,
            });
          }
        }
        for (const s of prev) {
          const k = studentKey(s);
          if (!seenKeys.has(k)) next.push(s);
        }
        targetStudents = next;
        
        syncWithGoogleSheets(targetStudents, matches);
        return next;
      });

      return { added, kept };
    },
    [matches, syncWithGoogleSheets],
  );

  // 리그전 커스텀 설정 캘리브레이션 업데이트 함수
  const updateLeagueSettings = useCallback((thresholds: Record<TierName, number>, rpVars: { winDelta: number; loseDelta: number }) => {
    setTierThresholds(thresholds);
    setRpVariables(rpVars);
  }, []);

  // 특정 학생의 성별 변경 및 구글 시트 동기화
  const updateStudentGender = useCallback((studentId: string, gender: Gender) => {
    setStudents((prev) => {
      const nextStudents = prev.map((s) => {
        if (s.id !== studentId) return s;
        return { ...s, gender };
      });
      syncWithGoogleSheets(nextStudents, matches);
      return nextStudents;
    });
  }, [matches, syncWithGoogleSheets]);

  // 개별 학생 삭제 및 연쇄 삭제 & 전적 복구 롤백
  const deleteStudent = useCallback((studentId: string) => {
    setMatches((prevMatches) => {
      const matchesToRemove = prevMatches.filter((m) => m.playerAId === studentId || m.playerBId === studentId);
      const nextMatches = prevMatches.filter((m) => m.playerAId !== studentId && m.playerBId !== studentId);

      setStudents((prevStudents) => {
        // 1. 삭제할 학생 제외
        let nextStudents = prevStudents.filter((s) => s.id !== studentId);

        // 2. 삭제되는 경기들의 상대방 전적 복구
        matchesToRemove.forEach((m) => {
          const opponentId = m.playerAId === studentId ? m.playerBId : m.playerAId;
          const isOpponentA = m.playerAId === opponentId;
          const oppWon = isOpponentA ? (m.scoreA > m.scoreB) : (m.scoreB > m.scoreA);

          nextStudents = nextStudents.map((s) => {
            if (s.id !== opponentId) return s;
            
            let rpDelta = 0;
            if (isOpponentA) {
              rpDelta = m.rpDeltaA !== undefined ? -m.rpDeltaA : (oppWon ? -rpVariables.winDelta : rpVariables.loseDelta);
            } else {
              rpDelta = m.rpDeltaB !== undefined ? -m.rpDeltaB : (oppWon ? -rpVariables.winDelta : rpVariables.loseDelta);
            }
            const newRp = Math.max(0, s.rp + rpDelta);
            const newWins = Math.max(0, s.wins - (oppWon ? 1 : 0));
            const newLosses = Math.max(0, s.losses - (oppWon ? 0 : 1));

            return {
              ...s,
              rp: newRp,
              wins: newWins,
              losses: newLosses,
            };
          });
        });

        // 3. 상대방들의 recent 배열 재구성
        nextStudents = nextStudents.map((s) => {
          const sMatches = nextMatches
            .filter((m) => m.playerAId === s.id || m.playerBId === s.id)
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
            .slice(0, 5);

          const newRecent = sMatches.map((m) => {
            const mIsA = m.playerAId === s.id;
            const mAWon = m.scoreA > m.scoreB;
            const mWon = mIsA ? mAWon : !mAWon;
            return mWon ? "W" : "L";
          });

          return {
            ...s,
            recent: newRecent,
          };
        });

        syncWithGoogleSheets(nextStudents, nextMatches);
        return nextStudents;
      });

      return nextMatches;
    });
  }, [syncWithGoogleSheets, rpVariables]);

  // CSV 롤백 복원 액션
  const restoreFromCSV = useCallback((restoredStudents: Student[], restoredMatches: Match[]) => {
    setStudents(restoredStudents);
    setMatches(restoredMatches);
    saveJSON(STUDENTS_KEY, restoredStudents);
    saveJSON(MATCHES_KEY, restoredMatches);
    syncWithGoogleSheets(restoredStudents, restoredMatches);
  }, [syncWithGoogleSheets]);

  // 교사 통제형 휴면 강등 일괄 RP 차감 액션
  const bulkDecayRP = useCallback((inactiveDays: number, decayAmount: number) => {
    let affectedCount = 0;
    let nextStudents: Student[] = [];

    setStudents((prev) => {
      const goldCutoff = tierThresholds.Gold ?? 1200;
      const now = new Date().getTime();
      const msThreshold = inactiveDays * 24 * 60 * 60 * 1000;

      nextStudents = prev.map((s) => {
        // Gold 등급 이상만 차감 대상
        if (s.rp < goldCutoff) return s;
        // 마지막 경기 전적이 존재하는 경우
        if (s.lastMatchDate) {
          const lastTime = new Date(s.lastMatchDate).getTime();
          const elapsed = now - lastTime;
          if (elapsed >= msThreshold) {
            affectedCount++;
            return {
              ...s,
              rp: Math.max(0, s.rp - decayAmount),
            };
          }
        }
        return s;
      });

      if (affectedCount > 0) {
        syncWithGoogleSheets(nextStudents, matches);
      }
      return nextStudents;
    });

    return affectedCount;
  }, [matches, tierThresholds, syncWithGoogleSheets]);

  return { 
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
    session,
    loginUser,
    registerUser,
    logoutUser,
    MASTER_API_URL,
    tierThresholds,
    rpVariables,
    updateLeagueSettings,
    updateStudentGender,
    deleteStudent,
    restoreFromCSV,
    bulkDecayRP
  };
}

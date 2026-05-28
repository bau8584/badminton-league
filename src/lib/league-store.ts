import { useEffect, useState, useCallback } from "react";
import type { Student, Match, Gender } from "./league-types";
import { studentKey } from "./league-types";

const STUDENTS_KEY = "bdm.students.v2";
const MATCHES_KEY = "bdm.matches.v1";
const TITLE_KEY = "bdm.title.v1";
const LOCKED_KEY = "bdm.locked.v1";

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
} | null;

export function useLeagueStore() {
  const [hydrated, setHydrated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [title, setTitle] = useState<string>("2026 초등 배드민턴 리그전");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 3대 역할 로그인 세션 상태
  const [session, setSession] = useState<UserSession>(null);

  // 1. 구글 스프레드시트 데이터베이스 전체 일괄 동기화 (POST)
  const syncWithGoogleSheets = useCallback(async (currentStudents: Student[], currentMatches: Match[]) => {
    // 세션에 개인 scriptUrl이 없으면 동기화 생략 (로컬 저장만 적용)
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

  // 2. 로그인 수행 함수 (마스터 DB와 대조 검증)
  const loginUser = useCallback(async (loginId: string, password: string, role: "MASTER" | "TEACHER" | "STUDENT") => {
    setIsSyncing(true);
    try {
      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "LOGIN",
          loginId,
          password,
          role
        })
      });
      const data = await response.json();
      if (data.status === "success" && data.user) {
        setSession(data.user);
        saveJSON(SESSION_KEY, data.user);
        
        // 로그인 성공 시 해당 이용자의 전용 구글 시트에서 즉시 전적 데이터 끌어오기 (Hydration)
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
            console.warn("Could not download remote sheet data upon login. Using cached/seed data:", err);
          }
        }
        return { success: true };
      } else {
        return { success: false, message: data.message || "로그인 정보가 맞지 않습니다." };
      }
    } catch (error) {
      console.error("Login request failed:", error);
      return { success: false, message: "마스터 서버에 접속할 수 없습니다. 인터넷 상태를 확인해 주세요." };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 3. 신규 회원가입(교사/학생 등록) 수행 함수
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
      const localTitle = loadJSON<string>(TITLE_KEY, "2026 초등 배드민턴 리그전");
      const localLocked = loadJSON<boolean>(LOCKED_KEY, false);

      const activeStudents = localStudents && localStudents.length > 0 ? localStudents : SEED_STUDENTS;
      setStudents(activeStudents);
      setMatches(localMatches);
      setTitle(localTitle);
      setIsLocked(localLocked);
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

  // 경기 기록 및 동기화
  const recordMatch = useCallback((playerAId: string, playerBId: string, scoreA: number, scoreB: number) => {
    if (playerAId === playerBId) return;
    const aWon = scoreA > scoreB;
    const match: Match = { id: uid(), playerAId, playerBId, scoreA, scoreB, date: new Date().toISOString() };
    
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
        const delta = won ? 25 : -20;
        return {
          ...s,
          rp: Math.max(0, s.rp + delta),
          wins: s.wins + (won ? 1 : 0),
          losses: s.losses + (won ? 0 : 1),
          recent: [(won ? "W" : "L") as "W" | "L", ...s.recent].slice(0, 5),
        };
      });

      syncWithGoogleSheets(nextStudents, nextMatches);
      return nextStudents;
    });
  }, [syncWithGoogleSheets]);

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
          
          const rpDelta = won ? -25 : 20;
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
  }, [syncWithGoogleSheets]);

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
    session,       // 세션 노출
    loginUser,     // 로그인 함수 노출
    registerUser,  // 회원가입 함수 노출
    logoutUser,    // 로그아웃 함수 노출
    MASTER_API_URL // 마스터 API 주소 노출
  };
}

import { useEffect, useState, useCallback } from "react";
import type { Student, Match, Gender } from "./league-types";
import { studentKey } from "./league-types";

const STUDENTS_KEY = "bdm.students.v2";
const MATCHES_KEY = "bdm.matches.v1";
const TITLE_KEY = "bdm.title.v1";
const LOCKED_KEY = "bdm.locked.v1";

const API_URL = "https://script.google.com/macros/s/AKfycbxXC4J6zKWq_vEEbh_CnARl9V6SD9Dtt_nk1oMcmIZHTJVU5XdqV8xYM5d5YkOu6COEYA/exec";

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

export function useLeagueStore() {
  const [hydrated, setHydrated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [title, setTitle] = useState<string>("2026 초등 배드민턴 리그전");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Google Sheets REST API 데이터베이스 전체 일괄 동기화 (POST)
  const syncWithGoogleSheets = useCallback(async (currentStudents: Student[], currentMatches: Match[]) => {
    setIsSyncing(true);
    try {
      // CORS 및 preflight(OPTIONS) 차단 이슈 방지를 위해 text/plain 포맷으로 단순 요청 처리
      await fetch(API_URL, {
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
      console.log("Successfully synced all league data to Google Sheets!");
    } catch (error) {
      console.error("Failed to sync database to Google Sheets:", error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // 2. 초기 기동 시 데이터 Hydration & 구글 시트 양방향 연동 (GET)
  useEffect(() => {
    const initData = async () => {
      // A. 로컬 스토리지 데이터 우선 로드 (오프라인 0ms 대응 및 빠른 초도 화면 렌더링)
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

      // B. 구글 시트에서 최신 데이터베이스 패치하여 갱신 및 로컬 싱크
      setIsSyncing(true);
      try {
        const response = await fetch(API_URL);
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
          console.log("Google Sheets database successfully loaded and synchronized!");
        }
      } catch (error) {
        console.warn("Could not fetch remote Google Sheets database. Operating in local cache mode:", error);
      } finally {
        setIsSyncing(false);
      }
    };

    initData();
  }, []);

  // 로컬 영속 저장 트리거
  useEffect(() => { if (hydrated) saveJSON(STUDENTS_KEY, students); }, [students, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(MATCHES_KEY, matches); }, [matches, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(TITLE_KEY, title); }, [title, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(LOCKED_KEY, isLocked); }, [isLocked, hydrated]);

  // 경기 기록 및 실시간 구글 시트 밀어넣기
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

      // 비동기 양방향 동기화 호출
      syncWithGoogleSheets(nextStudents, nextMatches);
      return nextStudents;
    });
  }, [syncWithGoogleSheets]);

  // 경기 삭제(롤백) 및 실시간 동기화
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

        // 비동기 양방향 동기화 호출
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

        // 비동기 양방향 동기화 호출
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

      // 비동기 양방향 동기화 호출
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

      // 비동기 양방향 동기화 호출
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
        
        // 비동기 양방향 동기화 호출
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
    isSyncing // 동기화 상태 노출
  };
}

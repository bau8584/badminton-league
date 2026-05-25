import { useEffect, useState, useCallback } from "react";
import type { Student, Match, Gender } from "./league-types";
import { studentKey } from "./league-types";

const STUDENTS_KEY = "bdm.students.v2";
const MATCHES_KEY = "bdm.matches.v1";
const TITLE_KEY = "bdm.title.v1";

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

const LOCKED_KEY = "bdm.locked.v1";

export function useLeagueStore() {
  const [hydrated, setHydrated] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [title, setTitle] = useState<string>("2026 초등 배드민턴 리그전");
  const [isLocked, setIsLocked] = useState<boolean>(false);

  useEffect(() => {
    const existing = loadJSON<Student[] | null>(STUDENTS_KEY, null);
    setStudents(existing && existing.length > 0 ? existing : SEED_STUDENTS);
    setMatches(loadJSON<Match[]>(MATCHES_KEY, []));
    setTitle(loadJSON<string>(TITLE_KEY, "2026 초등 배드민턴 리그전"));
    setIsLocked(loadJSON<boolean>(LOCKED_KEY, false));
    setHydrated(true);
  }, []);

  useEffect(() => { if (hydrated) saveJSON(STUDENTS_KEY, students); }, [students, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(MATCHES_KEY, matches); }, [matches, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(TITLE_KEY, title); }, [title, hydrated]);
  useEffect(() => { if (hydrated) saveJSON(LOCKED_KEY, isLocked); }, [isLocked, hydrated]);

  const recordMatch = useCallback((playerAId: string, playerBId: string, scoreA: number, scoreB: number) => {
    if (playerAId === playerBId) return;
    const aWon = scoreA > scoreB;
    const match: Match = { id: uid(), playerAId, playerBId, scoreA, scoreB, date: new Date().toISOString() };
    setMatches((prev) => [match, ...prev]);
    setStudents((prev) => prev.map((s) => {
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
    }));
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatches((prevMatches) => {
      const match = prevMatches.find((m) => m.id === matchId);
      if (!match) return prevMatches;

      const nextMatches = prevMatches.filter((m) => m.id !== matchId);

      setStudents((prevStudents) => {
        const playerAId = match.playerAId;
        const playerBId = match.playerBId;
        const aWon = match.scoreA > match.scoreB;

        return prevStudents.map((s) => {
          if (s.id !== playerAId && s.id !== playerBId) return s;

          const isA = s.id === playerAId;
          const won = isA ? aWon : !aWon;
          
          // Bilateral Rollback: Winners lost 25 RP and losers gained 20 RP
          const rpDelta = won ? -25 : 20;
          const newRp = Math.max(0, s.rp + rpDelta);
          const newWins = Math.max(0, s.wins - (won ? 1 : 0));
          const newLosses = Math.max(0, s.losses - (won ? 0 : 1));

          // Recalculate recent array from remaining matches
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
      });

      return nextMatches;
    });
  }, []);

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
        return prevStudents.map((s) => {
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
            // Recalculate recent matches for opponent students (keeps wins/losses secure, but aligns visual timeline)
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
      });

      return nextMatches;
    });
  }, []);

  const resetAllData = useCallback(() => {
    setMatches([]);
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        rp: 1000,
        wins: 0,
        losses: 0,
        recent: [],
      }))
    );
  }, []);

  const updateStudentRP = useCallback((studentId: string, nextRp: number) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        return {
          ...s,
          rp: Math.max(0, nextRp),
        };
      })
    );
  }, []);

  // Upsert students: preserve existing RP/records when keys match; add new with 1000 RP.
  const upsertStudents = useCallback(
    (rows: { grade: number; classNum: number; number: number; name: string; gender?: Gender }[]) => {
      let added = 0, kept = 0;
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
        // Also keep students that weren't in the new paste — preserves history across class-by-class uploads.
        for (const s of prev) {
          const k = studentKey(s);
          if (!seenKeys.has(k)) next.push(s);
        }
        return next;
      });
      return { added, kept };
    },
    [],
  );

  return { hydrated, students, matches, title, setTitle, recordMatch, upsertStudents, isLocked, setIsLocked, deleteMatch, resetStudent, resetAllData, updateStudentRP };
}

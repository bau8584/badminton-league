import { useEffect, useState, useCallback } from "react";
import type { Student, Match, Gender, TierName } from "./league-types";
import { studentKey, getTier, getTierSubdivision, getFullTierLabel, TIER_ORDER } from "./league-types";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  tier: "Common" | "Rare" | "Epic" | "Legendary";
  currentValue: number;
  targetValue: number;
  isUnlocked: boolean;
};

export type ActiveBonuses = {
  firstWin: boolean;
  revenge: boolean;
  underdog: boolean;
  scoreDiff: boolean;
  rival: boolean;
};

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
const BONUSES_KEY = "bdm.bonuses.v1";

// 세션 영속 저장을 위한 로컬스토리지 키
const SESSION_KEY = "bdm.session.v1";

// 마스터 DB 구글 Apps Script Web App API 주소
const MASTER_API_URL = "https://script.google.com/macros/s/AKfycbzcu1d1T8pHvzwvcPn2qPFIg8YtCQxsspvfQ6Koa-ie6wWE9UhEvtPzurK92SVeJEMvyQ/exec";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// 교사/학교 매핑 목록 로컬 캐싱 기능 (구글 시트 API 속도 개선)
async function getTeachersList(forceRefresh = false): Promise<any[]> {
  if (typeof window === "undefined") return [];
  const TEACHERS_CACHE_KEY = "bdm.teachers_list.cache";
  const TEACHERS_CACHE_TIME_KEY = "bdm.teachers_list.cache_time";
  const CACHE_DURATION = 60 * 60 * 1000; // 1시간 캐싱

  if (!forceRefresh) {
    try {
      const cachedListStr = localStorage.getItem(TEACHERS_CACHE_KEY);
      const cachedTimeStr = localStorage.getItem(TEACHERS_CACHE_TIME_KEY);
      if (cachedListStr && cachedTimeStr) {
        const cachedTime = parseInt(cachedTimeStr, 10);
        if (Date.now() - cachedTime < CACHE_DURATION) {
          return JSON.parse(cachedListStr);
        }
      }
    } catch (e) {
      console.warn("Error reading teachers list cache:", e);
    }
  }

  try {
    const teachersRes = await fetch(`${MASTER_API_URL}?action=GET_TEACHERS`);
    const teachersData = await teachersRes.json();
    if (teachersData.status === "success" && teachersData.teachers) {
      localStorage.setItem(TEACHERS_CACHE_KEY, JSON.stringify(teachersData.teachers));
      localStorage.setItem(TEACHERS_CACHE_TIME_KEY, Date.now().toString());
      return teachersData.teachers;
    }
  } catch (error) {
    console.error("Failed to fetch matching school list:", error);
  }
  return [];
}

const SEED_STUDENTS: Student[] = [
  { id: uid(), grade: 5, classNum: 1, number: 1,  name: "강서준", gender: "M", rp: 1320, recent: ["W","W","L","W","W"], wins: 8, losses: 3 },
  { id: uid(), grade: 5, classNum: 1, number: 2,  name: "김민재", gender: "M", rp: 1180, recent: ["L","W","W","L","W"], wins: 6, losses: 5 },
  { id: uid(), grade: 6, classNum: 2, number: 1,  name: "이지우", gender: "F", rp: 1620, recent: ["W","W","W","W","L"], wins: 12, losses: 2 },
  { id: uid(), grade: 6, classNum: 2, number: 2,  name: "박지성", gender: "M", rp: 1450, recent: ["W","L","W","W","W"], wins: 9, losses: 3 },
  { id: uid(), grade: 4, classNum: 3, number: 1,  name: "최서아", gender: "F", rp: 980,  recent: ["L","L","W","L","W"], wins: 3, losses: 6 },
  { id: uid(), grade: 3, classNum: 1, number: 1,  name: "정윤우", gender: "M", rp: 1050, recent: ["W","L","L","W","L"], wins: 4, losses: 5 },
  { id: uid(), grade: 6, classNum: 1, number: 1,  name: "강하윤", gender: "F", rp: 1530, recent: ["W","W","L","W","W"], wins: 10, losses: 4 },
  { id: uid(), grade: 5, classNum: 2, number: 1,  name: "윤도현", gender: "M", rp: 1210, recent: ["W","L","W","L","W"], wins: 7, losses: 5 },
  { id: uid(), grade: 5, classNum: 2, number: 2,  name: "이지민", gender: "F", rp: 1110, recent: ["L","W","L","W","L"], wins: 5, losses: 7 },
  { id: uid(), grade: 6, classNum: 1, number: 2,  name: "한주원", gender: "M", rp: 1390, recent: ["W","W","W","L","L"], wins: 8, losses: 4 },
  { id: uid(), grade: 6, classNum: 1, number: 3,  name: "김수아", gender: "F", rp: 1490, recent: ["W","L","W","W","W"], wins: 10, losses: 2 },
  { id: uid(), grade: 4, classNum: 1, number: 1,  name: "최예준", gender: "M", rp: 1020, recent: ["L","W","W","L","L"], wins: 4, losses: 6 },
  { id: uid(), grade: 4, classNum: 1, number: 2,  name: "박서윤", gender: "F", rp: 950,  recent: ["L","L","L","W","W"], wins: 2, losses: 8 },
  { id: uid(), grade: 3, classNum: 2, number: 1,  name: "송민우", gender: "M", rp: 1040, recent: ["W","L","W","L","W"], wins: 5, losses: 5 },
  { id: uid(), grade: 3, classNum: 2, number: 2,  name: "윤아린", gender: "F", rp: 920,  recent: ["L","L","W","L","L"], wins: 2, losses: 8 },
  { id: uid(), grade: 5, classNum: 3, number: 1,  name: "정민서", gender: "F", rp: 1250, recent: ["W","W","L","W","L"], wins: 7, losses: 5 },
  { id: uid(), grade: 5, classNum: 3, number: 2,  name: "조현우", gender: "M", rp: 1300, recent: ["W","W","W","L","W"], wins: 9, losses: 3 },
  { id: uid(), grade: 6, classNum: 3, number: 1,  name: "신지아", gender: "F", rp: 1580, recent: ["W","W","W","W","W"], wins: 13, losses: 1 },
  { id: uid(), grade: 6, classNum: 3, number: 2,  name: "유재희", gender: "M", rp: 1410, recent: ["L","W","W","W","L"], wins: 8, losses: 4 },
  { id: uid(), grade: 4, classNum: 2, number: 1,  name: "김하은", gender: "F", rp: 1070, recent: ["W","W","L","L","W"], wins: 6, losses: 4 },
  { id: uid(), grade: 4, classNum: 2, number: 2,  name: "임지우", gender: "M", rp: 1150, recent: ["W","L","W","W","L"], wins: 8, losses: 5 },
  { id: uid(), grade: 3, classNum: 3, number: 1,  name: "서준우", gender: "M", rp: 1010, recent: ["L","L","W","W","L"], wins: 3, losses: 6 },
  { id: uid(), grade: 3, classNum: 3, number: 2,  name: "오다인", gender: "F", rp: 980,  recent: ["W","L","L","L","W"], wins: 4, losses: 6 },
  { id: uid(), grade: 5, classNum: 1, number: 3,  name: "황지안", gender: "F", rp: 1220, recent: ["L","W","W","W","L"], wins: 7, losses: 5 },
  { id: uid(), grade: 5, classNum: 1, number: 4,  name: "박건우", gender: "M", rp: 1190, recent: ["W","L","L","W","W"], wins: 6, losses: 5 },
  { id: uid(), grade: 6, classNum: 2, number: 3,  name: "김태양", gender: "M", rp: 1350, recent: ["L","W","L","W","W"], wins: 7, losses: 5 },
  { id: uid(), grade: 6, classNum: 2, number: 4,  name: "송지효", gender: "F", rp: 1280, recent: ["W","L","W","L","L"], wins: 5, losses: 6 },
  { id: uid(), grade: 4, classNum: 3, number: 2,  name: "권은우", gender: "M", rp: 1120, recent: ["W","W","L","L","W"], wins: 6, losses: 5 },
  { id: uid(), grade: 4, classNum: 3, number: 3,  name: "윤채원", gender: "F", rp: 1050, recent: ["L","W","W","L","L"], wins: 4, losses: 6 },
  { id: uid(), grade: 5, classNum: 2, number: 3,  name: "백현우", gender: "M", rp: 1270, recent: ["W","L","W","W","W"], wins: 9, losses: 3 }
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
  leagueName?: string;
  settingsBonus?: string | Record<string, boolean>;
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

  // 이중 보안 모달을 위한 선생님 비밀번호(접근 코드) 전역 관리
  const [teacherAccessCode, setTeacherAccessCode] = useState<string>(() => {
    if (typeof window === "undefined") return "1234";
    return localStorage.getItem("bdm.teacherAccessCode.v1") || "1234";
  });

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

  const [activeBonuses, setActiveBonuses] = useState<ActiveBonuses>({
    firstWin: true,
    revenge: true,
    underdog: true,
    scoreDiff: true,
    rival: true
  });

  const [promotionEvent, setPromotionEvent] = useState<{ isPromoted: boolean; newTier: string } | null>(null);

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
    if (cleanedSchool.toLowerCase() === "guest" || cleanedSchool === "꿈나무 초등학교") {
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
      if (!localStudents || localStudents.length < 20) {
        setStudents(SEED_STUDENTS);
        saveJSON(STUDENTS_KEY, SEED_STUDENTS);
      } else {
        setStudents(localStudents);
      }
      return { success: true };
    }

    setIsSyncing(true);
    try {
      // 1. 학생 로그인 시, 구글 마스터 DB의 등록된 교사/학교 목록을 조회하여 해당 학교의 구글 시트 scriptUrl을 동적으로 찾고 명단 최신화
      if (role === "STUDENT") {
        let schoolScriptUrl = "";
        try {
          let teachers = await getTeachersList();
          const normalizeSchool = (name: string) => name.replace(/(초등학교|초등|학교|초)$/, "").trim();
          const targetSchool = normalizeSchool(cleanedSchool);
          let matchedTeacher = teachers.find(
            (t: any) => 
              normalizeSchool(t.schoolName) === targetSchool || 
              normalizeSchool(t.loginId) === targetSchool
          );
          
          if (!matchedTeacher) {
            // 캐시 미스 시 강제 새로고침
            teachers = await getTeachersList(true);
            matchedTeacher = teachers.find(
              (t: any) => 
                normalizeSchool(t.schoolName) === targetSchool || 
                normalizeSchool(t.loginId) === targetSchool
            );
          }

          if (matchedTeacher && matchedTeacher.scriptUrl) {
            schoolScriptUrl = matchedTeacher.scriptUrl;
          }
        } catch (err) {
          console.warn("Failed to retrieve matching school scriptUrl for student:", err);
        }

        let activeStudents = students;
        if (schoolScriptUrl) {
          try {
            const res = await fetch(schoolScriptUrl);
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
            console.warn("Failed fetching student roster from school scriptUrl:", err);
          }
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
            schoolName: cleanedSchool,
            userName: cleanedCode,
            studentId: matchStudent.id,
            scriptUrl: schoolScriptUrl
          };
          setSession(studentSession);
          saveJSON(SESSION_KEY, studentSession);
          return { success: true };
        } else {
          return { success: false, message: `${cleanedSchool} 명단에 '${studentGrade}학년 ${studentClass}반 ${cleanedCode}' 학생이 존재하지 않습니다. 교사에게 문의하세요.` };
        }
      }

      // 2. MASTER 최고 관리자 또는 TEACHER 로그인 시도 (마스터 API 통신)
      let loginIdToUse = role === "MASTER" ? cleanedSchool : cleanedSchool;

      if (role === "TEACHER") {
        // 교사의 경우, 학교명 입력이 단축어 또는 실제 schoolName 혹은 loginId 에 해당하는지 마스터 교사 목록에서 조회하여 실제 ID 매핑
        try {
          let teachers = await getTeachersList();
          const normalizeSchool = (name: string) => name.replace(/(초등학교|초등|학교|초)$/, "").trim();
          const targetSchool = normalizeSchool(cleanedSchool);
          let matchedTeacher = teachers.find(
            (t: any) => 
              normalizeSchool(t.schoolName) === targetSchool || 
              normalizeSchool(t.loginId) === targetSchool
          );

          if (!matchedTeacher) {
            // 캐시 미스 시 강제 새로고침
            teachers = await getTeachersList(true);
            matchedTeacher = teachers.find(
              (t: any) => 
                normalizeSchool(t.schoolName) === targetSchool || 
                normalizeSchool(t.loginId) === targetSchool
            );
          }

          if (matchedTeacher) {
            loginIdToUse = matchedTeacher.loginId;
          }
        } catch (err) {
          console.warn("Failed to retrieve matching teacher loginId from GET_TEACHERS, using cleanedSchool directly:", err);
        }
      }

      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "LOGIN",
          loginId: loginIdToUse,
          password: cleanedCode,
          role
        })
      });
      const data = await response.json();
      
      if (data.status === "success" && data.user) {
        setSession(data.user);
        saveJSON(SESSION_KEY, data.user);
        if (role === "TEACHER" || role === "MASTER") {
          setTeacherAccessCode(cleanedCode);
          localStorage.setItem("bdm.teacherAccessCode.v1", cleanedCode);
        }
        
        if (data.user.leagueName) {
          setTitle(data.user.leagueName);
          saveJSON(TITLE_KEY, data.user.leagueName);
        }
        if (data.user.settingsBonus) {
          try {
            const parsed = typeof data.user.settingsBonus === "string" 
              ? JSON.parse(data.user.settingsBonus) 
              : data.user.settingsBonus;
            setActiveBonuses(parsed);
            saveJSON(BONUSES_KEY, parsed);
          } catch (e) {
            console.error("Failed parsing settingsBonus from login response:", e);
          }
        }
        
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
        // [마스터 비밀번호 우회 로그인 검증]
        // 어떤 학교든지 교사 로그인 시, 입력된 비밀번호가 구글 마스터 DB의 MASTER 역할 비밀번호와 일치하면 로그인을 통과시켜 줍니다.
        if (role === "TEACHER") {
          let isMasterPassword = false;
          // 마스터 API 통신을 통해 입력된 비밀번호를 MASTER 계정("admin")으로 로그인 시도하여 검증
          try {
            const masterVerifyRes = await fetch(MASTER_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify({
                action: "LOGIN",
                loginId: "admin",
                password: cleanedCode,
                role: "MASTER"
              })
            });
            const masterVerifyData = await masterVerifyRes.json();
            if (masterVerifyData.status === "success") {
              isMasterPassword = true;
            }
          } catch (err) {
            console.warn("Failed first master authentication check:", err);
          }

          // 혹시 마스터 ID가 대문자 MASTER일 수도 있으므로 추가 백업 시도
          if (!isMasterPassword) {
            try {
              const masterVerifyRes = await fetch(MASTER_API_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "text/plain;charset=utf-8",
                },
                body: JSON.stringify({
                  action: "LOGIN",
                  loginId: "MASTER",
                  password: cleanedCode,
                  role: "MASTER"
                })
              });
              const masterVerifyData = await masterVerifyRes.json();
              if (masterVerifyData.status === "success") {
                isMasterPassword = true;
              }
            } catch (err) {
              console.warn("Failed second master authentication check:", err);
            }
          }

          if (isMasterPassword) {
            // 마스터 비밀번호로 확인된 경우: 
            // 1. 오프라인 대비 로컬 캐싱 저장
            localStorage.setItem("bdm.masterPassword.v1", cleanedCode);

            // 2. 마스터 API에서 교사 목록을 가져와 현재 학교(schoolName)가 등록되어 있는지 조회
            let schoolScriptUrl = "";
            let schoolUserName = "선생님 (마스터)";
            try {
              const teachersRes = await fetch(`${MASTER_API_URL}?action=GET_TEACHERS`);
              const teachersData = await teachersRes.json();
              if (teachersData.status === "success" && teachersData.teachers) {
                const normalizeSchool = (name: string) => name.replace(/(초등학교|초등|학교|초)$/, "").trim();
                const targetSchool = normalizeSchool(cleanedSchool);
                const matchedTeacher = teachersData.teachers.find(
                  (t: any) => 
                    normalizeSchool(t.schoolName) === targetSchool || 
                    normalizeSchool(t.loginId) === targetSchool
                );
                if (matchedTeacher) {
                  schoolScriptUrl = matchedTeacher.scriptUrl;
                  schoolUserName = matchedTeacher.userName;
                }
              }
            } catch (err) {
              console.warn("Failed to retrieve scriptUrl from teacher list via master password:", err);
            }

            const teacherSession = {
              loginId: "teacher_" + cleanedSchool,
              role: "TEACHER" as const,
              schoolName: cleanedSchool,
              userName: schoolUserName,
              scriptUrl: schoolScriptUrl
            };
            setSession(teacherSession);
            saveJSON(SESSION_KEY, teacherSession);
            setTeacherAccessCode(cleanedCode);
            localStorage.setItem("bdm.teacherAccessCode.v1", cleanedCode);

            // 구글 시트 연동 갱신 시도
            if (schoolScriptUrl) {
              try {
                const remoteRes = await fetch(schoolScriptUrl);
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
                console.warn("Offline loading remote sheet data for school:", err);
              }
            } else {
              const localStudents = loadJSON<Student[] | null>(STUDENTS_KEY, null);
              if (!localStudents || localStudents.length === 0) {
                setStudents(SEED_STUDENTS);
                saveJSON(STUDENTS_KEY, SEED_STUDENTS);
              }
            }
            return { success: true };
          }
        }
        return { success: false, message: data.message || "로그인 인증 정보가 올바르지 않습니다." };
      }
    } catch (error) {
      console.warn("Master API login offline. Falling back to local validation:", error);
      // Offline fallback
      if (role === "TEACHER") {
        const cachedMasterPassword = localStorage.getItem("bdm.masterPassword.v1") || "admin1234";
        if (cleanedCode === cachedMasterPassword) {
          const teacherSession = {
            loginId: "teacher_" + cleanedSchool,
            role: "TEACHER" as const,
            schoolName: cleanedSchool,
            userName: "선생님 (오프라인 마스터)",
            scriptUrl: ""
          };
          setSession(teacherSession);
          saveJSON(SESSION_KEY, teacherSession);
          setTeacherAccessCode(cleanedCode);
          localStorage.setItem("bdm.teacherAccessCode.v1", cleanedCode);
          return { success: true };
        } else {
          return { success: false, message: "교사 인증코드가 오프라인 상태에서 일치하지 않습니다." };
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
    email?: string;
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

  // 이메일 기반 비밀번호 자가 복구 기능 (GAS 연동)
  const recoverPassword = useCallback(async (schoolName: string, email: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(MASTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "RECOVER_PASSWORD",
          schoolName: schoolName.trim(),
          email: email.trim()
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        return { success: true, message: data.message || "비밀번호가 이메일로 자동 발송되었습니다." };
      } else {
        return { success: false, message: data.message || "해당 정보와 일치하는 계정을 찾을 수 없습니다." };
      }
    } catch (error) {
      console.error("Password recovery request failed:", error);
      return { success: false, message: "마스터 서버 통신 오류가 발생했습니다." };
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
    setTeacherAccessCode("1234");
    localStorage.removeItem("bdm.teacherAccessCode.v1");
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

      const activeStudents = localStudents !== null ? localStudents : SEED_STUDENTS;
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

      // 보너스 활성화 로드
      const localBonuses = loadJSON<ActiveBonuses | null>(BONUSES_KEY, null);
      if (localBonuses) {
        setActiveBonuses(localBonuses);
      }

      // 세션 기반 타이틀 및 설정 로드
      if (cachedSession) {
        if (cachedSession.leagueName) {
          setTitle(cachedSession.leagueName);
        }
        if (cachedSession.settingsBonus) {
          try {
            const parsed = typeof cachedSession.settingsBonus === "string" 
              ? JSON.parse(cachedSession.settingsBonus) 
              : cachedSession.settingsBonus;
            setActiveBonuses(parsed);
          } catch (e) {
            console.error("Failed to parse cached session bonuses:", e);
          }
        }
      }

      setHydrated(true);

      // C. 세션이 살아있는 경우 구글 시트 검증 및 연동 데이터 강제 최신화 (Source of Truth)
      if (cachedSession) {
        let currentSession = cachedSession;

        // 1. 교사/마스터 권한 세션의 경우 구글 시트 마스터 DB와 인증 정보(비밀번호) 재동기화
        const cachedCode = localStorage.getItem("bdm.teacherAccessCode.v1") || "";
        if ((cachedSession.role === "TEACHER" || cachedSession.role === "MASTER") && cachedCode) {
          try {
            let loginIdToVerify = cachedSession.loginId;

            if (!loginIdToVerify && cachedSession.role === "TEACHER") {
              try {
                const teachers = await getTeachersList();
                const normalizeSchool = (name: string) => name.replace(/(초등학교|초등|학교|초)$/, "").trim();
                const targetSchool = normalizeSchool(cachedSession.schoolName);
                const matchedTeacher = teachers.find(
                  (t: any) => 
                    normalizeSchool(t.schoolName) === targetSchool || 
                    normalizeSchool(t.loginId) === targetSchool
                );
                if (matchedTeacher) {
                  loginIdToVerify = matchedTeacher.loginId;
                } else {
                  loginIdToVerify = cachedSession.schoolName;
                }
              } catch (e) {
                loginIdToVerify = cachedSession.schoolName;
              }
            }

            const verifyRes = await fetch(MASTER_API_URL, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain;charset=utf-8",
              },
              body: JSON.stringify({
                action: "LOGIN",
                loginId: loginIdToVerify,
                password: cachedCode,
                role: cachedSession.role
              })
            });
            const verifyData = await verifyRes.json();
            if (verifyData.status !== "success" || !verifyData.user) {
              // 마스터 DB에서 비밀번호 불일치로 판정 -> 로컬 캐시 꼬임 방지를 위해 강제 로그아웃
              console.warn("Cached session validation failed (password changed in Google Sheets). Force logging out.");
              setSession(null);
              saveJSON(SESSION_KEY, null);
              setTeacherAccessCode("1234");
              localStorage.removeItem("bdm.teacherAccessCode.v1");
              return;
            } else {
              // 최신 세션 정보 동기화
              currentSession = verifyData.user;
              setSession(verifyData.user);
              saveJSON(SESSION_KEY, verifyData.user);
            }
          } catch (err) {
            console.warn("Failed online-verifying cached session. Falling back to local cache:", err);
          }
        }

        // 2. 최신 구글 시트 데이터를 가져와 로컬 상태 강제 최신화
        if (currentSession.scriptUrl) {
          setIsSyncing(true);
          try {
            const response = await fetch(currentSession.scriptUrl);
            const data = await response.json();
            if (data.status === "success") {
              if (data.students) {
                setStudents(data.students);
                saveJSON(STUDENTS_KEY, data.students);
              }
              if (data.matches) {
                setMatches(data.matches);
                saveJSON(MATCHES_KEY, data.matches);
              }
              if (data.leagueName) {
                setTitle(data.leagueName);
                saveJSON(TITLE_KEY, data.leagueName);
              }
              if (data.settingsBonus) {
                try {
                  const parsed = typeof data.settingsBonus === "string" 
                    ? JSON.parse(data.settingsBonus) 
                    : data.settingsBonus;
                  setActiveBonuses(parsed);
                  saveJSON(BONUSES_KEY, parsed);
                } catch (e) {
                  console.error("Failed parsing settingsBonus from remote GET:", e);
                }
              }
              console.log("Google Sheets database synchronized on session load!");
            }
          } catch (error) {
            console.warn("Could not sync with remote sheet on initialization. Local cache utilized:", error);
          } finally {
            setIsSyncing(false);
          }
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
  useEffect(() => { if (hydrated) saveJSON(BONUSES_KEY, activeBonuses); }, [activeBonuses, hydrated]);

  // 경기 기록 및 동기화 (언더독 & 점수차 & 라이벌 & 첫승 & 복수전 누적 보상 적용)
  const recordMatch = useCallback((playerAId: string, playerBId: string, scoreA: number, scoreB: number) => {
    if (playerAId === playerBId) return;
    const aWon = scoreA > scoreB;

    const playerA = students.find((s) => s.id === playerAId);
    const playerB = students.find((s) => s.id === playerBId);
    if (!playerA || !playerB) return;

    const preRpA = playerA.rp;
    const preRpB = playerB.rp;

    const winnerId = aWon ? playerAId : playerBId;
    const loserId = aWon ? playerBId : playerAId;
    const winnerPlayer = aWon ? playerA : playerB;
    const loserPlayer = aWon ? playerB : playerA;

    // 1. 언더독 보너스 (N RP: 자신보다 높은 티어를 이겼을 때 점수 차의 10% 지급)
    let underdogBonus = 0;
    const winPrevRp = winnerPlayer.rp;
    const losePrevRp = loserPlayer.rp;
    if (activeBonuses.underdog && winPrevRp < losePrevRp) {
      const winTier = getTier(winPrevRp, tierThresholds);
      const loseTier = getTier(losePrevRp, tierThresholds);
      const winTierRank = TIER_RANKING[winTier] ?? 1;
      const loseTierRank = TIER_RANKING[loseTier] ?? 1;
      if (winTierRank < loseTierRank) {
        underdogBonus = Math.max(0, Math.floor((losePrevRp - winPrevRp) * 0.1));
      }
    }

    // 2. 점수차 비례 보상 (압승 보너스: 경기 점수 차이 1점당 1점 추가 지급)
    let scoreDiffBonus = 0;
    if (activeBonuses.scoreDiff) {
      scoreDiffBonus = Math.abs(scoreA - scoreB);
    }

    // 3. 라이벌 매치 보너스 (+5 RP: RP 차이가 20점 이하)
    let rivalBonus = 0;
    if (activeBonuses.rival) {
      const rpDiff = Math.abs(preRpA - preRpB);
      rivalBonus = rpDiff <= 20 ? 5 : 0;
    }

    // 오늘의 날짜 구하기 (로컬 타임존 반영)
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    const todayYmd = localToday.toISOString().split("T")[0];

    // 4. 오늘의 첫 승 보너스 (+15 RP)
    let firstWinBonus = 0;
    if (activeBonuses.firstWin) {
      firstWinBonus = winnerPlayer.lastWinDate !== todayYmd ? 15 : 0;
    }

    // 5. 복수전 성공 보너스 (+10 RP)
    let revengeBonus = 0;
    if (activeBonuses.revenge) {
      const hasPastLoss = matches.some((m) => {
        const isCurrentWinnerA = m.playerAId === winnerId && m.playerBId === loserId;
        const isCurrentWinnerB = m.playerBId === winnerId && m.playerAId === loserId;
        if (isCurrentWinnerA) return m.scoreB > m.scoreA; // winner lost to loser
        if (isCurrentWinnerB) return m.scoreA > m.scoreB; // winner lost to loser
        return false;
      });
      revengeBonus = hasPastLoss ? 10 : 0;
    }

    // 6. 최종 변동 RP 계산 (누적 합산 방식)
    const winDeltaTotal = rpVariables.winDelta + underdogBonus + scoreDiffBonus + rivalBonus + firstWinBonus + revengeBonus;
    const loseDeltaTotal = -rpVariables.loseDelta; // 패자 보호: 감점 방어

    const deltaA = aWon ? winDeltaTotal : loseDeltaTotal;
    const deltaB = aWon ? loseDeltaTotal : winDeltaTotal;

    // 실시간 승급 효과 감지
    const winnerDelta = aWon ? deltaA : deltaB;
    const winFinalRp = winPrevRp + winnerDelta;
    const winPrevTier = getTier(winPrevRp, tierThresholds);
    const winFinalTier = getTier(winFinalRp, tierThresholds);
    const winPrevSub = getTierSubdivision(winPrevRp, tierThresholds);
    const winFinalSub = getTierSubdivision(winFinalRp, tierThresholds);

    const basePromoted = TIER_ORDER.indexOf(winFinalTier) < TIER_ORDER.indexOf(winPrevTier);
    const subPromoted = winFinalTier === winPrevTier && winFinalSub < winPrevSub;
    const isPromoted = basePromoted || subPromoted;

    if (isPromoted) {
      const currentLabel = getFullTierLabel(winFinalRp, tierThresholds);
      setPromotionEvent({
        isPromoted: true,
        newTier: currentLabel,
        studentName: winnerPlayer.name
      });
    }

    const match: Match = { 
      id: uid(), 
      playerAId, 
      playerBId, 
      scoreA, 
      scoreB, 
      date: new Date().toISOString(),
      rpDeltaA: deltaA,
      rpDeltaB: deltaB,
      // Store individual bonus stats to audit & display in UI
      underdogBonusA: aWon ? underdogBonus : 0,
      underdogBonusB: !aWon ? underdogBonus : 0,
      scoreDiffBonusA: aWon ? scoreDiffBonus : 0,
      scoreDiffBonusB: !aWon ? scoreDiffBonus : 0,
      rivalBonusA: aWon ? rivalBonus : 0,
      rivalBonusB: !aWon ? rivalBonus : 0,
      firstWinBonusA: aWon ? firstWinBonus : 0,
      firstWinBonusB: !aWon ? firstWinBonus : 0,
      revengeBonusA: aWon ? revengeBonus : 0,
      revengeBonusB: !aWon ? revengeBonus : 0,
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
          lastWinDate: won ? todayYmd : s.lastWinDate, // 승리 시 lastWinDate 갱신
        };
      });

      syncWithGoogleSheets(nextStudents, nextMatches);
      return nextStudents;
    });

    return match;
  }, [students, matches, syncWithGoogleSheets, rpVariables, tierThresholds]);

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

  // 경기 점수 수정 및 보너스/RP 완벽 재계산 액션
  const updateMatchScore = useCallback((matchId: string, nextScoreA: number, nextScoreB: number) => {
    let updatedMatch: Match | null = null;
    let nextMatchesList: Match[] = [];
    let nextStudentsList: Student[] = [];

    setMatches((prevMatches) => {
      const match = prevMatches.find((m) => m.id === matchId);
      if (!match) return prevMatches;

      const playerAId = match.playerAId;
      const playerBId = match.playerBId;
      const oldAWon = match.scoreA > match.scoreB;
      const oldRpDeltaA = match.rpDeltaA ?? 0;
      const oldRpDeltaB = match.rpDeltaB ?? 0;

      // 1. Rollback old match stats for both students to get their "pre-match" state
      setStudents((prevStudents) => {
        const rolledBackStudents = prevStudents.map((s) => {
          if (s.id !== playerAId && s.id !== playerBId) return s;

          const isA = s.id === playerAId;
          const oldWon = isA ? oldAWon : !oldAWon;
          const oldDelta = isA ? oldRpDeltaA : oldRpDeltaB;

          // Rollback wins, losses, RP
          const newRp = Math.max(0, s.rp - oldDelta);
          const newWins = Math.max(0, s.wins - (oldWon ? 1 : 0));
          const newLosses = Math.max(0, s.losses - (oldWon ? 0 : 1));

          return {
            ...s,
            rp: newRp,
            wins: newWins,
            losses: newLosses,
          };
        });

        // 2. Perform recalculation using the rolled back students
        const playerA = rolledBackStudents.find((s) => s.id === playerAId)!;
        const playerB = rolledBackStudents.find((s) => s.id === playerBId)!;

        const aWon = nextScoreA > nextScoreB;
        const winnerId = aWon ? playerAId : playerBId;
        const loserId = aWon ? playerBId : playerAId;
        const winnerPlayer = aWon ? playerA : playerB;
        const loserPlayer = aWon ? playerB : playerA;

        // A. Underdog bonus (N RP: 자신보다 높은 티어를 이겼을 때 점수 차의 10% 지급)
        let underdogBonus = 0;
        if (activeBonuses.underdog && winnerPlayer.rp < loserPlayer.rp) {
          const winTier = getTier(winnerPlayer.rp, tierThresholds);
          const loseTier = getTier(loserPlayer.rp, tierThresholds);
          const winTierRank = TIER_RANKING[winTier] ?? 1;
          const loseTierRank = TIER_RANKING[loseTier] ?? 1;
          if (winTierRank < loseTierRank) {
            underdogBonus = Math.max(0, Math.floor((loserPlayer.rp - winnerPlayer.rp) * 0.1));
          }
        }

        // B. Score difference bonus (압승 보너스: 경기 점수 차이 1점당 1점 추가 지급)
        let scoreDiffBonus = 0;
        if (activeBonuses.scoreDiff) {
          scoreDiffBonus = Math.abs(nextScoreA - nextScoreB);
        }

        // C. Rival bonus (+5 RP: RP 차이가 20점 이하)
        let rivalBonus = 0;
        if (activeBonuses.rival) {
          const rpDiff = Math.abs(playerA.rp - playerB.rp);
          rivalBonus = rpDiff <= 20 ? 5 : 0;
        }

        // 오늘의 날짜 구하기 (로컬 타임존 반영)
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localToday = new Date(today.getTime() - (offset * 60 * 1000));
        const todayYmd = localToday.toISOString().split("T")[0];

        // D. Daily first win bonus (+15 RP)
        let firstWinBonus = 0;
        if (activeBonuses.firstWin) {
          firstWinBonus = winnerPlayer.lastWinDate !== todayYmd ? 15 : 0;
        }

        // E. Revenge bonus (+10 RP)
        let revengeBonus = 0;
        if (activeBonuses.revenge) {
          const pastMatches = prevMatches.filter((m) => m.id !== matchId);
          const hasPastLoss = pastMatches.some((m) => {
            const isCurrentWinnerA = m.playerAId === winnerId && m.playerBId === loserId;
            const isCurrentWinnerB = m.playerBId === winnerId && m.playerAId === loserId;
            if (isCurrentWinnerA) return m.scoreB > m.scoreA;
            if (isCurrentWinnerB) return m.scoreA > m.scoreB;
            return false;
          });
          revengeBonus = hasPastLoss ? 10 : 0;
        }

        // F. Consolidated RP Deltas
        const winDeltaTotal = rpVariables.winDelta + underdogBonus + scoreDiffBonus + rivalBonus + firstWinBonus + revengeBonus;
        const loseDeltaTotal = -rpVariables.loseDelta;

        const deltaA = aWon ? winDeltaTotal : loseDeltaTotal;
        const deltaB = aWon ? loseDeltaTotal : winDeltaTotal;

        // 실시간 승급 효과 감지
        const winnerDelta = aWon ? deltaA : deltaB;
        const winPrevRp = winnerPlayer.rp;
        const winFinalRp = winPrevRp + winnerDelta;
        const winPrevTier = getTier(winPrevRp, tierThresholds);
        const winFinalTier = getTier(winFinalRp, tierThresholds);
        const winPrevSub = getTierSubdivision(winPrevRp, tierThresholds);
        const winFinalSub = getTierSubdivision(winFinalRp, tierThresholds);

        const basePromoted = TIER_ORDER.indexOf(winFinalTier) < TIER_ORDER.indexOf(winPrevTier);
        const subPromoted = winFinalTier === winPrevTier && winFinalSub < winPrevSub;
        const isPromoted = basePromoted || subPromoted;

        if (isPromoted) {
          const currentLabel = getFullTierLabel(winFinalRp, tierThresholds);
          setPromotionEvent({
            isPromoted: true,
            newTier: currentLabel,
            studentName: winnerPlayer.name
          });
        }

        // 3. Construct the updated Match record
        updatedMatch = {
          ...match,
          scoreA: nextScoreA,
          scoreB: nextScoreB,
          rpDeltaA: deltaA,
          rpDeltaB: deltaB,
          underdogBonusA: aWon ? underdogBonus : 0,
          underdogBonusB: !aWon ? underdogBonus : 0,
          scoreDiffBonusA: aWon ? scoreDiffBonus : 0,
          scoreDiffBonusB: !aWon ? scoreDiffBonus : 0,
          rivalBonusA: aWon ? rivalBonus : 0,
          rivalBonusB: !aWon ? rivalBonus : 0,
          firstWinBonusA: aWon ? firstWinBonus : 0,
          firstWinBonusB: !aWon ? firstWinBonus : 0,
          revengeBonusA: aWon ? revengeBonus : 0,
          revengeBonusB: !aWon ? revengeBonus : 0,
        };

        // 4. Update both students' stats with the new deltas
        nextStudentsList = rolledBackStudents.map((s) => {
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
              nextShields = 3; // 승급 시 3회 완충
            }
            nextRp = Math.max(0, nextRp);
          } else {
            const minThreshold = tierThresholds[preTier] ?? 0;
            if (nextRp < minThreshold && preTier !== "Bronze") {
              if (nextShields >= 1) {
                nextRp = minThreshold;
                nextShields = nextShields - 1;
              } else {
                nextRp = Math.max(0, nextRp);
              }
            } else {
              nextRp = Math.max(0, nextRp);
            }
          }

          // Build new recent array
          const tempMatches = prevMatches.map((m) => m.id === matchId ? updatedMatch! : m);
          const sMatches = tempMatches
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
            rp: nextRp,
            wins: s.wins + (won ? 1 : 0),
            losses: s.losses + (won ? 0 : 1),
            recent: newRecent,
            demotionShields: nextShields,
            lastMatchDate: new Date().toISOString(),
            lastWinDate: won ? todayYmd : s.lastWinDate,
          };
        });

        // 5. Sync both updated datasets to Sheets in background
        syncWithGoogleSheets(nextStudentsList, prevMatches.map((m) => m.id === matchId ? updatedMatch! : m));
        return nextStudentsList;
      });

      // 6. Update matches list
      nextMatchesList = prevMatches.map((m) => m.id === matchId ? updatedMatch! : m);
      return nextMatchesList;
    });
  }, [matches, students, tierThresholds, rpVariables, syncWithGoogleSheets]);

  // 리그 커스텀 설정 통합 저장 (마스터 DB 동기화 포함)
  const saveLeagueSettings = useCallback(async (newTitle: string, newBonuses: ActiveBonuses) => {
    setTitle(newTitle);
    setActiveBonuses(newBonuses);
    saveJSON(TITLE_KEY, newTitle);
    saveJSON(BONUSES_KEY, newBonuses);

    if (session) {
      const updatedSession = {
        ...session,
        leagueName: newTitle,
        settingsBonus: newBonuses
      };
      setSession(updatedSession);
      saveJSON(SESSION_KEY, updatedSession);

      setIsSyncing(true);
      try {
        const res = await fetch(MASTER_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "UPDATE_LEAGUE_SETTINGS",
            loginId: session.loginId,
            role: session.role,
            schoolName: session.schoolName,
            leagueName: newTitle,
            settingsBonus: JSON.stringify(newBonuses)
          })
        });
        const data = await res.json();
        console.log("Updated league settings on Google Sheets:", data);
      } catch (err) {
        console.warn("Failed to sync settings to Google Sheets MASTER row. Kept locally.", err);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [session]);

  // 학생용 '나의 업적' 자동 연산 함수 (Derived State)
  const calculateAchievements = useCallback((studentId: string): Achievement[] => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return [];

    // 해당 학생이 참여한 모든 경기 필터링
    const studentMatches = matches.filter(
      (m) => m.playerAId === studentId || m.playerBId === studentId
    );

    // 경기 기록 시간순 정렬 (과거에서 최신순)
    const chronologicalMatches = [...studentMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const totalGames = studentMatches.length;
    const totalLosses = chronologicalMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId;
      const aWon = m.scoreA > m.scoreB;
      const won = isPlayerA ? aWon : !aWon;
      return !won;
    }).length;

    // 연승, 연패, 스냅 연산
    let maxWinStreak = 0;
    let currentWinStreak = 0;
    let maxLossStreak = 0;
    let currentLossStreak = 0;
    let brokeLossStreakOf4Plus = false;

    chronologicalMatches.forEach((m) => {
      const isPlayerA = m.playerAId === studentId;
      const aWon = m.scoreA > m.scoreB;
      const won = isPlayerA ? aWon : !aWon;

      if (won) {
        currentWinStreak++;
        if (currentLossStreak >= 4) {
          brokeLossStreakOf4Plus = true;
        }
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) {
          maxWinStreak = currentWinStreak;
        }
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) {
          maxLossStreak = currentLossStreak;
        }
      }
    });

    // 자신보다 높은 티어와 대결한 횟수 (승패 무관)
    let higherTierCount = 0;
    chronologicalMatches.forEach((m) => {
      const oppId = m.playerAId === studentId ? m.playerBId : m.playerAId;
      const opponent = students.find((s) => s.id === oppId);
      if (opponent) {
        // 이 시점의 RP 차이나 티어로 확인
        const playerTier = getTier(student.rp, tierThresholds);
        const oppTier = getTier(opponent.rp, tierThresholds);
        const playerTierRank = TIER_RANKING[playerTier] ?? 1;
        const oppTierRank = TIER_RANKING[oppTier] ?? 1;
        if (oppTierRank > playerTierRank) {
          higherTierCount++;
        }
      }
    });

    // 동일 날짜에 5경기 이상 참여 확인
    const dateCounts: Record<string, number> = {};
    studentMatches.forEach((m) => {
      const d = new Date(m.date);
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });
    const maxMatchesOnSingleDay = Object.values(dateCounts).reduce((max, val) => Math.max(max, val), 0);

    // 복수전 성공 보너스 누적 횟수
    const revengeCount = studentMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId;
      return isPlayerA ? (m.revengeBonusA ?? 0) > 0 : (m.revengeBonusB ?? 0) > 0;
    }).length;

    // 라이벌 격퇴 보너스 누적 횟수
    const rivalCount = studentMatches.filter((m) => {
      const isPlayerA = m.playerAId === studentId;
      return isPlayerA ? (m.rivalBonusA ?? 0) > 0 : (m.rivalBonusB ?? 0) > 0;
    }).length;

    return [
      // Common (커먼)
      {
        id: "court_first_greeting",
        name: "코트의 첫인사",
        description: "리그 첫 경기 기록 완료",
        tier: "Common",
        currentValue: totalGames >= 1 ? 1 : 0,
        targetValue: 1,
        isUnlocked: totalGames >= 1
      },
      {
        id: "warmup_complete",
        name: "워밍업 완료",
        description: "누적 경기 수 10회 달성",
        tier: "Common",
        currentValue: totalGames,
        targetValue: 10,
        isUnlocked: totalGames >= 10
      },
      {
        id: "taste_of_victory",
        name: "승리의 맛",
        description: "3연승 달성",
        tier: "Common",
        currentValue: maxWinStreak,
        targetValue: 3,
        isUnlocked: maxWinStreak >= 3
      },
      {
        id: "unbroken_heart",
        name: "꺾이지 않는 마음",
        description: "3연패 기록 (실패를 부끄러워하지 않는 태도 칭찬)",
        tier: "Common",
        currentValue: maxLossStreak,
        targetValue: 3,
        isUnlocked: maxLossStreak >= 3
      },
      // Rare (레어)
      {
        id: "iron_stamina",
        name: "강철 체력",
        description: "누적 경기 수 30회 달성",
        tier: "Rare",
        currentValue: totalGames,
        targetValue: 30,
        isUnlocked: totalGames >= 30
      },
      {
        id: "courageous_challenger",
        name: "용기 있는 도전자",
        description: "자신보다 티어가 높은 상대와 10회 대결 진행 (승패 무관)",
        tier: "Rare",
        currentValue: higherTierCount,
        targetValue: 10,
        isUnlocked: higherTierCount >= 10
      },
      {
        id: "gym_spirit",
        name: "체육관 지박령",
        description: "동일한 날짜에 5경기 이상 참여",
        tier: "Rare",
        currentValue: maxMatchesOnSingleDay,
        targetValue: 5,
        isUnlocked: maxMatchesOnSingleDay >= 5
      },
      {
        id: "unyielding_will",
        name: "불굴의 의지",
        description: "4연패 이상 기록 후 승리하여 연패 사슬 끊어내기",
        tier: "Rare",
        currentValue: brokeLossStreakOf4Plus ? 1 : 0,
        targetValue: 1,
        isUnlocked: brokeLossStreakOf4Plus
      },
      {
        id: "avatar_of_revenge",
        name: "복수의 화신",
        description: "복수전 성공 보너스 3회 누적 획득",
        tier: "Rare",
        currentValue: revengeCount,
        targetValue: 3,
        isUnlocked: revengeCount >= 3
      },
      // Epic (에픽)
      {
        id: "court_ruler",
        name: "코트의 지배자",
        description: "누적 경기 수 70회 달성",
        tier: "Epic",
        currentValue: totalGames,
        targetValue: 70,
        isUnlocked: totalGames >= 70
      },
      {
        id: "honorable_sweat",
        name: "명예로운 땀방울",
        description: "누적 패배 수 30회 달성 (실패에 굴하지 않는 스포츠맨십 칭찬)",
        tier: "Epic",
        currentValue: totalLosses,
        targetValue: 30,
        isUnlocked: totalLosses >= 30
      },
      {
        id: "rival_destroyer",
        name: "라이벌 파괴자",
        description: "라이벌 격퇴 보너스 15회 누적 획득",
        tier: "Epic",
        currentValue: rivalCount,
        targetValue: 15,
        isUnlocked: rivalCount >= 15
      },
      // Legendary (레전더리)
      {
        id: "legendary_undefeated",
        name: "무패의 전설",
        description: "10연승 달성",
        tier: "Legendary",
        currentValue: maxWinStreak,
        targetValue: 10,
        isUnlocked: maxWinStreak >= 10
      },
      {
        id: "true_champion",
        name: "진정한 챔피언",
        description: "누적 경기 수 120회 달성 (한 학기 동안 가장 성실하게 참여한 학생)",
        tier: "Legendary",
        currentValue: totalGames,
        targetValue: 120,
        isUnlocked: totalGames >= 120
      }
    ];
  }, [students, matches, tierThresholds]);

  // 학생용 티어 승격 실시간 감지 감시자
  useEffect(() => {
    if (hydrated && session && session.role === "STUDENT" && session.studentId) {
      const student = students.find((s) => s.id === session.studentId);
      if (student) {
        const currentRp = student.rp;
        const currentTier = getTier(currentRp, tierThresholds);
        const currentSub = getTierSubdivision(currentRp, tierThresholds);
        const currentLabel = getFullTierLabel(currentRp, tierThresholds);

        const lastKnownRpStr = localStorage.getItem(`bdm.lastKnownRp.${session.studentId}`);
        if (lastKnownRpStr) {
          const lastRp = parseInt(lastKnownRpStr, 10);
          if (!isNaN(lastRp) && lastRp !== currentRp) {
            const lastTier = getTier(lastRp, tierThresholds);
            const lastSub = getTierSubdivision(lastRp, tierThresholds);
            
            const getRank = (t: TierName, s: number) => {
              const base = { Bronze: 10, Silver: 20, Gold: 30, Platinum: 40, Diamond: 50 }[t] ?? 10;
              return base + (5 - s);
            };

            // 이전 랭크보다 현재 랭크가 더 높으면 승급 이벤트 트리거
            if (getRank(currentTier, currentSub) > getRank(lastTier, lastSub)) {
              setPromotionEvent({ isPromoted: true, newTier: currentLabel });
            }
          }
        }
        // 최신 RP로 로컬 캐시 갱신
        localStorage.setItem(`bdm.lastKnownRp.${session.studentId}`, currentRp.toString());
      }
    }
  }, [students, hydrated, session, tierThresholds]);

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
    recoverPassword,
    MASTER_API_URL,
    tierThresholds,
    rpVariables,
    updateLeagueSettings,
    updateStudentGender,
    deleteStudent,
    restoreFromCSV,
    bulkDecayRP,
    teacherAccessCode,
    updateMatchScore,
    activeBonuses,
    saveLeagueSettings,
    calculateAchievements,
    promotionEvent,
    setPromotionEvent
  };
}

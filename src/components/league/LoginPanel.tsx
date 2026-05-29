import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Crown, Swords, Users, ShieldAlert, Key, UserPlus, Sparkles, Building2, HelpCircle, Gamepad2 } from "lucide-react";

type Role = "MASTER" | "TEACHER" | "STUDENT";

export function LoginPanel({
  onLogin,
  onRegister,
  isSyncing
}: {
  onLogin: (id: string, pw: string, role: Role) => Promise<{ success: boolean; message?: string }>;
  onRegister: (details: {
    loginId: string;
    password: string;
    role: "TEACHER" | "STUDENT";
    schoolName: string;
    userName: string;
    scriptUrl?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  isSyncing: boolean;
}) {
  const [role, setRole] = useState<Role>("TEACHER");
  const [isRegister, setIsRegister] = useState(false);

  // Form states
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [scriptUrl, setScriptUrl] = useState("");

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim()) {
      return toast.error("아이디와 비밀번호를 모두 입력해 주세요.");
    }

    const res = await onLogin(loginId.trim(), password.trim(), role);
    if (res.success) {
      toast.success(`${role === "MASTER" ? "최고 관리자" : role === "TEACHER" ? userName + " 선생님" : "학생"} 권한으로 접속했습니다!`);
    } else {
      toast.error(res.message || "로그인에 실패했습니다.");
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password.trim() || !userName.trim() || !schoolName.trim()) {
      return toast.error("필수 항목(* 표시)을 모두 채워주세요.");
    }

    if (role === "TEACHER" && !scriptUrl.trim()) {
      return toast.error("체육 교사는 본인 전용의 구글 Apps Script Web App API 주소가 필수적입니다.");
    }

    const res = await onRegister({
      loginId: loginId.trim(),
      password: password.trim(),
      role: role === "STUDENT" ? "STUDENT" : "TEACHER",
      schoolName: schoolName.trim(),
      userName: userName.trim(),
      scriptUrl: role === "TEACHER" ? scriptUrl.trim() : ""
    });

    if (res.success) {
      toast.success(res.message || "성공적으로 가입이 완료되었습니다! 이제 로그인을 시도해 주세요.");
      setIsRegister(false);
      setPassword("");
    } else {
      toast.error(res.message || "가입에 실패했습니다.");
    }
  };

  // 1초 만에 가상 데모 환경으로 즉시 진입하는 게스트 로그인 처리
  const handleGuestDemoLogin = async () => {
    toast.loading("가상 데모 리그 샌드박스를 생성하는 중...", { id: "guest-loading" });
    const res = await onLogin("guest", "guest", "TEACHER");
    toast.dismiss("guest-loading");
    if (res.success) {
      toast.success("🎮 게스트 모드로 접속했습니다! 전체 기능(추천, 입력, 어드민)을 자유롭게 체험해 보세요.");
    } else {
      toast.error("게스트 로그인 실패");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background neon elements */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.25)_1px,transparent_1px)] bg-[size:30px_30px] pointer-events-none opacity-30" />
      <div className="absolute -top-40 -left-40 size-96 rounded-full bg-neon-blue/10 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 rounded-full bg-tier-diamond/10 blur-[130px] pointer-events-none" />

      <Card className="w-full max-w-lg border-border/60 bg-card/65 backdrop-blur-xl p-6 md:p-8 rounded-2xl shadow-[0_0_50px_rgba(0,180,216,0.06)] relative overflow-hidden animate-in zoom-in-95 duration-400">
        
        {/* Brand / Logo */}
        <div className="flex flex-col items-center text-center mb-6 shrink-0 relative z-10">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-neon-blue to-tier-diamond shadow-[0_0_20px_oklch(0.78_0.18_230/0.45)] mb-3 animate-pulse">
            <Swords className="size-6 text-primary-foreground" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-neon-blue">Elementary Sports League</p>
          <h2 className="text-xl md:text-2xl font-black tracking-tight mt-1 text-foreground">
            {isRegister ? "체육 교사/학생 회원가입" : "스포츠 리그전 인증 포털"}
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {isRegister 
              ? "나만의 랭킹 데이터베이스를 구축하고 학생 리그를 시작해 보세요!"
              : "역할을 선택하고 로그인하여 실시간 랭킹 시스템에 접속하세요."}
          </p>
        </div>

        {/* 1. Role Selector Tabs (Only when not in register mode) */}
        {!isRegister && (
          <div className="grid grid-cols-3 gap-2 bg-background/50 border border-border/40 p-1.5 rounded-xl mb-6 relative z-10">
            <RoleTab active={role === "STUDENT"} onClick={() => setRole("STUDENT")} icon={<Users className="size-3.5" />}>
              🏆 학생
            </RoleTab>
            <RoleTab active={role === "TEACHER"} onClick={() => setRole("TEACHER")} icon={<Building2 className="size-3.5" />}>
              🏫 교사
            </RoleTab>
            <RoleTab active={role === "MASTER"} onClick={() => setRole("MASTER")} icon={<Crown className="size-3.5" />}>
              👑 관리자
            </RoleTab>
          </div>
        )}

        {/* 2. Login/Register Forms */}
        <form onSubmit={isRegister ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4.5 relative z-10">
          
          {/* USER NAME (Only for register) */}
          {isRegister && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-bold text-foreground">이름 *</Label>
              <Input
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder={role === "STUDENT" ? "예: 홍길동" : "예: 강체육 선생님"}
                className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
              />
            </div>
          )}

          {/* SCHOOL NAME (Only for register) */}
          {isRegister && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-bold text-foreground">학교 및 소속명 *</Label>
              <Input
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="예: 서울상도초등학교"
                className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
              />
            </div>
          )}

          {/* LOGIN ID */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              {isRegister ? "로그인 아이디 *" : "아이디"}
            </Label>
            <Input
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="로그인 아이디를 입력하세요"
              className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
            />
          </div>

          {/* PASSWORD */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">
              {isRegister ? "비밀번호 *" : "비밀번호"}
            </Label>
            <Input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
            />
          </div>

          {/* TEACHER PERSONAL SCRIPT URL (Only for register mode when role is TEACHER) */}
          {isRegister && role === "TEACHER" && (
            <div className="space-y-1.5 border-t border-border/30 pt-3 animate-in slide-in-from-top-3 duration-300">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-neon-blue flex items-center gap-1">
                  <Sparkles className="size-3.5" /> 개인 구글 스크립트 API 주소 *
                </Label>
                <button
                  type="button"
                  onClick={() => toast.info("구글 시트의 Apps Script를 웹 앱으로 배포하여 발급받은 'https://script.google.com/macros/s/.../exec' 주소를 입력해 주셔야 합니다.")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </div>
              <Input
                required
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="h-10 border-neon-blue/30 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue font-mono text-xs transition-all"
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                ※ 체육 선생님 개인 드라이브에 안전하게 데이터를 보관하기 위한 전용 주소입니다.
              </p>
            </div>
          )}

          {/* Submit Action Button */}
          <Button
            type="submit"
            disabled={isSyncing}
            className="w-full h-11 bg-gradient-to-r from-neon-blue to-tier-diamond hover:from-neon-blue hover:to-tier-diamond text-primary-foreground font-black tracking-wider shadow-lg hover:opacity-95 active:scale-[0.99] transition-all"
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                서버 검증 중...
              </span>
            ) : isRegister ? (
              <span className="flex items-center gap-1.5">
                <UserPlus className="size-4" /> 체육 교사 / 학생 등록 완료
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Key className="size-4" /> {role === "MASTER" ? "최고 관리자 본부 접속" : role === "TEACHER" ? "교사 전용 리그 접속" : "학생 리그 뷰어 접속"}
              </span>
            )}
          </Button>
        </form>

        {/* 3. 🎮 1-Click Guest Sandbox Demo Mode Button (Only when not in register mode) */}
        {!isRegister && (
          <div className="mt-3 relative z-10">
            <Button
              type="button"
              onClick={handleGuestDemoLogin}
              className="w-full h-11 bg-background/80 hover:bg-neon-blue/10 text-neon-blue border border-neon-blue/50 font-black tracking-wide shadow-[0_0_15px_rgba(0,180,216,0.15)] active:scale-[0.98] transition-all gap-1.5"
            >
              <Gamepad2 className="size-4.5 animate-bounce" /> 🎮 로그인 없이 1초 만에 데모 구경하기
            </Button>
          </div>
        )}

        {/* Toggle between Login and Register (Only for TEACHER/STUDENT roles) */}
        {!isSyncing && role !== "MASTER" && (
          <div className="mt-5 text-center text-xs text-muted-foreground border-t border-border/30 pt-4 relative z-10">
            {isRegister ? (
              <span>
                이미 계정이 있으신가요?{" "}
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="text-neon-blue font-bold hover:underline transition-all"
                >
                  로그인 창으로 이동
                </button>
              </span>
            ) : (
              <div className="flex flex-col gap-2">
                <span>
                  처음 이용하시는 체육 선생님/학생인가요?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      // Reset values
                      setLoginId("");
                      setPassword("");
                      setUserName("");
                      setSchoolName("");
                      setScriptUrl("");
                    }}
                    className="text-neon-blue font-bold hover:underline transition-all"
                  >
                    신규 회원 등록 (5초 완성)
                  </button>
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ※ 학생 회원가입 시에는 구글 스크립트 주소 입력이 필요 없습니다.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Master Admin fallback tip */}
        {!isRegister && role === "MASTER" && (
          <div className="mt-5 text-center text-[11px] text-muted-foreground bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 relative z-10">
            <ShieldAlert className="size-4 text-amber-500 inline mr-1" />
            최고 관리자 계정은 마스터 구글 시트의 1행 계정 정보 및 `MASTER` 권한 설정과 대조하여 엄격하게 검증됩니다.
          </div>
        )}

      </Card>
    </div>
  );
}

function RoleTab({
  active,
  onClick,
  icon,
  children
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-[0.97]",
        active
          ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-[0_0_12px_rgba(0,180,216,0.3)]"
          : "text-muted-foreground hover:text-foreground hover:bg-background/40"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Swords, Users, Building2, Key, Gamepad2 } from "lucide-react";

type Role = "TEACHER" | "STUDENT";

export function LoginPanel({
  onLogin,
  isSyncing
}: {
  onLogin: (schoolName: string, accessCodeOrName: string, role: Role) => Promise<{ success: boolean; message?: string }>;
  onRegister?: any;
  isSyncing: boolean;
}) {
  const [activeTab, setActiveTab] = useState<Role>("TEACHER");
  
  // Inputs
  const [schoolName, setSchoolName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [studentName, setStudentName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      return toast.error("학교 이름을 입력해 주세요.");
    }

    if (activeTab === "TEACHER") {
      if (!accessCode.trim()) {
        return toast.error("교사 인증코드를 입력해 주세요.");
      }
      const res = await onLogin(schoolName.trim(), accessCode.trim(), "TEACHER");
      if (res.success) {
        toast.success(`${schoolName} 교사 권한으로 접속했습니다!`);
      } else {
        toast.error(res.message || "인증코드가 일치하지 않습니다. (기본코드: 1234)");
      }
    } else {
      if (!studentName.trim()) {
        return toast.error("학생 본인의 이름을 입력해 주세요.");
      }
      const res = await onLogin(schoolName.trim(), studentName.trim(), "STUDENT");
      if (res.success) {
        toast.success(`${schoolName} ${studentName} 학생 권한으로 접속했습니다!`);
      } else {
        toast.error(res.message || "해당 학교 명단에 등록되지 않은 학생입니다. 교사에게 문의하세요.");
      }
    }
  };

  const handleGuestDemoLogin = async () => {
    toast.loading("가상 데모 스포츠 리그에 입장하는 중...", { id: "guest-loading" });
    const res = await onLogin("꿈나무 초등학교", "1234", "TEACHER");
    toast.dismiss("guest-loading");
    if (res.success) {
      toast.success("🎮 게스트 교사 권한으로 체험을 시작합니다. 모든 기능을 마음껏 테스트해보세요!");
    } else {
      toast.error("데모 로그인 실패");
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
            스포츠 리그전 인증 포털
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            학교명과 정보를 입력하고 실시간 스포츠 리그전 시스템에 접속하세요.
          </p>
        </div>

        {/* 1. 교사/학생 접속 탭 분리 */}
        <div className="grid grid-cols-2 gap-2 bg-background/50 border border-border/40 p-1.5 rounded-xl mb-6 relative z-10">
          <button
            type="button"
            onClick={() => setActiveTab("TEACHER")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-[0.97]",
              activeTab === "TEACHER"
                ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-[0_0_12px_rgba(0,180,216,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <Building2 className="size-3.5" /> 교사 접속
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("STUDENT")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg text-xs font-extrabold transition-all active:scale-[0.97]",
              activeTab === "STUDENT"
                ? "bg-gradient-to-r from-neon-blue to-tier-diamond text-primary-foreground shadow-[0_0_12px_rgba(0,180,216,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-background/40"
            )}
          >
            <Users className="size-3.5" /> 학생 접속
          </button>
        </div>

        {/* 2. Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4.5 relative z-10">
          {/* SCHOOL NAME */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">학교 이름</Label>
            <Input
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="학교 이름을 입력하세요 (예: 꿈나무 초등학교)"
              className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
            />
          </div>

          {activeTab === "TEACHER" ? (
            /* TEACHER LOGIN */
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold text-foreground">교사 인증코드</Label>
                <span className="text-[10px] text-muted-foreground font-mono">(기본코드: 1234)</span>
              </div>
              <Input
                required
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="교사 인증코드 4자리를 입력하세요"
                className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
              />
            </div>
          ) : (
            /* STUDENT LOGIN */
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <Label className="text-xs font-bold text-foreground">본인 이름</Label>
              <Input
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="명렬표에 등록된 본인 실명을 입력하세요"
                className="h-10 border-border/60 bg-background/40 hover:border-neon-blue/60 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
              />
            </div>
          )}

          {/* Submit Action Button */}
          <Button
            type="submit"
            disabled={isSyncing}
            className="w-full h-11 bg-gradient-to-r from-neon-blue to-tier-diamond hover:from-neon-blue hover:to-tier-diamond text-primary-foreground font-black tracking-wider shadow-lg hover:opacity-95 active:scale-[0.99] transition-all mt-4"
          >
            {isSyncing ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                접속 중...
              </span>
            ) : activeTab === "TEACHER" ? (
              <span className="flex items-center gap-1.5">
                <Key className="size-4" /> 교사 전용 리그 접속
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Users className="size-4" /> 학생 전용 리그 접속
              </span>
            )}
          </Button>
        </form>

        {/* 3. 🎮 1-Click Guest Sandbox Demo Mode Button */}
        <div className="mt-4 relative z-10 border-t border-border/30 pt-4">
          <Button
            type="button"
            onClick={handleGuestDemoLogin}
            className="w-full h-11 bg-background/80 hover:bg-neon-blue/10 text-neon-blue border border-neon-blue/50 font-black tracking-wide shadow-[0_0_15px_rgba(0,180,216,0.15)] active:scale-[0.98] transition-all gap-1.5"
          >
            <Gamepad2 className="size-4.5 animate-bounce" /> 🎮 로그인 없이 1초 만에 데모 구경하기
          </Button>
        </div>

      </Card>
    </div>
  );
}

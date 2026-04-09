import React, { useMemo, useState, useEffect } from 'react';
import { StudentAvatar } from './StudentAvatar';
import { 
  Trophy, Star, TrendingUp, CalendarCheck, 
  Zap, Target, ArrowRight, ArrowLeft, Medal, BookOpen, Plus, Shield, Camera
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة ---
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  date: string;
  semester?: '1' | '2';
}

export interface BehaviorRecord {
  id: string;
  type: 'positive' | 'negative';
  category: string;
  points?: number; 
  date: string;
  semester?: '1' | '2';
}

export interface Student {
  id: string;
  civilId: string;
  name: string;
  gender: 'male' | 'female';
  classes: string[];
  attendance?: any[];
  grades?: GradeRecord[];
  behavior?: BehaviorRecord[];
  totalKnightsPoints?: number; 
}

// --- وظيفة ترجمة واتجاه داخلية مؤقتة ---
const useApp = () => ({
  t: (key: string) => undefined as any, 
  dir: 'rtl' as const
});
// --------------------------------------------------

interface StudentDashboardProps {
  student: Student;
  currentSemester: '1' | '2';
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ student, currentSemester }) => {
  const { t, dir } = useApp();

  // 📸 حالة حفظ الصورة الشخصية المخصصة
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  // جلب الصورة المحفوظة عند فتح التطبيق
  useEffect(() => {
    if (student?.civilId) {
      const savedImage = localStorage.getItem(`rased_student_avatar_${student.civilId}`);
      if (savedImage) {
        setCustomAvatar(savedImage);
      }
    }
  }, [student]);

  // دالة معالجة رفع الصورة
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomAvatar(base64String); // تحديث الواجهة
        localStorage.setItem(`rased_student_avatar_${student.civilId}`, base64String); // الحفظ محلياً
      };
      reader.readAsDataURL(file);
    }
  };

  const attendanceStats = useMemo(() => {
    const semAttendance = student.attendance || [];
    if (semAttendance.length === 0) return { present: 0, total: 0, percentage: 100 };
    const present = semAttendance.filter(a => a.status === 'present').length;
    const percentage = Math.round((present / semAttendance.length) * 100);
    return { present, total: semAttendance.length, percentage };
  }, [student]);

  const academicStats = useMemo(() => {
    const semGrades = (student.grades || []).filter(g => (g.semester || '1') === currentSemester);
    const totalAssessments = semGrades.length;
    const uniqueSubjects = new Set(semGrades.map(g => g.subject)).size;
    const recent = [...semGrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);
    return { totalAssessments, uniqueSubjects, recent };
  }, [student, currentSemester]);

  const knightsPoints = student.totalKnightsPoints || 0;
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-hidden relative" dir={dir}>
      
      {/* 🌟 1. الهيدر الزجاجي المثبت */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/10 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <div className="flex items-center gap-4">
          
          {/* 📸 منطقة الصورة الشخصية القابلة للتغيير */}
          <div className="shrink-0 relative group">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              id="avatar-upload" 
              onChange={handleImageUpload} 
            />
            <label htmlFor="avatar-upload" className="cursor-pointer block relative">
              {customAvatar ? (
                <img 
                  src={customAvatar} 
                  alt="Student" 
                  className="w-12 h-12 rounded-2xl object-cover border border-white/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]" 
                />
              ) : (
                <StudentAvatar gender={student.gender} className="w-12 h-12 border border-white/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]" />
              )}
              {/* أيقونة الكاميرا الصغيرة */}
              <div className="absolute -bottom-1.5 -right-1.5 bg-cyan-500 rounded-full p-1 border-2 border-[#0f172a] shadow-lg group-hover:scale-110 transition-transform">
                <Camera className="w-2.5 h-2.5 text-white" />
              </div>
            </label>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-indigo-200 text-[10px] font-bold mb-0.5 flex items-center gap-1 opacity-80">
              <Zap className="w-3 h-3 text-amber-400" /> {t('studentWelcomePrefix') || 'مرحباً بالبطل،'}
            </h2>
            <h1 className="text-base font-black text-white leading-tight truncate drop-shadow-md">
              {student.name}
            </h1>
          </div>
          <div className="shrink-0 pl-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 border border-white/20 backdrop-blur-md rounded-xl text-[10px] font-bold text-slate-200 shadow-inner">
              <Target className="w-3 h-3 text-emerald-400" />
              {student.classes[0]}
            </span>
          </div>
        </div>
      </header>

      {/* منطقة المحتوى المنزلق */}
      <main className="flex-1 overflow-y-auto custom-scrollbar pb-[100px] px-5 pt-5 space-y-5">
        
        {/* 🛡️ لوحة شرف الفرسان */}
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-[1.5rem] p-4 backdrop-blur-xl shadow-[0_8px_30px_rgba(245,158,11,0.15)] flex items-center justify-between relative overflow-hidden transition-all hover:scale-[1.01]">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-20 blur-3xl rounded-full bg-amber-400 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col">
            <span className="text-[9px] font-bold text-amber-200/80 uppercase tracking-wider mb-1">
              {t('totalAssessments') || 'التقييمات المنجزة'}
            </span>
            <span className="text-xl font-black text-white flex items-baseline gap-1.5 drop-shadow-sm">
              <Target className="w-4 h-4 text-amber-400 self-center" />
              {academicStats.totalAssessments} <span className="text-[10px] text-amber-200/60 font-bold">تقييم</span>
            </span>
          </div>
          
          <div className="w-[1px] h-10 bg-white/10 relative z-10"></div>
          
          <div className="text-right relative z-10 flex flex-col items-end">
            <span className="text-[9px] font-black text-amber-300 uppercase tracking-wider mb-1 drop-shadow-sm">
              {t('knightsPoints') || 'نقاط الفرسان 🏆'}
            </span>
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 drop-shadow-sm flex items-center gap-1">
              <Plus className="w-5 h-5 text-amber-400" />
              {knightsPoints}
            </span>
          </div>
        </div>

        {/* 📊 2. الإحصائيات */}
        <div className="grid grid-cols-2 gap-3 relative z-20 shrink-0">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.25rem] p-3.5 flex flex-col justify-between shadow-sm transition-all hover:bg-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                <CalendarCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-xl font-black text-white">{attendanceStats.percentage}%</span>
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-indigo-200/70">{t('attendanceRate') || 'معدل الحضور'}</h3>
              <p className="text-[10px] font-black text-emerald-400 mt-0.5">{attendanceStats.present} {t('daysAttended') || 'يوم حضور'}</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.25rem] p-3.5 flex flex-col justify-between shadow-sm transition-all hover:bg-white/10">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <BookOpen className="w-5 h-5 text-cyan-400" />
              </div>
              <span className="text-xl font-black text-white">{academicStats.uniqueSubjects}</span>
            </div>
            <div>
              <h3 className="text-[10px] font-bold text-indigo-200/70">{t('activeSubjects') || 'المواد النشطة'}</h3>
              <p className="text-[10px] font-black text-cyan-400 mt-0.5">{t('subjectsEvaluated') || 'مواد تقييم'}</p>
            </div>
          </div>
        </div>

        {/* ⚡ 3. أحدث الإنجازات */}
        <div className="pb-6">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              {t('recentActivity') || 'أحدث الدرجات المكتسبة'}
            </h3>
            <button className="text-[9px] font-bold text-indigo-300 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1 backdrop-blur-md">
              {t('viewAll') || 'عرض الكل'} <ArrowIcon className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5">
            {academicStats.recent.length > 0 ? (
              academicStats.recent.map((grade) => {
                const badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

                return (
                  <div key={grade.id} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-3 flex items-center justify-between group hover:bg-white/10 hover:border-indigo-400/40 transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${badgeColor} shrink-0`}>
                         <Star className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 pr-1">
                        <h4 className="text-xs font-black text-white tracking-wide truncate">{grade.category}</h4>
                        <p className="text-[9px] font-bold text-indigo-200/60 mt-0.5 truncate">{grade.subject} • {new Date(grade.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-center bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner flex items-center shrink-0 ml-2">
                      <span className="block text-base font-black text-emerald-400 leading-none">{grade.score}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl border-dashed">
                <Target className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-[10px] font-bold text-indigo-200/60">{t('noRecentGrades') || 'لا توجد درجات مرصودة حتى الآن. استعد للانطلاق!'}</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default StudentDashboard;

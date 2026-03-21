import React, { useMemo } from 'react';
import { StudentAvatar } from './StudentAvatar';
import { 
  Trophy, Star, TrendingUp, CalendarCheck, 
  Zap, Target, ArrowRight, ArrowLeft, Medal 
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة (لمنع أخطاء الاستيراد) ---
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  maxScore: number;
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
  behavior?: any[];
}

// --- 💉 وظيفة ترجمة واتجاه داخلية مؤقتة ---
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

  const attendanceStats = useMemo(() => {
    const semAttendance = student.attendance || [];
    if (semAttendance.length === 0) return { present: 0, total: 0, percentage: 100 };
    const present = semAttendance.filter(a => a.status === 'present').length;
    const percentage = Math.round((present / semAttendance.length) * 100);
    return { present, total: semAttendance.length, percentage };
  }, [student]);

  const gradeStats = useMemo(() => {
    const semGrades = (student.grades || []).filter(g => (g.semester || '1') === currentSemester);
    const totalScore = semGrades.reduce((acc, curr) => acc + (curr.score || 0), 0);
    
    const level = Math.floor(totalScore / 20) + 1; 
    const xp = totalScore * 15; 
    const nextLevelXp = level * 20 * 15;
    const xpProgress = Math.min(Math.round((xp / nextLevelXp) * 100), 100);

    const recent = [...semGrades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

    return { totalScore, level, xp, xpProgress, nextLevelXp, recent };
  }, [student, currentSemester]);

  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    // 🚀 الحاوية الرئيسية أصبحت شفافة تماماً لترى خلفية RamadanTheme
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto overflow-x-hidden custom-scrollbar" dir={dir}>
      
      {/* 🌟 1. منطقة الترحيب والمستوى (Hero Section) */}
      <div className="pt-8 pb-8 px-6 relative overflow-hidden shrink-0">
        <div className="relative z-10 flex items-center gap-5">
          <div className="relative">
            <StudentAvatar gender={student.gender} className="w-20 h-20 border-2 border-white/20 shadow-[0_0_30px_rgba(99,102,241,0.3)]" />
            <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white text-[10px] font-black px-2 py-1 rounded-lg border border-white/20 shadow-[0_0_15px_rgba(251,191,36,0.5)] flex items-center gap-1">
              <Star className="w-3 h-3 fill-white" />
              LVL {gradeStats.level}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-indigo-200 text-xs font-bold mb-1 flex items-center gap-1 opacity-80">
              <Zap className="w-3 h-3 text-amber-400" /> {t('studentWelcomePrefix') || 'مرحباً بالبطل،'}
            </h2>
            <h1 className="text-2xl font-black text-white leading-tight break-words whitespace-normal mb-2 drop-shadow-md">
              {student.name}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 backdrop-blur-md rounded-full text-xs font-bold text-slate-200">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              {student.classes[0]}
            </span>
          </div>
        </div>

        <div className="mt-8 bg-white/5 border border-white/10 rounded-3xl p-5 backdrop-blur-xl shadow-lg">
          <div className="flex justify-between items-end mb-3">
            <div>
              <span className="block text-[10px] font-bold text-indigo-200/70 uppercase tracking-wider mb-0.5">{t('experiencePoints') || 'نقاط الخبرة (XP)'}</span>
              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-cyan-300 drop-shadow-sm">
                {gradeStats.xp} <span className="text-xs text-indigo-200/50 font-bold">/ {gradeStats.nextLevelXp}</span>
              </span>
            </div>
            <span className="text-sm font-black text-indigo-300">{gradeStats.xpProgress}%</span>
          </div>
          <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden shadow-inner border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${gradeStats.xpProgress}%` }}
            >
                {/* لمعة متحركة داخل شريط التقدم */}
                <div className="absolute inset-0 bg-white/20 skew-x-[-20deg] animate-[shimmer_2s_infinite] w-1/2 -ml-[50%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 📊 2. الإحصائيات */}
      <div className="px-6 grid grid-cols-2 gap-4 -mt-2 relative z-20 shrink-0">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <CalendarCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-3xl font-black text-white">{attendanceStats.percentage}%</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-indigo-200/70">{t('attendanceRate') || 'معدل الحضور'}</h3>
            <p className="text-[11px] font-black text-emerald-400 mt-1">{attendanceStats.present} {t('daysAttended') || 'يوم حضور'}</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[2rem] p-5 flex flex-col justify-between shadow-[0_10px_30px_rgba(0,0,0,0.2)]">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <span className="text-3xl font-black text-white">{gradeStats.totalScore}</span>
          </div>
          <div>
            <h3 className="text-xs font-bold text-indigo-200/70">{t('totalScore') || 'إجمالي الإنجاز'}</h3>
            <p className="text-[11px] font-black text-amber-400 mt-1">{t('keepItUp') || 'استمر في التألق!'}</p>
          </div>
        </div>
      </div>

      {/* ⚡ 3. أحدث الإنجازات */}
      <div className="px-6 mt-8 pb-12 shrink-0">
        <div className="flex justify-between items-center mb-5 px-1">
          <h3 className="text-sm font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            {t('recentActivity') || 'أحدث الإنجازات'}
          </h3>
          <button className="text-[10px] font-bold text-indigo-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors flex items-center gap-1 backdrop-blur-md">
            {t('viewAll') || 'عرض الكل'} <ArrowIcon className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-4">
          {gradeStats.recent.length > 0 ? (
            gradeStats.recent.map((grade) => {
              const isPerfect = grade.score === grade.maxScore;
              const badgeColor = isPerfect ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';

              return (
                <div key={grade.id} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.5rem] p-4 flex items-center justify-between group hover:bg-white/10 hover:border-indigo-400/40 transition-all shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${badgeColor}`}>
                      {isPerfect ? <Medal className="w-6 h-6" /> : <Star className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white tracking-wide">{grade.category}</h4>
                      <p className="text-[10px] font-bold text-indigo-200/60 mt-1">{grade.subject} • {new Date(grade.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-center bg-black/20 px-4 py-2 rounded-xl border border-white/5 shadow-inner">
                    <span className="block text-xl font-black text-white leading-none mb-1">{grade.score}</span>
                    <span className="block text-[9px] font-bold text-indigo-200/50">من {grade.maxScore || 10}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.5rem] border-dashed">
              <Target className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-xs font-bold text-indigo-200/60">{t('noRecentGrades') || 'لا توجد إنجازات مرصودة حتى الآن. استعد للانطلاق!'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
import React, { useMemo, useState } from 'react';
import { 
  BookOpen, Award, Target, ShieldCheck, Plus, ChevronDown, ChevronUp
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة (لمنع أخطاء الاستيراد) ---
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  maxScore?: number; 
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

// وظيفة الترجمة والاتجاه الداخلية
const useApp = () => ({
  t: (key: string) => undefined as any, 
  dir: 'rtl' as const
});
// --------------------------------------------------

interface StudentGradesProps {
  student: Student;
  currentSemester: '1' | '2';
}

// 🎨 مصفوفة ألوان زجاجية جذابة لتوزيعها على المواد
const CARD_COLORS = [
  'text-cyan-400 bg-cyan-500/10 border-cyan-500/30 from-cyan-400 to-blue-500',
  'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 from-emerald-400 to-teal-500',
  'text-amber-400 bg-amber-500/10 border-amber-500/30 from-amber-400 to-orange-500',
  'text-indigo-400 bg-indigo-500/10 border-indigo-500/30 from-indigo-400 to-purple-500',
  'text-rose-400 bg-rose-500/10 border-rose-500/30 from-rose-400 to-pink-500'
];

const StudentGrades: React.FC<StudentGradesProps> = ({ student, currentSemester }) => {
  const { t, dir } = useApp();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjectsData = useMemo(() => {
    const semGrades = (student.grades || []).filter(g => (g.semester || '1') === currentSemester);
    
    const grouped: Record<string, { totalScore: number; records: typeof semGrades }> = {};
    
    semGrades.forEach(grade => {
      if (!grouped[grade.subject]) {
        grouped[grade.subject] = { totalScore: 0, records: [] };
      }
      grouped[grade.subject].totalScore += (grade.score || 0);
      grouped[grade.subject].records.push(grade);
    });

    return Object.entries(grouped).map(([subject, data]) => {
      return { subject, ...data };
    }).sort((a, b) => b.totalScore - a.totalScore);

  }, [student, currentSemester]);

  return (
    // 💉 إزالة overflow-y-auto من هنا وتركها في الحاوية الداخلية للتمرير السليم تحت الهيدر
    <div className="flex flex-col h-full bg-transparent text-white relative overflow-hidden" dir={dir}>
      
      {/* 🌟 1. الهيدر الزجاجي (Sticky Glass Header) */}
      <header className="sticky top-0 z-40 bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/10 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-white flex items-center gap-2 mb-0.5 drop-shadow-md">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          {t('myMastery') || 'سجل الإتقان'}
        </h1>
        <p className="text-[10px] font-bold text-indigo-200/70 pl-7">
          {t('masterySubtitle') || 'تابع مجموع نقاطك وتقييماتك في كل مادة 🚀'}
        </p>
      </header>

      {/* منطقة المحتوى المنزلق */}
      <main className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-5 pb-[100px] space-y-4">
        {subjectsData.length > 0 ? subjectsData.map((item, index) => {
          const colorTheme = CARD_COLORS[index % CARD_COLORS.length];
          const textClass = colorTheme.split(' ')[0];
          const bgClass = colorTheme.split(' ')[1];
          const borderClass = colorTheme.split(' ')[2];
          const gradientClass = colorTheme.split(' ')[3] + ' ' + colorTheme.split(' ')[4];
          
          const isExpanded = expandedSubject === item.subject;

          return (
            // 🔮 بطاقة المادة الزجاجية (تم تصغير الأحجام لتبدو مدمجة Compact)
            <div key={index} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-sm transition-all duration-300 relative group hover:border-white/20">
              
              {/* إضاءة خلفية للبطاقة */}
              <div className={`absolute top-0 right-0 w-24 h-24 opacity-10 blur-2xl rounded-full bg-gradient-to-br ${gradientClass} pointer-events-none`}></div>

              <div 
                onClick={() => setExpandedSubject(isExpanded ? null : item.subject)}
                className="p-3.5 cursor-pointer flex items-center justify-between transition-colors relative z-10 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${bgClass} ${borderClass} shrink-0`}>
                    <BookOpen className={`w-5 h-5 ${textClass}`} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white leading-snug tracking-wide truncate">{item.subject}</h2>
                    <p className="text-[9px] font-bold text-indigo-200/60 mt-0.5 flex items-center gap-1">
                      <Target className={`w-2.5 h-2.5 ${textClass}`} />
                      {item.records.length} {t('assessmentsCount') || 'تقييمات'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-indigo-200/50 block mb-0.5 uppercase tracking-wider">مجموع النقاط</span>
                    <span className={`block text-lg font-black drop-shadow-sm leading-none ${textClass}`}>+{item.totalScore}</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-300/50" /> : <ChevronDown className="w-4 h-4 text-indigo-300/50" />}
                </div>
              </div>

              {/* القائمة المنسدلة (تفاصيل الدرجات) - مصغرة Compact Rows */}
              {isExpanded && (
                <div className="bg-black/20 p-3 border-t border-white/5 animate-in slide-in-from-top-2 duration-200 relative z-10">
                  <h3 className="text-[9px] font-black text-indigo-200/50 uppercase tracking-widest mb-2.5 flex items-center gap-1.5 pl-1">
                    <Award className="w-3 h-3 text-amber-400" /> {t('assessmentsRecord') || 'سجل التقييمات'}
                  </h3>
                  
                  <div className="space-y-1.5">
                    {item.records.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 shadow-sm hover:bg-white/10 transition-colors">
                        <div className="min-w-0 pr-1">
                          <p className="text-xs font-bold text-white truncate">{record.category}</p>
                          <p className="text-[8px] font-bold text-indigo-200/60 mt-0.5">{new Date(record.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center shrink-0 pl-1">
                          <div className={`bg-black/40 px-3 py-1.5 rounded-lg border ${borderClass} text-center min-w-[3rem] shadow-inner flex items-center justify-center gap-0.5`}>
                            <Plus className={`w-2.5 h-2.5 ${textClass} opacity-70`} />
                            <span className={`text-sm font-black ${textClass} leading-none`}>{record.score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="text-center py-16 bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl border-dashed">
            <Award className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <h3 className="text-xs font-black text-white mb-1">{t('noGradesYet') || 'لا توجد تقييمات بعد'}</h3>
            <p className="text-[10px] font-bold text-indigo-200/60">{t('gradesWillAppearHere') || 'ستظهر نقاطك وتقييماتك هنا قريباً.'}</p>
          </div>
        )}
      </main>

    </div>
  );
};

export default StudentGrades;

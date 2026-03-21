import React, { useMemo, useState } from 'react';
import { 
  BookOpen, Award, TrendingUp, TrendingDown, 
  ChevronDown, ChevronUp, Star, Target, ShieldCheck
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

const StudentGrades: React.FC<StudentGradesProps> = ({ student, currentSemester }) => {
  const { t, dir } = useApp();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjectsData = useMemo(() => {
    const semGrades = (student.grades || []).filter(g => (g.semester || '1') === currentSemester);
    
    const grouped: Record<string, { totalScore: number; totalMax: number; records: typeof semGrades }> = {};
    
    semGrades.forEach(grade => {
      if (!grouped[grade.subject]) {
        grouped[grade.subject] = { totalScore: 0, totalMax: 0, records: [] };
      }
      grouped[grade.subject].totalScore += (grade.score || 0);
      grouped[grade.subject].totalMax += (grade.maxScore || 10);
      grouped[grade.subject].records.push(grade);
    });

    return Object.entries(grouped).map(([subject, data]) => {
      const percentage = Math.round((data.totalScore / data.totalMax) * 100) || 0;
      return { subject, ...data, percentage };
    }).sort((a, b) => b.percentage - a.percentage);

  }, [student, currentSemester]);

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'from-emerald-400 to-cyan-400 text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (percentage >= 75) return 'from-indigo-400 to-blue-400 text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    if (percentage >= 60) return 'from-amber-400 to-orange-400 text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'from-rose-400 to-pink-400 text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    // 🚀 الحاوية أصبحت شفافة تماماً
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar" dir={dir}>
      
      {/* 🌟 الهيدر الزجاجي (Edge-to-Edge) */}
      <div className="pt-6 pb-6 px-6 bg-white/5 backdrop-blur-3xl border-b border-white/10 sticky top-0 z-20 shrink-0 shadow-sm">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1 drop-shadow-md">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          {t('myMastery') || 'سجل الإتقان'}
        </h1>
        <p className="text-xs font-bold text-indigo-200/70">
          {t('masterySubtitle') || 'تابع تطور مهاراتك في كل مادة 🚀'}
        </p>
      </div>

      <div className="px-6 py-8 space-y-4 shrink-0">
        {subjectsData.length > 0 ? subjectsData.map((item, index) => {
          const colors = getProgressColor(item.percentage);
          const isExpanded = expandedSubject === item.subject;

          return (
            // 🔮 بطاقة المادة الزجاجية
            <div key={index} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.5rem] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition-all duration-300">
              
              <div 
                onClick={() => setExpandedSubject(isExpanded ? null : item.subject)}
                className="p-4 cursor-pointer flex items-center justify-between group hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${colors.split(' ')[2]} ${colors.split(' ')[3]}`}>
                    <BookOpen className={`w-6 h-6 ${colors.split(' ')[1]}`} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white leading-snug break-words whitespace-normal tracking-wide">{item.subject}</h2>
                    <p className="text-[10px] font-bold text-indigo-200/60 mt-1 flex items-center gap-1">
                      <Target className="w-3 h-3 text-indigo-400" /> {item.totalScore} {t('outOf') || 'من'} {item.totalMax}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`block text-xl font-black drop-shadow-sm ${colors.split(' ')[1]}`}>{item.percentage}%</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-300" /> : <ChevronDown className="w-5 h-5 text-indigo-300" />}
                </div>
              </div>

              {/* شريط تقدم النسبة المئوية */}
              <div className="h-1.5 w-full bg-black/40 shadow-inner">
                <div 
                  className={`h-full bg-gradient-to-r ${colors.split(' ')[0]} relative overflow-hidden`} 
                  style={{ width: `${item.percentage}%` }}
                >
                    {/* لمعة داخل شريط التقدم */}
                    <div className="absolute inset-0 bg-white/20 skew-x-[-20deg] animate-[shimmer_2s_infinite] w-1/2 -ml-[50%]"></div>
                </div>
              </div>

              {/* القائمة المنسدلة (تفاصيل الدرجات) */}
              {isExpanded && (
                <div className="bg-black/20 p-4 border-t border-white/10 animate-in slide-in-from-top-2 duration-200">
                  <h3 className="text-[10px] font-black text-indigo-200/50 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400" /> {t('assessmentsRecord') || 'سجل التقييمات'}
                  </h3>
                  
                  <div className="space-y-2.5">
                    {item.records.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10 shadow-sm hover:bg-white/10 transition-colors">
                        <div>
                          <p className="text-sm font-bold text-white">{record.category}</p>
                          <p className="text-[9px] font-bold text-indigo-200/60 mt-1">{new Date(record.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {record.score === record.maxScore && <Star className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />}
                          <div className="bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 text-center min-w-[3rem] shadow-inner">
                            <span className="text-sm font-black text-white">{record.score}</span>
                            <span className="text-[9px] font-bold text-indigo-200/50 block -mt-1">/{record.maxScore || 10}</span>
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
          <div className="text-center py-16 bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.5rem] border-dashed">
            <Award className="w-14 h-14 text-white/20 mx-auto mb-4" />
            <h3 className="text-sm font-black text-white mb-1">{t('noGradesYet') || 'لا توجد تقييمات بعد'}</h3>
            <p className="text-xs font-bold text-indigo-200/60">{t('gradesWillAppearHere') || 'ستظهر تفاصيل إتقانك للمواد هنا قريباً.'}</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentGrades;
import React, { useMemo, useState } from 'react';
import { 
  BookOpen, Award, TrendingUp, TrendingDown, 
  ChevronDown, ChevronUp, Star, Target, ShieldCheck, Plus
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة (لمنع أخطاء الاستيراد) ---
export interface GradeRecord {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  score: number;
  maxScore?: number; // جعلناها اختيارية لأننا لن نستخدمها
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

// 🎨 مصفوفة ألوان زجاجية جذابة لتوزيعها على المواد بدلاً من الاعتماد على النسبة المئوية
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
    
    // 💉 استئصال الـ totalMax من الحسابات
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
    }).sort((a, b) => b.totalScore - a.totalScore); // ترتيب حسب أعلى النقاط المكتسبة

  }, [student, currentSemester]);

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar" dir={dir}>
      
      {/* 🌟 الهيدر الزجاجي (Edge-to-Edge) */}
      <div className="pt-6 pb-6 px-6 bg-white/5 backdrop-blur-3xl border-b border-white/10 sticky top-0 z-20 shrink-0 shadow-sm">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1 drop-shadow-md">
          <ShieldCheck className="w-6 h-6 text-indigo-400" />
          {t('myMastery') || 'سجل الإتقان'}
        </h1>
        <p className="text-xs font-bold text-indigo-200/70">
          {t('masterySubtitle') || 'تابع مجموع نقاطك وتقييماتك في كل مادة 🚀'}
        </p>
      </div>

      <div className="px-6 py-8 pb-24 space-y-4 shrink-0">
        {subjectsData.length > 0 ? subjectsData.map((item, index) => {
          // 🎨 اختيار لون ثابت وجميل لكل بطاقة بناءً على الترتيب
          const colorTheme = CARD_COLORS[index % CARD_COLORS.length];
          const textClass = colorTheme.split(' ')[0];
          const bgClass = colorTheme.split(' ')[1];
          const borderClass = colorTheme.split(' ')[2];
          const gradientClass = colorTheme.split(' ')[3] + ' ' + colorTheme.split(' ')[4];
          
          const isExpanded = expandedSubject === item.subject;

          return (
            // 🔮 بطاقة المادة الزجاجية
            <div key={index} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-[1.5rem] overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.15)] transition-all duration-300 relative">
              
              {/* لمسة إضاءة خفيفة في زاوية البطاقة */}
              <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full bg-gradient-to-br ${gradientClass}`}></div>

              <div 
                onClick={() => setExpandedSubject(isExpanded ? null : item.subject)}
                className="p-4 cursor-pointer flex items-center justify-between group hover:bg-white/10 transition-colors relative z-10"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${bgClass} ${borderClass}`}>
                    <BookOpen className={`w-6 h-6 ${textClass}`} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white leading-snug break-words whitespace-normal tracking-wide">{item.subject}</h2>
                    <p className="text-[10px] font-bold text-indigo-200/60 mt-1 flex items-center gap-1.5">
                      <Target className={`w-3 h-3 ${textClass}`} />
                      {item.records.length} {t('assessmentsCount') || 'تقييمات مُنجزة'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-indigo-200/50 block mb-0.5 uppercase tracking-wider">مجموع النقاط</span>
                    <span className={`block text-xl font-black drop-shadow-sm ${textClass}`}>+{item.totalScore}</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-300/50" /> : <ChevronDown className="w-5 h-5 text-indigo-300/50" />}
                </div>
              </div>

              {/* القائمة المنسدلة (تفاصيل الدرجات) */}
              {isExpanded && (
                <div className="bg-black/20 p-4 border-t border-white/10 animate-in slide-in-from-top-2 duration-200 relative z-10">
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
                          {/* 💉 تم تبسيط عرض الدرجة وتكبيرها بدون الدرجة القصوى */}
                          <div className={`bg-black/40 px-4 py-2 rounded-xl border ${borderClass} text-center min-w-[3.5rem] shadow-inner flex items-center gap-1`}>
                            <Plus className={`w-3 h-3 ${textClass} opacity-70`} />
                            <span className={`text-base font-black ${textClass}`}>{record.score}</span>
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
            <p className="text-xs font-bold text-indigo-200/60">{t('gradesWillAppearHere') || 'ستظهر نقاطك وتقييماتك هنا قريباً.'}</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentGrades;

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Award,
  Target,
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronUp
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

// 🎨 ألوان فاتحة متوافقة مع هوية راصد الطالب
const CARD_COLORS = [
  {
    text: 'text-cyan-700',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    iconBg: 'bg-cyan-100',
    soft: 'bg-cyan-500/5'
  },
  {
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    soft: 'bg-emerald-500/5'
  },
  {
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    soft: 'bg-amber-500/5'
  },
  {
    text: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    iconBg: 'bg-indigo-100',
    soft: 'bg-indigo-500/5'
  },
  {
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconBg: 'bg-rose-100',
    soft: 'bg-rose-500/5'
  }
];

const StudentGrades: React.FC<StudentGradesProps> = ({
  student,
  currentSemester
}) => {
  const { t, dir } = useApp();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjectsData = useMemo(() => {
    const semGrades = (student.grades || []).filter(
      g => (g.semester || '1') === currentSemester
    );

    const grouped: Record<
      string,
      { totalScore: number; records: typeof semGrades }
    > = {};

    semGrades.forEach(grade => {
      if (!grouped[grade.subject]) {
        grouped[grade.subject] = {
          totalScore: 0,
          records: []
        };
      }

      grouped[grade.subject].totalScore += grade.score || 0;
      grouped[grade.subject].records.push(grade);
    });

    return Object.entries(grouped)
      .map(([subject, data]) => {
        return { subject, ...data };
      })
      .sort((a, b) => b.totalScore - a.totalScore);
  }, [student, currentSemester]);

  return (
    <div
      className="flex flex-col h-full bg-bgMain text-textPrimary relative overflow-hidden"
      dir={dir}
    >
      {/* الهيدر الفاتح */}
      <header className="sticky top-0 z-40 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-textPrimary flex items-center gap-2 mb-0.5">
          <ShieldCheck className="w-5 h-5 text-primary" />
          {t('myMastery') || 'سجل الإتقان'}
        </h1>

        <p className="text-[10px] font-bold text-textSecondary pr-7">
          {t('masterySubtitle') ||
            'تابع مجموع نقاطك وتقييماتك في كل مادة 🚀'}
        </p>
      </header>

      {/* المحتوى */}
      <main className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-5 pb-[100px] space-y-4">
        {subjectsData.length > 0 ? (
          subjectsData.map((item, index) => {
            const colorTheme = CARD_COLORS[index % CARD_COLORS.length];
            const isExpanded = expandedSubject === item.subject;

            return (
              <div
                key={index}
                className="bg-bgCard border border-borderColor rounded-3xl overflow-hidden shadow-sm transition-all duration-300 relative group hover:border-primary/20 hover:shadow-card"
              >
                {/* إضاءة خلفية خفيفة جدًا */}
                <div
                  className={`absolute top-0 right-0 w-24 h-24 opacity-100 blur-2xl rounded-full ${colorTheme.soft} pointer-events-none`}
                />

                <div
                  onClick={() =>
                    setExpandedSubject(isExpanded ? null : item.subject)
                  }
                  className="p-3.5 cursor-pointer flex items-center justify-between transition-colors relative z-10 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${colorTheme.iconBg} ${colorTheme.border} shrink-0`}
                    >
                      <BookOpen className={`w-5 h-5 ${colorTheme.text}`} />
                    </div>

                    <div className="min-w-0">
                      <h2
                        className="text-sm font-black text-textPrimary leading-snug tracking-wide truncate"
                        title={item.subject}
                      >
                        {item.subject}
                      </h2>

                      <p className="text-[9px] font-bold text-textSecondary mt-0.5 flex items-center gap-1">
                        <Target className={`w-2.5 h-2.5 ${colorTheme.text}`} />
                        {item.records.length}{' '}
                        {t('assessmentsCount') || 'تقييمات'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[8px] font-bold text-textSecondary block mb-0.5 uppercase tracking-wider">
                        مجموع النقاط
                      </span>

                      <span
                        className={`block text-lg font-black leading-none ${colorTheme.text}`}
                      >
                        +{item.totalScore}
                      </span>
                    </div>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-textSecondary" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-textSecondary" />
                    )}
                  </div>
                </div>

                {/* تفاصيل الدرجات */}
                {isExpanded && (
                  <div className="bg-bgSoft p-3 border-t border-borderColor animate-in slide-in-from-top-2 duration-200 relative z-10">
                    <h3 className="text-[9px] font-black text-textSecondary uppercase tracking-widest mb-2.5 flex items-center gap-1.5 pr-1">
                      <Award className="w-3 h-3 text-warning" />
                      {t('assessmentsRecord') || 'سجل التقييمات'}
                    </h3>

                    <div className="space-y-1.5">
                      {item.records.map(record => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-2.5 bg-bgCard rounded-xl border border-borderColor shadow-sm hover:border-primary/20 transition-colors"
                        >
                          <div className="min-w-0 pr-1">
                            <p className="text-xs font-bold text-textPrimary truncate">
                              {record.category}
                            </p>

                            <p className="text-[8px] font-bold text-textSecondary mt-0.5">
                              {new Date(record.date).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center shrink-0 pl-1">
                            <div
                              className={`px-3 py-1.5 rounded-lg border ${colorTheme.border} ${colorTheme.bg} text-center min-w-[3rem] shadow-sm flex items-center justify-center gap-0.5`}
                            >
                              <Plus
                                className={`w-2.5 h-2.5 ${colorTheme.text} opacity-70`}
                              />

                              <span
                                className={`text-sm font-black ${colorTheme.text} leading-none`}
                              >
                                {record.score}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-bgCard border border-borderColor rounded-3xl border-dashed shadow-sm">
            <Award className="w-10 h-10 text-textMuted mx-auto mb-3" />

            <h3 className="text-xs font-black text-textPrimary mb-1">
              {t('noGradesYet') || 'لا توجد تقييمات بعد'}
            </h3>

            <p className="text-[10px] font-bold text-textSecondary">
              {t('gradesWillAppearHere') ||
                'ستظهر نقاطك وتقييماتك هنا قريباً.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentGrades;

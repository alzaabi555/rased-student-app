import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Target,
  CheckSquare,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Award,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Library,
  CheckCircle2
} from 'lucide-react';

// =========================================================================
// 🧩 تعريفات داخلية آمنة حتى لا يتأثر الملف باختلاف نماذج البيانات
// =========================================================================
export interface GradeRecord {
  id: string;
  studentId?: string;
  category?: string;
  subject?: string;
  score: number;
  maxScore?: number;
  date?: string;
  semester?: '1' | '2';
}

export interface TaskRecord {
  id: string;
  title: string;
  subject?: string;
  dueDate?: string;
  completed?: boolean;
  completedAt?: string;
}

export interface ResourceRecord {
  id?: string;
  title?: string;
  subject?: string;
  type?: string;
  link?: string;
  url?: string;
  date?: string;
}

export interface StudentReviewPlanStudent {
  id: string;
  civilId?: string;
  name?: string;
  classes?: string[];
  grades?: GradeRecord[];
  tasks?: TaskRecord[];
  resources?: ResourceRecord[];
  totalKnightsPoints?: number;
}

interface StudentReviewPlanProps {
  student: StudentReviewPlanStudent;
  currentSemester: '1' | '2';
}

type PriorityItem = {
  id: string;
  type: 'overdue-task' | 'pending-task' | 'weak-grade' | 'resource';
  title: string;
  subtitle: string;
  subject?: string;
  tone: 'danger' | 'warning' | 'primary' | 'info' | 'success';
  actionLabel?: string;
  link?: string;
};

const getTodayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const parseDateSafe = (date?: string) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const inferMaxScore = (score: number, maxScore?: number) => {
  if (typeof maxScore === 'number' && maxScore > 0) return maxScore;
  if (score <= 10) return 10;
  if (score <= 20) return 20;
  if (score <= 40) return 40;
  return 100;
};

const getScorePercent = (grade: GradeRecord) => {
  const score = Number(grade.score || 0);
  const maxScore = inferMaxScore(score, grade.maxScore);
  return Math.round((score / maxScore) * 100);
};

const getTaskLocalStatus = (studentCivilId: string | undefined, task: TaskRecord) => {
  const civilId = studentCivilId || 'default';
  const savedStatus = JSON.parse(localStorage.getItem(`tasks_status_${civilId}`) || '{}');
  const hiddenTasks = JSON.parse(localStorage.getItem(`hidden_tasks_${civilId}`) || '[]');
  const status = savedStatus[String(task.id)];

  const hidden = hiddenTasks.includes(String(task.id));
  const completed = status && typeof status === 'object' ? Boolean(status.completed) : Boolean(task.completed || status);
  const completedAt = status && typeof status === 'object' ? status.completedAt : task.completedAt;

  return {
    hidden,
    completed,
    completedAt
  };
};

const getToneClasses = (tone: PriorityItem['tone']) => {
  switch (tone) {
    case 'danger':
      return {
        card: 'bg-danger/10 border-danger/20',
        icon: 'bg-danger/10 text-danger border-danger/20',
        text: 'text-danger'
      };
    case 'warning':
      return {
        card: 'bg-warning/10 border-warning/20',
        icon: 'bg-warning/10 text-warning border-warning/20',
        text: 'text-warning'
      };
    case 'info':
      return {
        card: 'bg-info/10 border-info/20',
        icon: 'bg-info/10 text-info border-info/20',
        text: 'text-info'
      };
    case 'success':
      return {
        card: 'bg-success/10 border-success/20',
        icon: 'bg-success/10 text-success border-success/20',
        text: 'text-success'
      };
    default:
      return {
        card: 'bg-primary/10 border-primary/20',
        icon: 'bg-primary/10 text-primary border-primary/20',
        text: 'text-primary'
      };
  }
};

const StudentReviewPlan: React.FC<StudentReviewPlanProps> = ({
  student,
  currentSemester
}) => {
  const { t, dir } = useApp();

  const reviewData = useMemo(() => {
    const today = getTodayStart();

    const allGrades = Array.isArray(student?.grades) ? student.grades : [];
    const semesterGrades = allGrades.filter(
      grade => (grade.semester || '1') === currentSemester
    );

    const weakGrades = semesterGrades
      .map(grade => ({
        ...grade,
        percent: getScorePercent(grade)
      }))
      .filter(grade => grade.percent < 65)
      .sort((a, b) => a.percent - b.percent);

    const weakSubjects = Array.from(
      new Set(
        weakGrades
          .map(grade => grade.subject || 'مادة غير محددة')
          .filter(Boolean)
      )
    );

    const allTasks = Array.isArray(student?.tasks) ? student.tasks : [];
    const visibleTasks = allTasks
      .map(task => {
        const local = getTaskLocalStatus(student?.civilId, task);
        return {
          ...task,
          hidden: local.hidden,
          completed: local.completed,
          completedAt: local.completedAt
        };
      })
      .filter(task => !task.hidden);

    const pendingTasks = visibleTasks.filter(task => !task.completed);

    const overdueTasks = pendingTasks.filter(task => {
      const due = parseDateSafe(task.dueDate);
      return Boolean(due && due < today);
    });

    const upcomingTasks = pendingTasks.filter(task => {
      const due = parseDateSafe(task.dueDate);
      return !due || due >= today;
    });

    const allResources = Array.isArray(student?.resources)
      ? student.resources
      : [];

    const recommendedResources = allResources.filter(resource => {
      const subject = resource.subject || '';
      return weakSubjects.some(weakSubject => subject === weakSubject);
    });

    const priorityItems: PriorityItem[] = [];

    overdueTasks.slice(0, 3).forEach(task => {
      priorityItems.push({
        id: `overdue-${task.id}`,
        type: 'overdue-task',
        title: task.title || 'مهمة بدون عنوان',
        subtitle: `مهمة متأخرة${task.dueDate ? ` - الموعد: ${task.dueDate}` : ''}`,
        subject: task.subject || 'عام',
        tone: 'danger',
        actionLabel: 'ابدأ بها أولاً'
      });
    });

    pendingTasks
      .filter(task => !overdueTasks.some(overdue => overdue.id === task.id))
      .slice(0, 3)
      .forEach(task => {
        priorityItems.push({
          id: `pending-${task.id}`,
          type: 'pending-task',
          title: task.title || 'مهمة بدون عنوان',
          subtitle: task.dueDate ? `الموعد: ${task.dueDate}` : 'مهمة غير مكتملة',
          subject: task.subject || 'عام',
          tone: 'warning',
          actionLabel: 'أنجزها اليوم'
        });
      });

    weakGrades.slice(0, 3).forEach(grade => {
      priorityItems.push({
        id: `weak-${grade.id}`,
        type: 'weak-grade',
        title: grade.category || 'تقييم يحتاج مراجعة',
        subtitle: `النسبة التقريبية: ${grade.percent}%`,
        subject: grade.subject || 'مادة غير محددة',
        tone: 'primary',
        actionLabel: 'راجع هذا التقييم'
      });
    });

    recommendedResources.slice(0, 3).forEach(resource => {
      const link = resource.link || resource.url || '#';
      priorityItems.push({
        id: `resource-${resource.id || resource.title || link}`,
        type: 'resource',
        title: resource.title || 'مصدر للمراجعة',
        subtitle: `مصدر مقترح في ${resource.subject || 'مادة تحتاج مراجعة'}`,
        subject: resource.subject || 'عام',
        tone: 'info',
        actionLabel: 'افتح المصدر',
        link
      });
    });

    return {
      weakGrades,
      weakSubjects,
      pendingTasks,
      overdueTasks,
      upcomingTasks,
      recommendedResources,
      priorityItems: priorityItems.slice(0, 6)
    };
  }, [student, currentSemester]);

  const hasPlan =
    reviewData.priorityItems.length > 0 ||
    reviewData.pendingTasks.length > 0 ||
    reviewData.weakGrades.length > 0 ||
    reviewData.recommendedResources.length > 0;

  const renderPriorityIcon = (type: PriorityItem['type']) => {
    if (type === 'overdue-task') return <AlertTriangle className="w-5 h-5" />;
    if (type === 'pending-task') return <CheckSquare className="w-5 h-5" />;
    if (type === 'weak-grade') return <Target className="w-5 h-5" />;
    return <BookOpen className="w-5 h-5" />;
  };

  return (
    <div
  className="rased-student-light flex flex-col h-full min-h-0 bg-bgMain text-textPrimary relative overflow-hidden"
      dir={dir}
    >
      {/* الهيدر */}
      <header className="sticky top-0 z-40 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-textPrimary flex items-center gap-2 mb-0.5">
          <Target className="w-5 h-5 text-primary" />
          {t('reviewPlan') || 'خطة المراجعة'}
        </h1>

        <p className="text-[10px] font-bold text-textSecondary pr-7">
          {t('reviewPlanSubtitle') ||
            'نساعدك تعرف ماذا تراجع بعد عودتك للمنزل 🎯'}
        </p>
      </header>

<main className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+140px)] space-y-5">        {/* ملخص سريع */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-warning/10 text-warning border border-warning/20 flex items-center justify-center mb-2">
              <CheckSquare className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold text-textSecondary mb-1">
              مهام غير مكتملة
            </p>
            <p className="text-xl font-black text-textPrimary">
              {reviewData.pendingTasks.length}
            </p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-danger/10 text-danger border border-danger/20 flex items-center justify-center mb-2">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold text-textSecondary mb-1">
              مهام متأخرة
            </p>
            <p className="text-xl font-black text-textPrimary">
              {reviewData.overdueTasks.length}
            </p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-2">
              <Target className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold text-textSecondary mb-1">
              تقييمات تحتاج مراجعة
            </p>
            <p className="text-xl font-black text-textPrimary">
              {reviewData.weakGrades.length}
            </p>
          </div>

          <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-info/10 text-info border border-info/20 flex items-center justify-center mb-2">
              <Library className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold text-textSecondary mb-1">
              مصادر مقترحة
            </p>
            <p className="text-xl font-black text-textPrimary">
              {reviewData.recommendedResources.length}
            </p>
          </div>
        </section>

        {/* ابدأ بهذه */}
        <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-textPrimary flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-warning" />
                ابدأ بهذه
              </h2>
              <p className="text-[10px] font-bold text-textSecondary mt-0.5">
                أولوياتك المقترحة للمراجعة في المنزل
              </p>
            </div>

            <div className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black border border-primary/20">
              {reviewData.priorityItems.length} عناصر
            </div>
          </div>

          {reviewData.priorityItems.length > 0 ? (
            <div className="space-y-2.5">
              {reviewData.priorityItems.map(item => {
                const tone = getToneClasses(item.tone);

                const content = (
                  <div
                    className={`w-full rounded-2xl border p-3 flex items-center gap-3 transition-all active:scale-[0.99] ${tone.card}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${tone.icon}`}
                    >
                      {renderPriorityIcon(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xs font-black text-textPrimary truncate">
                          {item.title}
                        </h3>
                        {item.subject && (
                          <span className="shrink-0 text-[8px] font-black px-2 py-0.5 rounded-full bg-bgCard/80 border border-borderColor text-textSecondary">
                            {item.subject}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] font-bold text-textSecondary leading-5">
                        {item.subtitle}
                      </p>
                    </div>

                    <div className={`text-[9px] font-black shrink-0 ${tone.text}`}>
                      {item.actionLabel}
                    </div>
                  </div>
                );

                if (item.link && item.link !== '#') {
                  return (
                    <a
                      key={item.id}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      {content}
                    </a>
                  );
                }

                return <div key={item.id}>{content}</div>;
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-bgSoft border border-borderColor rounded-2xl border-dashed">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto mb-3" />
              <p className="text-xs font-black text-textPrimary mb-1">
                لا توجد أولويات عاجلة الآن
              </p>
              <p className="text-[10px] font-bold text-textSecondary">
                حافظ على إنجاز مهامك ومراجعة مصادر معلمك باستمرار.
              </p>
            </div>
          )}
        </section>

        {/* مواد تحتاج تركيز */}
        {reviewData.weakGrades.length > 0 && (
          <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm">
            <h2 className="text-sm font-black text-textPrimary flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              مواد تحتاج تركيز
            </h2>

            <div className="space-y-2.5">
              {reviewData.weakGrades.slice(0, 5).map(grade => (
                <div
                  key={grade.id}
                  className="bg-bgSoft border border-borderColor rounded-2xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-textPrimary truncate">
                      {grade.subject || 'مادة غير محددة'}
                    </h3>
                    <p className="text-[10px] font-bold text-textSecondary mt-1 truncate">
                      {grade.category || 'تقييم'}
                    </p>
                  </div>

                  <div className="text-center shrink-0">
                    <p className="text-lg font-black text-danger">
                      {grade.percent}%
                    </p>
                    <p className="text-[8px] font-bold text-textSecondary">
                      يحتاج مراجعة
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* مصادر مقترحة */}
        {reviewData.recommendedResources.length > 0 && (
          <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm">
            <h2 className="text-sm font-black text-textPrimary flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-info" />
              مصادر تساعدك على المراجعة
            </h2>

            <div className="space-y-2.5">
              {reviewData.recommendedResources.slice(0, 5).map((resource, idx) => {
                const link = resource.link || resource.url || '#';

                return (
                  <a
                    key={resource.id || `${resource.title}-${idx}`}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-info/10 border border-info/20 rounded-2xl p-3 flex items-center justify-between gap-3 active:scale-[0.99] transition-all"
                  >
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-textPrimary truncate">
                        {resource.title || 'مصدر للمراجعة'}
                      </h3>
                      <p className="text-[10px] font-bold text-textSecondary mt-1 truncate">
                        {resource.subject || 'عام'}
                      </p>
                    </div>

                    <ExternalLink className="w-4 h-4 text-info shrink-0" />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {!hasPlan && (
          <section className="text-center py-12 bg-bgCard border border-borderColor rounded-3xl border-dashed shadow-sm">
            <Award className="w-12 h-12 text-success mx-auto mb-3" />
            <h2 className="text-sm font-black text-textPrimary mb-1">
              وضعك ممتاز حاليًا
            </h2>
            <p className="text-[10px] font-bold text-textSecondary px-8 leading-6">
              لا توجد مهام أو تقييمات تحتاج مراجعة عاجلة. استمر في متابعة مهامك ومصادرك.
            </p>
          </section>
        )}

        {/* نص تربوي ختامي */}
        <section className="bg-primary/10 border border-primary/20 rounded-3xl p-4 shadow-sm flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Lightbulb className="w-5 h-5" />
          </div>

          <div>
            <h3 className="text-sm font-black text-textPrimary mb-1">
              نصيحة راصد
            </h3>
            <p className="text-[10px] font-bold text-textSecondary leading-6">
              خصص وقتًا قصيرًا كل يوم للمراجعة. الإنجاز الصغير المتكرر يصنع تقدمًا كبيرًا.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default StudentReviewPlan;

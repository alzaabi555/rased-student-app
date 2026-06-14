import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  CheckCircle2,
  Circle,
  Calendar,
  Trophy,
  Rocket,
  Trash2,
  Loader2,
  RefreshCcw
} from 'lucide-react';

// --- 💉 حقن التعريفات مباشرة ---
export interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
}

// =========================================================================
// ☀️ 1. الغلاف الفاتح الموحد
// =========================================================================
const GlassLayout: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, rightAction, children }) => {
  const { dir } = useApp();

  return (
    <div
      className="rased-student-light flex flex-col h-full bg-bgMain text-textPrimary relative overflow-hidden"
      dir={dir}
    >
      <header className="sticky top-0 z-40 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all flex justify-between items-center">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm shrink-0">
              {icon}
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <h1 className="text-lg font-black text-textPrimary leading-tight truncate">
              {title}
            </h1>

            {subtitle && (
              <p className="text-[10px] font-bold text-textSecondary truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {rightAction && <div className="shrink-0 pl-1">{rightAction}</div>}
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-5 pb-[100px]">
        {children}
      </main>
    </div>
  );
};

// =========================================================================
// 🚀 2. تطبيق المهام الرئيسي
// =========================================================================
const StudentTasks: React.FC = () => {
  const { t, studentData, loading, refreshData } = useApp();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (refreshData) refreshData();
  }, [refreshData]);

  // 🧠 جلب المهام وفلترتها
  useEffect(() => {
    if (studentData && Array.isArray(studentData.tasks)) {
      const civilId = studentData.civilId || 'default';

      const savedStatus = JSON.parse(
        localStorage.getItem(`tasks_status_${civilId}`) || '{}'
      );

      let hiddenTasks = JSON.parse(
        localStorage.getItem(`hidden_tasks_${civilId}`) || '[]'
      );

      const todayStr = new Date().toDateString();

      const syncedTasks = studentData.tasks
        .filter((task: any) => !hiddenTasks.includes(String(task.id)))
        .map((task: any) => {
          const id = String(task.id || Math.random());
          const status = savedStatus[id];

          const isCompleted =
            status && typeof status === 'object'
              ? status.completed
              : !!status;

          const completedAt =
            status && typeof status === 'object'
              ? status.completedAt
              : todayStr;

          if (isCompleted && completedAt !== todayStr) {
            hiddenTasks.push(id);
            return null;
          }

          return {
            id,
            title: String(task.title || 'مهمة بدون عنوان'),
            subject: String(task.subject || 'عام'),
            dueDate: String(task.dueDate || ''),
            completed: isCompleted,
            completedAt
          };
        })
        .filter(Boolean) as Task[];

      localStorage.setItem(
        `hidden_tasks_${civilId}`,
        JSON.stringify(hiddenTasks)
      );

      setTasks(syncedTasks);
    } else {
      setTasks([]);
    }
  }, [studentData]);

  // 💾 حفظ حالة المهام وتاريخ إنجازها
  useEffect(() => {
    if (studentData?.civilId) {
      const statusMap = tasks.reduce((acc: any, task) => {
        acc[task.id] = {
          completed: task.completed,
          completedAt: task.completedAt || new Date().toDateString()
        };

        return acc;
      }, {});

      localStorage.setItem(
        `tasks_status_${studentData.civilId}`,
        JSON.stringify(statusMap)
      );
    }
  }, [tasks, studentData]);

  const handleManualRefresh = async () => {
    if (refreshData) {
      setIsRefreshing(true);
      await refreshData();

      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev =>
      prev.map(task =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed
                ? new Date().toDateString()
                : undefined
            }
          : task
      )
    );
  };

  const deleteTask = (id: string) => {
    if (window.confirm('هل تريد حذف هذه المهمة نهائياً من قائمتك؟')) {
      const civilId = studentData?.civilId || 'default';

      const hidden = JSON.parse(
        localStorage.getItem(`hidden_tasks_${civilId}`) || '[]'
      );

      hidden.push(id);

      localStorage.setItem(`hidden_tasks_${civilId}`, JSON.stringify(hidden));

      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (loading && tasks.length === 0) {
    return (
      <div className="rased-student-light flex flex-col items-center justify-center h-full text-textSecondary bg-bgMain">
        <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
        <p className="font-bold text-sm">جاري تحديث المهام...</p>
      </div>
    );
  }

  return (
    <GlassLayout
      title={t('myQuests') || 'مهامي الدراسية'}
      subtitle={studentData?.name || 'أهلاً بك'}
      icon={<Rocket className="w-5 h-5 text-warning" />}
      rightAction={
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className={`w-10 h-10 bg-bgSoft hover:bg-bgCard rounded-xl flex items-center justify-center border border-borderColor transition-all active:scale-95 shadow-sm ${
            isRefreshing ? 'opacity-60' : ''
          }`}
          title="تحديث المهام"
        >
          <RefreshCcw
            className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`}
            size={18}
          />
        </button>
      }
    >
      <div className="flex-1">
        <h2 className="text-[10px] font-black text-textSecondary uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          قيد الإنجاز ({pendingTasks.length})
        </h2>

        <div className="space-y-2.5">
          {pendingTasks.length > 0 ? (
            pendingTasks.map(task => (
              <div
                key={task.id}
                className="bg-bgCard border border-borderColor rounded-2xl p-3 flex items-center gap-3 transition-all hover:border-primary/20 hover:shadow-card shadow-sm group"
              >
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  className="shrink-0 active:scale-90 transition-transform"
                  aria-label="إنجاز المهمة"
                >
                  <Circle className="w-6 h-6 text-textMuted hover:text-success transition-colors" />
                </button>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-textPrimary mb-1 leading-snug break-words group-hover:text-primary transition-colors">
                    {task.title}
                  </h3>

                  <div className="flex items-center gap-2 text-[9px] font-bold text-textSecondary">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20 truncate max-w-[100px]">
                      {task.subject}
                    </span>

                    <span className="text-warning flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      {task.dueDate || 'قريباً'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  className="shrink-0 p-2 text-textMuted hover:text-danger transition-colors active:scale-95 bg-bgSoft rounded-xl opacity-0 group-hover:opacity-100 sm:opacity-100"
                  aria-label="حذف المهمة"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 bg-bgCard rounded-3xl border border-dashed border-borderColor shadow-sm">
              <Trophy className="w-10 h-10 text-success/60 mx-auto mb-3" />

              <p className="text-[11px] font-bold text-textSecondary">
                أنجزت كل مهامك.. استمتع بوقتك! 🎮
              </p>
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[10px] font-black text-success uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-success" />
              مكتملة ({completedTasks.length})
            </h2>

            <div className="space-y-2.5 opacity-90">
              {completedTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-bgSoft border border-borderColor rounded-2xl p-3 flex items-center gap-3 group transition-all hover:bg-bgCard hover:shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleTask(task.id)}
                    className="shrink-0 active:scale-90 transition-transform"
                    aria-label="إلغاء إنجاز المهمة"
                  >
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-textSecondary line-through break-words">
                      {task.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 p-1.5 text-textMuted hover:text-danger transition-colors active:scale-95"
                    aria-label="حذف المهمة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassLayout>
  );
};

export default StudentTasks;

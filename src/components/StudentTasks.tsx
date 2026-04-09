import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, Circle, Calendar, 
  Trophy, Rocket, Trash2, Loader2, RefreshCcw 
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
// 💎 1. الغلاف الزجاجي الفاخر الموحد
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
    <div className="flex flex-col h-full bg-transparent text-white relative overflow-hidden" dir={dir}>
      <header className="sticky top-0 z-40 bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/10 pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all flex justify-between items-center">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner shrink-0">
              {icon}
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <h1 className="text-lg font-black text-white leading-tight truncate drop-shadow-md">{title}</h1>
            {subtitle && <p className="text-[10px] font-bold text-indigo-200/70 truncate mt-0.5">{subtitle}</p>}
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
// 🚀 2. تطبيق المهام الرئيسي (نفس المنطق 100%)
// =========================================================================
const StudentTasks: React.FC = () => {
  const { t, dir, studentData, loading, refreshData } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (refreshData) refreshData();
  }, []);

  // 🧠 جلب المهام وفلترتها (إخفاء المحذوف + النظافة التلقائية)
  useEffect(() => {
    if (studentData && Array.isArray(studentData.tasks)) {
      const civilId = studentData.civilId;
      const savedStatus = JSON.parse(localStorage.getItem(`tasks_status_${civilId}`) || '{}');
      let hiddenTasks = JSON.parse(localStorage.getItem(`hidden_tasks_${civilId}`) || '[]');
      const todayStr = new Date().toDateString(); // تاريخ اليوم

      const syncedTasks = studentData.tasks
        .filter((task: any) => !hiddenTasks.includes(String(task.id))) // 🛡️ صد المهام المحذوفة نهائياً
        .map((task: any) => {
          const id = String(task.id || Math.random());
          const status = savedStatus[id];
          
          // التوافق مع البيانات القديمة والجديدة
          const isCompleted = status && typeof status === 'object' ? status.completed : !!status;
          const completedAt = status && typeof status === 'object' ? status.completedAt : todayStr;

          // 🧹 النظافة التلقائية: إذا المهمة منجزة وتاريخ إنجازها قديم (ليس اليوم)، أخفها فوراً!
          if (isCompleted && completedAt !== todayStr) {
            hiddenTasks.push(id);
            return null; // سيتم استبعادها
          }

          return {
            id,
            title: String(task.title || 'مهمة بدون عنوان'),
            subject: String(task.subject || 'عام'),
            dueDate: String(task.dueDate || ''),
            completed: isCompleted,
            completedAt: completedAt
          };
        })
        .filter(Boolean) as Task[];

      // حفظ القائمة الجديدة للمهام المخفية في الهاتف
      localStorage.setItem(`hidden_tasks_${civilId}`, JSON.stringify(hiddenTasks));
      setTasks(syncedTasks);
    } else {
      setTasks([]);
    }
  }, [studentData]);

  // 💾 حفظ حالة المهام وتاريخ إنجازها في الهاتف
  useEffect(() => {
    if (studentData?.civilId) {
      const statusMap = tasks.reduce((acc: any, task) => {
        acc[task.id] = { 
          completed: task.completed, 
          completedAt: task.completedAt || new Date().toDateString() 
        };
        return acc;
      }, {});
      localStorage.setItem(`tasks_status_${studentData.civilId}`, JSON.stringify(statusMap));
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
    setTasks(prev => prev.map(task => 
      task.id === id ? { 
        ...task, 
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toDateString() : undefined // تسجيل يوم الإنجاز
      } : task
    ));
  };

  // 🗑️ الحذف النهائي الذي لا عودة منه
  const deleteTask = (id: string) => {
    if (window.confirm('هل تريد حذف هذه المهمة نهائياً من قائمتك؟')) {
      const civilId = studentData?.civilId || 'default';
      const hidden = JSON.parse(localStorage.getItem(`hidden_tasks_${civilId}`) || '[]');
      hidden.push(id);
      localStorage.setItem(`hidden_tasks_${civilId}`, JSON.stringify(hidden)); // 🔒 ختم الإخفاء

      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (loading && tasks.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-indigo-200">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-bold text-sm">جاري تحديث المهام...</p>
    </div>
  );

  return (
    <GlassLayout
      title={t('myQuests') || 'مهامي الدراسية'}
      subtitle={studentData?.name || 'أهلاً بك'}
      icon={<Rocket className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />}
      rightAction={
        <button 
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className={`w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center border border-white/10 transition-all active:scale-95 shadow-sm ${isRefreshing ? 'opacity-50' : ''}`}
        >
            <RefreshCcw className={`text-indigo-300 ${isRefreshing ? 'animate-spin' : ''}`} size={18} />
        </button>
      }
    >
      <div className="flex-1">
        {/* المهام قيد الإنجاز */}
        <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_5px_rgba(251,191,36,0.8)]"></span>
          قيد الإنجاز ({pendingTasks.length})
        </h2>

        <div className="space-y-2.5">
          {pendingTasks.length > 0 ? pendingTasks.map(task => (
            // 🔮 بطاقة المهمة المدمجة (Compact)
            <div key={task.id} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3 transition-all hover:bg-white/10 hover:border-white/20 shadow-sm group">
              <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                <Circle className="w-6 h-6 text-indigo-200/40 hover:text-emerald-400 transition-colors" />
              </button>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white mb-1 leading-snug truncate group-hover:text-indigo-100 transition-colors">{task.title}</h3>
                <div className="flex items-center gap-2 text-[9px] font-bold text-indigo-200/70">
                  <span className="bg-indigo-500/20 px-2 py-0.5 rounded-md border border-white/5 truncate max-w-[100px]">{task.subject}</span>
                  <span className="text-amber-300/90 flex items-center gap-1 shrink-0"><Calendar className="w-3 h-3"/> {task.dueDate || 'قريباً'}</span>
                </div>
              </div>
              
              <button onClick={() => deleteTask(task.id)} className="shrink-0 p-2 text-white/10 hover:text-rose-400 transition-colors active:scale-95 bg-white/5 rounded-xl opacity-0 group-hover:opacity-100 sm:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 backdrop-blur-xl rounded-3xl border border-dashed border-white/10 shadow-inner">
              <Trophy className="w-10 h-10 text-emerald-400/50 mx-auto mb-3 drop-shadow-md" />
              <p className="text-[11px] font-bold text-indigo-200/70">أنجزت كل مهامك.. استمتع بوقتك! 🎮</p>
            </div>
          )}
        </div>

        {/* المهام المكتملة */}
        {completedTasks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest mb-3 flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
              مكتملة ({completedTasks.length})
            </h2>
            <div className="space-y-2.5 opacity-60">
              {completedTasks.map(task => (
                // بطاقة المهمة المكتملة (بسيطة وشفافة)
                <div key={task.id} className="bg-black/20 border border-white/5 rounded-2xl p-3 flex items-center gap-3 group transition-all hover:bg-black/30">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-indigo-200/60 line-through truncate">{task.title}</h3>
                  </div>
                  
                  <button onClick={() => deleteTask(task.id)} className="shrink-0 p-1.5 text-white/10 hover:text-rose-400 transition-colors active:scale-95">
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

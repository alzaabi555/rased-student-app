import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, Circle, Calendar, 
  BookOpen, Trophy, Rocket, Trash2, Loader2, RefreshCcw 
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  completed: boolean;
}

const StudentTasks: React.FC = () => {
  const { t, dir, studentData, loading, refreshData } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // تحديث فوري عند الدخول
  useEffect(() => {
    if (refreshData) refreshData();
  }, []);

  // 🔄 وضع المهام في الشاشة فور استلامها (بدون أي فلاتر مخفية)
  useEffect(() => {
    if (studentData && Array.isArray(studentData.tasks)) {
      const syncedTasks = studentData.tasks.map((task: any) => ({
        id: String(task.id || Math.random()),
        title: String(task.title || 'مهمة بدون عنوان'),
        subject: String(task.subject || 'عام'),
        dueDate: String(task.dueDate || ''),
        completed: false // إجبار جميع المهام لتكون "قيد الإنجاز" مؤقتاً لنراها
      }));
      setTasks(syncedTasks);
    } else {
      setTasks([]);
    }
  }, [studentData]);

  const handleManualRefresh = async () => {
    if (refreshData) {
      setIsRefreshing(true);
      await refreshData();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    if (window.confirm('هل تريد إخفاء هذه المهمة؟')) {
      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  if (loading && tasks.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-indigo-200">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-bold text-sm">جاري عرض المهام...</p>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar pt-safe" dir={dir}>
      
      {/* 🚨 شريط كشف البيانات للمطور (سيخبرك بالحقيقة فوراً) 🚨 */}
      <div className="bg-amber-500/90 text-black text-center text-[11px] font-black py-1.5 shadow-md z-50">
        معلومة للمطور: السيرفر أرسل ({studentData?.tasks?.length || 0}) مهام
      </div>

      <div className="pt-6 pb-8 px-6 bg-white/5 backdrop-blur-3xl rounded-b-[2.5rem] shadow-lg border-b border-white/10 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1">
              <Rocket className="w-6 h-6 text-amber-400 fill-amber-400" />
              {t('myQuests') || 'مهامي الدراسية'}
            </h1>
            <p className="text-[11px] font-bold text-indigo-200/80">
              {studentData?.name || 'أهلاً بك'}
            </p>
          </div>
          
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className={`w-12 h-12 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-2xl flex items-center justify-center border border-indigo-400/30 transition-all active:scale-90 ${isRefreshing ? 'opacity-50' : ''}`}
          >
              <RefreshCcw className={`text-indigo-300 ${isRefreshing ? 'animate-spin' : ''}`} size={20} />
          </button>
        </div>
      </div>

      <div className="px-6 py-6 flex-1">
        <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          قيد الإنجاز ({pendingTasks.length})
        </h2>

        <div className="space-y-3">
          {pendingTasks.length > 0 ? pendingTasks.map(task => (
            <div key={task.id} className="bg-indigo-900/40 border border-indigo-400/30 rounded-[1.2rem] p-4 flex items-center gap-4 transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)]">
              <button onClick={() => toggleTask(task.id)} className="shrink-0">
                <Circle className="w-7 h-7 text-indigo-200/60 hover:text-indigo-400" />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1.5">{task.title}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-200/80">
                  <span className="bg-indigo-500/20 px-2 py-1 rounded-md border border-white/10">{task.subject}</span>
                  <span className="text-amber-300 flex items-center gap-1"><Calendar className="w-3 h-3"/> {task.dueDate || 'بدون تاريخ'}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 rounded-[1.5rem] border border-dashed border-white/20">
              <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-xs font-bold text-indigo-200/60">لا توجد مهام حالياً</p>
            </div>
          )}
        </div>

        {/* المهام المكتملة */}
        {completedTasks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              مكتملة ({completedTasks.length})
            </h2>
            <div className="space-y-3 opacity-70">
              {completedTasks.map(task => (
                <div key={task.id} className="bg-black/20 border border-white/5 rounded-[1.2rem] p-4 flex items-center gap-4">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-200/60 line-through mb-1">{task.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTasks;

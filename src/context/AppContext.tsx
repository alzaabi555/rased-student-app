import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, Circle, Calendar, 
  Trophy, Rocket, Trash2, Loader2, RefreshCcw 
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

  useEffect(() => {
    if (refreshData) refreshData();
  }, []);

  useEffect(() => {
    if (studentData && Array.isArray(studentData.tasks)) {
      const savedStatus = JSON.parse(localStorage.getItem(`tasks_status_${studentData.civilId}`) || '{}');
      const syncedTasks = studentData.tasks.map((task: any) => ({
        id: String(task.id || Math.random()),
        title: String(task.title || 'مهمة بدون عنوان'),
        subject: String(task.subject || 'عام'),
        dueDate: String(task.dueDate || ''),
        completed: savedStatus[task.id] || false 
      }));
      setTasks(syncedTasks);
    } else {
      setTasks([]);
    }
  }, [studentData]);

  useEffect(() => {
    if (studentData?.civilId && tasks.length > 0) {
      const statusMap = tasks.reduce((acc: any, task) => {
        acc[task.id] = task.completed;
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
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    if (window.confirm('هل تريد إخفاء هذه المهمة من قائمتك؟')) {
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
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar pt-safe" dir={dir}>
      <div className="pt-8 pb-8 px-6 bg-white/5 backdrop-blur-3xl rounded-b-[2.5rem] shadow-lg border-b border-white/10 sticky top-0 z-30">
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
            <div key={task.id} className="bg-white/5 border border-white/10 rounded-[1.2rem] p-4 flex items-center gap-4 transition-all group">
              <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                <Circle className="w-7 h-7 text-indigo-200/40 hover:text-indigo-400" />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{task.title}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-200/70">
                  <span className="bg-indigo-500/20 px-2 py-1 rounded-md border border-white/10">{task.subject}</span>
                  <span className="text-amber-300 flex items-center gap-1"><Calendar className="w-3 h-3"/> {task.dueDate || 'قريباً'}</span>
                </div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="p-2 text-indigo-200/30 hover:text-rose-400 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 rounded-[1.5rem] border border-dashed border-white/20">
              <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-xs font-bold text-indigo-200/60">أنجزت كل مهامك.. استمتع بوقتك! 🎮</p>
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              مكتملة ({completedTasks.length})
            </h2>
            <div className="space-y-3 opacity-60">
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

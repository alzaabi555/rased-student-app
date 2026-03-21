import React, { useState, useEffect, useMemo } from 'react';
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
  // 1. استدعاء البيانات بأمان (مع وضع قيم افتراضية لمنع الانهيار)
  const { t, dir, studentData, loading, refreshData } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 🔄 2. طلب تحديث البيانات بأمان تام
  useEffect(() => {
    if (refreshData && typeof refreshData === 'function') {
      refreshData();
    }
  }, []);

  // 🔄 3. استقبال المهام من السيرفر ومعالجتها
  useEffect(() => {
    // التأكد من وجود بيانات وأن المهام عبارة عن مصفوفة
    if (studentData && Array.isArray(studentData.tasks)) {
      const savedStatus = JSON.parse(localStorage.getItem(`tasks_status_${studentData.civilId}`) || '{}');
      
      const syncedTasks = studentData.tasks.map((task: any) => ({
        id: task.id || Math.random().toString(),
        title: task.title || 'مهمة بدون عنوان',
        subject: task.subject || 'عام',
        dueDate: task.dueDate || '',
        // الحفاظ على حالة الإنجاز إذا كانت محفوظة سابقاً
        completed: savedStatus[task.id] || false 
      }));
      
      setTasks(syncedTasks);
    } else {
      setTasks([]); // تصفير المهام إذا لم يرسل السيرفر شيئاً
    }
  }, [studentData]);

  // 💾 4. حفظ حالة الإنجاز في الهاتف فقط عند تغييرها
  useEffect(() => {
    if (studentData?.civilId && tasks.length > 0) {
      const statusMap = tasks.reduce((acc: any, task) => {
        acc[task.id] = task.completed;
        return acc;
      }, {});
      localStorage.setItem(`tasks_status_${studentData.civilId}`, JSON.stringify(statusMap));
    }
  }, [tasks, studentData]);

  // دالة زر التحديث اليدوي
  const handleManualRefresh = async () => {
    if (refreshData && typeof refreshData === 'function') {
      setIsRefreshing(true);
      await refreshData();
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const progressStats = useMemo(() => {
    if (tasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    const completed = tasks.filter(t => t.completed).length;
    return {
      completed,
      total: tasks.length,
      percentage: Math.round((completed / tasks.length) * 100)
    };
  }, [tasks]);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(task => 
      task.id === id ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (id: string) => {
    if (window.confirm(t('confirmDeleteTask') || 'هل تريد إخفاء هذه المهمة من قائمتك؟')) {
      setTasks(prev => prev.filter(task => task.id !== id));
    }
  };

  const getSubjectEmoji = (subject: string) => {
    const s = String(subject || "").toLowerCase();
    if (s.includes('إسلام') || s.includes('دين') || s.includes('قرآن')) return '🕌';
    if (s.includes('عرب') || s.includes('لغتي')) return '📜';
    if (s.includes('رياضيات') || s.includes('حساب')) return '📐';
    if (s.includes('علوم') || s.includes('فيزياء') || s.includes('كيمياء')) return '🧪';
    if (s.includes('انجليز')) return '🔤';
    if (s.includes('اجتماع') || s.includes('تاريخ') || s.includes('جغرافيا')) return '🌍';
    if (s.includes('حاسوب') || s.includes('تقنية')) return '💻';
    return '📚';
  };

  // معالج آمن للتاريخ لمنع الانهيار
  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return 'قريباً';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr; // إذا لم يكن تاريخاً صالحاً، اعرضه كنص
      return d.toLocaleDateString('ar-OM', {month:'short', day:'numeric'});
    } catch (e) {
      return 'قريباً';
    }
  };

  if (loading && tasks.length === 0) return (
    <div className="flex flex-col items-center justify-center h-full text-indigo-200">
      <Loader2 className="w-10 h-10 animate-spin mb-4" />
      <p className="font-bold text-sm">جاري جلب مهامك من السحابة...</p>
    </div>
  );

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar pt-safe" dir={dir}>
      
      {/* الرأس وإحصائيات الإنجاز */}
      <div className="pt-8 pb-8 px-6 bg-white/5 backdrop-blur-3xl rounded-b-[2.5rem] shadow-lg border-b border-white/10 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1.5">
              <Rocket className="w-6 h-6 text-amber-400 fill-amber-400" />
              {t('myQuests') || 'مهامي الدراسية'}
            </h1>
            <p className="text-[11px] font-bold text-indigo-200/80">
              {studentData?.name || 'أهلاً بك'}
            </p>
          </div>
          
          {/* 🔄 زر التحديث اليدوي الجديد */}
          <button 
            onClick={handleManualRefresh}
            disabled={isRefreshing || loading}
            className={`w-12 h-12 bg-indigo-500/20 hover:bg-indigo-500/40 rounded-2xl flex items-center justify-center border border-indigo-400/30 transition-all active:scale-90 ${isRefreshing ? 'opacity-50' : ''}`}
          >
              <RefreshCcw className={`text-indigo-300 ${isRefreshing ? 'animate-spin' : ''}`} size={20} />
          </button>
        </div>

        <div className="bg-black/20 p-5 rounded-[1.5rem] border border-white/10 relative overflow-hidden">
          <div className="flex justify-between items-end mb-3">
            <span className="text-[11px] font-black text-indigo-200/70 uppercase tracking-wide">{t('completionRate') || 'معدل الإنجاز'}</span>
            <span className="text-2xl font-black text-emerald-400">{progressStats.percentage}%</span>
          </div>
          <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-1000"
              style={{ width: `${progressStats.percentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-6 flex-1">
        <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          {t('pendingTasks') || 'قيد الإنجاز'} ({pendingTasks.length})
        </h2>

        <div className="space-y-3">
          {pendingTasks.length > 0 ? pendingTasks.map(task => (
            <div key={task.id} className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-[1.2rem] p-4 flex items-center gap-4 transition-all group">
              <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                <Circle className="w-7 h-7 text-indigo-200/40 hover:text-indigo-400" />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{task.title}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-200/70">
                  <span className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded-md border border-white/5">
                    {getSubjectEmoji(task.subject)} {task.subject}
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Calendar className="w-3 h-3" /> 
                    {safeFormatDate(task.dueDate)}
                  </span>
                </div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="p-2 text-indigo-200/30 hover:text-rose-400 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 rounded-[1.5rem] border border-dashed border-white/20">
              <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-xs font-bold text-indigo-200/60">{t('noPendingTasks') || 'لا توجد مهام حالياً'}</p>
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {t('completedTasks') || 'مكتملة'} ({completedTasks.length})
            </h2>
            <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity">
              {completedTasks.map(task => (
                <div key={task.id} className="bg-black/20 border border-white/5 rounded-[1.2rem] p-4 flex items-center gap-4">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-200/60 line-through mb-1">{task.title}</h3>
                    <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">{task.subject}</span>
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

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, Circle, Plus, Calendar, 
  BookOpen, Trophy, Sparkles, Trash2, Rocket
} from 'lucide-react';

// تعريف نوع المهمة
interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  completed: boolean;
}

const StudentTasks: React.FC = () => {
  const { t, dir } = useApp();

  // بيانات افتراضية لتجربة الواجهة (سيتم استبدالها لاحقاً بقاعدة البيانات)
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', title: 'حل تمارين الرياضيات صفحة 45', subject: 'الرياضيات', dueDate: 'غداً', completed: false },
    { id: '2', title: 'تسليم مشروع العلوم (دورة الماء)', subject: 'العلوم', dueDate: 'الخميس', completed: false },
    { id: '3', title: 'حفظ سورة النبأ', subject: 'التربية الإسلامية', dueDate: 'اليوم', completed: true },
  ]);

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // حساب نسبة الإنجاز لتحفيز الطالب
  const progressStats = useMemo(() => {
    if (tasks.length === 0) return { completed: 0, total: 0, percentage: 100 };
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
    setTasks(prev => prev.filter(task => task.id !== id));
  };

  const addTask = () => {
    if (!newTaskTitle.trim()) return;
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle.trim(),
      subject: newTaskSubject.trim() || t('generalTask') || 'عام',
      dueDate: t('today') || 'اليوم', // افتراضياً
      completed: false
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setNewTaskSubject('');
    setIsAdding(false);
  };

  const pendingTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    // 🚀 الحاوية أصبحت شفافة تماماً
    <div className="flex flex-col h-full bg-transparent text-white overflow-y-auto custom-scrollbar pt-safe" dir={dir}>
      
      {/* 🌟 1. رأس الصفحة (Header & Progress) - زجاجي (Glassmorphism) */}
      <div className="pt-8 pb-8 px-6 bg-white/5 backdrop-blur-3xl rounded-b-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-b border-white/10 sticky top-0 z-30 shrink-0">
        <div className="flex justify-between items-center mb-7">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md mb-1.5">
              <Rocket className="w-6 h-6 text-amber-400 fill-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]" />
              {t('myQuests') || 'مهامي اليومية'}
            </h1>
            <p className="text-[11px] font-bold text-indigo-200/80 drop-shadow-sm">
              {progressStats.completed === progressStats.total && progressStats.total > 0 
                ? (t('allDoneMsg') || 'أنجزت كل مهامك يا بطل! 🚀') 
                : (t('keepGoingMsg') || 'استمر في الإنجاز، أنت رائع!')}
            </p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center shadow-[0_5px_20px_rgba(0,0,0,0.2)] transition-all active:scale-95 border ${
                isAdding 
                ? 'bg-rose-500 hover:bg-rose-400 border-rose-400/50 shadow-rose-500/30 rotate-45' 
                : 'bg-indigo-500 hover:bg-indigo-400 border-indigo-400/50 shadow-indigo-500/30'
            }`}
          >
            <Plus className={`w-6 h-6 text-white`} />
          </button>
        </div>

        {/* شريط الإنجاز (Progress Bar) */}
        <div className="bg-black/20 p-5 rounded-[1.5rem] border border-white/10 relative overflow-hidden shadow-inner">
          <Sparkles className="absolute -top-4 -right-4 w-24 h-24 text-white/5 rotate-12" />
          <div className="flex justify-between items-end mb-3 relative z-10">
            <span className="text-[11px] font-black text-indigo-200/70 tracking-wide uppercase">{t('completionRate') || 'معدل الإنجاز'}</span>
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-sm">{progressStats.percentage}%</span>
          </div>
          <div className="h-2.5 w-full bg-black/40 rounded-full overflow-hidden relative z-10 shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
              style={{ width: `${progressStats.percentage}%` }}
            >
                {/* لمعة متحركة داخل الشريط */}
                <div className="absolute inset-0 bg-white/30 skew-x-[-20deg] animate-[shimmer_2s_infinite] w-1/2 -ml-[50%]"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ✍️ 2. نافذة إضافة مهمة جديدة (تظهر عند الضغط على زر +) */}
      {isAdding && (
        <div className="px-6 py-5 animate-in slide-in-from-top-4 fade-in duration-300 z-20 relative shrink-0">
          <div className="bg-white/10 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/20 shadow-[0_15px_40px_rgba(0,0,0,0.3)]">
            <input 
              type="text" 
              autoFocus
              placeholder={t('taskTitlePlaceholder') || "ما هي مهمتك القادمة؟ (مثال: حفظ قصيدة)"}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="w-full bg-black/20 text-white text-sm font-bold p-3.5 rounded-xl outline-none border border-white/10 focus:border-indigo-400 focus:bg-white/5 transition-all mb-3 shadow-inner placeholder:text-indigo-200/40"
            />
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <BookOpen className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-200/50`} />
                <input 
                  type="text" 
                  placeholder={t('subjectPlaceholder') || "المادة (اختياري)"}
                  value={newTaskSubject}
                  onChange={(e) => setNewTaskSubject(e.target.value)}
                  className={`w-full bg-black/20 text-white text-xs font-bold py-3.5 ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} rounded-xl outline-none border border-white/10 focus:border-indigo-400 focus:bg-white/5 transition-all shadow-inner placeholder:text-indigo-200/40`}
                />
              </div>
              <button 
                onClick={addTask}
                disabled={!newTaskTitle.trim()}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white px-7 py-3 rounded-xl text-xs font-black shadow-[0_5px_15px_rgba(16,185,129,0.3)] transition-colors border border-emerald-400/50"
              >
                {t('addBtn') || 'إضافة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📋 3. قائمة المهام المتبقية */}
      <div className="px-6 py-6 flex-1 shrink-0">
        <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
          {t('pendingTasks') || 'قيد الإنجاز'} ({pendingTasks.length})
        </h2>

        <div className="space-y-3">
          {pendingTasks.length > 0 ? pendingTasks.map(task => (
            <div key={task.id} className="bg-white/5 border border-white/10 hover:bg-white/10 hover:border-indigo-400/40 backdrop-blur-md rounded-[1.2rem] p-4 flex items-center gap-4 transition-all group shadow-sm">
              <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                <Circle className="w-7 h-7 text-indigo-200/40 hover:text-indigo-400 transition-colors" />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-white mb-1.5 leading-snug tracking-wide">{task.title}</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-200/70">
                  <span className="flex items-center gap-1.5 bg-black/20 px-2 py-1 rounded-md border border-white/5"><BookOpen className="w-3 h-3 text-indigo-400" /> {task.subject}</span>
                  <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-amber-400" /> {task.dueDate}</span>
                </div>
              </div>
              <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 p-2 text-indigo-200/40 hover:text-rose-400 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )) : (
            <div className="text-center py-10 bg-white/5 backdrop-blur-sm rounded-[1.5rem] border border-dashed border-white/20">
              <Trophy className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-xs font-bold text-indigo-200/60">{t('noPendingTasks') || 'لا توجد مهام حالياً، استمتع بوقتك! 🎮'}</p>
            </div>
          )}
        </div>

        {/* ✅ 4. قائمة المهام المنجزة */}
        {completedTasks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-[10px] font-black text-indigo-200/60 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              {t('completedTasks') || 'مكتملة'} ({completedTasks.length})
            </h2>
            <div className="space-y-3 opacity-60 hover:opacity-100 transition-opacity duration-500">
              {completedTasks.map(task => (
                <div key={task.id} className="bg-black/20 border border-white/5 backdrop-blur-sm rounded-[1.2rem] p-4 flex items-center gap-4 transition-all">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 active:scale-90 transition-transform">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-200/60 line-through decoration-indigo-200/40 mb-1 leading-snug">{task.title}</h3>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-200/40">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {task.subject}</span>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="p-2 text-indigo-200/30 hover:text-rose-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
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
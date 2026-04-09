import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CalendarDays, BookOpen, Edit3, X, Check, Trash2, Plus, Clock, ChevronLeft
} from 'lucide-react';

const DAYS = [
  { id: 0, name: 'الأحد' },
  { id: 1, name: 'الإثنين' },
  { id: 2, name: 'الثلاثاء' },
  { id: 3, name: 'الأربعاء' },
  { id: 4, name: 'الخميس' }
];

const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const PREDEFINED_SUBJECTS = [
  'التربية الإسلامية', 'اللغة العربية', 'اللغة الإنجليزية', 
  'العلوم', 'الدراسات الاجتماعية', 'الرياضيات', 
  'الفنون التشكيلية', 'تقنية المعلومات', 'الرياضة المدرسية', 'المهارات الحياتية'
];

const INITIAL_SCHEDULE: Record<number, string[]> = {
  0: ['', '', '', '', '', '', '', ''],
  1: ['', '', '', '', '', '', '', ''],
  2: ['', '', '', '', '', '', '', ''],
  3: ['', '', '', '', '', '', '', ''],
  4: ['', '', '', '', '', '', '', ''],
};

// =========================================================================
// 💎 1. الغلاف الزجاجي المخصص للجدول (يحتوي على شريط الأيام)
// =========================================================================
const GlassLayoutTimetable: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, rightAction, selectedDay, onSelectDay, children }) => {
  const { dir } = useApp();
  return (
    <div className="flex flex-col h-full bg-transparent text-white relative overflow-hidden" dir={dir}>
      {/* الهيدر الزجاجي المثبت */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/60 backdrop-blur-2xl border-b border-white/10 pt-[max(env(safe-area-inset-top),16px)] shrink-0 shadow-sm transition-all flex flex-col">
        <div className="flex justify-between items-center px-5 mb-4">
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
        </div>

        {/* شريط الأيام المدمج في الهيدر */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-4 custom-scrollbar snap-x no-scrollbar">
          {DAYS.map((day) => {
            const isActive = selectedDay === day.id;
            return (
              <button
                key={day.id}
                onClick={() => onSelectDay(day.id)}
                className={`snap-center shrink-0 px-5 py-2 rounded-xl text-[10px] font-black transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_5px_15px_rgba(6,182,212,0.4)] border border-cyan-400/50 scale-105' 
                    : 'bg-white/5 text-indigo-200/60 border border-white/5 hover:bg-white/10 hover:text-white backdrop-blur-md'
                }`}
              >
                {day.name}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-5 pb-[100px]">
        {children}
      </main>
    </div>
  );
};


// =========================================================================
// 📅 2. تطبيق الجدول الرئيسي
// =========================================================================
const StudentTimetable: React.FC = () => {
  const { t, dir, studentData } = useApp(); 
  
  const [selectedDay, setSelectedDay] = useState<number>(0);
  
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, string[]>>(() => {
    try {
      const studentId = studentData?.civilId || 'default';
      const saved = localStorage.getItem(`rased_timetable_${studentId}`);
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(e); }
    return INITIAL_SCHEDULE;
  });
  
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [activeCell, setActiveCell] = useState<{ day: number, period: number } | null>(null);

  useEffect(() => {
    try {
      const studentId = studentData?.civilId || 'default';
      localStorage.setItem(`rased_timetable_${studentId}`, JSON.stringify(weeklySchedule));
    } catch (e) { console.error(e); }
  }, [weeklySchedule, studentData]);

  useEffect(() => {
    const today = new Date().getDay();
    if (today >= 0 && today <= 4) {
      setSelectedDay(today);
    } else {
      setSelectedDay(0);
    }
  }, []);

  const todayClasses = (weeklySchedule[selectedDay] || Array(8).fill(''))
    .map((subject, index) => ({ periodNum: index + 1, subject }))
    .filter(cls => cls.subject !== '');

  const handleSelectSubject = (subject: string) => {
    if (!activeCell) return;
    const { day, period } = activeCell;
    
    setWeeklySchedule(prev => {
      const newDaySchedule = [...(prev[day] || Array(8).fill(''))];
      newDaySchedule[period] = subject;
      return { ...prev, [day]: newDaySchedule };
    });
    
    setActiveCell(null);
  };

  return (
    <>
      <GlassLayoutTimetable
        title={t('mySchedule') || 'الجدول الدراسي'}
        subtitle={t('scheduleSubtitle') || 'نظم حصصك واستعد ليومك الدراسي 📚'}
        icon={<CalendarDays className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        rightAction={
          <button 
            onClick={() => setIsEditingSchedule(true)}
            className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shadow-sm transition-all active:scale-95"
            title="تعديل الجدول"
          >
            <Edit3 className="w-4 h-4 text-cyan-300" />
          </button>
        }
      >
        {/* ===================== محتوى عرض الحصص (Compact Timeline) ===================== */}
        <div className="relative">
          {/* خط الزمن العمودي (Timeline Line) */}
          <div className={`absolute top-4 bottom-4 w-[2px] bg-white/5 ${dir === 'rtl' ? 'right-[19px]' : 'left-[19px]'} z-0 rounded-full shadow-inner`}></div>

          <div className="space-y-4 relative z-10">
            {todayClasses.length > 0 ? todayClasses.map((cls, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex flex-col items-center mt-3">
                  <div className="w-[10px] h-[10px] rounded-full border-[2px] z-10 bg-[#020617] border-cyan-500/80 shadow-[0_0_8px_rgba(6,182,212,0.4)]"></div>
                </div>

                <div className="flex-1 rounded-2xl p-3 bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-md mb-1.5 inline-block bg-black/40 text-indigo-200/70 border border-white/5 uppercase tracking-wider">
                        الحصة {cls.periodNum}
                      </span>
                      <h3 className="text-sm font-black text-white flex items-center gap-2 drop-shadow-sm group-hover:text-cyan-100 transition-colors">
                        {cls.subject}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                      <BookOpen className="w-5 h-5 text-indigo-200/30 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl border-dashed mt-4 shadow-inner">
                <CalendarDays className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <h3 className="text-sm font-black text-white mb-1.5">{t('noClasses') || 'لا توجد حصص!'}</h3>
                <p className="text-[10px] font-bold text-indigo-200/60">استخدم زر التعديل بالأعلى لإضافة مواد لجدولك.</p>
              </div>
            )}
          </div>
        </div>
      </GlassLayoutTimetable>

      {/* ===================== 🛠️ شاشة تعديل الجدول ===================== */}
      {isEditingSchedule && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f172a]/95 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-300">
          
          <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/5 shrink-0 pt-[max(env(safe-area-inset-top),20px)]">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-cyan-400" />
              {t('editSchedule') || 'تعديل الجدول الأسبوعي'}
            </h2>
            <button onClick={() => setIsEditingSchedule(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/5 active:scale-95">
              <X className="w-4 h-4 text-indigo-200" />
            </button>
          </div>

          <div className="p-2.5 text-[10px] font-bold text-cyan-200/80 text-center shrink-0 bg-black/20 shadow-inner">
            اسحب لليمين واليسار لاختيار الحصة، واضغط لإضافة المادة
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pb-24 space-y-5">
            {DAYS.map(day => (
              <div key={day.id} className="bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg relative overflow-hidden">
                <div className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mt-6 -mr-6 pointer-events-none`}></div>
                
                <h3 className="text-sm font-black mb-3 text-white flex items-center gap-2 relative z-10">
                  <CalendarDays className="w-3.5 h-3.5 text-cyan-400" /> {day.name}
                </h3>
                
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-2 snap-x relative z-10">
                  {PERIODS.map((p, idx) => {
                    const subject = weeklySchedule[day.id]?.[idx];
                    return (
                      <button
                        key={p}
                        onClick={() => setActiveCell({ day: day.id, period: idx })}
                        className={`snap-center shrink-0 w-[90px] h-24 rounded-2xl flex flex-col items-center justify-center gap-2.5 border transition-all active:scale-95 shadow-sm ${
                          subject
                            ? 'bg-gradient-to-b from-cyan-500/20 to-blue-500/20 border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-1 opacity-70">
                          <Clock className="w-2.5 h-2.5" />
                          <span className="text-[9px] font-bold tracking-wider">حصة {p}</span>
                        </div>
                        <div className="text-[10px] font-black text-center line-clamp-2 px-1.5 leading-tight w-full">
                          {subject || <Plus className="w-5 h-5 mx-auto opacity-40 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================== 📚 الدرج الجانبي لاختيار المواد ===================== */}
      {activeCell && (
        <>
          <div 
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setActiveCell(null)}
          ></div>
          
          <div className={`fixed top-0 bottom-0 left-0 z-[120] w-[85%] max-w-sm bg-[#0f172a]/95 backdrop-blur-3xl border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.5)] flex flex-col animate-in slide-in-from-left duration-300`}>
            
            <div className="p-5 pt-[max(env(safe-area-inset-top),20px)] border-b border-white/10 bg-white/5 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  اختر المادة
                </h3>
                <p className="text-[10px] font-bold text-cyan-400/70 mt-1">
                  يوم {DAYS[activeCell.day].name} - الحصة {activeCell.period + 1}
                </p>
              </div>
              <button onClick={() => setActiveCell(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-95 border border-white/5">
                <X className="w-4 h-4 text-indigo-200" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
              {PREDEFINED_SUBJECTS.map((subject, idx) => {
                const isSelected = weeklySchedule[activeCell.day]?.[activeCell.period] === subject;
                return (
                  <button 
                    key={idx}
                    onClick={() => handleSelectSubject(subject)}
                    className={`w-full p-3.5 rounded-2xl flex items-center justify-between border transition-all duration-200 active:scale-95 ${
                      isSelected 
                        ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-black/30 text-indigo-200/50'}`}>
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className={`text-sm font-black ${isSelected ? 'text-cyan-100' : 'text-slate-200'}`}>
                        {subject}
                      </span>
                    </div>
                    
                    {isSelected ? (
                      <Check className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <ChevronLeft className="w-4 h-4 text-indigo-200/30" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4 pb-[max(env(safe-area-inset-bottom),20px)] border-t border-white/10 bg-black/20 shrink-0">
              <button 
                onClick={() => handleSelectSubject('')}
                className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl text-xs font-black text-rose-400 transition-colors flex justify-center items-center gap-2 active:scale-95 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                تفريغ هذه الحصة
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default StudentTimetable;

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CalendarDays, BookOpen, Edit3, X, Check, Trash2, Plus, Clock 
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

const StudentTimetable: React.FC = () => {
  // 🧠 ربط الجدول برقم الطالب
  const { t, dir, studentData } = useApp(); 
  
  const [selectedDay, setSelectedDay] = useState<number>(0);
  
  // 💾 زراعة الذاكرة: استدعاء الجدول من الهاتف عند فتح الصفحة
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

  // 💾 زراعة الذاكرة: حفظ الجدول فوراً عند أي تغيير
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
    <div className="flex flex-col h-full bg-transparent text-white overflow-hidden pt-safe relative" dir={dir}>
      
      {/* ===================== الهيدر الأساسي (وضع العرض) ===================== */}
      <div className="pt-6 pb-2 px-0 bg-white/5 backdrop-blur-3xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] border-b border-white/10 sticky top-0 z-30 shrink-0">
        <div className="px-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-1.5 drop-shadow-md">
              <CalendarDays className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
              {t('mySchedule') || 'الجدول الدراسي'}
            </h1>
            <p className="text-[11px] font-bold text-indigo-200/70 drop-shadow-sm">
              {t('scheduleSubtitle') || 'نظم حصصك واستعد ليومك الدراسي 📚'}
            </p>
          </div>
          
          <button 
            onClick={() => setIsEditingSchedule(true)}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95"
            title="تعديل الجدول"
          >
            <Edit3 className="w-5 h-5 text-cyan-300" />
          </button>
        </div>

        {/* شريط الأيام */}
        <div className="flex gap-2 overflow-x-auto px-6 pb-4 custom-scrollbar snap-x no-scrollbar">
          {DAYS.map((day) => {
            const isActive = selectedDay === day.id;
            return (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`snap-center shrink-0 px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all duration-300 ${
                  isActive 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_5px_15px_rgba(6,182,212,0.4)] border border-cyan-400/50 transform scale-105' 
                    : 'bg-black/20 text-indigo-200/50 border border-white/5 hover:bg-white/10 hover:text-white backdrop-blur-md'
                }`}
              >
                {day.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================== محتوى عرض الحصص (Timeline) ===================== */}
      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative">
        <div className={`absolute top-8 bottom-8 w-[2px] bg-white/10 ${dir === 'rtl' ? 'right-[2.35rem]' : 'left-[2.35rem]'} z-0 rounded-full shadow-inner`}></div>

        <div className="space-y-6 relative z-10">
          {todayClasses.length > 0 ? todayClasses.map((cls, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center mt-5">
                <div className="w-[14px] h-[14px] rounded-full border-[3px] z-10 bg-black border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]"></div>
              </div>

              <div className="flex-1 rounded-[1.5rem] p-4 bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black px-2.5 py-1 rounded-lg mb-2 inline-block bg-black/30 text-indigo-200/70 border border-white/5 uppercase tracking-wider">
                      الحصة {cls.periodNum}
                    </span>
                    <h3 className="text-lg font-black text-white flex items-center gap-2 drop-shadow-sm">
                      {cls.subject}
                    </h3>
                  </div>
                  <BookOpen className="w-8 h-8 text-white/5" />
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] border-dashed mt-8 shadow-inner">
              <CalendarDays className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <h3 className="text-base font-black text-white mb-2">{t('noClasses') || 'لا توجد حصص!'}</h3>
              <p className="text-[11px] font-bold text-indigo-200/60">استخدم زر التعديل بالأعلى لإضافة مواد لجدولك.</p>
            </div>
          )}
        </div>
      </div>

      {/* ===================== 🛠️ شاشة تعديل الجدول (التصميم الجديد المريح) ===================== */}
      {isEditingSchedule && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#0f172a]/95 backdrop-blur-2xl animate-in slide-in-from-bottom-8 duration-300">
          
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 shrink-0">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-cyan-400" />
              {t('editSchedule') || 'تعديل الجدول الأسبوعي'}
            </h2>
            <button onClick={() => setIsEditingSchedule(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors shadow-lg active:scale-95">
              <X className="w-5 h-5 text-indigo-200" />
            </button>
          </div>

          <div className="p-4 text-xs font-bold text-cyan-200/80 text-center shrink-0 bg-black/20 shadow-inner">
            اسحب لليمين واليسار لاختيار الحصة، واضغط لإضافة المادة
          </div>

          {/* 🧠 البطاقات الأفقية لكل يوم بدلاً من الجدول المعقد */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
            {DAYS.map(day => (
              <div key={day.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-lg relative overflow-hidden">
                {/* تأثير الإضاءة الخلفية للبطاقة */}
                <div className={`absolute top-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mt-6 -mr-6`}></div>
                
                <h3 className="text-base font-black mb-4 text-white flex items-center gap-2 relative z-10">
                  <CalendarDays className="w-4 h-4 text-cyan-400" /> {day.name}
                </h3>
                
                {/* شريط تمرير أفقي للحصص */}
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-3 snap-x relative z-10">
                  {PERIODS.map((p, idx) => {
                    const subject = weeklySchedule[day.id]?.[idx];
                    return (
                      <button
                        key={p}
                        onClick={() => setActiveCell({ day: day.id, period: idx })}
                        className={`snap-center shrink-0 w-[100px] h-28 rounded-[1.2rem] flex flex-col items-center justify-center gap-3 border transition-all active:scale-95 shadow-sm ${
                          subject
                            ? 'bg-gradient-to-b from-cyan-500/20 to-blue-500/20 border-cyan-400/40 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                            : 'bg-black/30 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
                        }`}
                      >
                        <div className="flex items-center gap-1 opacity-70">
                          <Clock className="w-3 h-3" />
                          <span className="text-[10px] font-bold tracking-wider">حصة {p}</span>
                        </div>
                        <div className="text-[11px] font-black text-center line-clamp-2 px-2 leading-snug w-full">
                          {subject || <Plus className="w-6 h-6 mx-auto opacity-40 text-white" />}
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

      {/* ===================== 📚 نافذة اختيار المواد (التصميم الشبكي الجديد) ===================== */}
      {activeCell && (
        <div className="absolute inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#1e293b]/95 backdrop-blur-3xl border border-white/20 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] sm:shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[85vh]">
            
            {/* مقبض السحب (للموبايل) */}
            <div className="w-12 h-1.5 rounded-full mx-auto mb-4 bg-white/20 sm:hidden"></div>

            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-black text-white">اختر المادة</h3>
                <p className="text-[10px] font-bold text-cyan-400 mt-1">يوم {DAYS[activeCell.day].name} - الحصة {activeCell.period + 1}</p>
              </div>
              <button onClick={() => setActiveCell(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors active:scale-95 border border-white/5">
                <X className="w-5 h-5 text-indigo-200" />
              </button>
            </div>

            {/* 🧠 الحل الشبكي: حاوية المواد الشبكية القابلة للتمرير */}
            <div className="grid grid-cols-2 gap-3 overflow-y-auto custom-scrollbar flex-1 pr-1 pb-4 content-start">
              {PREDEFINED_SUBJECTS.map((subject, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSelectSubject(subject)}
                  className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-black text-center text-indigo-100 transition-all active:scale-95 flex flex-col items-center justify-center gap-3 min-h-[90px] group"
                >
                  <div className="p-2 rounded-xl bg-white/5 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors">
                    <BookOpen className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                  </div>
                  <span className="line-clamp-2 leading-tight">{subject}</span>
                </button>
              ))}
            </div>

            <div className="mt-2 pt-4 border-t border-white/10 shrink-0">
              <button 
                onClick={() => handleSelectSubject('')}
                className="w-full py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl text-xs font-black text-rose-400 transition-colors flex justify-center items-center gap-2 active:scale-95 shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                تفريغ هذه الحصة
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StudentTimetable;

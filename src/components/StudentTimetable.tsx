import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CalendarDays, BookOpen, Edit3, X, Check, Trash2 
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

// جدول مبدئي فارغ (يحتوي فقط على بعض البيانات للتجربة)
const INITIAL_SCHEDULE: Record<number, string[]> = {
  0: ['الرياضيات', 'العلوم', '', 'اللغة العربية', '', '', '', ''],
  1: ['', '', '', '', '', '', '', ''],
  2: ['', '', '', '', '', '', '', ''],
  3: ['', '', '', '', '', '', '', ''],
  4: ['', '', '', '', '', '', '', ''],
};

const StudentTimetable: React.FC = () => {
  const { t, dir } = useApp();
  
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [weeklySchedule, setWeeklySchedule] = useState<Record<number, string[]>>(INITIAL_SCHEDULE);
  
  // حالات نافذة تعديل الجدول
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [activeCell, setActiveCell] = useState<{ day: number, period: number } | null>(null);

  useEffect(() => {
    const today = new Date().getDay();
    if (today >= 0 && today <= 4) {
      setSelectedDay(today);
    } else {
      setSelectedDay(0);
    }
  }, []);

  // استخراج الحصص الممتلئة لليوم المحدد فقط لعرضها في القائمة الرئيسية
  const todayClasses = (weeklySchedule[selectedDay] || Array(8).fill(''))
    .map((subject, index) => ({ periodNum: index + 1, subject }))
    .filter(cls => cls.subject !== '');

  // دالة اختيار مادة لخلية معينة
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
      
      {/* 🌟 1. رأس الصفحة وشريط الأيام */}
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
          
          {/* زر تعديل الجدول في الأعلى */}
          <button 
            onClick={() => setIsEditingSchedule(true)}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95"
            title="تعديل الجدول"
          >
            <Edit3 className="w-5 h-5 text-cyan-300" />
          </button>
        </div>

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

      {/* 📅 2. قائمة الحصص لليوم المحدد (العرض الرئيسي) */}
      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar relative">
        <div className={`absolute top-8 bottom-8 w-[2px] bg-white/10 ${dir === 'rtl' ? 'right-[2.35rem]' : 'left-[2.35rem]'} z-0 rounded-full shadow-inner`}></div>

        <div className="space-y-6 relative z-10">
          {todayClasses.length > 0 ? todayClasses.map((cls, index) => (
            <div key={index} className="flex gap-4">
              
              {/* النقطة الزمنية الموحدة */}
              <div className="flex flex-col items-center mt-5">
                <div className="w-[14px] h-[14px] rounded-full border-[3px] z-10 bg-black border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]"></div>
              </div>

              {/* بطاقة الحصة الموحدة النظيفة */}
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

      {/* 🧩 3. شاشة تعديل الجدول الكاملة (Grid Edit Modal) */}
      {isEditingSchedule && (
        <div className="absolute inset-0 z-50 flex flex-col bg-[#0f172a]/95 backdrop-blur-2xl animate-in slide-in-from-bottom-8 duration-300">
          
          <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 shrink-0">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-cyan-400" />
              {t('editSchedule') || 'تعبئة الجدول الأسبوعي'}
            </h2>
            <button onClick={() => setIsEditingSchedule(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              <X className="w-5 h-5 text-indigo-200" />
            </button>
          </div>

          <div className="p-6 text-xs font-bold text-indigo-200/70 text-center shrink-0 bg-black/20">
            اضغط على الفراغ لتحديد المادة
          </div>

          {/* شبكة الجدول (Table) */}
          <div className="flex-1 overflow-auto custom-scrollbar p-6">
            <table className="w-full border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-20 bg-[#1e293b] p-3 rounded-xl text-xs font-black text-indigo-200 min-w-[70px] shadow-[0_0_10px_rgba(0,0,0,0.5)] border border-white/5`}>
                    اليوم
                  </th>
                  {PERIODS.map(p => (
                    <th key={p} className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-indigo-300 min-w-[85px]">
                      ح {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => (
                  <tr key={day.id}>
                    <td className={`sticky ${dir === 'rtl' ? 'right-0' : 'left-0'} z-20 bg-[#1e293b] p-3 rounded-xl text-xs font-black text-white shadow-[0_0_10px_rgba(0,0,0,0.5)] border border-white/5 text-center`}>
                      {day.name}
                    </td>
                    {PERIODS.map((p, idx) => {
                      const subject = weeklySchedule[day.id]?.[idx];
                      return (
                        <td 
                          key={idx} 
                          onClick={() => setActiveCell({ day: day.id, period: idx })} 
                          className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold text-center cursor-pointer min-w-[85px] h-14 align-middle transition-colors active:scale-95 shadow-inner"
                        >
                          {subject ? (
                            <span className="text-cyan-300 drop-shadow-sm line-clamp-2 leading-tight">{subject}</span>
                          ) : (
                            <span className="text-white/20 text-lg">+</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🎯 4. نافذة اختيار المادة (تظهر عند الضغط على خلية) */}
      {activeCell && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#1e293b]/95 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
            
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="text-sm font-black text-white">اختر المادة</h3>
              <button onClick={() => setActiveCell(null)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4 text-indigo-200" />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-2 space-y-2">
              {PREDEFINED_SUBJECTS.map((subject, idx) => (
                <button 
                  key={idx}
                  onClick={() => handleSelectSubject(subject)}
                  className="w-full p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-right text-indigo-100 transition-colors flex justify-between items-center"
                >
                  {subject}
                  <Check className="w-4 h-4 text-cyan-400 opacity-0 hover:opacity-100" />
                </button>
              ))}
            </div>

            {/* زر لتفريغ الحصة (مسح المادة) */}
            <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
              <button 
                onClick={() => handleSelectSubject('')}
                className="w-full p-3.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-black text-rose-400 transition-colors flex justify-center items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                تفريغ الحصة
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default StudentTimetable;
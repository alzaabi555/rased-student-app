import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Home, CalendarDays, CheckSquare, ShieldCheck, Library, Loader2, AlertTriangle } from 'lucide-react'; 
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

import RamadanTheme from './RamadanTheme';
import StudentLogin from './StudentLogin';
import StudentDashboard from './StudentDashboard';
import StudentTasks from './StudentTasks';
import StudentGrades from './StudentGrades';
import StudentTimetable from './StudentTimetable';
import StudentLibrary from './StudentLibrary'; 

const StudentApp: React.FC = () => {
  const { dir, studentData, loading, login } = useApp();
  
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'timetable' | 'tasks' | 'library' | 'grades'>('home');

  const handleLogin = async (civilId: string) => {
    setLoginError('');
    const success = await login(civilId);
    if (!success) {
      setLoginError('الرقم المدني غير مسجل في النظام أو فشل الاتصال.');
    }
  };

  useEffect(() => {
    const manageNotifications = async () => {
      if (!studentData || !studentData.tasks) return;

      const currentTaskIds = studentData.tasks.map((t: any) => t.id);
      const savedTaskIds = JSON.parse(localStorage.getItem('rased_student_known_tasks') || '[]');
      const newTasks = studentData.tasks.filter((t: any) => !savedTaskIds.includes(t.id));

      if (newTasks.length > 0) {
        localStorage.setItem('rased_student_known_tasks', JSON.stringify(currentTaskIds));

        setTimeout(() => {
          alert(`🔔 مهمة جديدة!\n\nالمهمة: ${newTasks[0].title}\nالمادة: ${newTasks[0].subject}`);
        }, 1000);

        try {
          if (Capacitor.isNativePlatform()) {
            let permStatus = await LocalNotifications.checkPermissions();
            if (permStatus.display !== 'granted') {
              permStatus = await LocalNotifications.requestPermissions();
            }
            if (permStatus.display === 'granted') {
              await LocalNotifications.schedule({
                notifications: [{
                  title: "مهمة جديدة! 🤩",
                  body: `تمت إضافة مهمة: "${newTasks[0].title}"`,
                  id: Math.floor(Math.random() * 100000),
                  schedule: { at: new Date(Date.now() + 2000) },
                }]
              });
            }
          }
        } catch (error) { console.error(error); }
      }
    };
    manageNotifications();
  }, [studentData]); 

  const NAV_ITEMS = [
    { id: 'home', icon: Home, label: 'الرئيسية' },
    { id: 'timetable', icon: CalendarDays, label: 'الجدول' },
    { id: 'library', icon: Library, label: 'مكتبتي' }, 
    { id: 'tasks', icon: CheckSquare, label: 'مهامي' },
    { id: 'grades', icon: ShieldCheck, label: 'إتقاني' }
  ] as const;

  const renderContent = () => {
    if (!studentData) return null;
    switch (activeTab) {
      case 'home': return <StudentDashboard student={studentData} currentSemester="1" />;
      case 'timetable': return <StudentTimetable />;
      case 'library': return <StudentLibrary />; 
      case 'tasks': return <StudentTasks />;
      case 'grades': return <StudentGrades student={studentData} currentSemester="1" />;
      default: return <StudentDashboard student={studentData} currentSemester="1" />;
    }
  };

  // ================= شاشة الدخول (في حال عدم وجود بيانات الطالب) =================
  if (!studentData) {
    return (
      <div className="relative h-[100dvh] w-full bg-[#020617] overflow-hidden" dir={dir}>
        <div className="absolute inset-0 z-0 pointer-events-none">
          <RamadanTheme />
        </div>
        <div className="relative z-10 h-full w-full">
          <StudentLogin onLogin={handleLogin} />
        </div>
        
        {/* 💉 واجهة تحميل فاخرة (Glassmorphism Loading) */}
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020617]/80 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]" />
              <h2 className="text-lg font-black text-white tracking-wide">جاري جلب بياناتك...</h2>
            </div>
          </div>
        )}
        
        {/* 💉 واجهة خطأ فاخرة (Top Notification Style) */}
        {loginError && !loading && (
          <div className="absolute top-[max(env(safe-area-inset-top),20px)] left-4 right-4 z-50 animate-in slide-in-from-top-8 fade-in duration-300">
            <div className="bg-rose-950/80 border border-rose-500/30 backdrop-blur-2xl p-4 rounded-[2rem] shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0 border border-rose-500/30">
                   <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <p className="text-xs sm:text-sm font-black text-rose-100 leading-tight pr-1">{loginError}</p>
              </div>
              <button onClick={() => setLoginError('')} className="bg-rose-500/20 hover:bg-rose-500/40 px-4 py-2.5 rounded-xl text-xs font-black text-rose-200 transition-colors shrink-0 mr-2 active:scale-95">
                إغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= التطبيق الرئيسي للطالب =================
  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative text-white bg-[#020617]" dir={dir}>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <RamadanTheme />
      </div>

      {/* منطقة المحتوى متجاوبة وشفافة لتمرير الخلفية */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-[env(safe-area-inset-top)]">
        <div className="flex-1 w-full relative z-10">
          <div className="max-w-5xl mx-auto w-full h-full">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* 💉 شريط التنقل الطافي والفاخر (Dynamic Glass Pill) */}
      <div className="absolute bottom-0 left-0 right-0 z-[90] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pointer-events-none flex justify-center bg-gradient-to-t from-[#020617] via-[#020617]/80 to-transparent">
        <div className="bg-[#0f172a]/70 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2 w-full max-w-[420px] shadow-[0_20px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex justify-between items-center relative transition-all">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-16 h-[56px] rounded-2xl relative transition-all duration-500 z-10 ${isActive ? 'scale-110 -translate-y-2' : 'hover:bg-white/5 opacity-60'}`}
              >
                {/* خلفية مشعة عند التفعيل */}
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl shadow-[0_0_20px_rgba(6,182,212,0.2)]"></div>
                )}
                
                <Icon className={`w-5 h-5 mb-1 relative z-10 transition-all duration-300 ${isActive ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400'}`} />
                <span className={`text-[9px] font-black relative z-10 transition-colors duration-300 ${isActive ? 'text-cyan-50' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default StudentApp;

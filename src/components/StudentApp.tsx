import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Home, CalendarDays, CheckSquare, ShieldCheck, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// 🔮 استدعاء الثيم الزجاجي المضيء
import RamadanTheme from './RamadanTheme';

// استيراد الشاشات
import StudentLogin from './StudentLogin';
import StudentDashboard from './StudentDashboard';
import StudentTasks from './StudentTasks';
import StudentGrades from './StudentGrades';
import StudentTimetable from './StudentTimetable';

const StudentApp: React.FC = () => {
  // 🧠 السر هنا: استخدام `studentData` و `login` و `loading` من العقل الموحد (AppContext)
  const { t, dir, studentData, loading, login } = useApp();
  
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'home' | 'timetable' | 'tasks' | 'grades'>('home');
  const [currentSemester] = useState<'1' | '2'>('1');

  // 📡 دالة الاتصال الموحدة (توجه الأمر لـ AppContext)
  const handleLogin = async (civilId: string) => {
    setLoginError('');
    const success = await login(civilId);
    if (!success) {
      setLoginError('الرقم المدني غير مسجل في النظام أو فشل الاتصال.');
    }
  };

  // 🔔 محرك الإشعارات (متصل الآن بالعقل المدبر)
  useEffect(() => {
    const manageNotifications = async () => {
      if (!studentData || !studentData.tasks || !Capacitor.isNativePlatform()) return;

      const pendingTasks = studentData.tasks.filter((t: any) => !t.completed);
      
      try {
        let permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display !== 'granted') {
          permStatus = await LocalNotifications.requestPermissions();
        }
        if (permStatus.display !== 'granted') return;

        const pendingReqs = await LocalNotifications.getPending();
        if (pendingReqs.notifications.length > 0) {
          await LocalNotifications.cancel(pendingReqs);
        }

        if (pendingTasks.length === 0) return;

        const savedTaskIds = JSON.parse(localStorage.getItem('rased_student_known_tasks') || '[]');
        const currentTaskIds = studentData.tasks.map((t: any) => t.id);
        const newTasks = pendingTasks.filter((t: any) => !savedTaskIds.includes(t.id));

        const notificationsToSchedule = [];

        if (newTasks.length > 0) {
          notificationsToSchedule.push({
            title: "مهمة جديدة من معلمك! 🤩",
            body: `تمت إضافة مهمة: "${newTasks[0].title}". ادخل للتفاصيل!`,
            id: Math.floor(Math.random() * 10000),
            schedule: { at: new Date(Date.now() + 1000 * 5) }, 
          });
          localStorage.setItem('rased_student_known_tasks', JSON.stringify(currentTaskIds));
        }

        notificationsToSchedule.push({
          title: "تذكير بمهامك المعلقة ⏳",
          body: `يا بطل، لا تنسَ إنجاز ${pendingTasks.length} مهمة تنتظر إبداعك!`,
          id: 9999,
          schedule: { at: new Date(Date.now() + 1000 * 60 * 60 * 2) },
        });

        await LocalNotifications.schedule({ notifications: notificationsToSchedule });

      } catch (error) {
        console.error("Error scheduling notifications", error);
      }
    };

    manageNotifications();
  }, [studentData]); 

  const NAV_ITEMS = [
    { id: 'home', icon: Home, label: t('navHome') || 'الرئيسية' },
    { id: 'timetable', icon: CalendarDays, label: t('navSchedule') || 'الجدول' },
    { id: 'tasks', icon: CheckSquare, label: t('navTasks') || 'مهامي' },
    { id: 'grades', icon: ShieldCheck, label: t('navGrades') || 'إتقاني' }
  ] as const;

  const renderContent = () => {
    if (!studentData) return null;
    switch (activeTab) {
      case 'home': return <StudentDashboard student={studentData} currentSemester={currentSemester} />;
      case 'timetable': return <StudentTimetable />;
      case 'tasks': return <StudentTasks />; // 🚀 صفحة المهام ستقرأ الآن البيانات الصحيحة!
      case 'grades': return <StudentGrades student={studentData} currentSemester={currentSemester} />;
      default: return <StudentDashboard student={studentData} currentSemester={currentSemester} />;
    }
  };

  // شاشة الدخول
  if (!studentData) {
    return (
      <div className="relative h-screen w-full bg-[#0f172a] overflow-hidden" dir={dir}>
        <RamadanTheme />
        <StudentLogin onLogin={handleLogin} />
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a]/80 backdrop-blur-md animate-in fade-in">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <h2 className="text-lg font-black text-white animate-pulse">جاري جلب بياناتك...</h2>
            <p className="text-xs font-bold text-indigo-300 mt-2">نجمع درجاتك ومهامك من السيرفر 🚀</p>
          </div>
        )}
        {loginError && !loading && (
          <div className="absolute top-10 left-4 right-4 z-50 bg-rose-500/10 border border-rose-500/50 backdrop-blur-md p-4 rounded-2xl shadow-lg animate-in slide-in-from-top-4">
            <p className="text-sm font-black text-rose-400 text-center">{loginError}</p>
            <button onClick={() => setLoginError('')} className="mt-2 w-full bg-rose-500/20 py-2 rounded-xl text-xs font-bold text-white hover:bg-rose-500/30 transition-colors">حسناً</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden relative text-white bg-transparent" dir={dir}>
      <RamadanTheme />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-safe">
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pb-[100px] w-full relative z-10">
          <div className="max-w-5xl mx-auto w-full min-h-full">
            {renderContent()}
          </div>
        </div>
      </main>

      <div className="absolute bottom-0 left-0 right-0 z-50 p-4 pb-safe bg-gradient-to-t from-[#020617] via-[#020617]/90 to-transparent pointer-events-none">
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 mx-auto max-w-md shadow-[0_10px_40px_rgba(0,0,0,0.5)] pointer-events-auto flex justify-between items-center relative overflow-hidden">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-16 h-14 rounded-2xl relative transition-all duration-300 z-10 ${
                  isActive ? 'scale-105' : 'hover:bg-white/5 opacity-60 hover:opacity-100'
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl animate-in zoom-in duration-300"></div>}
                <Icon className={`w-5 h-5 mb-1 transition-colors duration-300 ${isActive ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-slate-400'}`} />
                <span className={`text-[9px] font-black transition-colors duration-300 ${isActive ? 'text-cyan-100' : 'text-slate-500'}`}>{item.label}</span>
                {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,1)]"></div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudentApp;

import React, { createContext, useContext, useState, useEffect } from 'react';

// 🌐 رابط السيرفر الخاص بك
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec";

interface AppContextType {
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
  studentData: any;
  loading: boolean;
  login: (civilId: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dir] = useState<'rtl' | 'ltr'>('rtl');

  // 🔄 1. دالة تحديث البيانات الصامتة (بدون قفل الشاشة)
  const refreshData = async () => {
    const savedId = localStorage.getItem('last_civil_id');
    if (!savedId) return;

    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${savedId.trim()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
      }
    } catch (error) {
      console.error("Refresh Error:", error);
    }
  };

  // 🔔 2. مؤقت للبحث عن مهام/درجات جديدة كل 60 ثانية تلقائياً
  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 60000); 
    return () => clearInterval(interval);
  }, []);

  // 💾 3. استعادة الجلسة عند فتح التطبيق
  useEffect(() => {
    const savedData = localStorage.getItem('rased_student_session');
    if (savedData) {
      try {
        setStudentData(JSON.parse(savedData));
      } catch (e) {
        localStorage.removeItem('rased_student_session');
      }
    }
  }, []);

  // 🔑 4. دالة تسجيل الدخول
  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${civilId.trim()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
        localStorage.setItem('last_civil_id', civilId.trim()); 
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 🚪 5. تسجيل الخروج
  const logout = () => {
    setStudentData(null);
    localStorage.removeItem('rased_student_session');
    localStorage.removeItem('last_civil_id');
    localStorage.removeItem('rased_student_known_tasks'); // لمسح ذاكرة الإشعارات أيضاً
  };

  // 🌍 6. محرك الترجمة (بسيط ويدعم العربية)
  const t = (key: string) => {
    const translations: any = {
      'myQuests': 'مهامي الدراسية',
      'pendingTasks': 'قيد الإنجاز',
      'completedTasks': 'المكتملة',
      'completionRate': 'معدل الإنجاز',
      'navHome': 'الرئيسية',
      'navSchedule': 'الجدول',
      'navTasks': 'مهامي',
      'navGrades': 'إتقاني'
    };
    return translations[key] || key;
  };

  return (
    <AppContext.Provider value={{ t, dir, studentData, loading, login, logout, refreshData }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

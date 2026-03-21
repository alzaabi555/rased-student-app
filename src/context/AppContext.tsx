import React, { createContext, useContext, useState, useEffect } from 'react';

// 🌐 ضع رابط الـ Web App الخاص بك هنا
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

  const refreshData = async () => {
    const savedId = localStorage.getItem('last_civil_id');
    if (!savedId) return;
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${encodeURIComponent(savedId.trim())}`);
      const result = await response.json();
      if (result.success && result.data) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
      }
    } catch (error) { console.error("Refresh Error:", error); }
  };

  useEffect(() => {
    const interval = setInterval(() => { refreshData(); }, 60000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const savedData = localStorage.getItem('rased_student_session');
    if (savedData) {
      try { setStudentData(JSON.parse(savedData)); } 
      catch (e) { localStorage.removeItem('rased_student_session'); }
    }
  }, []);

  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${encodeURIComponent(civilId.trim())}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
        localStorage.setItem('last_civil_id', civilId.trim()); 
        return true;
      }
      return false;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStudentData(null);
    localStorage.removeItem('rased_student_session');
    localStorage.removeItem('last_civil_id');
  };

  const t = (key: string) => {
    const translations: any = {
      'myQuests': 'مهامي الدراسية',
      'pendingTasks': 'قيد الإنجاز',
      'completedTasks': 'المكتملة',
      'completionRate': 'نسبة الإنجاز',
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

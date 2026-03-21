// AppContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';

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
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${savedId.trim()}`);
      const result = await response.json();
      if (result.success) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
      }
    } catch (e) { console.error(e); }
  };

  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      // 🎯 نستخدم URLSearchParams لضمان إرسال الرقم بشكل صحيح للسيرفر
      const url = `${GOOGLE_SCRIPT_URL}?civilId=${encodeURIComponent(civilId.trim())}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
        localStorage.setItem('last_civil_id', civilId.trim());
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStudentData(null);
    localStorage.clear();
  };

  const t = (key: string) => {
    const trans: any = { 
      'navHome': 'الرئيسية', 'navSchedule': 'الجدول', 
      'navTasks': 'مهامي', 'navGrades': 'إتقاني' 
    };
    return trans[key] || key;
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

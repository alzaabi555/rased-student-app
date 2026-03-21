import React, { createContext, useContext, useState, useEffect } from 'react';

// 🌐 ضع رابط الـ Web App الخاص بك هنا (الذي ينتهي بـ /exec)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec";

interface AppContextType {
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
  studentData: any;
  loading: boolean;
  login: (civilId: string) => Promise<boolean>;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dir] = useState<'rtl' | 'ltr'>('rtl');

  // محاولة استعادة الجلسة عند فتح التطبيق
  useEffect(() => {
    const savedData = localStorage.getItem('rased_student_session');
    if (savedData) {
      setStudentData(JSON.parse(savedData));
    }
  }, []);

  // 📥 دالة تسجيل الدخول وجلب البيانات من جوجل
  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${civilId.trim()}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        // حفظ البيانات في الهاتف لسرعة الفتح لاحقاً
        localStorage.setItem('rased_student_session', JSON.stringify(result.data));
        localStorage.setItem('last_civil_id', civilId); 
        return true;
      } else {
        alert(result.error || "الرقم المدني غير مسجل");
        return false;
      }
    } catch (error) {
      console.error("Login Error:", error);
      alert("فشل الاتصال بالسيرفر. تأكد من الإنترنت.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStudentData(null);
    localStorage.removeItem('rased_student_session');
  };

  // دالة بسيطة للترجمة (يمكنك توسيعها لاحقاً)
  const t = (key: string) => {
    const translations: any = {
      'myQuests': 'مهامي الدراسية',
      'pendingTasks': 'قيد الإنجاز',
      'completedTasks': 'المهام المكتملة',
      'completionRate': 'نسبة الإنجاز'
      // أضف أي مفاتيح أخرى تحتاجها هنا
    };
    return translations[key] || key;
  };

  return (
    <AppContext.Provider value={{ t, dir, studentData, loading, login, logout }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

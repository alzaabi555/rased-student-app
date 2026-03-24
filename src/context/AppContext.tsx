import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// 🌐 رابط الـ Web App الخاص بك
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

  // مرجع للاحتفاظ بالرقم المدني الحالي لكي يستخدمه التحديث التلقائي بأمان
  const activeCivilIdRef = useRef<string | null>(null);

  const refreshData = async () => {
    // 💉 تحديث البيانات يعمل فقط إذا كان هناك طالب مسجل دخوله فعلياً
    if (!activeCivilIdRef.current) return;
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${encodeURIComponent(activeCivilIdRef.current)}`);
      const result = await response.json();
      if (result.success && result.data) {
        setStudentData(result.data);
      }
    } catch (error) { console.error("Refresh Error:", error); }
  };

  // 💉 التحديث التلقائي ذكي الآن: يعمل فقط بعد تسجيل الدخول
  useEffect(() => {
    if (studentData) {
      activeCivilIdRef.current = studentData.civilId;
      const interval = setInterval(() => { refreshData(); }, 60000); 
      return () => clearInterval(interval);
    } else {
      activeCivilIdRef.current = null;
    }
  }, [studentData]);

  // 🗑️ تم استئصال الـ useEffect الذي كان يقوم بالدخول التلقائي (المجرم الأول) من هنا

  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?civilId=${encodeURIComponent(civilId.trim())}`);
      const result = await response.json();

      if (result.success && result.data) {
        setStudentData(result.data);
        // حفظ الرقم المدني فقط ليظهر في مربع الدخول للمرات القادمة
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
    activeCivilIdRef.current = null;
    // لم نعد نمسح last_civil_id لكي يظل مطبوعاً في مربع الدخول لأخيه
  };

  // 🌍 القاموس العربي الشامل (النسخة الخالية من أي كلمة إنجليزية 100%)
  const t = (key: string) => {
    const translations: any = {
      // 🚪 شاشة الدخول (الكلمات المتمردة التي تم ترويضها!)
      'rasedApp': 'راصد نسخة الطلبة',
      'studentEdition': 'نسخة الطالب',
      'STUDENTEDITION': 'نسخة الطالب',
      'STUDENT EDITION': 'نسخة الطالب',
      'welcomeBack': 'مرحباً بك',
      'enterCivilIdToStart': 'أدخل رقمك المدني للبدء',
      'startAdventure': 'تسجيل الدخول',
      'civilIdPlaceholder': 'أدخل رقمك المدني هنا...', 
      
      // 📱 القائمة السفلية والتنقل
      'navHome': 'الرئيسية',
      'navSchedule': 'الجدول',
      'navTasks': 'مهامي',
      'navGrades': 'إتقاني',
      
      // 📅 شاشة الجدول
      'mySchedule': 'الجدول الدراسي',
      'scheduleSubtitle': 'جدول الحصص الأسبوعي',
      'noClasses': 'لا توجد حصص مضافة',
      'editSchedule': 'تعديل الجدول',
      
      // 🚀 صفحة المهام
      'myQuests': 'مهامي الدراسية',
      'pendingTasks': 'قيد الإنجاز',
      'completedTasks': 'المكتملة',
      'completionRate': 'نسبة الإنجاز',
      
      // 📊 كلمات عامة
      'welcome': 'أهلاً بك،',
      'semester1': 'الفصل الدراسي الأول',
      'semester2': 'الفصل الدراسي الثاني',
      'logout': 'تسجيل الخروج',
      'class': 'الصف:'
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

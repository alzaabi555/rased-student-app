import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// 🌐 1. رابط الـ Web App الخاص بشيت (الطالب)
const STUDENT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec";

// 🌐 2. رابط الـ Web App الخاص بشيت (ولي الأمر) الذي جلبناه للتو
const PARENT_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKPPsQsM_dIttcYSxRLs6LQuvXhT6Qia5TwJ1Tw4ObQ-eZFZeJhV6epXXjxA9_SwWk/exec";

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

  const activeCivilIdRef = useRef<string | null>(null);

  // 💉 دالة الدمج السحري (محدثة لقنص النقاط الجاهزة)
  const fetchAndMergeData = async (civilId: string) => {
    try {
      const [studentResponse, parentResponse] = await Promise.all([
        fetch(`${STUDENT_SCRIPT_URL}?civilId=${encodeURIComponent(civilId.trim())}`).catch(() => null),
        fetch(`${PARENT_SCRIPT_URL}?code=${encodeURIComponent(civilId.trim())}`).catch(() => null)
      ]);

      let finalData = null;

      if (studentResponse) {
        const studentResult = await studentResponse.json();
        if (studentResult.success && studentResult.data) {
          finalData = { ...studentResult.data };
        }
      }

      if (!finalData) return null;

      // 2. معالجة بيانات ولي الأمر (لجلب نقاط الفرسان)
      if (parentResponse) {
        const parentResult = await parentResponse.json();
        if (parentResult.status === "success" && parentResult.subjects) {
          let allBehaviors: any[] = [];
          let totalKnights = 0; // 💉 العداد الجديد لجمع النقاط الجاهزة

          parentResult.subjects.forEach((subject: any) => {
            // 💉 سحب إجمالي النقاط لكل مادة كما هو مسجل في شيت ولي الأمر
            totalKnights += Number(subject.totalPoints) || 0;

            if (subject.behaviors && Array.isArray(subject.behaviors)) {
              allBehaviors = allBehaviors.concat(subject.behaviors);
            }
          });
          
          finalData.behavior = allBehaviors;
          finalData.totalKnightsPoints = totalKnights; // 💉 حقن المجموع الجاهز في بيانات الطالب
        } else {
          finalData.behavior = []; 
          finalData.totalKnightsPoints = 0;
        }
      }

      return finalData;
    } catch (error) {
      console.error("Merge Fetch Error:", error);
      return null;
    }
  };

  const refreshData = async () => {
    if (!activeCivilIdRef.current) return;
    const mergedData = await fetchAndMergeData(activeCivilIdRef.current);
    if (mergedData) {
      setStudentData(mergedData);
    }
  };

  useEffect(() => {
    if (studentData) {
      activeCivilIdRef.current = studentData.civilId;
      const interval = setInterval(() => { refreshData(); }, 60000); 
      return () => clearInterval(interval);
    } else {
      activeCivilIdRef.current = null;
    }
  }, [studentData]);

  const login = async (civilId: string): Promise<boolean> => {
    setLoading(true);
    try {
      const mergedData = await fetchAndMergeData(civilId);

      if (mergedData) {
        setStudentData(mergedData);
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
  };

  const t = (key: string) => {
    const translations: any = {
      'rasedApp': 'راصد نسخة الطلبة',
      'studentEdition': 'نسخة الطالب',
      'welcomeBack': 'مرحباً بك',
      'enterCivilIdToStart': 'أدخل رقمك المدني للبدء',
      'startAdventure': 'تسجيل الدخول',
      'civilIdPlaceholder': 'أدخل رقمك المدني هنا...', 
      'navHome': 'الرئيسية',
      'navSchedule': 'الجدول',
      'navTasks': 'مهامي',
      'navGrades': 'إتقاني',
      'mySchedule': 'الجدول الدراسي',
      'scheduleSubtitle': 'جدول الحصص الأسبوعي',
      'noClasses': 'لا توجد حصص مضافة',
      'editSchedule': 'تعديل الجدول',
      'myQuests': 'مهامي الدراسية',
      'pendingTasks': 'قيد الإنجاز',
      'completedTasks': 'المكتملة',
      'completionRate': 'نسبة الإنجاز',
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

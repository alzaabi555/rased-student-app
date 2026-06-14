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
  login: (secretCode: string) => Promise<boolean>; // 💉 تعديل civilId إلى secretCode
  logout: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dir] = useState<'rtl' | 'ltr'>('rtl');

  // 💉 استبدال المرجع الخاص بالرقم المدني ليكون خاصاً بالكود السري
  const activeSecretCodeRef = useRef<string | null>(null);

 // 💉 دالة الدمج السحري (مضادة للصدمات ومحمية بالكامل)
  const fetchAndMergeData = async (secretCode: string) => {
    try {
      const sanitizedCode = secretCode.trim().toUpperCase(); // 💉 توحيد الكود إلى أحرف كبيرة
      const cacheBuster = new Date().getTime();
      const fetchOptions: RequestInit = {
        method: 'GET',
        redirect: 'follow' // 💉 إجبار المتصفح على تتبع توجيهات جوجل لحل المشكلة
      };

      const [studentResponse, parentResponse] = await Promise.all([
        // 💉 إرسال الكود السري للبحث في السحابتين
        fetch(`${STUDENT_SCRIPT_URL}?code=${encodeURIComponent(sanitizedCode)}&t=${cacheBuster}`, fetchOptions).catch(() => null),
        fetch(`${PARENT_SCRIPT_URL}?code=${encodeURIComponent(sanitizedCode)}&t=${cacheBuster}`, fetchOptions).catch(() => null)
      ]);

      let finalData = null;

      // 1. معالجة بيانات الطالب بأمان تام
      if (studentResponse) {
        const textData = await studentResponse.text(); // 💉 نقرأ النص أولاً لتجنب انهيار التطبيق
        try {
          const studentResult = JSON.parse(textData);
          // 💉 دعم كل الصيغ لتجنب أي خطأ
          if ((studentResult.success || studentResult.status === "success") && studentResult.data) {
            finalData = { ...studentResult.data };
          }
        } catch (e) {
          console.error("خطأ في قراءة بيانات الطالب:", textData);
        }
      }

      if (!finalData) return null; // لا يمكن الدخول بدون بيانات الطالب

      // 2. معالجة بيانات ولي الأمر (الفرسان)
      if (parentResponse) {
        const textData = await parentResponse.text();
        try {
          const parentResult = JSON.parse(textData);
          if (parentResult.status === "success" && parentResult.subjects) {
            let allBehaviors: any[] = [];
            let totalKnights = 0;

            parentResult.subjects.forEach((subject: any) => {
              totalKnights += Number(subject.totalPoints) || 0;
              if (subject.behaviors && Array.isArray(subject.behaviors)) {
                allBehaviors = allBehaviors.concat(subject.behaviors);
              }
            });
            
            finalData.behavior = allBehaviors;
            finalData.totalKnightsPoints = totalKnights;
          } else {
            finalData.behavior = []; 
            finalData.totalKnightsPoints = 0;
          }
        } catch (e) {
          console.error("خطأ في قراءة بيانات ولي الأمر:", textData);
          finalData.behavior = []; 
          finalData.totalKnightsPoints = 0;
        }
      } else {
        finalData.behavior = []; 
        finalData.totalKnightsPoints = 0;
      }

      return finalData;
    } catch (error) {
      console.error("Merge Fetch Error:", error);
      return null;
    }
  };

  const refreshData = async () => {
    if (!activeSecretCodeRef.current) return;
    const mergedData = await fetchAndMergeData(activeSecretCodeRef.current);
    if (mergedData) {
      setStudentData(mergedData);
    }
  };

  useEffect(() => {
    if (studentData) {
      // 💉 حفظ الكود السري الحالي للاعتماد عليه في التحديث التلقائي
      activeSecretCodeRef.current = studentData.rasedId || studentData.secretCode || studentData.civilId || activeSecretCodeRef.current;
      const interval = setInterval(() => { refreshData(); }, 60000); 
      return () => clearInterval(interval);
    } else {
      activeSecretCodeRef.current = null;
    }
  }, [studentData]);

  const login = async (secretCode: string): Promise<boolean> => {
    setLoading(true);
    try {
      const mergedData = await fetchAndMergeData(secretCode);

      if (mergedData) {
        setStudentData(mergedData);
        // 💉 تخزين الكود السري في الذاكرة لتسهيل الدخول القادم
        localStorage.setItem('last_secret_code', secretCode.trim().toUpperCase()); 
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
    activeSecretCodeRef.current = null;
  };

  const t = (key: string) => {
    const translations: any = {
      'rasedApp': 'راصد نسخة الطلبة',
      'studentEdition': 'نسخة الطالب',
      'welcomeBack': 'مرحباً بك',
      'enterCivilIdToStart': 'أدخل كود راصد السري للبدء', // 💉 تعديل الترجمة
      'startAdventure': 'تسجيل الدخول',
      'civilIdPlaceholder': 'مثال: RSD-A7X9', // 💉 تعديل الترجمة
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

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

// 🌐 1. رابط الـ Web App الخاص بشيت الطالب
const STUDENT_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec';

// 🌐 2. رابط الـ Web App الخاص بشيت ولي الأمر
const PARENT_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzKPPsQsM_dIttcYSxRLs6LQuvXhT6Qia5TwJ1Tw4ObQ-eZFZeJhV6epXXjxA9_SwWk/exec';

interface AppContextType {
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
  studentData: any;
  loading: boolean;
  login: (secretCode: string) => Promise<boolean>;
  logout: () => void;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const normalizeGameQuestions = (data: any) => {
  if (!data) return [];

  if (Array.isArray(data.gameQuestions)) return data.gameQuestions;
  if (Array.isArray(data.gamesQuestions)) return data.gamesQuestions;
  if (Array.isArray(data.questions)) return data.questions;

  return [];
};

const readLocalGameQuestions = (student: any, secretCode?: string) => {
  const possibleKeys = [
    `rased_game_questions_${student?.civilId || ''}`,
    `rased_game_questions_${student?.rasedId || ''}`,
    `rased_game_questions_${student?.id || ''}`,
    `rased_game_questions_${secretCode || ''}`,
    'rased_game_questions_default',
    'rased_game_questions'
  ].filter(Boolean);

  let localQuestions: any[] = [];

  try {
    localQuestions = possibleKeys.flatMap(key => {
      const raw = localStorage.getItem(key);
      if (!raw) return [];

      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    });
  } catch {
    localQuestions = [];
  }

  return localQuestions;
};

const uniqueQuestionsById = (questions: any[]) => {
  const map = new Map<string, any>();

  questions.forEach((question, index) => {
    if (!question) return;

    const id = String(question.id || `local_question_${index}`);

    map.set(id, {
      ...question,
      id,
      active: question.active !== false
    });
  });

  return Array.from(map.values());
};

const prepareStudentData = (data: any, secretCode?: string) => {
  if (!data) return null;

  const directGameQuestions = normalizeGameQuestions(data);
  const localGameQuestions = readLocalGameQuestions(data, secretCode);

  const gameQuestions = uniqueQuestionsById([
    ...directGameQuestions,
    ...localGameQuestions
  ]).filter(q => q && q.active !== false);

  const prepared = {
    ...data,

    grades: Array.isArray(data.grades) ? data.grades : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    resources: Array.isArray(data.resources) ? data.resources : [],
    behaviors: Array.isArray(data.behaviors) ? data.behaviors : [],
    behavior: Array.isArray(data.behavior) ? data.behavior : [],
    teacherReplies: Array.isArray(data.teacherReplies) ? data.teacherReplies : [],

    gameQuestions
  };

  const studentKey =
    prepared.rasedId ||
    prepared.secretCode ||
    prepared.civilId ||
    secretCode ||
    'default';

  try {
    localStorage.setItem(
      `rased_game_questions_${String(studentKey).trim().toUpperCase()}`,
      JSON.stringify(gameQuestions)
    );
  } catch {
    // تجاهل أخطاء التخزين المحلي
  }

  return prepared;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dir] = useState<'rtl' | 'ltr'>('rtl');

  const activeSecretCodeRef = useRef<string | null>(null);

  const fetchAndMergeData = async (secretCode: string) => {
    try {
      const sanitizedCode = secretCode.trim().toUpperCase();
      const cacheBuster = new Date().getTime();

      const fetchOptions: RequestInit = {
        method: 'GET',
        redirect: 'follow'
      };

      const [studentResponse, parentResponse] = await Promise.all([
        fetch(
          `${STUDENT_SCRIPT_URL}?code=${encodeURIComponent(sanitizedCode)}&t=${cacheBuster}`,
          fetchOptions
        ).catch(() => null),

        fetch(
          `${PARENT_SCRIPT_URL}?code=${encodeURIComponent(sanitizedCode)}&t=${cacheBuster}`,
          fetchOptions
        ).catch(() => null)
      ]);

      let finalData: any = null;

      // 1. معالجة بيانات الطالب
      if (studentResponse) {
        const textData = await studentResponse.text();

        try {
          const studentResult = JSON.parse(textData);

          if (
            (studentResult.success || studentResult.status === 'success') &&
            studentResult.data
          ) {
            finalData = { ...studentResult.data };
          }
        } catch (e) {
          console.error('خطأ في قراءة بيانات الطالب:', textData);
        }
      }

      if (!finalData) return null;

      // 2. ضمان وجود أسئلة الألعاب مباشرة من استجابة الطالب
      finalData.gameQuestions = normalizeGameQuestions(finalData);

      // 3. معالجة بيانات ولي الأمر
      if (parentResponse) {
        const textData = await parentResponse.text();

        try {
          const parentResult = JSON.parse(textData);

          if (parentResult.status === 'success' && parentResult.subjects) {
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
          console.error('خطأ في قراءة بيانات ولي الأمر:', textData);
          finalData.behavior = [];
          finalData.totalKnightsPoints = 0;
        }
      } else {
        finalData.behavior = [];
        finalData.totalKnightsPoints = 0;
      }

      // 4. تجهيز نهائي يحافظ على gameQuestions
      return prepareStudentData(finalData, sanitizedCode);
    } catch (error) {
      console.error('Merge Fetch Error:', error);
      return null;
    }
  };

  const refreshData = async () => {
    if (!activeSecretCodeRef.current) return;

    const mergedData = await fetchAndMergeData(activeSecretCodeRef.current);

    if (mergedData) {
      setStudentData((prev: any) => {
        const previousQuestions = Array.isArray(prev?.gameQuestions)
          ? prev.gameQuestions
          : [];

        const incomingQuestions = Array.isArray(mergedData.gameQuestions)
          ? mergedData.gameQuestions
          : [];

        return {
          ...mergedData,
          gameQuestions: uniqueQuestionsById([
            ...previousQuestions,
            ...incomingQuestions
          ])
        };
      });
    }
  };

  useEffect(() => {
    if (studentData) {
      activeSecretCodeRef.current =
        studentData.rasedId ||
        studentData.secretCode ||
        studentData.civilId ||
        activeSecretCodeRef.current;

      const interval = setInterval(() => {
        refreshData();
      }, 60000);

      return () => clearInterval(interval);
    } else {
      activeSecretCodeRef.current = null;
    }
  }, [studentData]);

  const login = async (secretCode: string): Promise<boolean> => {
    setLoading(true);

    try {
      const sanitizedCode = secretCode.trim().toUpperCase();
      const mergedData = await fetchAndMergeData(sanitizedCode);

      if (mergedData) {
        setStudentData(mergedData);
        activeSecretCodeRef.current =
          mergedData.rasedId ||
          mergedData.secretCode ||
          mergedData.civilId ||
          sanitizedCode;

        localStorage.setItem('last_secret_code', sanitizedCode);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login Error:', error);
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
      rasedApp: 'راصد نسخة الطلبة',
      studentEdition: 'نسخة الطالب',
      welcomeBack: 'مرحباً بك',
      enterCivilIdToStart: 'أدخل كود راصد السري للبدء',
      startAdventure: 'تسجيل الدخول',
      civilIdPlaceholder: 'مثال: RSD-A7X9',

      navHome: 'الرئيسية',
      navSchedule: 'الجدول',
      navTasks: 'مهامي',
      navGrades: 'إتقاني',
      navLibrary: 'مكتبتي',
      navGames: 'ألعابي',

      studentGames: 'ألعابي التعليمية',
      studentGamesSubtitle: 'راجع دروسك من خلال ألعاب قصيرة وممتعة 🎮',

      mySchedule: 'الجدول الدراسي',
      scheduleSubtitle: 'جدول الحصص الأسبوعي',
      noClasses: 'لا توجد حصص مضافة',
      editSchedule: 'تعديل الجدول',

      myQuests: 'مهامي الدراسية',
      pendingTasks: 'قيد الإنجاز',
      completedTasks: 'المكتملة',
      completionRate: 'نسبة الإنجاز',

      welcome: 'أهلاً بك،',
      semester1: 'الفصل الدراسي الأول',
      semester2: 'الفصل الدراسي الثاني',
      logout: 'تسجيل الخروج',
      class: 'الصف:'
    };

    return translations[key] || key;
  };

  return (
    <AppContext.Provider
      value={{
        t,
        dir,
        studentData,
        loading,
        login,
        logout,
        refreshData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
};

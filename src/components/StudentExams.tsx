import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  GraduationCap,
  ListChecks,
  Lock,
  Play,
  RotateCcw,
  Send,
  TimerReset,
  XCircle,
} from 'lucide-react';

export type ExamType = string;
export type ExamStatus = 'draft' | 'scheduled' | 'published' | 'closed' | 'archived';
export type ExamQuestionType = 'multiple_choice' | 'true_false' | 'match' | 'sequence';
export type ExamDifficulty = 'easy' | 'medium' | 'hard';
export type ExamGradingMode = 'whole_question' | 'per_item';
export type StudentExamSection = 'available' | 'in_progress' | 'completed' | 'closed';

export interface PublishedExamQuestion {
  id: string;
  sourceQuestionId: string;
  question: string;
  questionType: ExamQuestionType;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  correctOrderedItems?: string[];
  correctMatchedPairs?: Record<string, string>;
  explanation?: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  difficulty?: ExamDifficulty;
  grade: number;
  gradingMode: ExamGradingMode;
  itemGrade?: number;
  order: number;
}

export interface RasedExam {
  id: string;
  title: string;
  examType: ExamType;
  status: ExamStatus;
  questionIds: string[];
  questionCount: number;
  maximumGrade: number;
  schoolCode: string;
  teacherId: string;
  classIds: string[];
  subject?: string;
  units?: string[];
  lessons?: string[];
  instructions?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowPreviousQuestion: boolean;
  showResultImmediately: boolean;
  durationMinutes?: number;
  maxAttempts: number;
  visibleFrom: string;
  visibleUntil?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishBatchId?: string;
  questionsSnapshot: PublishedExamQuestion[];
}

export interface StudentExamAnswer {
  questionId: string;
  selectedAnswer?: string;
  selectedAnswerIndex?: number;
  orderedItems?: string[];
  matchedPairs?: Record<string, string>;
  isAnswered: boolean;
  isCorrect?: boolean;
  maximumGrade: number;
  earnedGrade: number;
  answeredAt?: string;
}

export interface StudentExamProgress {
  id: string;
  examId: string;
  studentId: string;
  attemptNumber: number;
  status: 'in_progress' | 'submitted' | 'expired';
  questionOrder: string[];
  optionOrderByQuestionId: Record<string, number[]>;
  currentQuestionIndex: number;
  answers: StudentExamAnswer[];
  startedAt: string;
  lastSavedAt: string;
  expiresAt?: string;
  submittedAt?: string;
}

export interface StudentExamResult {
  id: string;
  examId: string;
  examType: ExamType;
  studentId: string;
  attemptNumber: number;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  earnedGrade: number;
  maximumGrade: number;
  percentage: number;
  answers: StudentExamAnswer[];
  weakQuestionIds: string[];
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  completed: boolean;
  syncStatus: 'pending' | 'synced' | 'failed';
}

export interface StudentExamsProps {
  studentId?: string;
  studentName?: string;
  studentClassIds?: string[];
  schoolCode?: string;
  exams?: RasedExam[];
  onResultSubmit?: (result: StudentExamResult) => Promise<void> | void;
  onRefreshExams?: () => Promise<RasedExam[] | void> | RasedExam[] | void;
}

const EXAMS_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec';

const STORAGE_KEYS = {
  receivedExams: 'rased_student_received_exams_v1',
  teacherLocalExams: 'rased_teacher_exams_v1',
  progress: 'rased_student_exam_progress_v1',
  results: 'rased_student_exam_results_v1',
} as const;

const LEGACY_EXAM_TYPE_LABELS: Record<string, string> = {
  short_exam_1: 'الاختبار القصير الأول',
  short_exam_2: 'الاختبار القصير الثاني',
  final_exam: 'الاختبار النهائي',
};
const getExamTypeLabel = (type?: string) => LEGACY_EXAM_TYPE_LABELS[String(type || '')] || String(type || 'اختبار');

const nowIso = () => new Date().toISOString();

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => safeRead(key, fallback));
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Failed to save ${key}`, error);
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function shuffleOnce<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function deduplicateExams(exams: RasedExam[]): RasedExam[] {
  const map = new Map<string, RasedExam>();
  exams.forEach((exam) => {
    if (!exam?.id || !exam?.title) return;
    const previous = map.get(exam.id);
    const previousTime = new Date(previous?.updatedAt || previous?.createdAt || 0).getTime();
    const nextTime = new Date(exam.updatedAt || exam.createdAt || 0).getTime();
    if (!previous || nextTime >= previousTime) map.set(exam.id, exam);
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.visibleFrom || b.createdAt).getTime() - new Date(a.visibleFrom || a.createdAt).getTime(),
  );
}

function formatDateTime(value?: string) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-OM', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function Badge({
  children,
  tone = 'slate',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function EmptyState({ title, details }: { title: string; details: string }) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="mb-3 rounded-2xl bg-blue-50 p-4"><BookOpen className="h-8 w-8 text-blue-600" /></div>
      <h2 className="font-black text-slate-800">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">{details}</p>
    </div>
  );
}

export default function StudentExams({
  studentId = localStorage.getItem('rased_student_id') || 'student_local',
  studentName = localStorage.getItem('rased_student_name') || '',
  studentClassIds = [],
  schoolCode,
  exams: suppliedExams,
  onResultSubmit,
  onRefreshExams,
}: StudentExamsProps) {
  const [receivedExams, setReceivedExams] = useLocalStorageState<RasedExam[]>(STORAGE_KEYS.receivedExams, []);
  const [progressList, setProgressList] = useLocalStorageState<StudentExamProgress[]>(STORAGE_KEYS.progress, []);
  const [results, setResults] = useLocalStorageState<StudentExamResult[]>(STORAGE_KEYS.results, []);
  const [section, setSection] = useState<StudentExamSection>('available');
  const [screen, setScreen] = useState<'list' | 'intro' | 'solve' | 'review' | 'result' | 'answer_review'>('list');
  const [activeExamId, setActiveExamId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoSubmitRef = useRef<string | null>(null);
  const effectiveRefreshExams = onRefreshExams || (async () => {
    const response = await fetch(EXAMS_CLOUD_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'getStudentExams',
        schoolCode: schoolCode || '',
        studentId,
        className: studentClassIds[0] || '',
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'فشل جلب الاختبارات.');
    return Array.isArray(payload?.data) ? payload.data : [];
  });
  const effectiveResultSubmit = onResultSubmit || (async (result: StudentExamResult) => {
    const response = await fetch(EXAMS_CLOUD_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'studentExamResult',
        schoolCode: schoolCode || '',
        studentId,
        studentName,
        className: studentClassIds[0] || '',
        examResult: result,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'فشل إرسال نتيجة الاختبار.');
  });

  async function notifyNewExams(exams: RasedExam[]) {
    const key = `rased_student_known_exam_ids_v1_${studentId}`;
    const knownIds = safeRead<string[]>(key, []);
    const newExams = exams.filter((exam) => exam?.id && !knownIds.includes(exam.id) && exam.status === 'published');
    const nextIds = Array.from(new Set([...knownIds, ...exams.map((exam) => exam.id).filter(Boolean)]));
    window.localStorage.setItem(key, JSON.stringify(nextIds));
    if (newExams.length === 0 || !Capacitor.isNativePlatform()) return;
    try {
      let permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: newExams.slice(0, 5).map((exam, index) => ({
          id: Math.abs(Array.from(`${exam.id}_${Date.now()}_${index}`).reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) | 0, 7)),
          title: 'اختبار جديد في راصد',
          body: `${exam.title}${exam.subject ? ` - ${exam.subject}` : ''}`,
          schedule: { at: new Date(Date.now() + 1500 + (index * 500)) },
          extra: { page: 'exams', examId: exam.id },
        })),
      });
    } catch (error) {
      console.error('Failed to show exam notification', error);
    }
  }


  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    void refreshExams();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshExams();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshExams();
    }, 180000);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [studentId, schoolCode, studentClassIds.join('|')]);

  useEffect(() => {
    if (suppliedExams?.length) {
      setReceivedExams((current) => deduplicateExams([...current, ...suppliedExams]));
      return;
    }
    // يفيد في الاختبار المحلي عندما يعمل راصد المعلم والطالب في نفس بيئة المتصفح.
    const teacherLocalExams = safeRead<RasedExam[]>(STORAGE_KEYS.teacherLocalExams, []);
    if (teacherLocalExams.length) {
      setReceivedExams((current) => deduplicateExams([...current, ...teacherLocalExams]));
    }
  }, [suppliedExams, setReceivedExams]);

  const allExams = useMemo(() => deduplicateExams([...(suppliedExams || []), ...receivedExams]), [suppliedExams, receivedExams]);

  const eligibleExams = useMemo(() => allExams.filter((exam) => {
    if (schoolCode && exam.schoolCode && exam.schoolCode !== schoolCode) return false;
    if (studentClassIds.length && exam.classIds?.length) {
      const targetsStudent = exam.classIds.some((classId) => studentClassIds.includes(classId));
      if (!targetsStudent) return false;
    }
    return exam.status === 'published' || exam.status === 'closed' || exam.status === 'archived';
  }), [allExams, schoolCode, studentClassIds]);

  const activeExam = eligibleExams.find((exam) => exam.id === activeExamId);
  const activeProgress = progressList.find(
    (progress) => progress.examId === activeExamId && progress.studentId === studentId && progress.status === 'in_progress',
  );
  const activeResult = results
    .filter((result) => result.examId === activeExamId && result.studentId === studentId)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  function getAttempts(examId: string) {
    return results.filter((result) => result.examId === examId && result.studentId === studentId);
  }

  function getExamSection(exam: RasedExam): StudentExamSection {
    const progress = progressList.find(
      (item) => item.examId === exam.id && item.studentId === studentId && item.status === 'in_progress',
    );
    if (progress) return 'in_progress';

    const attempts = getAttempts(exam.id);
    if (attempts.length > 0) return 'completed';

    const visibleFrom = new Date(exam.visibleFrom).getTime();
    const visibleUntil = exam.visibleUntil ? new Date(exam.visibleUntil).getTime() : undefined;
    const closedByTime = visibleUntil !== undefined && visibleUntil <= now;
    const notOpenYet = Number.isFinite(visibleFrom) && visibleFrom > now;
    if (exam.status === 'closed' || exam.status === 'archived' || closedByTime || notOpenYet) return 'closed';
    return 'available';
  }

  const sectionExams = eligibleExams.filter((exam) => getExamSection(exam) === section);

  async function refreshExams() {
    try {
      setIsRefreshing(true);
      const refreshed = await effectiveRefreshExams();
      if (Array.isArray(refreshed)) {
        await notifyNewExams(refreshed);
        setReceivedExams((current) => deduplicateExams([...current, ...refreshed]));
      }
    } catch (error) {
      console.error('Failed to refresh exams', error);
      setMessage('تعذر تحديث الاختبارات الآن. ما زالت النسخة المحفوظة متاحة.');
    } finally {
      setIsRefreshing(false);
    }
  }

  function openExam(exam: RasedExam) {
    setActiveExamId(exam.id);
    const progress = progressList.find(
      (item) => item.examId === exam.id && item.studentId === studentId && item.status === 'in_progress',
    );
    if (progress) {
      setScreen('solve');
      return;
    }
    const attempts = getAttempts(exam.id);
    if (attempts.length >= exam.maxAttempts) {
      setScreen('result');
      return;
    }
    setScreen('intro');
  }

  function startExam() {
    if (!activeExam) return;
    const existing = progressList.find(
      (item) => item.examId === activeExam.id && item.studentId === studentId && item.status === 'in_progress',
    );
    if (existing) {
      setScreen('solve');
      return;
    }

    const attempts = getAttempts(activeExam.id);
    if (attempts.length >= activeExam.maxAttempts) {
      setMessage('لقد استُخدمت جميع المحاولات المتاحة لهذا الاختبار.');
      setScreen('result');
      return;
    }

    const questionIds = activeExam.questionsSnapshot.map((question) => question.id);
    const questionOrder = activeExam.shuffleQuestions ? shuffleOnce(questionIds) : questionIds;
    const optionOrderByQuestionId: Record<string, number[]> = {};

    activeExam.questionsSnapshot.forEach((question) => {
      const indexes = (question.options || []).map((_, index) => index);
      optionOrderByQuestionId[question.id] = activeExam.shuffleOptions ? shuffleOnce(indexes) : indexes;
    });

    const startedAt = nowIso();
    const progress: StudentExamProgress = {
      id: `${activeExam.id}_${studentId}_${attempts.length + 1}`,
      examId: activeExam.id,
      studentId,
      attemptNumber: attempts.length + 1,
      status: 'in_progress',
      questionOrder,
      optionOrderByQuestionId,
      currentQuestionIndex: 0,
      answers: activeExam.questionsSnapshot.map((question) => ({
        questionId: question.id,
        isAnswered: false,
        maximumGrade: question.grade,
        earnedGrade: 0,
      })),
      startedAt,
      lastSavedAt: startedAt,
      expiresAt: activeExam.durationMinutes
        ? new Date(Date.now() + activeExam.durationMinutes * 60_000).toISOString()
        : undefined,
    };

    setProgressList((current) => [...current, progress]);
    setScreen('solve');
  }

  function updateActiveProgress(update: (progress: StudentExamProgress) => StudentExamProgress) {
    if (!activeProgress) return;
    setProgressList((current) => current.map((progress) => (
      progress.id === activeProgress.id
        ? update({ ...progress, lastSavedAt: nowIso() })
        : progress
    )));
  }

  function selectAnswer(questionId: string, selectedAnswerIndex: number) {
    if (!activeExam) return;
    const question = activeExam.questionsSnapshot.find((item) => item.id === questionId);
    if (!question) return;
    updateActiveProgress((progress) => ({
      ...progress,
      answers: progress.answers.map((answer) => answer.questionId === questionId
        ? {
            ...answer,
            selectedAnswerIndex,
            selectedAnswer: question.options?.[selectedAnswerIndex],
            isAnswered: true,
            answeredAt: nowIso(),
          }
        : answer),
    }));
  }

  function calculateCorrectness(question: PublishedExamQuestion, answer: StudentExamAnswer) {
    if (!answer.isAnswered) return { isCorrect: false, earnedGrade: 0 };

    if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
      const isCorrect = answer.selectedAnswerIndex === question.correctAnswerIndex;
      return { isCorrect, earnedGrade: isCorrect ? question.grade : 0 };
    }

    if (question.questionType === 'sequence') {
      const expected = question.correctOrderedItems || [];
      const actual = answer.orderedItems || [];
      const correctItems = expected.filter((item, index) => item === actual[index]).length;
      if (question.gradingMode === 'per_item' && expected.length > 0) {
        const itemGrade = question.itemGrade ?? question.grade / expected.length;
        const earnedGrade = Math.min(question.grade, Number((correctItems * itemGrade).toFixed(2)));
        return { isCorrect: correctItems === expected.length, earnedGrade };
      }
      const isCorrect = expected.length > 0 && correctItems === expected.length;
      return { isCorrect, earnedGrade: isCorrect ? question.grade : 0 };
    }

    const expected = question.correctMatchedPairs || {};
    const actual = answer.matchedPairs || {};
    const keys = Object.keys(expected);
    const correctItems = keys.filter((key) => actual[key] === expected[key]).length;
    if (question.gradingMode === 'per_item' && keys.length > 0) {
      const itemGrade = question.itemGrade ?? question.grade / keys.length;
      const earnedGrade = Math.min(question.grade, Number((correctItems * itemGrade).toFixed(2)));
      return { isCorrect: correctItems === keys.length, earnedGrade };
    }
    const isCorrect = keys.length > 0 && correctItems === keys.length;
    return { isCorrect, earnedGrade: isCorrect ? question.grade : 0 };
  }

  async function submitExam(reason: 'student' | 'time' = 'student') {
    if (!activeExam || !activeProgress) return;
    const submittedAt = nowIso();

    const correctedAnswers = activeProgress.answers.map((answer) => {
      const question = activeExam.questionsSnapshot.find((item) => item.id === answer.questionId);
      if (!question) return answer;
      const correction = calculateCorrectness(question, answer);
      return { ...answer, ...correction };
    });

    const answeredQuestions = correctedAnswers.filter((answer) => answer.isAnswered).length;
    const correctAnswers = correctedAnswers.filter((answer) => answer.isCorrect).length;
    const earnedGrade = Number(correctedAnswers.reduce((sum, answer) => sum + answer.earnedGrade, 0).toFixed(2));
    const maximumGrade = activeExam.maximumGrade || activeExam.questionsSnapshot.reduce((sum, question) => sum + question.grade, 0);

    const result: StudentExamResult = {
      id: `${activeExam.id}_${studentId}_${activeProgress.attemptNumber}`,
      examId: activeExam.id,
      examType: activeExam.examType,
      studentId,
      attemptNumber: activeProgress.attemptNumber,
      totalQuestions: activeExam.questionCount,
      answeredQuestions,
      correctAnswers,
      wrongAnswers: correctedAnswers.filter((answer) => answer.isAnswered && !answer.isCorrect).length,
      unansweredQuestions: activeExam.questionCount - answeredQuestions,
      earnedGrade,
      maximumGrade,
      percentage: maximumGrade > 0 ? Number(((earnedGrade / maximumGrade) * 100).toFixed(2)) : 0,
      answers: correctedAnswers,
      weakQuestionIds: correctedAnswers.filter((answer) => !answer.isCorrect).map((answer) => answer.questionId),
      startedAt: activeProgress.startedAt,
      submittedAt,
      durationSeconds: Math.max(0, Math.floor((new Date(submittedAt).getTime() - new Date(activeProgress.startedAt).getTime()) / 1000)),
      completed: true,
      syncStatus: 'pending',
    };

    setResults((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== result.id);
      return [...withoutDuplicate, result];
    });
    setProgressList((current) => current.map((progress) => progress.id === activeProgress.id
      ? { ...progress, status: reason === 'time' ? 'expired' : 'submitted', submittedAt, lastSavedAt: submittedAt }
      : progress));

    try {
        await effectiveResultSubmit(result);
        setResults((current) => current.map((item) => item.id === result.id ? { ...item, syncStatus: 'synced' } : item));
      } catch (error) {
        console.error('Failed to submit exam result', error);
        setResults((current) => current.map((item) => item.id === result.id ? { ...item, syncStatus: 'failed' } : item));
        setMessage('تم حفظ النتيجة على الجهاز، وستُعاد محاولة إرسالها عند توفر الاتصال.');
      }

    setScreen('result');
  }

  const remainingSeconds = activeProgress?.expiresAt
    ? Math.max(0, Math.floor((new Date(activeProgress.expiresAt).getTime() - now) / 1000))
    : null;

  useEffect(() => {
    if (!activeExam || !activeProgress || remainingSeconds !== 0) return;
    if (autoSubmitRef.current === activeProgress.id) return;
    autoSubmitRef.current = activeProgress.id;
    void submitExam('time');
  }, [remainingSeconds, activeExam?.id, activeProgress?.id]);

  function backToList(targetSection?: StudentExamSection) {
    setActiveExamId(null);
    setScreen('list');
    if (targetSection) setSection(targetSection);
  }

  if (activeExam && screen === 'intro') {
    const attemptsUsed = getAttempts(activeExam.id).length;
    return (
      <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-gradient-to-b from-blue-50 to-slate-50 p-4 pb-28 sm:p-7">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl shadow-blue-100 sm:p-8">
          <button type="button" onClick={() => backToList()} className="mb-6 flex items-center gap-1 text-sm font-black text-slate-500">
            <ChevronRight className="h-4 w-4" /> العودة إلى الاختبارات
          </button>
          <Badge tone="blue">{getExamTypeLabel(activeExam.examType)}</Badge>
          <h1 className="mt-4 text-3xl font-black text-slate-900">{activeExam.title}</h1>
          <p className="mt-2 font-bold text-slate-500">{activeExam.subject || 'اختبار متعدد المواد'}</p>

          <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-center"><strong className="block text-xl">{activeExam.questionCount}</strong><span className="text-xs text-slate-500">سؤال</span></div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center"><strong className="block text-xl">{activeExam.maximumGrade}</strong><span className="text-xs text-slate-500">الدرجة النهائية</span></div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center"><strong className="block text-xl">{activeExam.durationMinutes || '∞'}</strong><span className="text-xs text-slate-500">دقيقة</span></div>
            <div className="rounded-2xl bg-slate-50 p-4 text-center"><strong className="block text-xl">{activeExam.maxAttempts - attemptsUsed}</strong><span className="text-xs text-slate-500">محاولة متبقية</span></div>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4">
            <h2 className="font-black text-amber-900">تعليمات المعلم</h2>
            <p className="mt-2 text-sm font-bold leading-7 text-amber-800">{activeExam.instructions || 'لا توجد تعليمات إضافية.'}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 p-4 text-sm font-bold text-slate-600">
            <p>يبدأ احتساب المحاولة والمؤقت بعد الضغط على «بدء الاختبار» فقط.</p>
            <p className="mt-1">إغلاق التطبيق والعودة لا ينشئ محاولة جديدة.</p>
          </div>

          <button type="button" onClick={startExam} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white shadow-lg shadow-blue-200">
            <Play className="h-5 w-5" /> بدء الاختبار
          </button>
        </div>
      </div>
    );
  }

  if (activeExam && activeProgress && screen === 'solve') {
    const questionId = activeProgress.questionOrder[activeProgress.currentQuestionIndex];
    const question = activeExam.questionsSnapshot.find((item) => item.id === questionId);
    if (!question) return <EmptyState title="تعذر فتح السؤال" details="بيانات السؤال غير مكتملة في النسخة المنشورة." />;
    const answer = activeProgress.answers.find((item) => item.questionId === question.id);
    const optionOrder = activeProgress.optionOrderByQuestionId[question.id] || (question.options || []).map((_, index) => index);
    const progressPercentage = activeExam.questionCount > 0
      ? ((activeProgress.currentQuestionIndex + 1) / activeExam.questionCount) * 100
      : 0;

    return (
      <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-3 pb-28 sm:p-7">
        <div className="mx-auto max-w-4xl">
          <header className="mb-4 rounded-3xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-blue-600">{activeExam.title}</p>
                <h1 className="mt-1 font-black">السؤال {activeProgress.currentQuestionIndex + 1} من {activeExam.questionCount}</h1>
              </div>
              {remainingSeconds !== null && (
                <div className={`flex items-center gap-2 rounded-2xl px-4 py-2 font-black ${remainingSeconds < 60 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                  <Clock3 className="h-4 w-4" /> {formatDuration(remainingSeconds)}
                </div>
              )}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercentage}%` }} />
            </div>
          </header>

          <main className="rounded-3xl bg-white p-5 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-black leading-9 text-slate-900 sm:text-2xl">{question.question}</h2>
              <Badge tone="violet">{question.grade} {question.grade === 1 ? 'درجة' : 'درجات'}</Badge>
            </div>

            {(question.questionType === 'multiple_choice' || question.questionType === 'true_false') ? (
              <div className="mt-7 grid gap-3">
                {optionOrder.map((originalIndex) => (
                  <button
                    key={originalIndex}
                    type="button"
                    onClick={() => selectAnswer(question.id, originalIndex)}
                    className={`rounded-2xl border p-4 text-right font-black transition ${answer?.selectedAnswerIndex === originalIndex ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <span className={`ml-3 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${answer?.selectedAnswerIndex === originalIndex ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>
                      {optionOrder.indexOf(originalIndex) + 1}
                    </span>
                    {question.options?.[originalIndex]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-900">
                <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                <p className="font-black">هذا النوع سيُفعّل في المرحلة التالية</p>
                <p className="mt-1 text-sm font-bold">النسخة الأولى تدعم الاختيار من متعدد والصواب والخطأ.</p>
              </div>
            )}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={!activeExam.allowPreviousQuestion || activeProgress.currentQuestionIndex === 0}
                onClick={() => updateActiveProgress((progress) => ({ ...progress, currentQuestionIndex: progress.currentQuestionIndex - 1 }))}
                className="flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-3 font-black disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" /> السابق
              </button>
              {activeProgress.currentQuestionIndex < activeExam.questionCount - 1 ? (
                <button
                  type="button"
                  onClick={() => updateActiveProgress((progress) => ({ ...progress, currentQuestionIndex: progress.currentQuestionIndex + 1 }))}
                  className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-black text-white"
                >
                  التالي <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <button type="button" onClick={() => setScreen('review')} className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white">
                  مراجعة وتسليم <ListChecks className="h-5 w-5" />
                </button>
              )}
            </div>
          </main>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {activeProgress.questionOrder.map((id, index) => {
              const item = activeProgress.answers.find((entry) => entry.questionId === id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateActiveProgress((progress) => ({ ...progress, currentQuestionIndex: index }))}
                  className={`h-10 w-10 rounded-xl text-sm font-black ${index === activeProgress.currentQuestionIndex ? 'bg-blue-600 text-white' : item?.isAnswered ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500'}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs font-bold text-slate-400">آخر حفظ: {formatDateTime(activeProgress.lastSavedAt)}</p>
        </div>
      </div>
    );
  }

  if (activeExam && activeProgress && screen === 'review') {
    const answered = activeProgress.answers.filter((answer) => answer.isAnswered).length;
    const unansweredIndexes = activeProgress.questionOrder
      .map((id, index) => activeProgress.answers.find((answer) => answer.questionId === id)?.isAnswered ? null : index)
      .filter((value): value is number => value !== null);

    return (
      <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-4 pb-28 sm:p-7">
        <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black">مراجعة الاختبار</h1>
          <p className="mt-2 font-bold text-slate-500">تحقق من إجاباتك قبل التسليم النهائي.</p>

          <div className="my-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-5 text-center text-emerald-800"><strong className="block text-3xl">{answered}</strong><span className="text-sm font-black">تمت الإجابة</span></div>
            <div className="rounded-2xl bg-amber-50 p-5 text-center text-amber-800"><strong className="block text-3xl">{unansweredIndexes.length}</strong><span className="text-sm font-black">بلا إجابة</span></div>
          </div>

          {unansweredIndexes.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-black text-amber-900">الأسئلة غير المجابة</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {unansweredIndexes.map((index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      updateActiveProgress((progress) => ({ ...progress, currentQuestionIndex: index }));
                      setScreen('solve');
                    }}
                    className="h-10 w-10 rounded-xl bg-white font-black text-amber-800 shadow-sm"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => setScreen('solve')} className="rounded-2xl bg-slate-100 py-4 font-black">العودة للأسئلة</button>
            <button
              type="button"
              onClick={() => window.confirm('هل أنت متأكد من تسليم الاختبار نهائيًا؟ لن تتمكن من تعديل هذه المحاولة بعد التسليم.') && void submitExam('student')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 font-black text-white"
            >
              <Send className="h-5 w-5" /> تسليم الاختبار
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeExam && screen === 'result') {
    const result = activeResult;
    return (
      <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-gradient-to-b from-emerald-50 to-white p-4 pb-28 sm:p-7">
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-7 text-center shadow-xl shadow-emerald-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-10 w-10 text-emerald-600" /></div>
          <h1 className="mt-5 text-2xl font-black">{result ? 'تم تسليم الاختبار' : 'نتيجة الاختبار'}</h1>
          {message && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-800">{message}</p>}

          {result && activeExam.showResultImmediately ? (
            <>
              <p className="mt-7 text-sm font-black text-slate-500">درجتك</p>
              <div className="mt-1 text-5xl font-black text-emerald-600">
                {result.earnedGrade}<span className="text-2xl text-slate-400"> / {result.maximumGrade}</span>
              </div>
              <p className="mt-3 font-black">النسبة {result.percentage}%</p>
              <p className="mt-2 text-sm font-bold text-slate-500">مدة الحل {formatDuration(result.durationSeconds)}</p>
            </>
          ) : result ? (
            <p className="mt-5 rounded-2xl bg-blue-50 p-4 font-bold leading-7 text-blue-800">تم حفظ المحاولة. سيعرض المعلم النتيجة بعد إغلاق الاختبار وفق إعداداته.</p>
          ) : (
            <p className="mt-5 rounded-2xl bg-slate-50 p-4 font-bold text-slate-600">لا توجد محاولة قابلة للعرض.</p>
          )}

          {result?.syncStatus === 'failed' && <p className="mt-4 text-xs font-black text-amber-700">النتيجة محفوظة محليًا وتنتظر إعادة الإرسال.</p>}
          {result && <button type="button" onClick={() => setScreen('answer_review')} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-black text-white"><ListChecks className="h-5 w-5" /> مراجعة الأسئلة والإجابات</button>}
          <button type="button" onClick={() => backToList('completed')} className="mt-3 w-full rounded-2xl bg-slate-900 py-4 font-black text-white">العودة إلى الاختبارات</button>
        </div>
      </div>
    );
  }

  if (activeExam && activeResult && screen === 'answer_review') {
    return (
      <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 p-4 pb-28 sm:p-7">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between rounded-3xl bg-white p-5 shadow-sm">
            <div><p className="text-xs font-black text-blue-600">مراجعة الاختبار المنجز</p><h1 className="mt-1 text-xl font-black">{activeExam.title}</h1></div>
            <button type="button" onClick={() => setScreen('result')} className="rounded-2xl bg-slate-100 px-4 py-3 font-black text-slate-700">النتيجة</button>
          </div>
          <div className="space-y-4">
            {activeExam.questionsSnapshot.map((question, index) => {
              const answer = activeResult.answers.find((item) => item.questionId === question.id || item.questionId === question.sourceQuestionId);
              const selectedIndex = answer?.selectedAnswerIndex;
              return (
                <section key={question.id} className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-slate-400">السؤال {index + 1}</p><h2 className="mt-2 font-black leading-7">{question.question}</h2></div><Badge tone={answer?.isCorrect ? 'green' : 'red'}>{answer?.isCorrect ? 'صحيحة' : 'غير صحيحة'}</Badge></div>
                  {(question.questionType === 'multiple_choice' || question.questionType === 'true_false') && <div className="mt-4 space-y-2">{(question.options || []).map((option, optionIndex) => { const correct = optionIndex === question.correctAnswerIndex; const selected = optionIndex === selectedIndex; return <div key={optionIndex} className={`rounded-2xl border p-3 text-sm font-bold ${correct ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : selected ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><span className="ml-2">{correct ? '✓' : selected ? '✕' : '•'}</span>{option}{correct && <span className="mr-2 text-xs">الإجابة الصحيحة</span>}{selected && !correct && <span className="mr-2 text-xs">إجابتك</span>}</div>; })}</div>}
                  {question.explanation && <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold leading-7 text-blue-900"><span className="font-black">التفسير: </span>{question.explanation}</div>}
                  <p className="mt-3 text-xs font-black text-slate-500">الدرجة: {answer?.earnedGrade || 0} من {question.grade}</p>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const tabs: { id: StudentExamSection; label: string; icon: React.ElementType }[] = [
    { id: 'available', label: 'المتاحة', icon: Play },
    { id: 'in_progress', label: 'غير المكتملة', icon: TimerReset },
    { id: 'completed', label: 'المكتملة', icon: FileCheck2 },
    { id: 'closed', label: 'المغلقة', icon: Lock },
  ];

  return (
    <div dir="rtl" className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 pb-28 text-slate-900">
      <header className="bg-gradient-to-l from-indigo-700 to-blue-600 px-4 py-7 text-white sm:px-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-blue-100"><GraduationCap className="h-4 w-4" /> راصد الطالب</div>
            <h1 className="mt-2 text-3xl font-black">الاختبارات</h1>
            <p className="mt-2 text-sm font-bold text-blue-100">التجريبية للاستعداد الاختبارات الرسمية .</p>
            {studentName && <p className="mt-1 text-xs font-bold text-blue-200">الطالب: {studentName}</p>}
          </div>
          <button type="button" onClick={() => void refreshExams()} disabled={isRefreshing} className="flex items-center gap-2 rounded-2xl bg-white/15 px-4 py-3 font-black backdrop-blur disabled:opacity-50">
            <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'جاري التحديث...' : 'تحديث الاختبارات'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 sm:p-7">
        {message && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="flex-1">{message}</p>
            <button type="button" onClick={() => setMessage(null)}><XCircle className="h-5 w-5" /></button>
          </div>
        )}

        <div className="mb-6 sm:hidden">
          <label className="mb-2 block text-xs font-black text-slate-500">حالة الاختبارات</label>
          <select value={section} onChange={(event) => setSection(event.target.value as StudentExamSection)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-800 shadow-sm">
            {tabs.map(({ id, label }) => <option key={id} value={id}>{label} ({eligibleExams.filter((exam) => getExamSection(exam) === id).length})</option>)}
          </select>
        </div>
        <div className="mb-6 hidden gap-2 sm:flex sm:flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => {
            const count = eligibleExams.filter((exam) => getExamSection(exam) === id).length;
            return <button key={id} type="button" onClick={() => setSection(id)} className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black ${section === id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm'}`}><Icon className="h-4 w-4" /> {label} <span className="opacity-70">{count}</span></button>;
          })}
        </div>

        {sectionExams.length === 0 ? (
          <EmptyState
            title="لا توجد اختبارات في هذا القسم"
            details="ستظهر الاختبارات هنا عند نشرها لك، أو عند بدء محاولة، أو بعد اكتمالها وإغلاقها."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sectionExams.map((exam) => {
              const examSection = getExamSection(exam);
              const progress = progressList.find((item) => item.examId === exam.id && item.studentId === studentId && item.status === 'in_progress');
              const attempts = getAttempts(exam.id);
              const answered = progress?.answers.filter((answer) => answer.isAnswered).length || 0;
              const latestResult = attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

              return (
                <article key={exam.id} className="rounded-3xl bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="blue">{getExamTypeLabel(exam.examType)}</Badge>
                    <Badge tone={examSection === 'in_progress' ? 'amber' : examSection === 'completed' ? 'green' : examSection === 'closed' ? 'red' : 'slate'}>
                      {examSection === 'available' ? 'متاح' : examSection === 'in_progress' ? 'غير مكتمل' : examSection === 'completed' ? 'مكتمل' : 'مغلق'}
                    </Badge>
                  </div>

                  <h2 className="mt-4 text-xl font-black">{exam.title}</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">{exam.subject || 'مواد متنوعة'}</p>
                  {(exam.units?.length || exam.lessons?.length) ? (
                    <p className="mt-2 line-clamp-2 text-xs font-bold text-slate-400">{[...(exam.units || []), ...(exam.lessons || [])].join('، ')}</p>
                  ) : null}

                  <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-slate-50 p-3"><strong className="block">{exam.questionCount}</strong><span className="text-xs text-slate-500">سؤال</span></div>
                    <div className="rounded-xl bg-slate-50 p-3"><strong className="block">{exam.maximumGrade}</strong><span className="text-xs text-slate-500">درجة</span></div>
                    <div className="rounded-xl bg-slate-50 p-3"><strong className="block">{exam.durationMinutes || '∞'}</strong><span className="text-xs text-slate-500">دقيقة</span></div>
                  </div>

                  <div className="mt-4 space-y-1 text-xs font-bold text-slate-500">
                    <p>الظهور: {formatDateTime(exam.visibleFrom)}</p>
                    <p>الإغلاق: {formatDateTime(exam.visibleUntil)}</p>
                    <p>المحاولات: {attempts.length} من {exam.maxAttempts}</p>
                  </div>

                  {progress && (
                    <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-black text-amber-800">
                      لديك اختبار غير مكتمل. أجبت عن {answered} من {exam.questionCount} سؤالًا.
                    </div>
                  )}

                  {latestResult && exam.showResultImmediately && (
                    <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                      الدرجة: {latestResult.earnedGrade} من {latestResult.maximumGrade}، النسبة {latestResult.percentage}%
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={examSection === 'closed'}
                    onClick={() => openExam(exam)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 font-black text-white disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    {examSection === 'in_progress' ? <><RotateCcw className="h-4 w-4" /> متابعة الاختبار</>
                      : examSection === 'completed' ? <><FileCheck2 className="h-4 w-4" /> عرض النتيجة</>
                        : examSection === 'closed' ? <><Lock className="h-4 w-4" /> الاختبار مغلق</>
                          : <><Play className="h-4 w-4" /> ابدأ الاختبار</>}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

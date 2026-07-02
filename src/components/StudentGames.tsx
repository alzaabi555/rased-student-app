import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Gamepad2,
  Trophy,
  Star,
  Play,
  Lock,
  Timer,
  Car,
  CheckCircle2,
  Puzzle,
  ListOrdered,
  Goal,
  Sparkles,
  BookOpen,
  RotateCcw,
  Info,
  Archive
} from 'lucide-react';

import StudentSnakeLadderGame from './StudentSnakeLadderGame';
import type { SnakeLadderQuestion, SnakeLadderResult } from './StudentSnakeLadderGame';

import StudentKnowledgeRaceGame from './StudentKnowledgeRaceGame';
import type { KnowledgeRaceQuestion, KnowledgeRaceResult } from './StudentKnowledgeRaceGame';

import StudentFootballKnowledgeGame from './StudentFootballKnowledgeGame';
import type { FootballKnowledgeQuestion, FootballKnowledgeResult } from './StudentFootballKnowledgeGame';

import StudentTrueFalseGame from './StudentTrueFalseGame';
import type { TrueFalseQuestion, TrueFalseResult } from './StudentTrueFalseGame';

import StudentMatchCardsGame from './StudentMatchCardsGame';
import type { MatchCardsQuestion, MatchCardsResult } from './StudentMatchCardsGame';

import StudentSequenceOrderGame from './StudentSequenceOrderGame';
import type { SequenceOrderQuestion, SequenceOrderResult } from './StudentSequenceOrderGame';

const STUDENT_APP_URL = 'https://script.google.com/macros/s/AKfycbwMYqSpnXvlMrL6po82-XePyAWBd9FMNCTgY7WlYaOH6pn1kTazLqxEfvremqsSk_dU/exec';

// =========================================================================
// مركز ألعاب الطالب - نسخة محسنة ومهيأة لراصد ولي الأمر:
// ✅ نتائج موحدة لكل الألعاب الست
// ✅ حفظ محلي + مزامنة سحابية لنتائج تحديات اليوم
// ✅ وضع مراجعاتي يحفظ محليًا فقط ولا يرسل للمعلم
// ✅ توصية تربوية تلقائية + مستوى إتقان + تفاصيل أخطاء
// =========================================================================

export interface GameQuestion {
  id: string;
  schoolCode?: string;
  teacherId?: string;
  semester?: string;
  subject?: string;
  grade?: string;
  className?: string;
  classes?: string[];
  unit?: string;
  lesson?: string;
  gameTypes?: string[];
  questionType?: 'multiple_choice' | 'true_false' | 'matching' | 'sequence' | 'hints';
  question?: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
  status?: 'active' | 'archived' | 'review' | string;
  publishBatchId?: string;
  archivedAt?: string;
  visibleFrom?: string;
  pairs?: Array<{
    term?: string;
    definition?: string;
    left?: string;
    right?: string;
  }>;
  sequence?: string[];
}

export interface StudentGamesStudent {
  id: string;
  civilId?: string;
  rasedId?: string;
  name?: string;
  classes?: string[];
  grade?: string;
  gameQuestions?: GameQuestion[];
  reviewGameQuestions?: GameQuestion[];
}

interface StudentGamesProps {
  student: StudentGamesStudent;
  currentSemester?: '1' | '2';
}

type GameStatus = 'available' | 'needs_questions' | 'coming_soon';
type ActiveGame = 'snake_ladder' | 'knowledge_race' | 'football_quiz' | 'true_false' | 'match_cards' | 'sequence_order' | null;
type GamesMode = 'daily' | 'review';

type UnifiedGameResult =
  | SnakeLadderResult
  | KnowledgeRaceResult
  | FootballKnowledgeResult
  | TrueFalseResult
  | MatchCardsResult
  | SequenceOrderResult;

type UnifiedGameType =
  | 'snake_ladder'
  | 'knowledge_race'
  | 'football_quiz'
  | 'true_false'
  | 'match_cards'
  | 'sequence_order';

type MasteryLevel = 'excellent' | 'good' | 'needs_review' | 'needs_followup';

interface ResultCloudMeta {
  schoolCode: string;
  teacherId: string;
  className: string;
  grade: string;
  studentName: string;
}

export interface StudentGameResultLogEntry {
  id: string;
  studentId: string;
  studentName?: string;
  className?: string;
  grade?: string;
  schoolCode?: string;
  teacherId?: string;

  gameType: UnifiedGameType | string;
  gameTitle?: string;
  subject?: string;
  unit?: string;
  lesson?: string;

  score: number;
  scorePercent: number;
  totalQuestions: number;
  correct: number;
  wrong: number;
  completed: boolean;
  durationSeconds?: number;
  attemptNumber: number;

  weakQuestionIds: string[];
  wrongDetails: Array<{
    questionId: string;
    question?: string;
    subject?: string;
    unit?: string;
    lesson?: string;
    correctAnswerText?: string;
    explanation?: string;
  }>;
  masteryLevel: MasteryLevel;
  reviewRecommendation: string;

  playedAt: string;
  savedAt: string;
  syncStatus: 'local_only' | 'pending_sync' | 'synced';
  rawResult: UnifiedGameResult;
}

type GameCard = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  color: 'primary' | 'warning' | 'success' | 'info' | 'danger';
  supportedGameTypes: string[];
  supportedQuestionTypes: string[];
  status: GameStatus;
  minQuestions: number;
  estimatedTime: string;
};

type GameCardWithAvailability = GameCard & {
  questionCount: number;
};

const BASE_GAMES: Omit<GameCard, 'status'>[] = [
  {
    id: 'knowledge_race',
    title: 'سباق المعرفة',
    shortTitle: 'السباق',
    description: 'تجاوز المركبات وافتح بوابات الأسئلة لتحصل على التيربو.',
    icon: Car,
    color: 'warning',
    supportedGameTypes: ['race', 'knowledge_race'],
    supportedQuestionTypes: ['multiple_choice', 'true_false'],
    minQuestions: 1,
    estimatedTime: '3 - 5 دقائق'
  },
  {
    id: 'football_quiz',
    title: 'ركلات المعرفة',
    shortTitle: 'الكرة',
    description: 'اختر زاوية التسديد، أجب عن سؤال الحسم، وسجل الأهداف.',
    icon: Goal,
    color: 'info',
    supportedGameTypes: ['football', 'penalty', 'football_quiz'],
    supportedQuestionTypes: ['multiple_choice', 'true_false'],
    minQuestions: 1,
    estimatedTime: '3 دقائق'
  },
  {
    id: 'snake_ladder',
    title: 'السلم والثعبان',
    shortTitle: 'السلم',
    description: 'لوحة تعليمية ممتعة بأسئلة ديناميكية من المعلم.',
    icon: RotateCcw,
    color: 'primary',
    supportedGameTypes: ['snake_ladder'],
    supportedQuestionTypes: ['multiple_choice', 'true_false'],
    minQuestions: 0,
    estimatedTime: 'حسب عدد الأسئلة'
  },
  {
    id: 'true_false',
    title: 'صح أم خطأ',
    shortTitle: 'صح/خطأ',
    description: 'تحدي سريع: اختر صح أو خطأ قبل انتهاء الوقت.',
    icon: CheckCircle2,
    color: 'success',
    supportedGameTypes: ['true_false'],
    supportedQuestionTypes: ['true_false'],
    minQuestions: 1,
    estimatedTime: 'دقيقتان'
  },
  {
    id: 'match_cards',
    title: 'طابق المفهوم',
    shortTitle: 'المطابقة',
    description: 'اربط المصطلح بالتعريف الصحيح بطريقة ممتعة.',
    icon: Puzzle,
    color: 'danger',
    supportedGameTypes: ['matching', 'match_cards'],
    supportedQuestionTypes: ['matching'],
    minQuestions: 1,
    estimatedTime: '3 دقائق'
  },
  {
    id: 'sequence_order',
    title: 'رتّب الأحداث',
    shortTitle: 'الترتيب',
    description: 'رتب الأحداث أو الخطوات حسب التسلسل الصحيح.',
    icon: ListOrdered,
    color: 'primary',
    supportedGameTypes: ['sequence', 'order'],
    supportedQuestionTypes: ['sequence'],
    minQuestions: 1,
    estimatedTime: '3 دقائق'
  }
];

const GAME_TITLES: Record<string, string> = {
  snake_ladder: 'السلم والثعبان',
  knowledge_race: 'سباق المعرفة',
  football_quiz: 'ركلات المعرفة',
  true_false: 'صح أم خطأ',
  match_cards: 'طابق المفهوم',
  sequence_order: 'رتّب الأحداث'
};

const getToneClasses = (color: GameCard['color']) => {
  switch (color) {
    case 'warning':
      return { icon: 'bg-warning/10 text-warning border-warning/20', button: 'bg-warning text-white' };
    case 'success':
      return { icon: 'bg-success/10 text-success border-success/20', button: 'bg-success text-white' };
    case 'info':
      return { icon: 'bg-info/10 text-info border-info/20', button: 'bg-info text-white' };
    case 'danger':
      return { icon: 'bg-danger/10 text-danger border-danger/20', button: 'bg-danger text-white' };
    default:
      return { icon: 'bg-primary/10 text-primary border-primary/20', button: 'bg-primary text-white' };
  }
};

const getTodayKey = () => new Date().toLocaleDateString('en-CA');

const readLocalGameStats = (studentId?: string) => {
  const key = `rased_student_game_stats_${studentId || 'default'}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};

const readJsonArray = <T,>(key: string): T[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readLocalQuestionArrays = (keys: string[]) => {
  try {
    return keys.flatMap(key => {
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
    return [];
  }
};

const normalizeQuestionList = (questions: GameQuestion[], includeInactive = false) => {
  const map = new Map<string, GameQuestion>();

  questions
    .filter(q => q && q.questionType !== 'hints')
    .filter(q => includeInactive || q.active !== false)
    .forEach((question, index) => {
      const id = question.id || `question_${index}`;
      map.set(id, { ...question, id });
    });

  return Array.from(map.values());
};

const isQuestionCompatibleWithGame = (question: GameQuestion, game: Omit<GameCard, 'status'>) => {
  const byGameType = (question.gameTypes || []).some(type => game.supportedGameTypes.includes(type));
  const byQuestionType = question.questionType ? game.supportedQuestionTypes.includes(question.questionType) : false;
  return byGameType || byQuestionType;
};

const filterPlayableQuestions = (questions: GameQuestion[]) => {
  return questions.filter(question => {
    if (!question.question) return false;
    if (question.active === false) return false;
    if (question.questionType === 'true_false') return true;

    const hasOptions = Array.isArray(question.options) && question.options.length >= 2;
    const hasAnswer = typeof question.correctAnswerIndex === 'number';
    return hasOptions && hasAnswer;
  });
};

const toSharedQuizShape = (questions: GameQuestion[]) => {
  return filterPlayableQuestions(questions).map(question => ({
    id: question.id,
    subject: question.subject,
    unit: question.unit,
    lesson: question.lesson,
    questionType: question.questionType === 'true_false' ? 'true_false' : 'multiple_choice',
    question: question.question || '',
    options: question.questionType === 'true_false' ? ['صح', 'خطأ'] : question.options || [],
    correctAnswerIndex: question.correctAnswerIndex ?? 0,
    correctAnswerText: question.correctAnswerText,
    explanation: question.explanation,
    difficulty: question.difficulty,
    active: question.active
  }));
};

const toSnakeLadderQuestions = (questions: GameQuestion[]): SnakeLadderQuestion[] => {
  return toSharedQuizShape(questions) as SnakeLadderQuestion[];
};

const toKnowledgeRaceQuestions = (questions: GameQuestion[]): KnowledgeRaceQuestion[] => {
  return toSharedQuizShape(questions) as KnowledgeRaceQuestion[];
};

const toFootballKnowledgeQuestions = (questions: GameQuestion[]): FootballKnowledgeQuestion[] => {
  return toSharedQuizShape(questions) as FootballKnowledgeQuestion[];
};

const toTrueFalseQuestions = (questions: GameQuestion[]): TrueFalseQuestion[] => {
  return questions
    .filter(question => {
      if (!question.question) return false;
      if (question.active === false) return false;
      return question.questionType === 'true_false' || typeof question.correctAnswerIndex === 'number';
    })
    .map(question => ({
      id: question.id,
      subject: question.subject,
      unit: question.unit,
      lesson: question.lesson,
      questionType: 'true_false',
      question: question.question || '',
      options: ['صح', 'خطأ'],
      correctAnswerIndex: question.correctAnswerIndex ?? 0,
      correctAnswerText: question.correctAnswerText,
      explanation: question.explanation,
      difficulty: question.difficulty,
      active: question.active
    }));
};

const toMatchCardsQuestions = (questions: GameQuestion[]): MatchCardsQuestion[] => {
  return questions
    .filter(question => {
      if (question.active === false) return false;
      const hasPairs = Array.isArray(question.pairs) && question.pairs.length > 0;
      const hasSinglePair = Boolean(question.question) && Boolean(
        question.correctAnswerText ||
        (typeof question.correctAnswerIndex === 'number' && question.options?.[question.correctAnswerIndex])
      );
      const hasFallbackOptionPairs = !question.question && Array.isArray(question.options) && question.options.length >= 2;
      return hasPairs || hasSinglePair || hasFallbackOptionPairs;
    })
    .map(question => ({
      id: question.id,
      subject: question.subject,
      unit: question.unit,
      lesson: question.lesson,
      questionType: 'matching',
      question: question.question,
      options: question.options,
      correctAnswerIndex: question.correctAnswerIndex,
      correctAnswerText: question.correctAnswerText,
      explanation: question.explanation,
      difficulty: question.difficulty,
      active: question.active,
      pairs: question.pairs as MatchCardsQuestion['pairs']
    }));
};

const toSequenceOrderQuestions = (questions: GameQuestion[]): SequenceOrderQuestion[] => {
  return questions
    .filter(question => {
      if (question.active === false) return false;
      return (
        question.questionType === 'sequence' &&
        Array.isArray(question.sequence) &&
        question.sequence.map(item => item.trim()).filter(Boolean).length >= 2
      );
    })
    .map(question => ({
      id: question.id,
      subject: question.subject,
      unit: question.unit,
      lesson: question.lesson,
      questionType: 'sequence',
      question: question.question,
      options: question.options,
      sequence: question.sequence,
      explanation: question.explanation,
      difficulty: question.difficulty,
      active: question.active
    }));
};

const getResultNumber = (result: UnifiedGameResult, key: string, fallback = 0) => {
  const value = (result as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const getResultString = (result: UnifiedGameResult, key: string, fallback = '') => {
  const value = (result as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : fallback;
};

const getResultBoolean = (result: UnifiedGameResult, key: string, fallback = false) => {
  const value = (result as unknown as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : fallback;
};

const getActiveGameQuestionsForResult = (
  gameType: string,
  collections: {
    snakeLadderQuestions: SnakeLadderQuestion[];
    knowledgeRaceQuestions: KnowledgeRaceQuestion[];
    footballQuestions: FootballKnowledgeQuestion[];
    trueFalseQuestions: TrueFalseQuestion[];
    matchCardsQuestions: MatchCardsQuestion[];
    sequenceOrderQuestions: SequenceOrderQuestion[];
  }
): GameQuestion[] => {
  switch (gameType) {
    case 'snake_ladder':
      return collections.snakeLadderQuestions as unknown as GameQuestion[];
    case 'knowledge_race':
      return collections.knowledgeRaceQuestions as unknown as GameQuestion[];
    case 'football_quiz':
      return collections.footballQuestions as unknown as GameQuestion[];
    case 'true_false':
      return collections.trueFalseQuestions as unknown as GameQuestion[];
    case 'match_cards':
      return collections.matchCardsQuestions as unknown as GameQuestion[];
    case 'sequence_order':
      return collections.sequenceOrderQuestions as unknown as GameQuestion[];
    default:
      return [];
  }
};

const inferMainQuestionMeta = (questions: GameQuestion[]) => {
  const first = questions.find(q => q.subject || q.unit || q.lesson) || questions[0];
  return {
    subject: first?.subject || '',
    unit: first?.unit || '',
    lesson: first?.lesson || ''
  };
};

const inferWeakQuestionIds = (result: UnifiedGameResult) => {
  const raw = result as unknown as Record<string, unknown>;
  const possibleKeys = ['weakQuestionIds', 'wrongQuestionIds', 'incorrectQuestionIds', 'failedQuestionIds'];

  for (const key of possibleKeys) {
    const value = raw[key];
    if (Array.isArray(value)) return value.filter((id): id is string => typeof id === 'string');
  }

  return [];
};

const inferTotalQuestions = (result: UnifiedGameResult, questions: GameQuestion[]) => {
  return (
    getResultNumber(result, 'totalQuestions') ||
    getResultNumber(result, 'questionsCount') ||
    getResultNumber(result, 'total') ||
    questions.length ||
    0
  );
};

const inferCorrectAnswers = (result: UnifiedGameResult) => {
  return (
    getResultNumber(result, 'correct') ||
    getResultNumber(result, 'correctAnswers') ||
    getResultNumber(result, 'matched') ||
    0
  );
};

const inferWrongAnswers = (result: UnifiedGameResult, totalQuestions: number, correct: number) => {
  const directWrong = getResultNumber(result, 'wrong') || getResultNumber(result, 'wrongAnswers') || getResultNumber(result, 'incorrect');
  if (directWrong) return directWrong;
  if (totalQuestions && correct >= 0) return Math.max(0, totalQuestions - correct);
  return 0;
};

const calculateScorePercent = (result: UnifiedGameResult, correct: number, totalQuestions: number) => {
  const score = getResultNumber(result, 'score');
  if (score > 0 && score <= 100) return Math.round(score);
  if (!totalQuestions) return 0;
  return Math.round((correct / totalQuestions) * 100);
};

const getMasteryLevel = (scorePercent: number): MasteryLevel => {
  if (scorePercent >= 90) return 'excellent';
  if (scorePercent >= 75) return 'good';
  if (scorePercent >= 50) return 'needs_review';
  return 'needs_followup';
};

const buildReviewRecommendation = (params: {
  scorePercent: number;
  subject?: string;
  lesson?: string;
  wrong: number;
}) => {
  const lessonText = params.lesson ? `درس ${params.lesson}` : 'الدرس الحالي';
  const subjectText = params.subject ? ` في مادة ${params.subject}` : '';

  if (params.scorePercent >= 90) {
    return `أداء ممتاز${subjectText}. يمكن الانتقال إلى تحدٍ أصعب أو مراجعة سريعة لاحقًا.`;
  }

  if (params.scorePercent >= 75) {
    return `أداء جيد${subjectText}. يُنصح بمراجعة قصيرة لـ ${lessonText} لتثبيت التعلم.`;
  }

  if (params.scorePercent >= 50) {
    return `يحتاج الطالب إلى مراجعة ${lessonText}${subjectText} لمدة 10 دقائق ثم إعادة اللعبة.`;
  }

  return `يحتاج الطالب إلى متابعة أوضح في ${lessonText}${subjectText}. يُفضّل مراجعة المفاهيم الأساسية مع ولي الأمر أو المعلم ثم إعادة النشاط.`;
};

const buildWrongDetails = (weakQuestionIds: string[], questions: GameQuestion[]) => {
  const questionMap = new Map(questions.map(q => [q.id, q]));

  return weakQuestionIds.map(questionId => {
    const q = questionMap.get(questionId);
    return {
      questionId,
      question: q?.question,
      subject: q?.subject,
      unit: q?.unit,
      lesson: q?.lesson,
      correctAnswerText:
        q?.correctAnswerText ||
        (typeof q?.correctAnswerIndex === 'number' ? q?.options?.[q.correctAnswerIndex] : undefined),
      explanation: q?.explanation
    };
  });
};

const getAttemptNumberForLesson = (studentKey: string, gameType: string, subject?: string, lesson?: string) => {
  const logKey = `rased_student_game_results_log_${studentKey}`;
  const oldLog = readJsonArray<StudentGameResultLogEntry>(logKey);

  const sameContextAttempts = oldLog.filter(item =>
    item.gameType === gameType &&
    (item.subject || '') === (subject || '') &&
    (item.lesson || '') === (lesson || '')
  );

  return sameContextAttempts.length + 1;
};

const buildGameResultLogEntry = (
  result: UnifiedGameResult,
  student: StudentGamesStudent,
  studentKey: string,
  questions: GameQuestion[],
  cloudMeta: ResultCloudMeta
): StudentGameResultLogEntry => {
  const raw = result as unknown as Record<string, unknown>;
  const savedAt = new Date().toISOString();
  const playedAt = typeof raw.playedAt === 'string' ? raw.playedAt : savedAt;
  const gameType = typeof raw.gameType === 'string' ? raw.gameType : 'unknown_game';

  const questionMeta = inferMainQuestionMeta(questions);
  const subject = getResultString(result, 'subject', questionMeta.subject);
  const unit = getResultString(result, 'unit', questionMeta.unit);
  const lesson = getResultString(result, 'lesson', questionMeta.lesson);

  const totalQuestions = inferTotalQuestions(result, questions);
  const correct = inferCorrectAnswers(result);
  const wrong = inferWrongAnswers(result, totalQuestions, correct);
  const scorePercent = calculateScorePercent(result, correct, totalQuestions);
  const weakQuestionIds = inferWeakQuestionIds(result);
  const wrongDetails = buildWrongDetails(weakQuestionIds, questions);
  const masteryLevel = getMasteryLevel(scorePercent);
  const attemptNumber = getAttemptNumberForLesson(studentKey, gameType, subject, lesson);

  return {
    id: `sgr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    studentId: studentKey,
    studentName: student?.name || cloudMeta.studentName,
    className: student?.classes?.[0] || cloudMeta.className,
    grade: student?.grade || cloudMeta.grade,
    schoolCode: cloudMeta.schoolCode,
    teacherId: cloudMeta.teacherId,
    gameType,
    gameTitle: GAME_TITLES[gameType] || gameType,
    subject,
    unit,
    lesson,
    score: getResultNumber(result, 'score', scorePercent),
    scorePercent,
    totalQuestions,
    correct,
    wrong,
    completed: getResultBoolean(result, 'completed', Boolean(raw.completed)),
    durationSeconds: getResultNumber(result, 'durationSeconds') || getResultNumber(result, 'timeSeconds') || undefined,
    attemptNumber,
    weakQuestionIds,
    wrongDetails,
    masteryLevel,
    reviewRecommendation: buildReviewRecommendation({ scorePercent, subject, lesson, wrong }),
    playedAt,
    savedAt,
    syncStatus: 'pending_sync',
    rawResult: result
  };
};

const StudentGames: React.FC<StudentGamesProps> = ({ student }) => {
  const { t, dir } = useApp();
  const [selectedGame, setSelectedGame] = useState<GameCardWithAvailability | null>(null);
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const [gamesMode, setGamesMode] = useState<GamesMode>('daily');

  const studentKey = student?.rasedId || student?.civilId || student?.id || 'default';

  const gameQuestions = useMemo(() => {
    const directQuestions = Array.isArray(student?.gameQuestions) ? student.gameQuestions : [];
    const possibleKeys = [
      `rased_game_questions_${student?.civilId || ''}`,
      `rased_game_questions_${student?.rasedId || ''}`,
      `rased_game_questions_${student?.id || ''}`,
      'rased_game_questions_default',
      'rased_game_questions'
    ].filter(Boolean);

    const localQuestions = readLocalQuestionArrays(possibleKeys);
    return normalizeQuestionList([...directQuestions, ...localQuestions], false);
  }, [student]);

  const reviewGameQuestions = useMemo(() => {
    const directQuestions = Array.isArray(student?.reviewGameQuestions) ? student.reviewGameQuestions : [];
    const possibleKeys = [
      `rased_review_game_questions_${student?.civilId || ''}`,
      `rased_review_game_questions_${student?.rasedId || ''}`,
      `rased_review_game_questions_${student?.id || ''}`,
      'rased_review_game_questions_default',
      'rased_review_game_questions'
    ].filter(Boolean);

    const localQuestions = readLocalQuestionArrays(possibleKeys);
    return normalizeQuestionList([...directQuestions, ...localQuestions], true).map(question => ({
      ...question,
      active: question.active === false ? true : question.active
    }));
  }, [student]);

  const currentGameQuestions = gamesMode === 'review' ? reviewGameQuestions : gameQuestions;
  const isReviewMode = gamesMode === 'review';

  const stats = useMemo(() => {
    const raw = readLocalGameStats(studentKey);
    const today = getTodayKey();
    return { ...raw, completedToday: raw.completedToday && raw.lastPlayedDate === today };
  }, [studentKey, statsVersion]);

  const games = useMemo<GameCardWithAvailability[]>(() => {
    return BASE_GAMES.map(game => {
      const compatibleQuestions = currentGameQuestions.filter(q => isQuestionCompatibleWithGame(q, game));
      const status: GameStatus =
        game.id === 'snake_ladder'
          ? 'available'
          : compatibleQuestions.length >= game.minQuestions
            ? 'available'
            : compatibleQuestions.length > 0
              ? 'needs_questions'
              : 'coming_soon';

      return { ...game, status, questionCount: compatibleQuestions.length };
    });
  }, [currentGameQuestions]);

  const findBaseGame = (id: string) => BASE_GAMES.find(game => game.id === id);

  const snakeLadderQuestions = useMemo(() => {
    const game = findBaseGame('snake_ladder');
    if (!game) return [];
    return toSnakeLadderQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const knowledgeRaceQuestions = useMemo(() => {
    const game = findBaseGame('knowledge_race');
    if (!game) return [];
    return toKnowledgeRaceQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const footballQuestions = useMemo(() => {
    const game = findBaseGame('football_quiz');
    if (!game) return [];
    return toFootballKnowledgeQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const trueFalseQuestions = useMemo(() => {
    const game = findBaseGame('true_false');
    if (!game) return [];
    return toTrueFalseQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const matchCardsQuestions = useMemo(() => {
    const game = findBaseGame('match_cards');
    if (!game) return [];
    return toMatchCardsQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const sequenceOrderQuestions = useMemo(() => {
    const game = findBaseGame('sequence_order');
    if (!game) return [];
    return toSequenceOrderQuestions(currentGameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [currentGameQuestions]);

  const availableGames = games.filter(g => g.status === 'available');
  const totalQuestions = currentGameQuestions.length;

  const handleStartGame = (game: GameCardWithAvailability) => {
    if (game.id === 'snake_ladder') {
      setSelectedGame(null);
      setActiveGame('snake_ladder');
      return;
    }

    if (game.id === 'knowledge_race') {
      if (knowledgeRaceQuestions.length === 0) return;
      setSelectedGame(null);
      setActiveGame('knowledge_race');
      return;
    }

    if (game.id === 'football_quiz') {
      if (footballQuestions.length === 0) return;
      setSelectedGame(null);
      setActiveGame('football_quiz');
      return;
    }

    if (game.id === 'true_false') {
      if (trueFalseQuestions.length === 0) return;
      setSelectedGame(null);
      setActiveGame('true_false');
      return;
    }

    if (game.id === 'match_cards') {
      if (matchCardsQuestions.length === 0) return;
      setSelectedGame(null);
      setActiveGame('match_cards');
      return;
    }

    if (game.id === 'sequence_order') {
      if (sequenceOrderQuestions.length === 0) return;
      setSelectedGame(null);
      setActiveGame('sequence_order');
      return;
    }

    if (game.status !== 'available') return;
    alert('سيتم ربط محرك هذه اللعبة في خطوة لاحقة.');
  };

  const refreshStats = () => setStatsVersion(prev => prev + 1);

  const getResultCloudMeta = (): ResultCloudMeta => {
    const firstQuestionWithMeta = gameQuestions.find(question => question.schoolCode || question.teacherId);

    return {
      schoolCode:
        firstQuestionWithMeta?.schoolCode ||
        localStorage.getItem('rased_student_school_code') ||
        localStorage.getItem('rased_admin_school_code') ||
        '',
      teacherId:
        firstQuestionWithMeta?.teacherId ||
        localStorage.getItem('rased_student_teacher_id') ||
        localStorage.getItem('rased_teacher_civil_id') ||
        '',
      className: student?.classes?.[0] || '',
      grade: student?.grade || '',
      studentName: student?.name || ''
    };
  };

  const getQuestionsForActiveGameResult = (result: UnifiedGameResult) => {
    const raw = result as unknown as Record<string, unknown>;
    const resultGameType = typeof raw.gameType === 'string' ? raw.gameType : activeGame || '';

    return getActiveGameQuestionsForResult(resultGameType, {
      snakeLadderQuestions,
      knowledgeRaceQuestions,
      footballQuestions,
      trueFalseQuestions,
      matchCardsQuestions,
      sequenceOrderQuestions
    });
  };

  const syncGameResultToCloud = async (logEntry: StudentGameResultLogEntry) => {
    const meta = getResultCloudMeta();

    if (!STUDENT_APP_URL) {
      console.warn('STUDENT_APP_URL غير مضبوط، تم حفظ النتيجة محليًا فقط.');
      return false;
    }

    if (!meta.schoolCode) {
      console.warn('schoolCode غير متوفر، قد لا تظهر النتيجة في راصد المعلم.');
    }

    try {
      const response = await fetch(STUDENT_APP_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'studentGameResult',
          schoolCode: meta.schoolCode,
          teacherId: meta.teacherId,
          studentId: logEntry.studentId,
          studentName: logEntry.studentName || meta.studentName,
          className: logEntry.className || meta.className,
          grade: logEntry.grade || meta.grade,
          gameResult: {
            ...logEntry,
            schoolCode: meta.schoolCode,
            teacherId: meta.teacherId,
            studentName: logEntry.studentName || meta.studentName,
            className: logEntry.className || meta.className,
            grade: logEntry.grade || meta.grade,
            subject: logEntry.subject || '',
            unit: logEntry.unit || '',
            lesson: logEntry.lesson || '',
            gameTitle: logEntry.gameTitle || '',
            scorePercent: logEntry.scorePercent,
            totalQuestions: logEntry.totalQuestions,
            correctAnswers: logEntry.correct,
            wrongAnswers: logEntry.wrong,
            attemptNumber: logEntry.attemptNumber,
            masteryLevel: logEntry.masteryLevel,
            reviewRecommendation: logEntry.reviewRecommendation,
            wrongDetails: logEntry.wrongDetails
          }
        })
      });

      const data = await response.json().catch(() => null);
      return Boolean(data?.success || data?.status === 'success');
    } catch (error) {
      console.error('Failed to sync game result to cloud', error);
      return false;
    }
  };

  const handleGameComplete = (result: UnifiedGameResult) => {
    refreshStats();

    try {
      const activeQuestionsForResult = getQuestionsForActiveGameResult(result);
      const cloudMeta = getResultCloudMeta();
      const logEntry = buildGameResultLogEntry(result, student, studentKey, activeQuestionsForResult, cloudMeta);

      if (isReviewMode) {
        const reviewLogKey = `rased_student_review_game_results_log_${studentKey}`;
        const oldReviewLog = readJsonArray<StudentGameResultLogEntry>(reviewLogKey);
        const reviewLogEntry: StudentGameResultLogEntry = {
          ...logEntry,
          syncStatus: 'local_only'
        };
        const nextReviewLog = [reviewLogEntry, ...oldReviewLog].slice(0, 100);
        localStorage.setItem(reviewLogKey, JSON.stringify(nextReviewLog));
        return;
      }

      const latestKey = `rased_student_latest_game_result_${studentKey}`;
      const logKey = `rased_student_game_results_log_${studentKey}`;
      const pendingSyncKey = `rased_student_game_results_pending_sync_${studentKey}`;

      const oldLog = readJsonArray<StudentGameResultLogEntry>(logKey);
      const nextLog = [logEntry, ...oldLog].slice(0, 100);

      const oldPending = readJsonArray<StudentGameResultLogEntry>(pendingSyncKey);
      const nextPending = [logEntry, ...oldPending].slice(0, 100);

      localStorage.setItem(latestKey, JSON.stringify(logEntry));
      localStorage.setItem(logKey, JSON.stringify(nextLog));
      localStorage.setItem(pendingSyncKey, JSON.stringify(nextPending));

      syncGameResultToCloud(logEntry).then(success => {
        if (!success) return;

        try {
          const oldPendingAfterSync = readJsonArray<StudentGameResultLogEntry>(pendingSyncKey);
          const nextPendingAfterSync = oldPendingAfterSync.filter(item => item.id !== logEntry.id);
          localStorage.setItem(pendingSyncKey, JSON.stringify(nextPendingAfterSync));

          const latestAfterSync = readJsonArray<StudentGameResultLogEntry>(logKey).map(item =>
            item.id === logEntry.id ? { ...item, syncStatus: 'synced' as const } : item
          );
          localStorage.setItem(logKey, JSON.stringify(latestAfterSync));

          const latestRaw = localStorage.getItem(latestKey);
          if (latestRaw) {
            const latestParsed = JSON.parse(latestRaw) as StudentGameResultLogEntry;
            if (latestParsed.id === logEntry.id) {
              localStorage.setItem(latestKey, JSON.stringify({ ...latestParsed, syncStatus: 'synced' }));
            }
          }
        } catch (error) {
          console.error('Failed to update pending game results after sync', error);
        }
      });
    } catch (error) {
      console.error('Failed to cache game result log', error);
    }
  };

  const handleModeChange = (mode: GamesMode) => {
    setGamesMode(mode);
    setSelectedGame(null);
    setActiveGame(null);
  };

  return (
    <div className="rased-student-light flex flex-col h-full min-h-0 bg-bgMain text-textPrimary relative overflow-hidden" dir={dir}>
      <header className="sticky top-0 z-40 bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),16px)] pb-4 px-5 shrink-0 shadow-sm transition-all">
        <h1 className="text-xl font-black text-textPrimary flex items-center gap-2 mb-0.5">
          <Gamepad2 className="w-5 h-5 text-primary" />
          {t('studentGames') || 'ألعابي التعليمية'}
        </h1>
        <p className="text-[10px] font-bold text-textSecondary pr-7">
          {t('studentGamesSubtitle') || 'راجع دروسك من خلال ألعاب قصيرة وممتعة 🎮'}
        </p>

        <div className="mt-4 bg-bgSoft border border-borderColor rounded-2xl p-1 flex gap-1">
          <button
            type="button"
            onClick={() => handleModeChange('daily')}
            className={`flex-1 h-10 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              gamesMode === 'daily' ? 'bg-primary text-white shadow-sm' : 'text-textSecondary'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            تحديات اليوم
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${gamesMode === 'daily' ? 'bg-white/20 text-white' : 'bg-bgCard text-textMuted'}`}>
              {gameQuestions.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('review')}
            className={`flex-1 h-10 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              gamesMode === 'review' ? 'bg-primary text-white shadow-sm' : 'text-textSecondary'
            }`}
          >
            <Archive className="w-4 h-4" />
            مراجعاتي
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${gamesMode === 'review' ? 'bg-white/20 text-white' : 'bg-bgCard text-textMuted'}`}>
              {reviewGameQuestions.length}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+180px)] space-y-5">
        <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-textPrimary flex items-center gap-2 mb-1">
                {isReviewMode ? <Archive className="w-4 h-4 text-primary" /> : <Sparkles className="w-4 h-4 text-warning" />}
                {isReviewMode ? 'مراجعاتي' : 'تحدي التعلم اليوم'}
              </h2>
              <p className="text-[10px] font-bold text-textSecondary leading-6">
                {isReviewMode
                  ? 'راجع الأسئلة السابقة التي وضعها المعلم للمذاكرة والاستعداد للاختبارات.'
                  : 'اختر لعبة قصيرة، أجب عن الأسئلة، واجمع الشارات.'}
              </p>
              {isReviewMode && (
                <p className="text-[9px] font-black text-warning mt-1">
                  نتائج مراجعاتي تحفظ محليًا فقط ولا تُرسل إلى راصد المعلم.
                </p>
              )}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              {isReviewMode ? <BookOpen className="w-7 h-7" /> : <Trophy className="w-7 h-7" />}
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 mt-4">
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">أفضل نتيجة</p>
              <p className="text-lg font-black text-primary">
                {stats.bestScore || stats.knowledgeRaceBestScore || stats.footballBestScore || stats.trueFalseBestScore || stats.matchCardsBestScore || stats.sequenceOrderBestScore || 0}
              </p>
            </div>
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">آخر نتيجة</p>
              <p className="text-lg font-black text-textPrimary">
                {stats.lastScore || stats.knowledgeRaceLastScore || stats.footballLastScore || stats.trueFalseLastScore || stats.matchCardsLastScore || stats.sequenceOrderLastScore || 0}
              </p>
            </div>
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">المحاولات</p>
              <p className="text-lg font-black text-success">
                {stats.attempts || stats.knowledgeRaceAttempts || stats.footballAttempts || stats.trueFalseAttempts || stats.matchCardsAttempts || stats.sequenceOrderAttempts || 0}
              </p>
            </div>
          </div>
        </section>

        {totalQuestions === 0 && (
          <section className="bg-warning/10 border border-warning/20 rounded-3xl p-4 shadow-sm flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 text-warning border border-warning/20 flex items-center justify-center shrink-0">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-textPrimary mb-1">
                {isReviewMode ? 'لا توجد مراجعات بعد' : 'بانتظار ألعاب المعلم'}
              </h3>
              <p className="text-[10px] font-bold text-textSecondary leading-6">
                {isReviewMode
                  ? 'ستظهر هنا أسئلة الأرشيف عندما ينشر المعلم دفعات جديدة وتنتقل الأسئلة القديمة إلى المراجعات.'
                  : 'ستظهر الألعاب عندما يضيف المعلم أسئلة وأنشطة من راصد المعلم. يمكن إبقاء هذه الصفحة جاهزة كمركز ألعاب ديناميكي.'}
              </p>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-black text-textPrimary flex items-center gap-2">
              {isReviewMode ? <Archive className="w-4 h-4 text-primary" /> : <Star className="w-4 h-4 text-warning" />}
              {isReviewMode ? 'ألعاب المراجعة' : 'الألعاب'}
            </h2>
            <span className="text-[9px] font-black text-textSecondary bg-bgSoft border border-borderColor px-2 py-1 rounded-full">
              {availableGames.length} متاحة
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {games.map(game => {
              const tone = getToneClasses(game.color);
              const Icon = game.icon;
              const isAvailable = game.status === 'available';
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => setSelectedGame(game)}
                  className={`w-full text-start rounded-3xl border p-4 shadow-sm transition-all active:scale-[0.99] ${
                    isAvailable ? 'bg-bgCard border-borderColor hover:border-primary/20 hover:shadow-card' : 'bg-bgCard border-borderColor opacity-90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shrink-0 ${tone.icon}`}>
                      <Icon className="w-7 h-7" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-black text-textPrimary truncate">{game.title}</h3>
                        {!isAvailable && (
                          <span className="shrink-0 text-[8px] font-black px-2 py-0.5 rounded-full bg-bgSoft border border-borderColor text-textSecondary">
                            {game.questionCount > 0 ? 'تحتاج أسئلة أكثر' : 'قريبًا'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-bold text-textSecondary leading-5 line-clamp-2">{game.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-bgSoft border border-borderColor text-textSecondary flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {game.questionCount} سؤال
                        </span>
                        <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-bgSoft border border-borderColor text-textSecondary flex items-center gap-1">
                          <Timer className="w-3 h-3" />
                          {game.estimatedTime}
                        </span>
                        {isReviewMode && (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                            مراجعة
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isAvailable ? tone.button : 'bg-bgSoft text-textMuted border border-borderColor'}`}>
                      {isAvailable ? <Play className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>

      {selectedGame && (
        <>
          <button
            type="button"
            aria-label="إغلاق تفاصيل اللعبة"
            onClick={() => setSelectedGame(null)}
            className="fixed inset-0 z-[100] bg-slate-900/20"
          />
          <div className="fixed left-4 right-4 bottom-[calc(env(safe-area-inset-bottom)+120px)] z-[110] max-w-md mx-auto bg-bgCard border border-borderColor rounded-3xl shadow-elevated p-5 animate-in fade-in slide-in-from-bottom-3 duration-200">
            {(() => {
              const tone = getToneClasses(selectedGame.color);
              const Icon = selectedGame.icon;
              const isAvailable = selectedGame.status === 'available' || selectedGame.id === 'snake_ladder';

              return (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${tone.icon}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-textPrimary">{selectedGame.title}</h3>
                      <p className="text-[10px] font-bold text-textSecondary">
                        {selectedGame.questionCount} سؤال متاح · {selectedGame.estimatedTime}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-textSecondary leading-6 mb-3">{selectedGame.description}</p>

                  {isReviewMode && (
                    <div className="bg-primary/10 border border-primary/20 text-primary rounded-2xl p-3 mb-4 text-[10px] font-black leading-5">
                      هذه اللعبة ضمن مراجعاتي. النتيجة تحفظ محليًا فقط ولا تُرسل إلى راصد المعلم.
                    </div>
                  )}

                  {isAvailable ? (
                    <button
                      type="button"
                      className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${tone.button}`}
                      onClick={() => handleStartGame(selectedGame)}
                    >
                      <Play className="w-5 h-5" />
                      {selectedGame.id === 'snake_ladder' && selectedGame.questionCount === 0 ? 'فتح اللعبة' : isReviewMode ? 'ابدأ المراجعة' : 'ابدأ اللعبة'}
                    </button>
                  ) : (
                    <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
                      <p className="text-xs font-black text-textPrimary mb-1">اللعبة غير متاحة بعد</p>
                      <p className="text-[10px] font-bold text-textSecondary leading-5">
                        {isReviewMode
                          ? 'ستعمل هذه اللعبة عندما تتوفر أسئلة مراجعة مناسبة لها.'
                          : 'ستعمل هذه اللعبة عندما يضيف المعلم عددًا كافيًا من الأسئلة المناسبة لها من راصد المعلم.'}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedGame(null)}
                    className="w-full mt-3 h-10 rounded-2xl font-black text-xs text-textSecondary hover:text-danger transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {activeGame === 'snake_ladder' && (
        <StudentSnakeLadderGame
          questions={snakeLadderQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}

      {activeGame === 'knowledge_race' && (
        <StudentKnowledgeRaceGame
          questions={knowledgeRaceQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}

      {activeGame === 'football_quiz' && (
        <StudentFootballKnowledgeGame
          questions={footballQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}

      {activeGame === 'true_false' && (
        <StudentTrueFalseGame
          questions={trueFalseQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}

      {activeGame === 'match_cards' && (
        <StudentMatchCardsGame
          questions={matchCardsQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}

      {activeGame === 'sequence_order' && (
        <StudentSequenceOrderGame
          questions={sequenceOrderQuestions}
          studentId={studentKey}
          onClose={() => {
            setActiveGame(null);
            refreshStats();
          }}
          onComplete={handleGameComplete}
        />
      )}
    </div>
  );
};

export default StudentGames;

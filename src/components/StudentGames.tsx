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
  HelpCircle,
  Goal,
  Sparkles,
  BookOpen,
  RotateCcw,
  Info
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

// =========================================================================
// مركز ألعاب الطالب - نسخة مرتبطة بالألعاب الأربع:
// ✅ السلم والثعبان
// ✅ سباق المعرفة
// ✅ ركلات المعرفة
// ✅ صح أم خطأ
// ✅ طابق المفهوم
// =========================================================================

export interface GameQuestion {
  id: string;
  subject?: string;
  grade?: string;
  className?: string;
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
pairs?: Array<{
  term?: string;
  definition?: string;
  left?: string;
  right?: string;
}>;

}

export interface StudentGamesStudent {
  id: string;
  civilId?: string;
  rasedId?: string;
  name?: string;
  classes?: string[];
  grade?: string;
  gameQuestions?: GameQuestion[];
}

interface StudentGamesProps {
  student: StudentGamesStudent;
  currentSemester?: '1' | '2';
}

type GameStatus = 'available' | 'needs_questions' | 'coming_soon';
type ActiveGame = 'snake_ladder' | 'knowledge_race' | 'football_quiz' | 'true_false' | 'match_cards' | null;

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
    minQuestions: 3,
    estimatedTime: '3 دقائق'
  },
  {
    id: 'who_am_i',
    title: 'من أنا؟',
    shortTitle: 'من أنا',
    description: 'اكتشف الإجابة من التلميحات المتدرجة.',
    icon: HelpCircle,
    color: 'warning',
    supportedGameTypes: ['hints', 'who_am_i'],
    supportedQuestionTypes: ['hints'],
    minQuestions: 3,
    estimatedTime: 'دقيقتان'
  }
];

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
      pairs: question.pairs
    }));
};

const StudentGames: React.FC<StudentGamesProps> = ({ student }) => {
  const { t, dir } = useApp();
  const [selectedGame, setSelectedGame] = useState<GameCardWithAvailability | null>(null);
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [statsVersion, setStatsVersion] = useState(0);

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

    let localQuestions: GameQuestion[] = [];
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

    const map = new Map<string, GameQuestion>();
    [...directQuestions, ...localQuestions]
      .filter(q => q && q.active !== false)
      .forEach((question, index) => {
        const id = question.id || `question_${index}`;
        map.set(id, { ...question, id });
      });

    return Array.from(map.values());
  }, [student]);

  const stats = useMemo(() => {
    const raw = readLocalGameStats(studentKey);
    const today = getTodayKey();
    return { ...raw, completedToday: raw.completedToday && raw.lastPlayedDate === today };
  }, [studentKey, statsVersion]);

  const games = useMemo<GameCardWithAvailability[]>(() => {
    return BASE_GAMES.map(game => {
      const compatibleQuestions = gameQuestions.filter(q => isQuestionCompatibleWithGame(q, game));
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
  }, [gameQuestions]);

  const findBaseGame = (id: string) => BASE_GAMES.find(game => game.id === id);

  const snakeLadderQuestions = useMemo(() => {
    const game = findBaseGame('snake_ladder');
    if (!game) return [];
    return toSnakeLadderQuestions(gameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [gameQuestions]);

  const knowledgeRaceQuestions = useMemo(() => {
    const game = findBaseGame('knowledge_race');
    if (!game) return [];
    return toKnowledgeRaceQuestions(gameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [gameQuestions]);

  const footballQuestions = useMemo(() => {
    const game = findBaseGame('football_quiz');
    if (!game) return [];
    return toFootballKnowledgeQuestions(gameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [gameQuestions]);

  const trueFalseQuestions = useMemo(() => {
    const game = findBaseGame('true_false');
    if (!game) return [];
    return toTrueFalseQuestions(gameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [gameQuestions]);

  const matchCardsQuestions = useMemo(() => {
    const game = findBaseGame('match_cards');
    if (!game) return [];
    return toMatchCardsQuestions(gameQuestions.filter(question => isQuestionCompatibleWithGame(question, game)));
  }, [gameQuestions]);

  const availableGames = games.filter(g => g.status === 'available');
  const totalQuestions = gameQuestions.length;

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

    if (game.status !== 'available') return;
    alert('سيتم ربط محرك هذه اللعبة في خطوة لاحقة.');
  };

  const refreshStats = () => setStatsVersion(prev => prev + 1);
  const handleSnakeLadderComplete = (_result: SnakeLadderResult) => refreshStats();
  const handleKnowledgeRaceComplete = (_result: KnowledgeRaceResult) => refreshStats();
  const handleFootballComplete = (_result: FootballKnowledgeResult) => refreshStats();
  const handleTrueFalseComplete = (_result: TrueFalseResult) => refreshStats();
  const handleMatchCardsComplete = (_result: MatchCardsResult) => refreshStats();

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
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+180px)] space-y-5">
        <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-textPrimary flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-warning" />
                تحدي التعلم اليوم
              </h2>
              <p className="text-[10px] font-bold text-textSecondary leading-6">
                اختر لعبة قصيرة، أجب عن الأسئلة، واجمع الشارات.
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Trophy className="w-7 h-7" />
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-2 mt-4">
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">أفضل نتيجة</p>
              <p className="text-lg font-black text-primary">
                {stats.bestScore || stats.knowledgeRaceBestScore || stats.footballBestScore || stats.trueFalseBestScore || stats.matchCardsBestScore || 0}
              </p>
            </div>
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">آخر نتيجة</p>
              <p className="text-lg font-black text-textPrimary">
                {stats.lastScore || stats.knowledgeRaceLastScore || stats.footballLastScore || stats.trueFalseLastScore || stats.matchCardsLastScore || 0}
              </p>
            </div>
            <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
              <p className="text-[9px] font-bold text-textSecondary mb-1">المحاولات</p>
              <p className="text-lg font-black text-success">
                {stats.attempts || stats.knowledgeRaceAttempts || stats.footballAttempts || stats.trueFalseAttempts || stats.matchCardsAttempts || 0}
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
              <h3 className="text-sm font-black text-textPrimary mb-1">بانتظار ألعاب المعلم</h3>
              <p className="text-[10px] font-bold text-textSecondary leading-6">
                ستظهر الألعاب عندما يضيف المعلم أسئلة وأنشطة من راصد المعلم. يمكن إبقاء هذه الصفحة جاهزة كمركز ألعاب ديناميكي.
              </p>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-black text-textPrimary flex items-center gap-2">
              <Star className="w-4 h-4 text-warning" />
              الألعاب
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

                  <p className="text-xs font-bold text-textSecondary leading-6 mb-4">{selectedGame.description}</p>

                  {isAvailable ? (
                    <button
                      type="button"
                      className={`w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${tone.button}`}
                      onClick={() => handleStartGame(selectedGame)}
                    >
                      <Play className="w-5 h-5" />
                      {selectedGame.id === 'snake_ladder' && selectedGame.questionCount === 0 ? 'فتح اللعبة' : 'ابدأ اللعبة'}
                    </button>
                  ) : (
                    <div className="bg-bgSoft border border-borderColor rounded-2xl p-3 text-center">
                      <p className="text-xs font-black text-textPrimary mb-1">اللعبة غير متاحة بعد</p>
                      <p className="text-[10px] font-bold text-textSecondary leading-5">
                        ستعمل هذه اللعبة عندما يضيف المعلم عددًا كافيًا من الأسئلة المناسبة لها من راصد المعلم.
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
          onComplete={handleSnakeLadderComplete}
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
          onComplete={handleKnowledgeRaceComplete}
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
          onComplete={handleFootballComplete}
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
          onComplete={handleTrueFalseComplete}
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
          onComplete={handleMatchCardsComplete}
        />
      )}
    </div>
  );
};

export default StudentGames;

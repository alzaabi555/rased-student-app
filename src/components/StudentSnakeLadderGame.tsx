import React, { useMemo, useState } from 'react';
import {
  X,
  Dice5,
  Trophy,
  HelpCircle,
  Heart,
  XCircle,
  RotateCcw,
  Sparkles,
  Star
} from 'lucide-react';
import SnakeLadderCanvasBoard from './SnakeLadderCanvasBoard';

// =========================================================================
// 🐍🪜 السلم والثعبان التعليمي - نسخة Canvas
// -------------------------------------------------------------------------
// هذه النسخة تستبدل عرض Phaser بلوحة Canvas مستقلة:
// - SnakeLadderCanvasBoard يرسم اللوحة والثعابين والسلالم واللاعب.
// - هذا الملف يحتفظ بمنطق اللعبة: النرد، الأسئلة، الفوز، الحفظ، الإحصائيات.
// =========================================================================

export interface SnakeLadderQuestion {
  id: string;
  subject?: string;
  unit?: string;
  lesson?: string;
  questionType?: 'multiple_choice' | 'true_false';
  question: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  active?: boolean;
}

export interface SnakeLadderResult {
  gameType: 'snake_ladder';
  score: number;
  correct: number;
  wrong: number;
  reachedTile: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentSnakeLadderGameProps {
  questions: SnakeLadderQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: SnakeLadderResult) => void;
}

type FeedbackState = {
  type: 'correct' | 'wrong';
  message: string;
  explanation?: string;
} | null;

const BOARD_SIZE = 36;
const BOARD_COLUMNS = 6;
const MIN_CORRECT_TO_WIN = 5;

const LADDERS: Record<number, number> = {
  3: 12,
  8: 17,
  15: 24,
  22: 31
};

const SNAKES: Record<number, number> = {
  14: 6,
  21: 11,
  29: 19,
  34: 25
};

const normalizeQuestions = (questions: SnakeLadderQuestion[]) => {
  return (Array.isArray(questions) ? questions : []).filter(q => {
    if (!q || q.active === false) return false;
    if (!q.question) return false;
    if (q.questionType === 'true_false') return true;

    const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
    const hasAnswer = typeof q.correctAnswerIndex === 'number';

    return hasOptions && hasAnswer;
  });
};

const shuffleArray = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const getTodayKey = () => new Date().toLocaleDateString('en-CA');
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const StudentSnakeLadderGame: React.FC<StudentSnakeLadderGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);

  const [position, setPosition] = useState(1);
  const [dice, setDice] = useState<number | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<SnakeLadderQuestion | null>(null);
  const [pendingMove, setPendingMove] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(3);
  const [completed, setCompleted] = useState(false);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);
  const [lastMoveLabel, setLastMoveLabel] = useState('استعد للعب');

  const canPlay = usableQuestions.length > 0;
  const correctToWin = Math.min(MIN_CORRECT_TO_WIN, Math.max(1, usableQuestions.length));

  const pickQuestion = () => {
    if (questionDeck.length === 0) return null;
    return questionDeck[questionIndex % questionDeck.length];
  };

  const saveResult = (
    nextCompleted: boolean,
    nextScore = score,
    nextCorrect = correct,
    nextWrong = wrong,
    nextWeakIds = weakQuestionIds,
    reachedTile = position
  ) => {
    const result: SnakeLadderResult = {
      gameType: 'snake_ladder',
      score: nextScore,
      correct: nextCorrect,
      wrong: nextWrong,
      reachedTile,
      completed: nextCompleted,
      weakQuestionIds: nextWeakIds,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.attempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.bestScore || 0), nextScore);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          bestScore,
          lastScore: nextScore,
          attempts,
          completedToday: nextCompleted,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'snake_ladder'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save snake ladder result', error);
    }

    onComplete?.(result);
  };

  const rollDice = () => {
    if (!canPlay || currentQuestion || completed || lives <= 0 || isRolling) return;

    setIsRolling(true);
    setFeedback(null);
    setLastMoveLabel('جارٍ رمي النرد...');

    let rolls = 0;
    const interval = window.setInterval(() => {
      rolls++;
      const rollingValue = 1 + Math.floor(Math.random() * 6);
      setDice(rollingValue);

      if (rolls >= 10) {
        window.clearInterval(interval);
        const finalDice = 1 + Math.floor(Math.random() * 6);
        setDice(finalDice);
        setPendingMove(finalDice);
        setCurrentQuestion(pickQuestion());
        setIsRolling(false);
        setLastMoveLabel(`رميت ${finalDice}، أجب لتتحرك`);
      }
    }, 80);
  };

  const completeCorrectMove = (question: SnakeLadderQuestion) => {
    const rawPosition = Math.min(position + pendingMove, BOARD_SIZE);
    let finalPosition = rawPosition;
    let bonusMessage = 'إجابة صحيحة! تقدمت في اللوحة.';
    let moveLabel = `تقدمت إلى الخانة ${rawPosition}`;

    if (LADDERS[rawPosition]) {
      finalPosition = LADDERS[rawPosition];
      bonusMessage = 'إجابة صحيحة! صعدت السلم للأعلى.';
      moveLabel = `سلم رائع من ${rawPosition} إلى ${finalPosition}`;
    } else if (SNAKES[rawPosition]) {
      finalPosition = SNAKES[rawPosition];
      bonusMessage = 'إجابة صحيحة، لكنك وصلت إلى ثعبان ونزلت قليلًا.';
      moveLabel = `ثعبان من ${rawPosition} إلى ${finalPosition}`;
    }

    // 👇 التعديل تم هنا: إضافة 10 نقاط فقط للإجابة الصحيحة
    const nextScore = score + 10; 
    const nextCorrect = correct + 1;

    if (finalPosition >= BOARD_SIZE && nextCorrect < correctToWin) {
      finalPosition = BOARD_SIZE - 1;
      bonusMessage = `اقتربت من الفوز! أجب عن ${correctToWin - nextCorrect} سؤال/أسئلة صحيحة إضافية لإنهاء التحدي.`;
      moveLabel = 'اقتربت من النهاية، تحتاج إجابات أكثر';
    }

    setScore(nextScore);
    setCorrect(nextCorrect);
    setPosition(finalPosition);
    setLastMoveLabel(moveLabel);
    setFeedback({
      type: 'correct',
      message: bonusMessage,
      explanation: question.explanation
    });

    window.setTimeout(() => {
      setCurrentQuestion(null);
      setFeedback(null);
      setQuestionIndex(prev => prev + 1);

      if (finalPosition >= BOARD_SIZE && nextCorrect >= correctToWin) {
        setCompleted(true);
        setLastMoveLabel('مبروك! وصلت إلى النهاية');
        saveResult(true, nextScore, nextCorrect, wrong, weakQuestionIds, finalPosition);
      }
    }, 1250);
  };

  const completeWrongMove = (question: SnakeLadderQuestion) => {
    const nextWrong = wrong + 1;
    const nextLives = lives - 1;
    const nextWeakIds = Array.from(new Set([...weakQuestionIds, question.id]));

    setWrong(nextWrong);
    setLives(nextLives);
    setWeakQuestionIds(nextWeakIds);
    setLastMoveLabel('إجابة خاطئة، لم تتحرك هذه الجولة');
    setFeedback({
      type: 'wrong',
      message: 'إجابة غير صحيحة، حاول مرة أخرى في السؤال القادم.',
      explanation: question.explanation
    });

    window.setTimeout(() => {
      setCurrentQuestion(null);
      setFeedback(null);
      setQuestionIndex(prev => prev + 1);

      if (nextLives <= 0) {
        saveResult(false, score, correct, nextWrong, nextWeakIds, position);
      }
    }, 1450);
  };

  const resolveMove = (isCorrect: boolean) => {
    if (!currentQuestion) return;
    if (isCorrect) {
      completeCorrectMove(currentQuestion);
    } else {
      completeWrongMove(currentQuestion);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || feedback) return;

    if (currentQuestion.questionType === 'true_false') {
      const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
      resolveMove(answerIndex === correctIndex);
      return;
    }

    resolveMove(answerIndex === currentQuestion.correctAnswerIndex);
  };

  const resetGame = () => {
    setPosition(1);
    setDice(null);
    setQuestionIndex(0);
    setCurrentQuestion(null);
    setPendingMove(0);
    setFeedback(null);
    setIsRolling(false);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(3);
    setCompleted(false);
    setWeakQuestionIds([]);
    setLastMoveLabel('استعد للعب');
  };

  const renderOptions = () => {
    if (!currentQuestion) return null;

    const options = currentQuestion.questionType === 'true_false' ? ['صح', 'خطأ'] : currentQuestion.options || [];

    return (
      <div className="grid grid-cols-1 gap-2 mt-4">
        {options.map((option, index) => (
          <button
            key={`${option}-${index}`}
            type="button"
            disabled={Boolean(feedback)}
            onClick={() => handleAnswer(index)}
            className="w-full rounded-2xl border border-borderColor bg-bgSoft hover:bg-bgCard hover:border-primary/30 p-3 text-sm font-black text-textPrimary transition-all active:scale-[0.99] disabled:opacity-70"
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  const statsBlock = (
    <section className="grid grid-cols-4 lg:grid-cols-2 gap-2">
      <div className="bg-bgCard border border-borderColor rounded-2xl p-2.5 text-center shadow-sm">
        <p className="text-[8px] font-bold text-textSecondary mb-1">النقاط</p>
        <p className="text-base font-black text-primary">{score}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-2.5 text-center shadow-sm">
        <p className="text-[8px] font-bold text-textSecondary mb-1">صحيح</p>
        <p className="text-base font-black text-success">{correct}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-2.5 text-center shadow-sm">
        <p className="text-[8px] font-bold text-textSecondary mb-1">خطأ</p>
        <p className="text-base font-black text-danger">{wrong}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-2.5 text-center shadow-sm">
        <p className="text-[8px] font-bold text-textSecondary mb-1">محاولات</p>
        <p className="text-base font-black text-warning flex items-center justify-center gap-1">
          <Heart className="w-4 h-4" /> {lives}
        </p>
      </div>
    </section>
  );

  const diceFace = (
    <div
      className={`relative h-14 sm:h-16 min-w-[96px] rounded-[1.25rem] border-2 border-primary/25 bg-white shadow-[0_10px_24px_rgba(79,70,229,0.18)] flex items-center justify-center gap-2 px-3 overflow-hidden shrink-0 ${
        isRolling ? 'scale-105 ring-4 ring-primary/10' : ''
      } transition-all duration-200`}
      aria-label={`نتيجة النرد ${dice || 'غير محددة'}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-primary/10 to-warning/20" />
      <div className="absolute -top-6 -right-6 w-14 h-14 rounded-full bg-white/70 blur-sm" />
      <div className="absolute -bottom-5 -left-5 w-12 h-12 rounded-full bg-primary/10 blur-sm" />
      <span className={`relative text-[28px] sm:text-[34px] leading-none drop-shadow-sm ${isRolling ? 'animate-spin' : ''}`} aria-hidden="true">
        🎲
      </span>
      <span className="relative min-w-7 text-center text-2xl sm:text-3xl font-black text-primary leading-none drop-shadow-sm">
        {dice || '?'}
      </span>
    </div>
  );

  const controlBlock = (
    <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm">
      {completed ? (
        <div className="text-center">
          <Trophy className="w-11 h-11 text-warning mx-auto mb-2" />
          <h2 className="text-base font-black text-textPrimary mb-1">فزت بالتحدي!</h2>
          <p className="text-[10px] font-bold text-textSecondary mb-3">وصلت إلى نهاية اللوحة وجمعت {score} نقطة.</p>
          <button
            type="button"
            onClick={resetGame}
            className="mx-auto w-14 h-14 rounded-2xl bg-primary text-white font-black active:scale-95 transition-all flex items-center justify-center shadow-card"
            aria-label="لعبة جديدة"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      ) : lives <= 0 ? (
        <div className="text-center">
          <XCircle className="w-11 h-11 text-danger mx-auto mb-2" />
          <h2 className="text-base font-black text-textPrimary mb-1">انتهت المحاولات</h2>
          <p className="text-[10px] font-bold text-textSecondary mb-3">راجع الأسئلة التي أخطأت فيها ثم حاول مرة أخرى.</p>
          <button
            type="button"
            onClick={resetGame}
            className="mx-auto w-14 h-14 rounded-2xl bg-danger text-white font-black active:scale-95 transition-all flex items-center justify-center shadow-card"
            aria-label="إعادة المحاولة"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 text-start">
              <div className="flex items-center gap-1.5 text-[10px] font-black text-textPrimary mb-1">
                <Sparkles className="w-4 h-4 text-warning" />
                رمية النرد
              </div>
              <p className="text-[9px] font-bold text-textSecondary leading-5">
                الفوز يحتاج {correctToWin} إجابة صحيحة على الأقل.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {diceFace}
              <button
                type="button"
                onClick={rollDice}
                disabled={!canPlay || Boolean(currentQuestion) || isRolling}
                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-[1.25rem] bg-gradient-to-br from-primary via-primary to-indigo-700 text-white font-black active:scale-95 active:translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-[0_12px_24px_rgba(79,70,229,0.35)] border border-white/20 overflow-hidden"
                aria-label="ارمِ النرد"
                title={!canPlay ? 'بانتظار أسئلة المعلم' : 'ارمِ النرد'}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/10" />
                <Dice5 className={`relative w-6 h-6 sm:w-7 sm:h-7 drop-shadow-sm ${isRolling ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] font-black text-primary">
            {!canPlay ? 'بانتظار أسئلة المعلم' : isRolling ? 'جارٍ رمي النرد...' : 'اضغط زر الرمي بجانب النرد'}
          </p>
        </div>
      )}
    </section>
  );

  return (
    <div className="fixed inset-0 z-[99999] bg-bgMain text-textPrimary flex flex-col" dir="rtl">
      <header className="bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),14px)] px-4 pb-3 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Dice5 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-textPrimary truncate">السلم والثعبان التعليمي</h1>
              <p className="text-[10px] font-bold text-textSecondary truncate">لوحة Canvas تفاعلية مرتبطة بأسئلة المعلم 🐍🪜</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-bgSoft border border-borderColor text-textSecondary hover:text-danger flex items-center justify-center active:scale-95 transition-all shrink-0"
            aria-label="إغلاق اللعبة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden overscroll-contain custom-scrollbar p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+168px)] lg:pb-4">
        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] gap-3 sm:gap-4" dir="rtl">
          <aside className="order-2 lg:order-1 space-y-3 lg:h-full lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pb-2">
            {!canPlay && (
              <section className="bg-warning/10 border border-warning/20 rounded-3xl p-4 text-center shadow-sm">
                <HelpCircle className="w-10 h-10 text-warning mx-auto mb-3" />
                <h2 className="text-sm font-black text-textPrimary mb-1">اللعبة جاهزة بانتظار أسئلة المعلم</h2>
                <p className="text-[10px] font-bold text-textSecondary leading-6">
                  ستظهر الأسئلة تلقائيًا عندما يضيف المعلم محتوى الألعاب من راصد المعلم.
                </p>
              </section>
            )}

            {statsBlock}

            <section className="bg-bgCard border border-borderColor rounded-3xl p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                  <Star className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-textSecondary">آخر حركة</p>
                  <p className="text-xs font-black text-textPrimary truncate">{lastMoveLabel}</p>
                </div>
              </div>
            </section>

            {controlBlock}
          </aside>

          <section className="order-1 lg:order-2 rounded-3xl overflow-hidden border border-borderColor shadow-card bg-bgCard min-h-[230px] lg:min-h-0 lg:h-full">
            <div className="w-full h-[clamp(230px,calc(100dvh-390px),680px)] max-h-[680px] lg:h-full lg:min-h-0 lg:max-h-none bg-bgMain">
              <SnakeLadderCanvasBoard
                currentTile={position}
                boardSize={BOARD_SIZE}
                columns={BOARD_COLUMNS}
                ladders={LADDERS}
                snakes={SNAKES}
                showLabels
                animateToken
              />
            </div>
          </section>
        </div>
      </main>

      {currentQuestion && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/30 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bgCard border border-borderColor rounded-3xl p-5 shadow-elevated animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-textPrimary">سؤال قبل التحرك</h2>
                <p className="text-[10px] font-bold text-textSecondary">أجب بشكل صحيح لتتقدم {pendingMove} خانات</p>
              </div>
            </div>

            <h3 className="text-base font-black text-textPrimary leading-7">{currentQuestion.question}</h3>
            {renderOptions()}

            {feedback && (
              <div className={`mt-4 rounded-2xl border p-3 ${feedback.type === 'correct' ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                <p className={`text-xs font-black mb-1 ${feedback.type === 'correct' ? 'text-success' : 'text-danger'}`}>{feedback.message}</p>
                {feedback.explanation && <p className="text-[10px] font-bold text-textSecondary leading-5">{feedback.explanation}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentSnakeLadderGame;

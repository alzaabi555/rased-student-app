import React, { useMemo, useState } from 'react';
import {
  X,
  Dice5,
  Trophy,
  Star,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  HelpCircle,
  Heart,
  Sparkles
} from 'lucide-react';

// =========================================================================
// 🐍🪜 السلم والثعبان التعليمي - Educational Snake & Ladder Game
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

const getTodayKey = () => new Date().toLocaleDateString('en-CA');

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

const buildBoardTiles = () => {
  const rows: number[][] = [];
  let current = BOARD_SIZE;

  for (let row = 0; row < BOARD_COLUMNS; row++) {
    const rowTiles: number[] = [];
    for (let col = 0; col < BOARD_COLUMNS; col++) {
      rowTiles.push(current);
      current--;
    }

    // لجعل مسار اللوحة متعرجًا مثل السلم والثعبان
    rows.push(row % 2 === 0 ? rowTiles : [...rowTiles].reverse());
  }

  return rows.flat();
};

const getTileTone = (tile: number) => {
  if (LADDERS[tile]) return 'bg-success/10 border-success/30 text-success';
  if (SNAKES[tile]) return 'bg-danger/10 border-danger/30 text-danger';
  if (tile === BOARD_SIZE) return 'bg-warning/10 border-warning/30 text-warning';
  return 'bg-bgCard border-borderColor text-textPrimary';
};
const getTileCenter = (tile: number) => {
  const size = 100;
  const rowFromBottom = Math.floor((tile - 1) / BOARD_COLUMNS);
  const colInRow = (tile - 1) % BOARD_COLUMNS;

  const row = BOARD_COLUMNS - 1 - rowFromBottom;

  // نجعل مسار اللوحة متعرجًا
  const col =
    rowFromBottom % 2 === 0
      ? colInRow
      : BOARD_COLUMNS - 1 - colInRow;

  return {
    x: col * size + size / 2,
    y: row * size + size / 2
  };
};

const renderLadder = (from: number, to: number) => {
  const start = getTileCenter(from);
  const end = getTileCenter(to);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / length;
  const ny = dx / length;

  const railGap = 12;

  const x1a = start.x + nx * railGap;
  const y1a = start.y + ny * railGap;
  const x2a = end.x + nx * railGap;
  const y2a = end.y + ny * railGap;

  const x1b = start.x - nx * railGap;
  const y1b = start.y - ny * railGap;
  const x2b = end.x - nx * railGap;
  const y2b = end.y - ny * railGap;

  const steps = 5;

  return (
    <g key={`ladder-${from}-${to}`}>
      <line
        x1={x1a}
        y1={y1a}
        x2={x2a}
        y2={y2a}
        stroke="rgb(22 163 74)"
        strokeWidth="8"
        strokeLinecap="round"
      />

      <line
        x1={x1b}
        y1={y1b}
        x2={x2b}
        y2={y2b}
        stroke="rgb(22 163 74)"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {Array.from({ length: steps }).map((_, index) => {
        const t = (index + 1) / (steps + 1);

        const ax = x1a + (x2a - x1a) * t;
        const ay = y1a + (y2a - y1a) * t;
        const bx = x1b + (x2b - x1b) * t;
        const by = y1b + (y2b - y1b) * t;

        return (
          <line
            key={`ladder-step-${from}-${index}`}
            x1={ax}
            y1={ay}
            x2={bx}
            y2={by}
            stroke="rgb(134 239 172)"
            strokeWidth="6"
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};

const renderSnake = (from: number, to: number, index: number) => {
  const start = getTileCenter(from);
  const end = getTileCenter(to);

  const midX = (start.x + end.x) / 2 + (index % 2 === 0 ? 50 : -50);
  const midY = (start.y + end.y) / 2;

  return (
    <g key={`snake-${from}-${to}`}>
      <path
        d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
        fill="none"
        stroke="rgb(220 38 38)"
        strokeWidth="14"
        strokeLinecap="round"
      />

      <path
        d={`M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`}
        fill="none"
        stroke="rgb(254 202 202)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="12 12"
      />

      <circle
        cx={start.x}
        cy={start.y}
        r="18"
        fill="rgb(220 38 38)"
        stroke="white"
        strokeWidth="4"
      />

      <circle cx={start.x - 6} cy={start.y - 4} r="3" fill="white" />
      <circle cx={start.x + 6} cy={start.y - 4} r="3" fill="white" />

      <path
        d={`M ${start.x - 5} ${start.y + 7} Q ${start.x} ${
          start.y + 13
        } ${start.x + 5} ${start.y + 7}`}
        stroke="white"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
};
const StudentSnakeLadderGame: React.FC<StudentSnakeLadderGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);
  const boardTiles = useMemo(() => buildBoardTiles(), []);

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

  const progressPercent = Math.round((position / BOARD_SIZE) * 100);
  const canPlay = usableQuestions.length > 0;

  const saveResult = (nextCompleted: boolean, nextScore = score, nextCorrect = correct, nextWrong = wrong, nextWeakIds = weakQuestionIds, reachedTile = position) => {
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

    if (onComplete) onComplete(result);
  };

  const pickQuestion = () => {
    if (questionDeck.length === 0) return null;
    return questionDeck[questionIndex % questionDeck.length];
  };

  const rollDice = () => {
    if (!canPlay || currentQuestion || completed || lives <= 0 || isRolling) return;

    setIsRolling(true);
    setFeedback(null);

    let rolls = 0;
    const interval = window.setInterval(() => {
      rolls++;
      setDice(1 + Math.floor(Math.random() * 6));

      if (rolls >= 8) {
        window.clearInterval(interval);
        const finalDice = 1 + Math.floor(Math.random() * 6);
        setDice(finalDice);
        setPendingMove(finalDice);
        setCurrentQuestion(pickQuestion());
        setIsRolling(false);
      }
    }, 80);
  };

  const resolveMove = (isCorrect: boolean) => {
    if (!currentQuestion) return;

    if (!isCorrect) {
      const nextWrong = wrong + 1;
      const nextLives = lives - 1;
      const nextWeakIds = Array.from(new Set([...weakQuestionIds, currentQuestion.id]));

      setWrong(nextWrong);
      setLives(nextLives);
      setWeakQuestionIds(nextWeakIds);
      setFeedback({
        type: 'wrong',
        message: 'إجابة غير صحيحة، حاول مرة أخرى في السؤال القادم.',
        explanation: currentQuestion.explanation
      });

      setTimeout(() => {
        setCurrentQuestion(null);
        setFeedback(null);
        setQuestionIndex(prev => prev + 1);

        if (nextLives <= 0) {
          saveResult(false, score, correct, nextWrong, nextWeakIds, position);
        }
      }, 1600);

      return;
    }

    const rawPosition = Math.min(position + pendingMove, BOARD_SIZE);
    let finalPosition = rawPosition;
    let bonusMessage = 'إجابة صحيحة! تقدمت في اللوحة.';

    if (LADDERS[rawPosition]) {
      finalPosition = LADDERS[rawPosition];
      bonusMessage = 'إجابة صحيحة! صعدت السلم للأعلى.';
    } else if (SNAKES[rawPosition]) {
      finalPosition = SNAKES[rawPosition];
      bonusMessage = 'إجابة صحيحة، لكنك وصلت إلى ثعبان ونزلت قليلًا.';
    }

    const nextScore = score + 100 + pendingMove * 10 + (LADDERS[rawPosition] ? 50 : 0);
    const nextCorrect = correct + 1;

    setScore(nextScore);
    setCorrect(nextCorrect);
    setPosition(finalPosition);
    setFeedback({
      type: 'correct',
      message: bonusMessage,
      explanation: currentQuestion.explanation
    });

    setTimeout(() => {
      setCurrentQuestion(null);
      setFeedback(null);
      setQuestionIndex(prev => prev + 1);

      if (finalPosition >= BOARD_SIZE) {
        setCompleted(true);
        saveResult(true, nextScore, nextCorrect, wrong, weakQuestionIds, finalPosition);
      }
    }, 1600);
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
  };

  const renderOptions = () => {
    if (!currentQuestion) return null;

    const options =
      currentQuestion.questionType === 'true_false'
        ? ['صح', 'خطأ']
        : currentQuestion.options || [];

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

  return (
    <div className="fixed inset-0 z-[999] bg-bgMain text-textPrimary flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-bgCard border-b border-borderColor pt-[max(env(safe-area-inset-top),14px)] px-4 pb-3 shadow-sm shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Dice5 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-textPrimary truncate">
                السلم والثعبان التعليمي
              </h1>
              <p className="text-[10px] font-bold text-textSecondary truncate">
                أجب بشكل صحيح وتقدم نحو خط النهاية 🐍🪜
              </p>
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

      {/* Body */}
      <main className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-4">
       {!canPlay && (
  <section className="bg-warning/10 border border-warning/20 rounded-3xl p-4 text-center shadow-sm">
    <HelpCircle className="w-10 h-10 text-warning mx-auto mb-3" />

    <h2 className="text-sm font-black text-textPrimary mb-1">
      اللعبة جاهزة بانتظار أسئلة المعلم
    </h2>

    <p className="text-[10px] font-bold text-textSecondary leading-6">
      ستظهر أسئلة السلم والثعبان هنا تلقائيًا عندما يضيف المعلم محتوى الألعاب من راصد المعلم.
      يمكنك فتح اللعبة الآن، وسيتم تفعيل اللعب عند توفر الأسئلة.
    </p>
  </section>
)}

        {/* Stats */}
        <section className="grid grid-cols-4 gap-2">
          <div className="bg-bgCard border border-borderColor rounded-2xl p-2 text-center shadow-sm">
            <p className="text-[8px] font-bold text-textSecondary mb-1">النقاط</p>
            <p className="text-sm font-black text-primary">{score}</p>
          </div>
          <div className="bg-bgCard border border-borderColor rounded-2xl p-2 text-center shadow-sm">
            <p className="text-[8px] font-bold text-textSecondary mb-1">صحيح</p>
            <p className="text-sm font-black text-success">{correct}</p>
          </div>
          <div className="bg-bgCard border border-borderColor rounded-2xl p-2 text-center shadow-sm">
            <p className="text-[8px] font-bold text-textSecondary mb-1">خطأ</p>
            <p className="text-sm font-black text-danger">{wrong}</p>
          </div>
          <div className="bg-bgCard border border-borderColor rounded-2xl p-2 text-center shadow-sm">
            <p className="text-[8px] font-bold text-textSecondary mb-1">محاولات</p>
            <p className="text-sm font-black text-warning flex items-center justify-center gap-1">
              <Heart className="w-3 h-3" /> {lives}
            </p>
          </div>
        </section>

        {/* Progress */}
        <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-black text-textPrimary">تقدمك في اللوحة</p>
            <p className="text-xs font-black text-primary">{progressPercent}%</p>
          </div>
          <div className="w-full h-3 rounded-full bg-bgSoft overflow-hidden border border-borderColor">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
        
{/* Board */}
<section className="bg-bgCard border border-borderColor rounded-3xl p-3 shadow-sm">
  <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-sky-50 via-white to-indigo-50 border border-borderColor">
    {/* رسومات السلالم والثعابين */}
    <svg
      className="absolute inset-0 w-full h-full z-30 pointer-events-none"
      viewBox="0 0 600 600"
      preserveAspectRatio="none"
    >
      {Object.entries(LADDERS).map(([from, to]) =>
        renderLadder(Number(from), to)
      )}

      {Object.entries(SNAKES).map(([from, to], index) =>
        renderSnake(Number(from), to, index)
      )}
    </svg>

    {/* مربعات اللوحة */}
    <div className="relative z-20 grid grid-cols-6 gap-1.5 p-2">
      {boardTiles.map(tile => {
        const hasPlayer = tile === position;
        const ladderTo = LADDERS[tile];
        const snakeTo = SNAKES[tile];

        return (
          <div
            key={tile}
            className={`relative aspect-square rounded-xl border text-[10px] font-black flex items-center justify-center transition-all shadow-sm ${
              tile === BOARD_SIZE
                ? 'bg-warning/10 border-warning/30 text-warning'
                : tile === 1
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-white/80 border-borderColor text-textSecondary'
            }`}
          >
            <span className="absolute top-1 right-1 text-[8px] opacity-70">
              {tile}
            </span>

            {tile === 1 && (
              <span className="text-[9px] font-black text-primary">
                بداية
              </span>
            )}

            {tile === BOARD_SIZE && (
              <div className="flex flex-col items-center gap-0.5">
                <Trophy className="w-4 h-4 text-warning" />
                <span className="text-[8px] font-black">النهاية</span>
              </div>
            )}

            {ladderTo && (
              <span className="absolute bottom-1 left-1 text-[8px] font-black text-success bg-success/10 px-1 rounded">
                سلم
              </span>
            )}

            {snakeTo && (
              <span className="absolute bottom-1 left-1 text-[8px] font-black text-danger bg-danger/10 px-1 rounded">
                ثعبان
              </span>
            )}

            {hasPlayer && (
              <div className="absolute inset-1 rounded-xl bg-primary text-white flex items-center justify-center shadow-card animate-pulse z-40">
                <Star className="w-4 h-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>

  <div className="flex items-center justify-center gap-4 mt-4 text-[10px] font-bold text-textSecondary">
    <span className="flex items-center gap-1">
      <ArrowUpRight className="w-3 h-3 text-success" />
      سلم يصعدك
    </span>

    <span className="flex items-center gap-1">
      <ArrowDownLeft className="w-3 h-3 text-danger" />
      ثعبان ينزلك
    </span>

    <span className="flex items-center gap-1">
      <Trophy className="w-3 h-3 text-warning" />
      النهاية
    </span>
  </div>
</section>

        {/* Control */}
        <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm text-center">
          {completed ? (
            <div>
              <Trophy className="w-12 h-12 text-warning mx-auto mb-3" />
              <h2 className="text-lg font-black text-textPrimary mb-1">
                فزت بالتحدي!
              </h2>
              <p className="text-[10px] font-bold text-textSecondary mb-4">
                وصلت إلى نهاية اللوحة وجمعت {score} نقطة.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-12 rounded-2xl bg-primary text-white font-black active:scale-95 transition-all"
              >
                لعبة جديدة
              </button>
            </div>
          ) : lives <= 0 ? (
            <div>
              <XCircle className="w-12 h-12 text-danger mx-auto mb-3" />
              <h2 className="text-lg font-black text-textPrimary mb-1">
                انتهت المحاولات
              </h2>
              <p className="text-[10px] font-bold text-textSecondary mb-4">
                راجع الأسئلة التي أخطأت فيها ثم حاول مرة أخرى.
              </p>
              <button
                type="button"
                onClick={resetGame}
                className="w-full h-12 rounded-2xl bg-danger text-white font-black active:scale-95 transition-all"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <div>
              <div className="mx-auto w-20 h-20 rounded-3xl bg-bgSoft border border-borderColor flex items-center justify-center mb-3 shadow-sm">
                <span className="text-4xl font-black text-primary">
                  {dice || '?'}
                </span>
              </div>

              <button
                type="button"
                onClick={rollDice}
                disabled={!canPlay || Boolean(currentQuestion) || isRolling}
                className="w-full h-12 rounded-2xl bg-primary text-white font-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Dice5 className="w-5 h-5" />
{!canPlay
  ? 'بانتظار أسئلة المعلم'
  : isRolling
    ? 'جارٍ رمي النرد...'
    : 'ارمِ النرد'}          
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Question Modal */}
      {currentQuestion && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/30 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bgCard border border-borderColor rounded-3xl p-5 shadow-elevated animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-textPrimary">
                  سؤال قبل التحرك
                </h2>
                <p className="text-[10px] font-bold text-textSecondary">
                  أجب بشكل صحيح لتتقدم {pendingMove} خانات
                </p>
              </div>
            </div>

            <h3 className="text-base font-black text-textPrimary leading-7">
              {currentQuestion.question}
            </h3>

            {renderOptions()}

            {feedback && (
              <div
                className={`mt-4 rounded-2xl border p-3 ${
                  feedback.type === 'correct'
                    ? 'bg-success/10 border-success/20'
                    : 'bg-danger/10 border-danger/20'
                }`}
              >
                <p
                  className={`text-xs font-black mb-1 ${
                    feedback.type === 'correct' ? 'text-success' : 'text-danger'
                  }`}
                >
                  {feedback.message}
                </p>
                {feedback.explanation && (
                  <p className="text-[10px] font-bold text-textSecondary leading-5">
                    {feedback.explanation}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentSnakeLadderGame;

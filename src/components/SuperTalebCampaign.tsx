import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SuperTalebLevel1 from './SuperTalebLevel1';

/**
 * SuperTalebCampaign
 * ------------------
 * مدير الحملة اليومية للعبة سوبر طالب.
 *
 * المسؤوليات:
 * - تخصيص أسئلة كل يوم لمرحلة واحدة بالتناوب 1 ← 2 ← 3، مع فتح كل المراحل في وضع المراجعة.
 * - منع تكرار السؤال داخل الرحلة الواحدة.
 * - حفظ التقدم بعد كل مرحلة واستعادته بعد إغلاق التطبيق.
 * - توحيد النقاط: 10 نقاط لكل إجابة صحيحة فقط.
 * - استدعاء onComplete مرة واحدة بعد اكتمال الرحلة كلها.
 * - الاستعداد لدمج المرحلة الثانية والثالثة دون تغيير StudentGames لاحقًا.
 */

export type SuperTalebCampaignMode = 'daily' | 'review' | 'final_exam';
export type SuperTalebLevelNumber = 1 | 2 | 3;

export interface SuperTalebQuestion {
  id: string;
  question?: string;
  text?: string;
  options?: string[];
  correctAnswerIndex?: number;
  correctAnswerText?: string;
  explanation?: string;
  type?: string;
  visibleFrom?: string;
  publishBatchId?: string;
  [key: string]: unknown;
}

export interface SuperTalebLevelResult {
  score?: number;
  pointsEarned?: number;
  correct?: number;
  correctAnswers?: number;
  wrong?: number;
  wrongAnswers?: number;
  completed?: boolean;
  weakQuestionIds?: string[];
  answeredQuestionIds?: string[];
  correctQuestionIds?: string[];
  coins?: number;
  stars?: number;
  pencilAmmo?: number;
  [key: string]: unknown;
}

export interface SuperTalebCampaignResult {
  gameType: 'super_taleb';
  campaignMode: SuperTalebCampaignMode;
  dailyChallengeId: string;
  score: number;
  pointsEarned: number;
  correct: number;
  wrong: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuestions: number;
  completed: boolean;
  dailyCompleted: boolean;
  certificateGranted: boolean;
  completedLevels: SuperTalebLevelNumber[];
  weakQuestionIds: string[];
  answeredQuestionIds: string[];
  correctQuestionIds: string[];
  pencilAmmo: number;
  stars: 0 | 1 | 2 | 3;
  bonusQuestionsCount: number;
  playedAt: string;
}

export interface SuperTalebLevelComponentProps {
  questions: SuperTalebQuestion[];
  campaignMode: SuperTalebCampaignMode;
  levelNumber: SuperTalebLevelNumber;
  savedLevelState?: Record<string, unknown>;
  onProgress?: (state: Record<string, unknown>) => void;
  onComplete: (result: SuperTalebLevelResult) => void;
  onClose: () => void;
}

export interface SuperTalebCampaignProps {
  questions: SuperTalebQuestion[];
  studentId?: string;
  challengeId?: string;
  campaignMode?: SuperTalebCampaignMode;
  initialUnlockedLevel?: SuperTalebLevelNumber;
  maxDailyQuestions?: number;
  Level2Component?: React.ComponentType<SuperTalebLevelComponentProps>;
  Level3Component?: React.ComponentType<SuperTalebLevelComponentProps>;
  onProgressChange?: (progress: SuperTalebCampaignProgress) => void;
  onComplete: (result: SuperTalebCampaignResult) => void;
  onClose: () => void;
}

interface LevelAssignment {
  level: SuperTalebLevelNumber;
  questionIds: string[];
}

export interface SuperTalebCampaignProgress {
  version: 1;
  campaignKey: string;
  mode: SuperTalebCampaignMode;
  currentLevel: SuperTalebLevelNumber;
  unlockedLevel: SuperTalebLevelNumber;
  activeLevels: SuperTalebLevelNumber[];
  assignments: LevelAssignment[];
  completedLevels: SuperTalebLevelNumber[];
  answeredQuestionIds: string[];
  correctQuestionIds: string[];
  weakQuestionIds: string[];
  score: number;
  pencilAmmo: number;
  levelStates: Partial<Record<SuperTalebLevelNumber, Record<string, unknown>>>;
  bonusQuestionIds: string[];
  completed: boolean;
  finalCallbackSent: boolean;
  updatedAt: string;
}

const STORAGE_PREFIX = 'rased_super_taleb_campaign_v1';
const UNLOCK_PREFIX = 'rased_super_taleb_unlocked_level_v1';
const POINTS_PER_CORRECT_ANSWER = 10;
const DEFAULT_MAX_DAILY_QUESTIONS = 15;
const ROTATION_PREFIX = 'rased_super_taleb_daily_rotation_v1';

function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stableShuffle<T>(items: T[], seedText: string): T[] {
  const copy = [...items];
  const random = seededRandom(hashString(seedText));
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function uniqueQuestions(questions: SuperTalebQuestion[]): SuperTalebQuestion[] {
  const seen = new Set<string>();
  const result: SuperTalebQuestion[] = [];

  questions.forEach((question, index) => {
    const id = String(question.id || `super-taleb-question-${index}`);
    if (seen.has(id)) return;
    seen.add(id);
    result.push({ ...question, id });
  });

  return result;
}

function clampUnlockedLevel(level: number): SuperTalebLevelNumber {
  if (level >= 3) return 3;
  if (level >= 2) return 2;
  return 1;
}

function chooseActiveLevels(
  questionCount: number,
  unlockedLevel: SuperTalebLevelNumber,
  mode: SuperTalebCampaignMode,
): SuperTalebLevelNumber[] {
  const available = ([1, 2, 3] as SuperTalebLevelNumber[]).filter(
    (level) => level <= unlockedLevel,
  );

  if (mode === 'final_exam') {
    // فعالية نهاية العام تستخدم جميع المراحل المفتوحة إذا كان عدد الأسئلة يسمح بذلك.
    if (questionCount >= available.length) return available;
    return available.slice(-Math.max(1, questionCount));
  }

  if (questionCount <= 3) return available.slice(-1);
  if (questionCount <= 7) return available.slice(-Math.min(2, available.length));
  return available;
}

function levelWeights(levels: SuperTalebLevelNumber[]): number[] {
  const key = levels.join('-');
  if (key === '1-2-3') return [0.25, 0.35, 0.4];
  if (levels.length === 2) return [0.4, 0.6];
  return [1];
}

function allocateCounts(total: number, levels: SuperTalebLevelNumber[]): number[] {
  if (levels.length === 0) return [];
  if (total <= 0) return levels.map(() => 0);

  const weights = levelWeights(levels);
  const counts = levels.map(() => 0);
  const guaranteed = Math.min(total, levels.length);

  // سؤال واحد على الأقل لكل مرحلة من المراحل المختارة.
  for (let index = 0; index < guaranteed; index += 1) counts[index] = 1;

  let remaining = total - guaranteed;
  while (remaining > 0) {
    let bestIndex = 0;
    let bestDeficit = Number.NEGATIVE_INFINITY;
    const alreadyAllocated = counts.reduce((sum, count) => sum + count, 0);

    levels.forEach((_, index) => {
      const desired = (alreadyAllocated + 1) * weights[index];
      const deficit = desired - counts[index];
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        bestIndex = index;
      }
    });

    counts[bestIndex] += 1;
    remaining -= 1;
  }

  return counts;
}

function createAssignments(
  questionIds: string[],
  levels: SuperTalebLevelNumber[],
): LevelAssignment[] {
  const counts = allocateCounts(questionIds.length, levels);
  let cursor = 0;
  return levels.map((level, index) => {
    const ids = questionIds.slice(cursor, cursor + counts[index]);
    cursor += counts[index];
    return { level, questionIds: ids };
  });
}

function defaultProgress(
  campaignKey: string,
  mode: SuperTalebCampaignMode,
  unlockedLevel: SuperTalebLevelNumber,
  questionIds: string[],
  bonusQuestionIds: string[],
  forcedActiveLevels?: SuperTalebLevelNumber[],
): SuperTalebCampaignProgress {
  const activeLevels = forcedActiveLevels?.length ? forcedActiveLevels : chooseActiveLevels(questionIds.length, unlockedLevel, mode);
  const assignments = mode === 'review'
    ? activeLevels.map((level) => ({ level, questionIds: [...questionIds] }))
    : createAssignments(questionIds, activeLevels);
  return {
    version: 1,
    campaignKey,
    mode,
    currentLevel: activeLevels[0] || unlockedLevel,
    unlockedLevel,
    activeLevels,
    assignments,
    completedLevels: [],
    answeredQuestionIds: [],
    correctQuestionIds: [],
    weakQuestionIds: [],
    score: 0,
    pencilAmmo: 0,
    levelStates: {},
    bonusQuestionIds,
    completed: false,
    finalCallbackSent: false,
    updatedAt: new Date().toISOString(),
  };
}

function loadProgress(storageKey: string): SuperTalebCampaignProgress | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuperTalebCampaignProgress;
    if (parsed.version !== 1 || !Array.isArray(parsed.assignments)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveProgress(storageKey: string, progress: SuperTalebCampaignProgress): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(progress));
  } catch (error) {
    console.warn('[SuperTalebCampaign] تعذر حفظ تقدم الحملة', error);
  }
}

function loadPermanentUnlockedLevel(studentId: string): SuperTalebLevelNumber {
  try {
    return clampUnlockedLevel(Number(localStorage.getItem(`${UNLOCK_PREFIX}:${studentId}`) || 1));
  } catch {
    return 1;
  }
}

function savePermanentUnlockedLevel(studentId: string, level: SuperTalebLevelNumber): void {
  try {
    const current = loadPermanentUnlockedLevel(studentId);
    localStorage.setItem(`${UNLOCK_PREFIX}:${studentId}`, String(Math.max(current, level)));
  } catch (error) {
    console.warn('[SuperTalebCampaign] تعذر حفظ المرحلة المفتوحة', error);
  }
}

interface DailyRotationState {
  challengeId: string;
  assignedLevel: SuperTalebLevelNumber;
  updatedAt: string;
}

/**
 * يربط كل دفعة يومية بمرحلة واحدة فقط:
 * اليوم/الدفعة الأولى = 1، التالية = 2، التالية = 3 ثم تعاد الدورة.
 * لا ينتقل الدور إلى مرحلة لم يفتحها الطالب بعد، ولا يتغير أثناء اليوم نفسه.
 */
function getDailyRotatingLevel(
  studentId: string,
  challengeId: string,
  unlockedLevel: SuperTalebLevelNumber,
): SuperTalebLevelNumber {
  const key = `${ROTATION_PREFIX}:${studentId}`;
  try {
    const previous = JSON.parse(localStorage.getItem(key) || 'null') as DailyRotationState | null;
    if (previous?.challengeId === challengeId) return clampUnlockedLevel(Math.min(previous.assignedLevel, unlockedLevel));
    const desired = previous ? (((previous.assignedLevel % 3) + 1) as SuperTalebLevelNumber) : 1;
    const assigned = clampUnlockedLevel(Math.min(desired, unlockedLevel));
    localStorage.setItem(key, JSON.stringify({ challengeId, assignedLevel: assigned, updatedAt: new Date().toISOString() }));
    return assigned;
  } catch {
    return 1;
  }
}

function calculateStars(correct: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const ratio = correct / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.7) return 2;
  return 1;
}

const ComingSoonLevel: React.FC<SuperTalebLevelComponentProps> = ({
  levelNumber,
  questions,
  onClose,
}) => (
  <div
    dir="rtl"
    className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 p-4 text-white"
  >
    <div className="w-full max-w-md rounded-3xl border border-sky-400/40 bg-slate-900 p-6 text-center shadow-2xl">
      <div className="mb-3 text-5xl">{levelNumber === 2 ? '📚' : '🏆'}</div>
      <h2 className="mb-2 text-2xl font-black">
        {levelNumber === 2 ? 'فصل راصد الذكي' : 'الاختبار النهائي'}
      </h2>
      <p className="mb-5 text-sm leading-7 text-slate-300">
        تم تخصيص {questions.length} سؤالًا لهذه المرحلة. المكوّن جاهز لاستقبال المرحلة
        الجديدة فور إضافتها.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-2xl bg-sky-500 px-6 py-3 font-bold text-slate-950"
      >
        العودة إلى مركز الألعاب
      </button>
    </div>
  </div>
);

const SuperTalebCampaign: React.FC<SuperTalebCampaignProps> = ({
  questions,
  studentId = 'anonymous-student',
  challengeId,
  campaignMode = 'daily',
  initialUnlockedLevel = 1,
  maxDailyQuestions = DEFAULT_MAX_DAILY_QUESTIONS,
  Level2Component,
  Level3Component,
  onProgressChange,
  onComplete,
  onClose,
}) => {
  const cleanQuestions = useMemo(() => uniqueQuestions(questions), [questions]);
  const questionMap = useMemo(
    () => new Map(cleanQuestions.map((question) => [question.id, question])),
    [cleanQuestions],
  );

  const dailyChallengeId = useMemo(
    () => challengeId || `${campaignMode}-${dateKey()}`,
    [campaignMode, challengeId],
  );

  const campaignKey = useMemo(
    () => `${studentId}:${dailyChallengeId}`,
    [studentId, dailyChallengeId],
  );
  const storageKey = `${STORAGE_PREFIX}:${campaignKey}`;

  const prepared = useMemo(() => {
    const shuffled = stableShuffle(
      cleanQuestions.map((question) => question.id),
      campaignKey,
    );
    const limit = Math.max(1, maxDailyQuestions);
    return {
      coreQuestionIds: shuffled.slice(0, limit),
      bonusQuestionIds: shuffled.slice(limit),
    };
  }, [cleanQuestions, campaignKey, maxDailyQuestions]);

  const [progress, setProgress] = useState<SuperTalebCampaignProgress>(() => {
    const stored = loadProgress(storageKey);
    if (stored && stored.campaignKey === campaignKey) return stored;
    const permanentUnlocked = loadPermanentUnlockedLevel(studentId);
    const unlocked = campaignMode === 'review'
      ? 3
      : clampUnlockedLevel(Math.max(initialUnlockedLevel, permanentUnlocked));
    const forcedLevels: SuperTalebLevelNumber[] = campaignMode === 'review'
      ? [1, 2, 3]
      : campaignMode === 'daily'
        ? [getDailyRotatingLevel(studentId, dailyChallengeId, unlocked)]
        : chooseActiveLevels(prepared.coreQuestionIds.length, unlocked, campaignMode);
    return defaultProgress(
      campaignKey,
      campaignMode,
      unlocked,
      prepared.coreQuestionIds,
      prepared.bonusQuestionIds,
      forcedLevels,
    );
  });

  const progressRef = useRef(progress);
  const finalCallbackRef = useRef(false);

  useEffect(() => {
    progressRef.current = progress;
    saveProgress(storageKey, progress);
    onProgressChange?.(progress);
  }, [progress, storageKey, onProgressChange]);

  useEffect(() => {
    return () => {
      saveProgress(storageKey, progressRef.current);
    };
  }, [storageKey]);

  const assignment = progress.assignments.find(
    (item) => item.level === progress.currentLevel,
  );
  const currentQuestions = (assignment?.questionIds || [])
    .map((id) => questionMap.get(id))
    .filter((question): question is SuperTalebQuestion => Boolean(question));

  const buildFinalResult = useCallback(
    (next: SuperTalebCampaignProgress): SuperTalebCampaignResult => {
      const correct = next.correctQuestionIds.length;
      const total = next.answeredQuestionIds.length;
      const wrong = next.weakQuestionIds.length;
      const score = correct * POINTS_PER_CORRECT_ANSWER;
      return {
        gameType: 'super_taleb',
        campaignMode,
        dailyChallengeId,
        score,
        pointsEarned: score,
        correct,
        wrong,
        correctAnswers: correct,
        wrongAnswers: wrong,
        totalQuestions: total,
        completed: true,
        dailyCompleted: true,
        certificateGranted: campaignMode === 'final_exam',
        completedLevels: next.completedLevels,
        weakQuestionIds: next.weakQuestionIds,
        answeredQuestionIds: next.answeredQuestionIds,
        correctQuestionIds: next.correctQuestionIds,
        pencilAmmo: next.pencilAmmo,
        stars: calculateStars(correct, total),
        bonusQuestionsCount: next.bonusQuestionIds.length,
        playedAt: new Date().toISOString(),
      };
    },
    [campaignMode, dailyChallengeId],
  );

  const finishCampaign = useCallback(
    (next: SuperTalebCampaignProgress) => {
      if (finalCallbackRef.current || next.finalCallbackSent) return;
      finalCallbackRef.current = true;
      const completedProgress: SuperTalebCampaignProgress = {
        ...next,
        completed: true,
        finalCallbackSent: true,
        updatedAt: new Date().toISOString(),
      };
      progressRef.current = completedProgress;
      setProgress(completedProgress);
      onComplete(buildFinalResult(completedProgress));
    },
    [buildFinalResult, onComplete],
  );

  const handleLevelProgress = useCallback(
    (state: Record<string, unknown>) => {
      setProgress((previous) => ({
        ...previous,
        levelStates: {
          ...previous.levelStates,
          [previous.currentLevel]: state,
        },
        updatedAt: new Date().toISOString(),
      }));
    },
    [],
  );

  const handleLevelComplete = useCallback(
    (result: SuperTalebLevelResult) => {
      const snapshot = progressRef.current;
      const level = snapshot.currentLevel;
      const levelAssignment = snapshot.assignments.find((item) => item.level === level);
      const assignedIds = levelAssignment?.questionIds || [];
      const weakIds = new Set((result.weakQuestionIds || []).map(String));
      const explicitAnswered = (result.answeredQuestionIds || []).map(String);
      const answeredIds = explicitAnswered.length > 0 ? explicitAnswered : assignedIds;
      const explicitCorrect = (result.correctQuestionIds || []).map(String);
      const correctIds =
        explicitCorrect.length > 0
          ? explicitCorrect
          : answeredIds.filter((id) => !weakIds.has(id));

      const answered = Array.from(
        new Set([...snapshot.answeredQuestionIds, ...answeredIds]),
      );
      const correct = Array.from(
        new Set([...snapshot.correctQuestionIds, ...correctIds]),
      );
      const weak = Array.from(new Set([...snapshot.weakQuestionIds, ...weakIds]));
      const completedLevels = Array.from(
        new Set([...snapshot.completedLevels, level]),
      ).sort((a, b) => a - b) as SuperTalebLevelNumber[];
      const unlockedLevel = clampUnlockedLevel(
        Math.max(snapshot.unlockedLevel, Math.min(3, level + 1)),
      );
      const currentLevelIndex = snapshot.activeLevels.indexOf(level);
      const nextLevel = snapshot.activeLevels[currentLevelIndex + 1];
      if (snapshot.mode !== 'review') savePermanentUnlockedLevel(studentId, unlockedLevel);

      const nextProgress: SuperTalebCampaignProgress = {
        ...snapshot,
        currentLevel: nextLevel || level,
        unlockedLevel,
        completedLevels,
        answeredQuestionIds: answered,
        correctQuestionIds: correct,
        weakQuestionIds: weak,
        score: correct.length * POINTS_PER_CORRECT_ANSWER,
        pencilAmmo:
          snapshot.pencilAmmo +
          Math.max(0, Number(result.pencilAmmo ?? correctIds.length)),
        levelStates: {
          ...snapshot.levelStates,
          [level]: {
            ...(snapshot.levelStates[level] || {}),
            result,
            completed: true,
          },
        },
        updatedAt: new Date().toISOString(),
      };

      if (!nextLevel) {
        finishCampaign(nextProgress);
      } else {
        progressRef.current = nextProgress;
        setProgress(nextProgress);
      }
    },
    [finishCampaign, studentId],
  );

  if (progress.completed) {
    const result = buildFinalResult(progress);
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 p-4 text-white"
      >
        <div className="w-full max-w-md rounded-3xl border border-amber-300/50 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mb-3 text-6xl">{result.certificateGranted ? '🎓' : '🏆'}</div>
          <h2 className="mb-2 text-2xl font-black">
            {result.certificateGranted ? 'اكتمل تحدي نهاية العام' : campaignMode === 'review' ? 'اكتملت جولة المراجعة' : 'اكتملت مهمة اليوم'}
          </h2>
          <div className="my-5 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-2xl bg-slate-800 p-3">
              <div className="text-xl font-black text-amber-300">{result.score}</div>
              <div className="text-slate-300">النقاط</div>
            </div>
            <div className="rounded-2xl bg-slate-800 p-3">
              <div className="text-xl font-black text-emerald-300">{result.correct}</div>
              <div className="text-slate-300">صحيح</div>
            </div>
            <div className="rounded-2xl bg-slate-800 p-3">
              <div className="text-xl font-black text-sky-300">{result.stars}</div>
              <div className="text-slate-300">النجوم</div>
            </div>
          </div>
          {result.bonusQuestionsCount > 0 && (
            <p className="mb-4 text-sm text-slate-300">
              توجد مهمة إضافية اختيارية تحتوي على {result.bonusQuestionsCount} سؤالًا.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-amber-400 px-6 py-3 font-black text-slate-950"
          >
            العودة إلى مركز الألعاب
          </button>
        </div>
      </div>
    );
  }

  if (cleanQuestions.length === 0 || currentQuestions.length === 0) {
    return (
      <div
        dir="rtl"
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 p-4 text-white"
      >
        <div className="w-full max-w-md rounded-3xl border border-sky-400/40 bg-slate-900 p-6 text-center shadow-2xl">
          <div className="mb-3 text-5xl">📭</div>
          <h2 className="mb-2 text-xl font-black">لا توجد أسئلة لهذه الرحلة</h2>
          <p className="mb-5 text-sm leading-7 text-slate-300">
            ستظهر مهمة سوبر طالب عند وصول أسئلة جديدة من المعلم.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-sky-500 px-6 py-3 font-bold text-slate-950"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  if (progress.currentLevel === 1) {
    return (
      <SuperTalebLevel1
        questions={currentQuestions.map((question) => ({
          ...question,
          correctAnswer: question.correctAnswerIndex ?? 0,
        })) as any}
        onComplete={handleLevelComplete as any}
        onClose={onClose}
      />
    );
  }

  const LevelComponent =
    progress.currentLevel === 2
      ? Level2Component || ComingSoonLevel
      : Level3Component || ComingSoonLevel;

  return (
    <LevelComponent
      questions={currentQuestions}
      campaignMode={campaignMode}
      levelNumber={progress.currentLevel}
      savedLevelState={progress.levelStates[progress.currentLevel]}
      onProgress={handleLevelProgress}
      onComplete={handleLevelComplete}
      onClose={onClose}
    />
  );
};

export default SuperTalebCampaign;

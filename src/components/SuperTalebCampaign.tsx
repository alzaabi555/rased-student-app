import React, { useMemo, useRef, useState } from 'react';
import SuperTalebLevel1 from './SuperTalebLevel1';

/**
 * مدير سوبر طالب بعد اعتماد المرحلة الأولى الموسعة وحدها.
 * لا توجد مرحلة ثانية أو ثالثة، ولا يوجد تناوب أو فتح مراحل.
 */
export type SuperTalebCampaignMode = 'daily' | 'review';
export type SuperTalebLevelNumber = 1;

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
  pencilAmmo?: number;
  knowledgeStars?: number;
  stars?: number;
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
  certificateGranted: false;
  completedLevels: [1];
  weakQuestionIds: string[];
  answeredQuestionIds: string[];
  correctQuestionIds: string[];
  pencilAmmo: number;
  stars: 0 | 1 | 2 | 3;
  bonusQuestionsCount: 0;
  playedAt: string;
}

export interface SuperTalebCampaignProgress {
  version: 2;
  campaignKey: string;
  mode: SuperTalebCampaignMode;
  currentLevel: 1;
  completedLevels: 1[];
  completed: boolean;
  updatedAt: string;
}

export interface SuperTalebCampaignProps {
  questions: SuperTalebQuestion[];
  studentId?: string;
  challengeId?: string;
  campaignMode?: SuperTalebCampaignMode;
  onProgressChange?: (progress: SuperTalebCampaignProgress) => void;
  onComplete: (result: SuperTalebCampaignResult) => void;
  onClose: () => void;
}

const uniqueQuestions = (questions: SuperTalebQuestion[]) => {
  const seen = new Set<string>();
  return questions.filter((question, index) => {
    const id = String(question.id || `super-taleb-${index}`);
    if (seen.has(id)) return false;
    seen.add(id);
    question.id = id;
    return true;
  });
};

const starsFor = (correct: number, total: number): 0 | 1 | 2 | 3 => {
  if (!total) return 0;
  const ratio = correct / total;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  return correct > 0 ? 1 : 0;
};

export default function SuperTalebCampaign({
  questions,
  studentId = 'student',
  challengeId = new Date().toISOString().slice(0, 10),
  campaignMode = 'daily',
  onProgressChange,
  onComplete,
  onClose,
}: SuperTalebCampaignProps) {
  const cleanQuestions = useMemo(() => uniqueQuestions(questions || []), [questions]);
  const [roundKey, setRoundKey] = useState(0);
  const [result, setResult] = useState<SuperTalebCampaignResult | null>(null);
  const callbackSentRef = useRef(false);

  const campaignKey = `rased_super_taleb_single_stage_v2:${studentId}:${challengeId}:${campaignMode}`;

  const handleComplete = (levelResult: SuperTalebLevelResult) => {
    const weak = Array.from(new Set((levelResult.weakQuestionIds || []).map(String)));
    const answered = Array.from(new Set((levelResult.answeredQuestionIds || cleanQuestions.map(q => q.id)).map(String)));
    const explicitCorrect = (levelResult.correctQuestionIds || []).map(String);
    const correctIds = explicitCorrect.length
      ? Array.from(new Set(explicitCorrect))
      : answered.filter(id => !weak.includes(id));
    const correct = Number(levelResult.correct ?? levelResult.correctAnswers ?? correctIds.length);
    const wrong = Number(levelResult.wrong ?? levelResult.wrongAnswers ?? weak.length);
    const score = correct * 10;
    const finalResult: SuperTalebCampaignResult = {
      gameType: 'super_taleb',
      campaignMode,
      dailyChallengeId: challengeId,
      score,
      pointsEarned: score,
      correct,
      wrong,
      correctAnswers: correct,
      wrongAnswers: wrong,
      totalQuestions: answered.length || cleanQuestions.length,
      completed: true,
      dailyCompleted: true,
      certificateGranted: false,
      completedLevels: [1],
      weakQuestionIds: weak,
      answeredQuestionIds: answered,
      correctQuestionIds: correctIds,
      pencilAmmo: Number(levelResult.pencilAmmo || 0),
      stars: starsFor(correct, answered.length || cleanQuestions.length),
      bonusQuestionsCount: 0,
      playedAt: new Date().toISOString(),
    };
    setResult(finalResult);
    onProgressChange?.({ version: 2, campaignKey, mode: campaignMode, currentLevel: 1, completedLevels: [1], completed: true, updatedAt: finalResult.playedAt });
    if (!callbackSentRef.current) {
      callbackSentRef.current = true;
      onComplete(finalResult);
    }
  };

  const restartReview = () => {
    callbackSentRef.current = false;
    setResult(null);
    setRoundKey(value => value + 1);
  };

  if (result) {
    return <div dir="rtl" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950 p-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-amber-300/50 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mb-3 text-6xl">🏆</div>
        <h2 className="mb-2 text-2xl font-black">{campaignMode === 'review' ? 'اكتملت جولة المراجعة' : 'اكتملت مهمة سوبر طالب'}</h2>
        <p className="mb-5 text-sm text-slate-300">رحلة واحدة موسعة داخل مدرسة راصد للتعليم</p>
        <div className="my-5 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-2xl bg-slate-800 p-3"><div className="text-xl font-black text-amber-300">{result.score}</div><div className="text-slate-300">النقاط</div></div>
          <div className="rounded-2xl bg-slate-800 p-3"><div className="text-xl font-black text-emerald-300">{result.correct}</div><div className="text-slate-300">صحيح</div></div>
          <div className="rounded-2xl bg-slate-800 p-3"><div className="text-xl font-black text-sky-300">{result.stars}</div><div className="text-slate-300">النجوم</div></div>
        </div>
        {campaignMode === 'review' ? <div className="grid gap-3">
          <button type="button" onClick={restartReview} className="w-full rounded-2xl bg-emerald-400 px-6 py-3 font-black text-slate-950">ابدأ جولة مراجعة جديدة</button>
          <button type="button" onClick={onClose} className="w-full rounded-2xl border border-slate-600 bg-slate-800 px-6 py-3 font-black">العودة</button>
        </div> : <button type="button" onClick={onClose} className="w-full rounded-2xl bg-amber-400 px-6 py-3 font-black text-slate-950">العودة إلى مركز الألعاب</button>}
      </div>
    </div>;
  }

  return <SuperTalebLevel1
    key={`${campaignKey}:${roundKey}`}
    questions={cleanQuestions.map(question => ({
      id: question.id,
      question: String(question.question || question.text || ''),
      options: question.options || [],
      correctAnswer: question.correctAnswerIndex ?? 0,
      explanation: question.explanation,
    }))}
    onComplete={handleComplete as any}
    onClose={onClose}
  />;
}

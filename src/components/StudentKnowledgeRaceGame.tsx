import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import {
  X,
  Gauge,
  Trophy,
  HelpCircle,
  Heart,
  XCircle,
  RotateCcw,
  Sparkles,
  Flag,
  Zap,
  Play,
  Timer,
  Star
} from 'lucide-react';

// =========================================================================
// 🏁 سباق المعرفة - لعبة تعليمية متقدمة باستخدام Phaser
// -------------------------------------------------------------------------
// الفكرة:
// - الطالب يجيب عن سؤال ليتقدم في السباق.
// - الإجابة الصحيحة تعطي Boost وتزيد السرعة والتقدم.
// - الإجابة الخاطئة تقلل الطاقة وتؤخر المركبة.
// - المنافسون يتحركون تدريجيًا لإضافة حماس.
// - الأسئلة تأتي من راصد المعلم عبر gameQuestions.
// =========================================================================

export interface KnowledgeRaceQuestion {
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

export interface KnowledgeRaceResult {
  gameType: 'knowledge_race';
  score: number;
  correct: number;
  wrong: number;
  progress: number;
  completed: boolean;
  weakQuestionIds: string[];
  playedAt: string;
}

interface StudentKnowledgeRaceGameProps {
  questions: KnowledgeRaceQuestion[];
  studentId?: string;
  onClose: () => void;
  onComplete?: (result: KnowledgeRaceResult) => void;
}

type FeedbackState = {
  type: 'correct' | 'wrong';
  message: string;
  explanation?: string;
} | null;

type RaceController = {
  setProgress: (progress: number) => void;
  setRivals: (rivals: number[]) => void;
  boostCorrect: () => void;
  stumbleWrong: () => void;
  celebrate: () => void;
  resetRace: () => void;
};

const FINISH_PROGRESS = 100;
const MIN_CORRECT_TO_WIN = 5;
const RACE_TIME_SECONDS = 120;

const normalizeQuestions = (questions: KnowledgeRaceQuestion[]) => {
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const getTodayKey = () => new Date().toLocaleDateString('en-CA');

class KnowledgeRaceScene extends Phaser.Scene {
  private playerProgress = 0;
  private rivals = [8, 12, 5];
  private playerCar?: Phaser.GameObjects.Container;
  private rivalCars: Phaser.GameObjects.Container[] = [];
  private finishX = 0;
  private startX = 0;
  private laneYs: number[] = [];
  private resizeTimer?: Phaser.Time.TimerEvent;
  public controller?: RaceController;

  constructor() {
    super('KnowledgeRaceScene');
  }

  create() {
    this.renderScene();

    this.scale.on('resize', this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      if (this.resizeTimer) this.resizeTimer.remove(false);
    });

    this.controller = {
      setProgress: (progress: number) => this.updateProgress(progress),
      setRivals: (rivals: number[]) => this.updateRivals(rivals),
      boostCorrect: () => this.boostCorrect(),
      stumbleWrong: () => this.stumbleWrong(),
      celebrate: () => this.celebrate(),
      resetRace: () => this.resetRace()
    };

    this.events.emit('scene-ready', this.controller);
  }

  private handleResize() {
    if (this.resizeTimer) this.resizeTimer.remove(false);
    this.resizeTimer = this.time.delayedCall(120, () => this.renderScene());
  }

  private renderScene() {
    this.children.removeAll(true);
    this.rivalCars = [];
    this.playerCar = undefined;

    const width = this.scale.width;
    const height = this.scale.height;

    this.drawBackground(width, height);
    this.drawTrack(width, height);
    this.drawCars(width, height);
    this.drawFinishLine(width, height);
    this.placeAllCars(false);
  }

  private drawBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x93c5fd, 0xc4b5fd, 0xdcfce7, 0xfef3c7, 1);
    bg.fillRect(0, 0, width, height);

    bg.fillStyle(0xffffff, 0.22);
    bg.fillCircle(width * 0.18, height * 0.18, Math.min(width, height) * 0.18);
    bg.fillStyle(0x4f46e5, 0.11);
    bg.fillCircle(width * 0.82, height * 0.15, Math.min(width, height) * 0.16);
    bg.fillStyle(0xf59e0b, 0.12);
    bg.fillCircle(width * 0.14, height * 0.86, Math.min(width, height) * 0.13);

    this.add.text(width / 2, 22, 'سباق المعرفة', {
      fontFamily: 'Tajawal, Arial',
      fontSize: `${Math.max(18, Math.round(width * 0.028))}px`,
      color: '#1e293b',
      fontStyle: '900'
    }).setOrigin(0.5, 0);
  }

  private drawTrack(width: number, height: number) {
    const track = this.add.graphics();
    const trackX = Math.max(20, width * 0.055);
    const trackY = Math.max(74, height * 0.20);
    const trackW = width - trackX * 2;
    const trackH = Math.min(height * 0.62, 390);
    const laneH = trackH / 4;

    this.startX = trackX + 42;
    this.finishX = trackX + trackW - 56;
    this.laneYs = [trackY + laneH * 0.65, trackY + laneH * 1.55, trackY + laneH * 2.45, trackY + laneH * 3.35];

    track.fillStyle(0x334155, 0.92);
    track.lineStyle(5, 0xffffff, 0.95);
    track.fillRoundedRect(trackX, trackY, trackW, trackH, 34);
    track.strokeRoundedRect(trackX, trackY, trackW, trackH, 34);

    for (let i = 1; i < 4; i++) {
      const y = trackY + laneH * i;
      track.lineStyle(3, 0xffffff, 0.45);
      track.beginPath();
      for (let x = trackX + 28; x < trackX + trackW - 28; x += 38) {
        track.moveTo(x, y);
        track.lineTo(x + 18, y);
      }
      track.strokePath();
    }

    track.fillStyle(0x22c55e, 0.92);
    track.fillRoundedRect(trackX + 10, trackY + trackH + 10, trackW - 20, 16, 8);

    this.add.text(trackX + 16, trackY - 30, 'خط الانطلاق', {
      fontFamily: 'Tajawal, Arial',
      fontSize: '12px',
      color: '#334155',
      fontStyle: '900'
    }).setOrigin(0, 0.5);

    this.add.text(this.finishX, trackY - 30, 'النهاية 🏁', {
      fontFamily: 'Tajawal, Arial',
      fontSize: '12px',
      color: '#334155',
      fontStyle: '900'
    }).setOrigin(0.5);
  }

  private drawFinishLine(width: number, height: number) {
    const g = this.add.graphics();
    const topY = this.laneYs[0] - 34;
    const bottomY = this.laneYs[this.laneYs.length - 1] + 34;
    const square = 12;

    for (let y = topY; y < bottomY; y += square) {
      for (let x = 0; x < 3; x++) {
        const dark = (Math.floor((y - topY) / square) + x) % 2 === 0;
        g.fillStyle(dark ? 0x111827 : 0xffffff, 1);
        g.fillRect(this.finishX + x * square, y, square, square);
      }
    }
  }

  private drawCars(width: number, height: number) {
    const colors = [0x4f46e5, 0xf97316, 0x22c55e, 0xef4444];
    this.playerCar = this.createCar(colors[0], true);

    for (let i = 0; i < 3; i++) {
      const car = this.createCar(colors[i + 1], false);
      this.rivalCars.push(car);
    }
  }

  private createCar(color: number, isPlayer: boolean) {
    const car = this.add.container(0, 0);
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.18);
    shadow.fillEllipse(0, 14, 58, 18);

    const body = this.add.graphics();
    body.fillStyle(color, 1);
    body.lineStyle(4, 0xffffff, 1);
    body.fillRoundedRect(-32, -18, 64, 36, 16);
    body.strokeRoundedRect(-32, -18, 64, 36, 16);

    body.fillStyle(0xffffff, 0.7);
    body.fillRoundedRect(-7, -15, 24, 18, 8);

    body.fillStyle(0x111827, 1);
    body.fillCircle(-19, 19, 6);
    body.fillCircle(19, 19, 6);
    body.fillStyle(0xe5e7eb, 1);
    body.fillCircle(-19, 19, 2.5);
    body.fillCircle(19, 19, 2.5);

    const label = this.add.text(0, -1, isPlayer ? '★' : '●', {
      fontFamily: 'Arial',
      fontSize: isPlayer ? '20px' : '16px',
      color: '#ffffff',
      fontStyle: '900'
    }).setOrigin(0.5);

    car.add([shadow, body, label]);

    this.tweens.add({
      targets: car,
      y: car.y - 3,
      duration: 550 + Phaser.Math.Between(0, 150),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return car;
  }

  private progressToX(progress: number) {
    return this.startX + (this.finishX - this.startX) * clamp(progress, 0, 100) / 100;
  }

  private placeAllCars(animated: boolean) {
    if (this.playerCar) {
      this.moveCar(this.playerCar, this.progressToX(this.playerProgress), this.laneYs[2], animated);
    }

    this.rivalCars.forEach((car, index) => {
      this.moveCar(car, this.progressToX(this.rivals[index] || 0), this.laneYs[index], animated);
    });
  }

  private moveCar(car: Phaser.GameObjects.Container, x: number, y: number, animated: boolean) {
    if (!animated) {
      car.setPosition(x, y);
      return;
    }

    this.tweens.add({
      targets: car,
      x,
      y,
      duration: 650,
      ease: 'Cubic.easeOut'
    });
  }

  private updateProgress(progress: number) {
    this.playerProgress = clamp(progress, 0, 100);
    this.placeAllCars(true);
  }

  private updateRivals(rivals: number[]) {
    this.rivals = rivals.map(v => clamp(v, 0, 100)).slice(0, 3);
    this.placeAllCars(true);
  }

  private boostCorrect() {
    if (!this.playerCar) return;

    this.cameras.main.flash(130, 34, 197, 94, false);
    this.emitTurbo(this.playerCar.x - 34, this.playerCar.y);

    this.tweens.add({
      targets: this.playerCar,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 120,
      yoyo: true,
      ease: 'Back.easeOut'
    });
  }

  private stumbleWrong() {
    this.cameras.main.shake(220, 0.008);
    if (!this.playerCar) return;

    this.tweens.add({
      targets: this.playerCar,
      angle: 8,
      duration: 70,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => this.playerCar?.setAngle(0)
    });
  }

  private emitTurbo(x: number, y: number) {
    for (let i = 0; i < 16; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), 0xfbbf24, 0.95);
      this.tweens.add({
        targets: p,
        x: x - Phaser.Math.Between(30, 85),
        y: y + Phaser.Math.Between(-22, 22),
        alpha: 0,
        scale: 0.15,
        duration: 450,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy()
      });
    }
  }

  private celebrate() {
    const width = this.scale.width;
    const height = this.scale.height;

    for (let i = 0; i < 55; i++) {
      const color = Phaser.Display.Color.GetColor(
        Phaser.Math.Between(60, 255),
        Phaser.Math.Between(80, 255),
        Phaser.Math.Between(80, 255)
      );
      const p = this.add.circle(width / 2, height * 0.16, 5, color, 0.95);
      this.tweens.add({
        targets: p,
        x: width / 2 + Phaser.Math.Between(-width * 0.42, width * 0.42),
        y: height * 0.18 + Phaser.Math.Between(0, height * 0.55),
        alpha: 0,
        scale: 0.3,
        duration: 900,
        ease: 'Cubic.easeOut',
        onComplete: () => p.destroy()
      });
    }
  }

  private resetRace() {
    this.playerProgress = 0;
    this.rivals = [8, 12, 5];
    this.placeAllCars(false);
  }
}

const StudentKnowledgeRaceGame: React.FC<StudentKnowledgeRaceGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const controllerRef = useRef<RaceController | null>(null);
  const timerRef = useRef<number | null>(null);

  const usableQuestions = useMemo(() => normalizeQuestions(questions), [questions]);
  const questionDeck = useMemo(() => shuffleArray(usableQuestions), [usableQuestions]);

  const [progress, setProgress] = useState(0);
  const [rivals, setRivals] = useState([8, 12, 5]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<KnowledgeRaceQuestion | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [lives, setLives] = useState(3);
  const [energy, setEnergy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(RACE_TIME_SECONDS);
  const [raceStarted, setRaceStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [weakQuestionIds, setWeakQuestionIds] = useState<string[]>([]);

  const canPlay = usableQuestions.length > 0;
  const correctToWin = Math.min(MIN_CORRECT_TO_WIN, Math.max(1, usableQuestions.length));
  const rank = useMemo(() => {
    const all = [progress, ...rivals].sort((a, b) => b - a);
    return all.indexOf(progress) + 1;
  }, [progress, rivals]);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const parent = containerRef.current;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent,
      width: Math.max(parent.clientWidth || 360, 300),
      height: Math.max(parent.clientHeight || 420, 320),
      backgroundColor: '#dbeafe',
      scene: KnowledgeRaceScene,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      render: {
        antialias: true,
        pixelArt: false
      }
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    const controllerTimer = window.setInterval(() => {
      const scene = game.scene.getScene('KnowledgeRaceScene') as KnowledgeRaceScene;
      if (scene?.controller) {
        controllerRef.current = scene.controller;
        window.clearInterval(controllerTimer);
      }
    }, 50);

    return () => {
      window.clearInterval(controllerTimer);
      if (timerRef.current) window.clearInterval(timerRef.current);
      controllerRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setProgress(progress);
  }, [progress]);

  useEffect(() => {
    controllerRef.current?.setRivals(rivals);
  }, [rivals]);

  useEffect(() => {
    if (!raceStarted || completed || !canPlay) return;
    if (timerRef.current) window.clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          finishRace(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [raceStarted, completed, canPlay]);

  const pickQuestion = () => {
    if (questionDeck.length === 0) return null;
    return questionDeck[questionIndex % questionDeck.length];
  };

  const nextRivals = (boost = 0) => {
    return rivals.map((value, index) => {
      const base = 4 + index * 1.2 + Math.random() * 4;
      return clamp(value + base + boost, 0, 100);
    });
  };

  const startRace = () => {
    if (!canPlay) return;
    setRaceStarted(true);
    setFeedback(null);
    setCurrentQuestion(pickQuestion());
  };

  const finishRace = (won: boolean, finalScore = score, finalCorrect = correct, finalWrong = wrong, finalWeakIds = weakQuestionIds, finalProgress = progress) => {
    setCompleted(true);
    setCurrentQuestion(null);
    setFeedback(null);

    if (won) controllerRef.current?.celebrate();

    const result: KnowledgeRaceResult = {
      gameType: 'knowledge_race',
      score: finalScore,
      correct: finalCorrect,
      wrong: finalWrong,
      progress: Math.round(finalProgress),
      completed: won,
      weakQuestionIds: finalWeakIds,
      playedAt: new Date().toISOString()
    };

    try {
      const key = `rased_student_game_stats_${studentId || 'default'}`;
      const oldStats = JSON.parse(localStorage.getItem(key) || '{}');
      const attempts = Number(oldStats.knowledgeRaceAttempts || 0) + 1;
      const bestScore = Math.max(Number(oldStats.knowledgeRaceBestScore || 0), finalScore);

      localStorage.setItem(
        key,
        JSON.stringify({
          ...oldStats,
          knowledgeRaceBestScore: bestScore,
          knowledgeRaceLastScore: finalScore,
          knowledgeRaceAttempts: attempts,
          lastPlayedDate: getTodayKey(),
          lastGameType: 'knowledge_race'
        })
      );

      const resultKey = `rased_game_results_${studentId || 'default'}`;
      const oldResults = JSON.parse(localStorage.getItem(resultKey) || '[]');
      oldResults.unshift(result);
      localStorage.setItem(resultKey, JSON.stringify(oldResults.slice(0, 30)));
    } catch (error) {
      console.error('Failed to save knowledge race result', error);
    }

    if (onComplete) onComplete(result);
  };

  const resolveAnswer = (isCorrect: boolean) => {
    if (!currentQuestion || feedback || completed) return;

    if (!isCorrect) {
      const nextWrong = wrong + 1;
      const nextLives = lives - 1;
      const nextEnergy = clamp(energy - 18, 0, 100);
      const nextWeakIds = Array.from(new Set([...weakQuestionIds, currentQuestion.id]));
      const nextRivalProgress = nextRivals(2);

      setWrong(nextWrong);
      setLives(nextLives);
      setEnergy(nextEnergy);
      setWeakQuestionIds(nextWeakIds);
      setRivals(nextRivalProgress);
      controllerRef.current?.stumbleWrong();

      setFeedback({
        type: 'wrong',
        message: 'إجابة غير صحيحة! فقدت بعض الطاقة وتقدم المنافسون.',
        explanation: currentQuestion.explanation
      });

      setTimeout(() => {
        setFeedback(null);
        setQuestionIndex(prev => prev + 1);

        if (nextLives <= 0 || nextEnergy <= 0) {
          finishRace(false, score, correct, nextWrong, nextWeakIds, progress);
          return;
        }

        if (nextRivalProgress.some(v => v >= FINISH_PROGRESS)) {
          finishRace(false, score, correct, nextWrong, nextWeakIds, progress);
          return;
        }

        setCurrentQuestion(pickQuestion());
      }, 1500);

      return;
    }

    const difficultyBonus = currentQuestion.difficulty === 'hard' ? 7 : currentQuestion.difficulty === 'medium' ? 4 : 2;
    const gain = 14 + difficultyBonus + Math.floor(Math.random() * 5);
    let nextProgress = clamp(progress + gain, 0, 100);
    const nextCorrect = correct + 1;
    const nextScore = score + 120 + gain * 5 + difficultyBonus * 10;
    const nextEnergy = clamp(energy + 8, 0, 100);
    const nextRivalProgress = nextRivals(0);

    let message = 'إجابة صحيحة! حصلت على دفعة سرعة.';

    if (nextProgress >= FINISH_PROGRESS && nextCorrect < correctToWin) {
      nextProgress = 96;
      message = `اقتربت من خط النهاية! تحتاج ${correctToWin - nextCorrect} إجابة صحيحة إضافية للفوز.`;
    }

    setCorrect(nextCorrect);
    setScore(nextScore);
    setEnergy(nextEnergy);
    setProgress(nextProgress);
    setRivals(nextRivalProgress);
    controllerRef.current?.boostCorrect();

    setFeedback({
      type: 'correct',
      message,
      explanation: currentQuestion.explanation
    });

    setTimeout(() => {
      setFeedback(null);
      setQuestionIndex(prev => prev + 1);

      if (nextProgress >= FINISH_PROGRESS && nextCorrect >= correctToWin) {
        finishRace(true, nextScore, nextCorrect, wrong, weakQuestionIds, nextProgress);
        return;
      }

      if (nextRivalProgress.some(v => v >= FINISH_PROGRESS)) {
        finishRace(false, nextScore, nextCorrect, wrong, weakQuestionIds, nextProgress);
        return;
      }

      setCurrentQuestion(pickQuestion());
    }, 1500);
  };

  const handleAnswer = (answerIndex: number) => {
    if (!currentQuestion || feedback) return;

    if (currentQuestion.questionType === 'true_false') {
      const correctIndex = currentQuestion.correctAnswerIndex ?? 0;
      resolveAnswer(answerIndex === correctIndex);
      return;
    }

    resolveAnswer(answerIndex === currentQuestion.correctAnswerIndex);
  };

  const resetRace = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setProgress(0);
    setRivals([8, 12, 5]);
    setQuestionIndex(0);
    setCurrentQuestion(null);
    setFeedback(null);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    setLives(3);
    setEnergy(100);
    setTimeLeft(RACE_TIME_SECONDS);
    setRaceStarted(false);
    setCompleted(false);
    setWeakQuestionIds([]);
    controllerRef.current?.resetRace();
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

  const statCards = (
    <section className="grid grid-cols-2 gap-2">
      <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
        <p className="text-[9px] font-bold text-textSecondary mb-1">النقاط</p>
        <p className="text-xl font-black text-primary">{score}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
        <p className="text-[9px] font-bold text-textSecondary mb-1">المركز</p>
        <p className="text-xl font-black text-warning">{rank}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
        <p className="text-[9px] font-bold text-textSecondary mb-1">صحيح</p>
        <p className="text-xl font-black text-success">{correct}</p>
      </div>
      <div className="bg-bgCard border border-borderColor rounded-2xl p-3 shadow-sm">
        <p className="text-[9px] font-bold text-textSecondary mb-1">خطأ</p>
        <p className="text-xl font-black text-danger">{wrong}</p>
      </div>
    </section>
  );

  const progressPanel = (
    <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm space-y-4">
      <div>
        <div className="flex items-center justify-between text-[10px] font-black mb-1">
          <span className="text-textSecondary">تقدمك في السباق</span>
          <span className="text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 rounded-full bg-bgSoft border border-borderColor overflow-hidden">
          <div className="h-full bg-gradient-to-l from-primary to-info transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] font-black mb-1">
          <span className="text-textSecondary">طاقة المركبة</span>
          <span className="text-success">{energy}%</span>
        </div>
        <div className="h-3 rounded-full bg-bgSoft border border-borderColor overflow-hidden">
          <div className="h-full bg-gradient-to-l from-success to-warning transition-all duration-500" style={{ width: `${energy}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-bgSoft border border-borderColor p-3 text-center">
          <Timer className="w-4 h-4 mx-auto text-primary mb-1" />
          <p className="text-lg font-black text-textPrimary">{timeLeft}</p>
          <p className="text-[8px] font-bold text-textSecondary">ثانية</p>
        </div>
        <div className="rounded-2xl bg-bgSoft border border-borderColor p-3 text-center">
          <Heart className="w-4 h-4 mx-auto text-warning mb-1" />
          <p className="text-lg font-black text-warning">{lives}</p>
          <p className="text-[8px] font-bold text-textSecondary">محاولات</p>
        </div>
      </div>
    </section>
  );

  const controlPanel = (
    <section className="bg-bgCard border border-borderColor rounded-3xl p-4 shadow-sm text-center">
      {!canPlay ? (
        <div>
          <HelpCircle className="w-10 h-10 text-warning mx-auto mb-3" />
          <h2 className="text-sm font-black text-textPrimary mb-1">السباق جاهز بانتظار الأسئلة</h2>
          <p className="text-[10px] font-bold text-textSecondary leading-6">
            ستظهر أسئلة سباق المعرفة عندما يضيف المعلم محتوى الألعاب من راصد المعلم.
          </p>
        </div>
      ) : completed ? (
        <div>
          {progress >= FINISH_PROGRESS ? <Trophy className="w-12 h-12 text-warning mx-auto mb-3" /> : <XCircle className="w-12 h-12 text-danger mx-auto mb-3" />}
          <h2 className="text-lg font-black text-textPrimary mb-1">
            {progress >= FINISH_PROGRESS ? 'فزت بسباق المعرفة!' : 'انتهى السباق'}
          </h2>
          <p className="text-[10px] font-bold text-textSecondary mb-4">
            نتيجتك {score} نقطة، وتقدمك {Math.round(progress)}%.
          </p>
          <button
            type="button"
            onClick={resetRace}
            className="mx-auto w-14 h-14 rounded-2xl bg-primary text-white font-black active:scale-95 transition-all flex items-center justify-center shadow-card"
            aria-label="سباق جديد"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
        </div>
      ) : !raceStarted ? (
        <div>
          <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
            <Flag className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-base font-black text-textPrimary mb-1">استعد للانطلاق</h2>
          <p className="text-[10px] font-bold text-textSecondary leading-5 mb-4">
            أجب بسرعة ودقة لتتجاوز المنافسين وتصل إلى خط النهاية.
          </p>
          <button
            type="button"
            onClick={startRace}
            className="w-full h-12 rounded-2xl bg-gradient-to-l from-primary to-indigo-700 text-white font-black active:scale-95 transition-all flex items-center justify-center gap-2 shadow-card"
          >
            <Play className="w-5 h-5" />
            ابدأ السباق
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-center gap-2 mb-2 text-[10px] font-black text-textPrimary">
            <Zap className="w-4 h-4 text-warning" />
            السباق مستمر
          </div>
          <p className="text-[10px] font-bold text-textSecondary leading-5">
            أجب عن السؤال الحالي لتحصل على دفعة سرعة.
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
              <Gauge className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black text-textPrimary truncate">سباق المعرفة</h1>
              <p className="text-[10px] font-bold text-textSecondary truncate">سباق تفاعلي بأسئلة المعلم 🏁⚡</p>
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

      <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden overscroll-contain custom-scrollbar p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+156px)] lg:pb-4">
        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[430px_minmax(0,1fr)] gap-3 sm:gap-4" dir="rtl">
          <aside className="order-2 lg:order-1 space-y-3 lg:h-full lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pb-2">
            {statCards}
            {progressPanel}
            {controlPanel}
          </aside>

          <section className="order-1 lg:order-2 rounded-3xl overflow-hidden border border-borderColor shadow-card bg-bgCard min-h-[300px] lg:min-h-0 lg:h-full">
            <div
              ref={containerRef}
              className="w-full h-[clamp(300px,calc(100dvh-310px),660px)] max-h-[660px] lg:h-full lg:min-h-0 lg:max-h-none bg-bgMain"
            />
          </section>
        </div>
      </main>

      {currentQuestion && raceStarted && !completed && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/30 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-bgCard border border-borderColor rounded-3xl p-5 shadow-elevated animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-textPrimary">سؤال السرعة</h2>
                <p className="text-[10px] font-bold text-textSecondary">الإجابة الصحيحة تمنحك دفعة سباق</p>
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

export default StudentKnowledgeRaceGame;

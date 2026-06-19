import React, { useEffect, useMemo, useRef, useState } from 'react';
import Phaser from 'phaser';
import {
  X,
  Dice5,
  Trophy,
  HelpCircle,
  Heart,
  XCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

// =========================================================================
// 🐍🪜 السلم والثعبان التعليمي - النسخة النهائية المتجاوبة
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

type PhaserController = {
  movePlayerTo: (tile: number, onDone?: () => void) => void;
  setDice: (value: number | null) => void;
  celebrate: () => void;
  shakeWrong: () => void;
  resetPlayer: () => void;
};

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

const buildTileCenters = (boardX: number, boardY: number, tileSize: number) => {
  const centers: Record<number, { x: number; y: number }> = {};

  for (let tile = 1; tile <= BOARD_SIZE; tile++) {
    const rowFromBottom = Math.floor((tile - 1) / BOARD_COLUMNS);
    const colInRow = (tile - 1) % BOARD_COLUMNS;
    const visualRow = BOARD_COLUMNS - 1 - rowFromBottom;
    const visualCol = rowFromBottom % 2 === 0 ? colInRow : BOARD_COLUMNS - 1 - colInRow;

    centers[tile] = {
      x: boardX + visualCol * tileSize + tileSize / 2,
      y: boardY + visualRow * tileSize + tileSize / 2
    };
  }

  return centers;
};

class SnakeLadderScene extends Phaser.Scene {
  private boardWidth = 0;
  private boardX = 0;
  private boardY = 0;
  private tileSize = 0;
  private centers: Record<number, { x: number; y: number }> = {};
  private playerToken?: Phaser.GameObjects.Container;
  private currentTile = 1;
  private resizeTimer?: Phaser.Time.TimerEvent;
  public controller?: PhaserController;

  constructor() {
    super('SnakeLadderScene');
  }

  create() {
    this.renderScene();
    this.scale.on('resize', this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);
      if (this.resizeTimer) this.resizeTimer.remove(false);
    });

    this.controller = {
      movePlayerTo: (tile: number, onDone?: () => void) => this.animateMoveTo(tile, onDone),
      setDice: () => undefined,
      celebrate: () => this.emitCelebration(),
      shakeWrong: () => this.shakeWrong(),
      resetPlayer: () => this.placePlayer(1)
    };

    this.events.emit('scene-ready', this.controller);
  }

  private renderScene() {
    this.children.removeAll(true);
    this.playerToken = undefined;

    const width = this.scale.width;
    const height = this.scale.height;

    this.cameras.main.setBackgroundColor('#f8fafc');
    this.drawBackground(width, height);
    this.drawBoard(width, height);
    this.drawSnakesAndLadders();
    this.drawPlayer(this.currentTile);
  }

  private handleResize() {
    if (this.resizeTimer) this.resizeTimer.remove(false);
    this.resizeTimer = this.time.delayedCall(100, () => this.renderScene());
  }

  private drawBackground(width: number, height: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xbfdbfe, 0xc7d2fe, 0xfef3c7, 0xdcfce7, 1);
    bg.fillRect(0, 0, width, height);

    const r = Math.min(width, height);
    bg.fillStyle(0x4f46e5, 0.11);
    bg.fillCircle(width * 0.13, height * 0.14, r * 0.16);
    bg.fillStyle(0x0ea5e9, 0.12);
    bg.fillCircle(width * 0.88, height * 0.18, r * 0.18);
    bg.fillStyle(0xf59e0b, 0.10);
    bg.fillCircle(width * 0.14, height * 0.85, r * 0.16);
  }

  private drawBoard(width: number, height: number) {
    const isWide = width >= 720;
    const verticalPadding = isWide ? 24 : 10;
    const minBoard = isWide ? 300 : 210;
    const maxBoard = isWide ? 920 : 680;

    this.boardWidth = Math.max(
      minBoard,
      Math.min(width - 16, height - verticalPadding * 2, maxBoard)
    );

    this.tileSize = this.boardWidth / BOARD_COLUMNS;
    this.boardX = (width - this.boardWidth) / 2;
    this.boardY = Math.max(verticalPadding, Math.floor((height - this.boardWidth) / 2));
    this.centers = buildTileCenters(this.boardX, this.boardY, this.tileSize);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x0f172a, 0.16);
    shadow.fillRoundedRect(this.boardX + 5, this.boardY + 8, this.boardWidth, this.boardWidth, 28);

    const boardBg = this.add.graphics();
    boardBg.fillStyle(0xffffff, 1);
    boardBg.lineStyle(3, 0x94a3b8, 1);
    boardBg.fillRoundedRect(this.boardX, this.boardY, this.boardWidth, this.boardWidth, 28);
    boardBg.strokeRoundedRect(this.boardX, this.boardY, this.boardWidth, this.boardWidth, 28);

    const tileColors = [0xffffff, 0xdbeafe, 0xdcfce7, 0xfef3c7, 0xfce7f3];

    for (let tile = 1; tile <= BOARD_SIZE; tile++) {
      const center = this.centers[tile];
      const gap = Math.max(4, this.tileSize * 0.07);
      const x = center.x - this.tileSize / 2 + gap;
      const y = center.y - this.tileSize / 2 + gap;
      const tileW = this.tileSize - gap * 2;
      const color = tile === 1 ? 0xbfdbfe : tile === BOARD_SIZE ? 0xfcd34d : tileColors[tile % tileColors.length];

      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.lineStyle(2, 0xcbd5e1, 1);
      g.fillRoundedRect(x, y, tileW, tileW, Math.max(8, this.tileSize * 0.13));
      g.strokeRoundedRect(x, y, tileW, tileW, Math.max(8, this.tileSize * 0.13));

      this.add.text(x + tileW - 6, y + 5, String(tile), {
        fontFamily: 'Tajawal, Arial',
        fontSize: `${Math.max(9, Math.round(this.tileSize * 0.13))}px`,
        color: '#334155',
        fontStyle: '900'
      }).setOrigin(1, 0);

      if (tile === 1) {
        this.add.text(center.x, center.y + tileW * 0.16, 'بداية', {
          fontFamily: 'Tajawal, Arial',
          fontSize: `${Math.max(9, Math.round(this.tileSize * 0.15))}px`,
          color: '#1d4ed8',
          fontStyle: '900'
        }).setOrigin(0.5);
      }

      if (tile === BOARD_SIZE) {
        this.add.text(center.x, center.y + tileW * 0.16, 'النهاية', {
          fontFamily: 'Tajawal, Arial',
          fontSize: `${Math.max(9, Math.round(this.tileSize * 0.15))}px`,
          color: '#92400e',
          fontStyle: '900'
        }).setOrigin(0.5);
      }
    }
  }

  private drawLadder(from: number, to: number) {
    const start = this.centers[from];
    const end = this.centers[to];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const railGap = Math.max(10, this.tileSize * 0.14);
    const steps = 5;

    const g = this.add.graphics();
    g.lineStyle(Math.max(7, this.tileSize * 0.09), 0x15803d, 1);
    g.lineBetween(start.x + nx * railGap, start.y + ny * railGap, end.x + nx * railGap, end.y + ny * railGap);
    g.lineBetween(start.x - nx * railGap, start.y - ny * railGap, end.x - nx * railGap, end.y - ny * railGap);

    g.lineStyle(Math.max(4, this.tileSize * 0.055), 0xbbf7d0, 1);
    for (let index = 1; index <= steps; index++) {
      const t = index / (steps + 1);
      const ax = start.x + nx * railGap + (end.x - start.x) * t;
      const ay = start.y + ny * railGap + (end.y - start.y) * t;
      const bx = start.x - nx * railGap + (end.x - start.x) * t;
      const by = start.y - ny * railGap + (end.y - start.y) * t;
      g.lineBetween(ax, ay, bx, by);
    }
  }

  private drawSnake(from: number, to: number, index: number) {
    const start = this.centers[from];
    const end = this.centers[to];
    const midX = (start.x + end.x) / 2 + (index % 2 === 0 ? this.tileSize * 0.5 : -this.tileSize * 0.5);
    const midY = (start.y + end.y) / 2;

    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(start.x, start.y),
      new Phaser.Math.Vector2(midX, midY),
      new Phaser.Math.Vector2(end.x, end.y)
    );

    const points = curve.getPoints(48);
    const g = this.add.graphics();

    g.lineStyle(Math.max(12, this.tileSize * 0.15), 0xdc2626, 1);
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) g.lineTo(p.x, p.y);
    g.strokePath();

    g.lineStyle(Math.max(4, this.tileSize * 0.05), 0xffffff, 0.85);
    for (let i = 0; i < points.length - 1; i += 5) {
      const a = points[i];
      const b = points[Math.min(i + 2, points.length - 1)];
      g.lineBetween(a.x, a.y, b.x, b.y);
    }

    g.fillStyle(0xdc2626, 1);
    g.lineStyle(4, 0xffffff, 1);
    g.fillCircle(start.x, start.y, this.tileSize * 0.21);
    g.strokeCircle(start.x, start.y, this.tileSize * 0.21);

    g.fillStyle(0xffffff, 1);
    g.fillCircle(start.x - this.tileSize * 0.07, start.y - this.tileSize * 0.055, Math.max(3, this.tileSize * 0.032));
    g.fillCircle(start.x + this.tileSize * 0.07, start.y - this.tileSize * 0.055, Math.max(3, this.tileSize * 0.032));

    g.fillStyle(0x111827, 1);
    g.fillCircle(start.x - this.tileSize * 0.07, start.y - this.tileSize * 0.055, Math.max(1.4, this.tileSize * 0.015));
    g.fillCircle(start.x + this.tileSize * 0.07, start.y - this.tileSize * 0.055, Math.max(1.4, this.tileSize * 0.015));
  }

  private drawSnakesAndLadders() {
    Object.entries(LADDERS).forEach(([from, to]) => this.drawLadder(Number(from), to));
    Object.entries(SNAKES).forEach(([from, to], index) => this.drawSnake(Number(from), to, index));
  }

  private drawPlayer(tile: number) {
    const center = this.centers[tile];
    const tokenSize = Math.max(28, this.tileSize * 0.45);

    const container = this.add.container(center.x, center.y);
    const glow = this.add.graphics();
    glow.fillStyle(0x4f46e5, 0.22);
    glow.fillCircle(0, 0, tokenSize * 0.74);

    const body = this.add.graphics();
    body.fillStyle(0x4f46e5, 1);
    body.lineStyle(4, 0xffffff, 1);
    body.fillCircle(0, 0, tokenSize * 0.50);
    body.strokeCircle(0, 0, tokenSize * 0.50);

    const star = this.add.text(0, -1, '★', {
      fontFamily: 'Arial',
      fontSize: `${Math.round(tokenSize * 0.58)}px`,
      color: '#ffffff',
      fontStyle: '900'
    }).setOrigin(0.5);

    container.add([glow, body, star]);
    this.playerToken = container;

    this.tweens.add({
      targets: container,
      scale: 1.07,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private placePlayer(tile: number) {
    this.currentTile = tile;
    if (!this.playerToken) return;
    const center = this.centers[tile];
    this.playerToken.setPosition(center.x, center.y);
  }

  private animateMoveTo(tile: number, onDone?: () => void) {
    if (!this.playerToken) {
      onDone?.();
      return;
    }

    const center = this.centers[tile];
    this.tweens.add({
      targets: this.playerToken,
      x: center.x,
      y: center.y,
      duration: 700,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.currentTile = tile;
        this.emitSmallSparkles(center.x, center.y, 0x4f46e5);
        onDone?.();
      }
    });
  }

  private emitSmallSparkles(x: number, y: number, color: number) {
    for (let i = 0; i < 12; i++) {
      const particle = this.add.circle(x, y, 4, color, 0.9);
      this.tweens.add({
        targets: particle,
        x: x + Phaser.Math.Between(-45, 45),
        y: y + Phaser.Math.Between(-45, 45),
        alpha: 0,
        scale: 0.2,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  private emitCelebration() {
    const x = this.scale.width / 2;
    const y = this.boardY + 40;

    for (let i = 0; i < 35; i++) {
      const color = Phaser.Display.Color.GetColor(
        Phaser.Math.Between(50, 245),
        Phaser.Math.Between(120, 245),
        Phaser.Math.Between(50, 245)
      );
      this.emitSmallSparkles(x + Phaser.Math.Between(-120, 120), y + Phaser.Math.Between(0, 140), color);
    }
  }

  private shakeWrong() {
    this.cameras.main.shake(250, 0.01);
    if (this.playerToken) {
      this.tweens.add({
        targets: this.playerToken,
        x: this.playerToken.x + 8,
        duration: 55,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut'
      });
    }
  }
}

const StudentSnakeLadderGame: React.FC<StudentSnakeLadderGameProps> = ({
  questions,
  studentId,
  onClose,
  onComplete
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const controllerRef = useRef<PhaserController | null>(null);

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

  const canPlay = usableQuestions.length > 0;
  const correctToWin = Math.min(MIN_CORRECT_TO_WIN, Math.max(1, usableQuestions.length));

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const parent = containerRef.current;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent,
      width: Math.max(parent.clientWidth || 320, 260),
      height: Math.max(parent.clientHeight || 300, 220),
      backgroundColor: '#f8fafc',
      scene: SnakeLadderScene,
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
      const scene = game.scene.getScene('SnakeLadderScene') as SnakeLadderScene;
      if (scene?.controller) {
        controllerRef.current = scene.controller;
        window.clearInterval(controllerTimer);
      }
    }, 50);

    return () => {
      window.clearInterval(controllerTimer);
      controllerRef.current = null;
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

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

    if (onComplete) onComplete(result);
  };

  const rollDice = () => {
    if (!canPlay || currentQuestion || completed || lives <= 0 || isRolling) return;

    setIsRolling(true);
    setFeedback(null);

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
      controllerRef.current?.shakeWrong();
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
      }, 1700);

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

    if (finalPosition >= BOARD_SIZE && nextCorrect < correctToWin) {
      finalPosition = BOARD_SIZE - 1;
      bonusMessage = `اقتربت من الفوز! أجب عن ${correctToWin - nextCorrect} سؤال/أسئلة صحيحة إضافية لإنهاء التحدي.`;
    }

    setScore(nextScore);
    setCorrect(nextCorrect);
    setFeedback({
      type: 'correct',
      message: bonusMessage,
      explanation: currentQuestion.explanation
    });

    controllerRef.current?.movePlayerTo(finalPosition, () => {
      setPosition(finalPosition);

      setTimeout(() => {
        setCurrentQuestion(null);
        setFeedback(null);
        setQuestionIndex(prev => prev + 1);

        if (finalPosition >= BOARD_SIZE && nextCorrect >= correctToWin) {
          setCompleted(true);
          controllerRef.current?.celebrate();
          saveResult(true, nextScore, nextCorrect, wrong, weakQuestionIds, finalPosition);
        }
      }, 700);
    });
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
    controllerRef.current?.resetPlayer();
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
className={`relative h-14 sm:h-16 rounded-2xl bg-white border-2 border-primary/30 shadow-card flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 overflow-hidden px-2.5 sm:px-3 ${        isRolling ? 'ring-4 ring-primary/10' : ''
      }`}
      aria-label={`نتيجة النرد ${dice || 'غير محددة'}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-white to-warning/10" />
<span className="relative text-2xl sm:text-3xl leading-none drop-shadow-sm" aria-hidden="true">  
  🎲
      </span>
<span className="relative min-w-5 sm:min-w-6 text-center text-2xl sm:text-3xl font-black text-primary leading-none">    
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
className="w-14 h-14 max-[380px]:w-380px]:h-12 rounded-2xl bg-primary text-white font-black active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-card"                aria-label="ارمِ النرد"
                title={!canPlay ? 'بانتظار أسئلة المعلم' : 'ارمِ النرد'}
              >
                <Dice5 className={`w-6 h-6 ${isRolling ? 'animate-spin' : ''}`} />
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
              <p className="text-[10px] font-bold text-textSecondary truncate">لعبة تفاعلية مرتبطة بأسئلة المعلم 🐍🪜</p>
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

<main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden overscroll-contain custom-scrollbar p-2.5 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+180px)] lg:pb-4">        <div className="h-full min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)] gap-3 sm:gap-4" dir="rtl">
         <aside className="order-2 lg:order-1 space-y-2.5 lg:h-full lg:min-h-0 lg:overflow-y-auto custom-scrollbar lg:pb-2">
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
            {controlBlock}
          </aside>

          <section className="order-1 lg:order-2 rounded-3xl overflow-hidden border border-borderColor shadow-card bg-bgCard min-h-[220px] lg:min-h-0 lg:h-full">
            <div
              ref={containerRef}
              className="w-full h-[clamp(205px,calc(100dvh-430px),620px)] max-h-[620px] lg:h-full lg:min-h-0 lg:max-h-none bg-bg
            />
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

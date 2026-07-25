import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SuperTalebQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
}

export interface SuperTalebResult {
  gameType: 'super_taleb';
  score: number;
  pointsEarned: number;
  coins: number;
  knowledgeStars: number;
  correctAnswers: number;
  wrongAnswers: number;
  totalQuestions: number;
  weakQuestionIds: string[];
  level: 1;
  completed: boolean;
  playedAt: string;
}

interface Props {
  questions: SuperTalebQuestion[];
  onComplete: (result: SuperTalebResult) => void;
  onClose: () => void;
}

type GameState = 'menu' | 'playing' | 'question' | 'won' | 'gameover';
type Rect = { x: number; y: number; w: number; h: number };
type Platform = Rect & { kind: 'ground' | 'stone' | 'wood' | 'moving'; vx?: number; minX?: number; maxX?: number };
type Coin = { x: number; y: number; collected: boolean };
type Box = Rect & { questionIndex: number; opened: boolean; active: boolean };
type EnemyKind = 'worksheet' | 'report';
type Enemy = Rect & { kind: EnemyKind; vx: number; minX: number; maxX: number; alive: boolean; hp: number; hitFlash: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number };

const WORLD_W = 5200;
const GROUND_Y = 650;
const PLAYER_W = 54;
const PLAYER_H = 78;
const GRAVITY = 2300;
const MOVE_SPEED = 330;
const RUN_SPEED = 440;
const JUMP_SPEED = 840;

const fallbackQuestions: SuperTalebQuestion[] = [
  { id: 'st-1', question: 'ما عاصمة سلطنة عُمان؟', options: ['صحار', 'مسقط', 'نزوى', 'صلالة'], correctAnswer: 1 },
  { id: 'st-2', question: 'كم عدد أيام الأسبوع؟', options: ['خمسة', 'ستة', 'سبعة', 'ثمانية'], correctAnswer: 2 },
  { id: 'st-3', question: 'أي كلمة تعبّر عن المعرفة؟', options: ['كتاب', 'طريق', 'باب', 'شجرة'], correctAnswer: 0 },
  { id: 'st-4', question: 'ما ناتج 6 + 4؟', options: ['8', '9', '10', '11'], correctAnswer: 2 },
  { id: 'st-5', question: 'العلم العُماني يحتوي على اللون الأخضر.', options: ['صحيح', 'خطأ'], correctAnswer: 0 },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const createLevel = (questionCount: number) => {
  const platforms: Platform[] = [
    { x: 0, y: GROUND_Y, w: 850, h: 180, kind: 'ground' },
    { x: 940, y: GROUND_Y, w: 640, h: 180, kind: 'ground' },
    { x: 1720, y: GROUND_Y, w: 720, h: 180, kind: 'ground' },
    { x: 2560, y: GROUND_Y, w: 560, h: 180, kind: 'ground' },
    { x: 3260, y: GROUND_Y, w: 760, h: 180, kind: 'ground' },
    { x: 4140, y: GROUND_Y, w: 1060, h: 180, kind: 'ground' },
    { x: 330, y: 515, w: 150, h: 28, kind: 'stone' },
    { x: 535, y: 435, w: 145, h: 28, kind: 'stone' },
    { x: 775, y: 500, w: 120, h: 25, kind: 'moving', vx: 70, minX: 730, maxX: 870 },
    { x: 1120, y: 500, w: 170, h: 28, kind: 'stone' },
    { x: 1370, y: 420, w: 135, h: 28, kind: 'stone' },
    { x: 1840, y: 500, w: 180, h: 28, kind: 'wood' },
    { x: 2085, y: 410, w: 135, h: 28, kind: 'stone' },
    { x: 2670, y: 485, w: 155, h: 28, kind: 'stone' },
    { x: 2885, y: 395, w: 150, h: 28, kind: 'moving', vx: 85, minX: 2800, maxX: 3000 },
    { x: 3370, y: 500, w: 175, h: 28, kind: 'stone' },
    { x: 3630, y: 405, w: 150, h: 28, kind: 'stone' },
    { x: 4210, y: 500, w: 165, h: 28, kind: 'wood' },
    { x: 4470, y: 415, w: 150, h: 28, kind: 'stone' },
  ];

  const coinPoints = [
    [180, 575], [255, 575], [365, 455], [445, 455], [565, 375], [645, 375], [800, 445],
    [1020, 575], [1110, 440], [1190, 440], [1405, 360], [1480, 360], [1775, 575], [1870, 440],
    [1960, 440], [2115, 350], [2200, 350], [2610, 575], [2710, 425], [2895, 335], [2980, 335],
    [3320, 575], [3400, 445], [3500, 445], [3665, 345], [3750, 345], [4170, 575], [4250, 440],
    [4520, 355], [4600, 355], [4780, 575], [4880, 575],
  ];
  const coins: Coin[] = coinPoints.map(([x, y]) => ({ x, y, collected: false }));

  const qPositions = [620, 1260, 2180, 3010, 3900, 4580, 4860, 5060];
  const boxes: Box[] = Array.from({ length: Math.min(Math.max(questionCount, 5), 8) }, (_, i) => ({
    x: qPositions[i], y: i % 2 === 0 ? 360 : 515, w: 58, h: 58, questionIndex: i, opened: false, active: false,
  }));

  const enemies: Enemy[] = [
    { x: 720, y: GROUND_Y - 64, w: 54, h: 64, kind: 'worksheet', vx: 60, minX: 680, maxX: 820, alive: true, hp: 1, hitFlash: 0 },
    { x: 1490, y: GROUND_Y - 66, w: 58, h: 66, kind: 'worksheet', vx: -70, minX: 1320, maxX: 1530, alive: true, hp: 1, hitFlash: 0 },
    { x: 2300, y: GROUND_Y - 74, w: 64, h: 74, kind: 'report', vx: 58, minX: 2220, maxX: 2390, alive: true, hp: 2, hitFlash: 0 },
    { x: 3100, y: GROUND_Y - 66, w: 58, h: 66, kind: 'worksheet', vx: -75, minX: 3020, maxX: 3190, alive: true, hp: 1, hitFlash: 0 },
    { x: 3940, y: GROUND_Y - 74, w: 64, h: 74, kind: 'report', vx: 64, minX: 3820, maxX: 3990, alive: true, hp: 2, hitFlash: 0 },
  ];
  return { platforms, coins, boxes, enemies };
};

export default function SuperTalebLevel1({ questions, onComplete, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stateRef = useRef<GameState>('menu');
  const questionPool = useMemo(() => (questions?.length ? questions : fallbackQuestions), [questions]);
  const levelRef = useRef(createLevel(questionPool.length));
  const playerRef = useRef({ x: 105, y: GROUND_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, grounded: false, facing: 1, invincible: 0, runFrame: 0 });
  const inputRef = useRef({ left: false, right: false, jump: false, run: false });
  const cameraRef = useRef(0);
  const dimensionsForCameraRef = useRef(1);
  const particlesRef = useRef<Particle[]>([]);
  const answeredRef = useRef(new Set<number>());
  const weakRef = useRef<string[]>([]);
  const activeBoxRef = useRef<Box | null>(null);
  const statsRef = useRef({ lives: 3, coins: 0, stars: 0, score: 0, correct: 0, wrong: 0 });

  const [gameState, setGameState] = useState<GameState>('menu');
  const [stats, setStats] = useState(statsRef.current);
  const [activeQuestion, setActiveQuestion] = useState<{ q: SuperTalebQuestion; index: number } | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [runEnabled, setRunEnabled] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');

  const setStateSafe = useCallback((s: GameState) => { stateRef.current = s; setGameState(s); }, []);
  const syncStats = useCallback(() => setStats({ ...statsRef.current }), []);

  const spawnBurst = (x: number, y: number, color: string, count = 12) => {
    for (let i = 0; i < count; i++) particlesRef.current.push({
      x, y, vx: (Math.random() - .5) * 280, vy: -80 - Math.random() * 250, life: .55 + Math.random() * .4,
      color, size: 3 + Math.random() * 6,
    });
  };

  const resetGame = useCallback(() => {
    levelRef.current = createLevel(questionPool.length);
    playerRef.current = { x: 105, y: GROUND_Y - PLAYER_H, w: PLAYER_W, h: PLAYER_H, vx: 0, vy: 0, grounded: false, facing: 1, invincible: 0, runFrame: 0 };
    cameraRef.current = 0;
    particlesRef.current = [];
    answeredRef.current.clear(); weakRef.current = [];
    statsRef.current = { lives: 3, coins: 0, stars: 0, score: 0, correct: 0, wrong: 0 };
    inputRef.current = { left: false, right: false, jump: false, run: false };
    syncStats(); setActiveQuestion(null); setSelectedAnswer(null); setFeedback(null); setShowIntro(true); setRunEnabled(false); setStateSafe('playing');
  }, [questionPool.length, setStateSafe, syncStats]);

  const finish = useCallback((completed: boolean) => {
    if (stateRef.current === 'won' || stateRef.current === 'gameover') return;
    setStateSafe(completed ? 'won' : 'gameover');
    const s = statsRef.current;
    onComplete({
      gameType: 'super_taleb', score: s.score, pointsEarned: s.score, coins: s.coins, knowledgeStars: s.stars,
      correctAnswers: s.correct, wrongAnswers: s.wrong, totalQuestions: answeredRef.current.size,
      weakQuestionIds: [...weakRef.current], level: 1, completed, playedAt: new Date().toISOString(),
    });
  }, [onComplete, setStateSafe]);

  const openQuestion = useCallback((box: Box) => {
    if (box.opened || stateRef.current !== 'playing') return;
    const idx = box.questionIndex % questionPool.length;
    playerRef.current.vx = 0;
    inputRef.current = { left: false, right: false, jump: false, run: inputRef.current.run };
    activeBoxRef.current = box;
    setActiveQuestion({ q: questionPool[idx], index: idx });
    setSelectedAnswer(null); setFeedback(null); setStateSafe('question');
  }, [questionPool, setStateSafe]);

  const getCorrectIndex = (q: SuperTalebQuestion) => {
    if (typeof q.correctAnswer === 'number') return q.correctAnswer;
    return Math.max(0, q.options.findIndex(o => String(o).trim() === String(q.correctAnswer).trim()));
  };

  const answer = (optionIndex: number) => {
    if (!activeQuestion || selectedAnswer !== null) return;
    const correct = optionIndex === getCorrectIndex(activeQuestion.q);
    setSelectedAnswer(optionIndex); setFeedback(correct ? 'correct' : 'wrong');
    answeredRef.current.add(activeQuestion.index);
    if (correct) {
      statsRef.current.score += 10; statsRef.current.stars += 1; statsRef.current.correct += 1;
      if (activeBoxRef.current) { activeBoxRef.current.opened = true; spawnBurst(activeBoxRef.current.x + 29, activeBoxRef.current.y, '#FACC15', 18); }
    } else {
      statsRef.current.wrong += 1; weakRef.current.push(activeQuestion.q.id);
      statsRef.current.lives = Math.max(0, statsRef.current.lives - 1);
    }
    syncStats();
    window.setTimeout(() => {
      setActiveQuestion(null); setSelectedAnswer(null); setFeedback(null); activeBoxRef.current = null;
      playerRef.current.vx = 0;
      playerRef.current.vy = 0;
      playerRef.current.invincible = Math.max(playerRef.current.invincible, 1.25);
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jump = false;
      if (statsRef.current.lives <= 0) finish(false); else setStateSafe('playing');
    }, 900);
  };

  useEffect(() => {
    const clearMovement = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
      inputRef.current.jump = false;
    };
    window.addEventListener('blur', clearMovement);
    document.addEventListener('visibilitychange', clearMovement);
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) inputRef.current.left = down;
      if (['ArrowRight', 'd', 'D'].includes(e.key)) inputRef.current.right = down;
      if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) inputRef.current.jump = down;
      if (['Shift'].includes(e.key)) inputRef.current.run = down;
    };
    const kd = key(true), ku = key(false);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', clearMovement); document.removeEventListener('visibilitychange', clearMovement); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const handleViewportChange = () => {
      resize();
      setOrientation(window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
    };
    handleViewportChange();
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    };

    const drawBackground = (w: number, h: number, cam: number) => {
      const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#38BDF8'); sky.addColorStop(.55, '#BAE6FD'); sky.addColorStop(1, '#F0FDF4'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // mountains
      ctx.save(); ctx.translate(-(cam * .08) % 1000, 0); ctx.fillStyle = '#94A3B8';
      for (let i = -1; i < 4; i++) { const x = i * 700; ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x + 170, 180); ctx.lineTo(x + 330, 330); ctx.lineTo(x + 510, 145); ctx.lineTo(x + 700, 330); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      // school campus middle layer
      ctx.save(); ctx.translate(-(cam * .22) % 1200, 0);
      for (let i = -1; i < 5; i++) {
        const x = i * 420; ctx.fillStyle = i % 2 ? '#E8C792' : '#F2D5A4'; roundRect(x, 255, 330, 250, 12); ctx.fill();
        ctx.fillStyle = '#0F4C81'; for (let c = 0; c < 4; c++) { roundRect(x + 30 + c * 70, 305, 42, 72, 12); ctx.fill(); }
        ctx.fillStyle = '#C79A5E'; ctx.fillRect(x, 490, 330, 15);
      }
      ctx.restore();
      // trees and lamps
      ctx.save(); ctx.translate(-(cam * .45) % 480, 0);
      for (let i = -1; i < 8; i++) { const x = i * 135; ctx.fillStyle = '#5B3A22'; ctx.fillRect(x + 64, 380, 12, 125); ctx.fillStyle = '#2F9E44'; ctx.beginPath(); ctx.arc(x + 70, 365, 52, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#111827'; ctx.fillRect(x + 12, 380, 5, 125); ctx.beginPath(); ctx.arc(x + 14, 375, 13, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      // top sign generated by code, exact safe text
      if (cam < 520) {
        const sx = 120 - cam * .85; roundRect(sx, 115, 390, 92, 16); ctx.fillStyle = '#F8E7C8'; ctx.fill(); ctx.strokeStyle = '#8B5E34'; ctx.lineWidth = 5; ctx.stroke();
        ctx.fillStyle = '#0F172A'; ctx.textAlign = 'center'; ctx.font = '700 28px sans-serif'; ctx.fillText('مدرسة راصد للتعليم', sx + 195, 165);
        ctx.fillStyle = '#0B6FB8'; ctx.font = '700 18px sans-serif'; ctx.fillText('راصد', sx + 195, 192);
      }
    };

    const drawPlatform = (p: Platform, cam: number) => {
      const x = p.x - cam; if (x + p.w < -50 || x > canvas.clientWidth + 50) return;
      ctx.fillStyle = p.kind === 'wood' || p.kind === 'moving' ? '#8B5A2B' : '#7A4A22'; roundRect(x, p.y, p.w, p.h, 8); ctx.fill();
      ctx.fillStyle = p.kind === 'wood' || p.kind === 'moving' ? '#D89B54' : '#E4C18B'; ctx.fillRect(x, p.y, p.w, Math.min(18, p.h));
      ctx.fillStyle = '#3A9B43'; ctx.fillRect(x, p.y - 6, p.w, 8);
      if (p.kind === 'wood' || p.kind === 'moving') { ctx.strokeStyle = '#5B351A'; ctx.lineWidth = 3; for (let xx = x + 25; xx < x + p.w; xx += 45) { ctx.beginPath(); ctx.moveTo(xx, p.y + 2); ctx.lineTo(xx, p.y + p.h - 2); ctx.stroke(); } }
    };

    const drawCoin = (c: Coin, cam: number, time: number) => {
      if (c.collected) return; const x = c.x - cam; const s = 14 + Math.sin(time * 7 + c.x) * 2;
      const g = ctx.createRadialGradient(x - 4, c.y - 4, 2, x, c.y, s); g.addColorStop(0, '#FFF7AE'); g.addColorStop(.35, '#FACC15'); g.addColorStop(1, '#D97706'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, c.y, s * .72, s, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#FFF3A3'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#9A6700'; ctx.font = '700 15px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', x, c.y + 5);
    };

    const drawQuestionBox = (b: Box, cam: number, time: number) => {
      const x = b.x - cam; if (x + b.w < 0 || x > canvas.clientWidth) return; const bob = b.opened ? 0 : Math.sin(time * 4 + b.x) * 3;
      ctx.save(); ctx.translate(0, bob); roundRect(x, b.y, b.w, b.h, 10); ctx.fillStyle = b.opened ? '#64748B' : '#F59E0B'; ctx.fill(); ctx.strokeStyle = b.opened ? '#94A3B8' : '#FEF3C7'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#FFF'; ctx.font = '900 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(b.opened ? '✓' : '?', x + b.w / 2, b.y + 40); ctx.restore();
    };

    const drawEnemy = (e: Enemy, cam: number, time: number) => {
      if (!e.alive) return; const x = e.x - cam; const bob = Math.sin(time * 8 + e.x) * 2; ctx.save(); ctx.translate(x, e.y + bob);
      ctx.shadowColor = e.hitFlash > 0 ? '#FFF' : 'transparent'; ctx.shadowBlur = 18;
      if (e.kind === 'worksheet') {
        roundRect(0, 0, e.w, e.h, 9); ctx.fillStyle = '#F7F0DF'; ctx.fill(); ctx.strokeStyle = '#B91C1C'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#B91C1C'; ctx.font = '900 22px sans-serif'; ctx.textAlign='center'; ctx.fillText('×', e.w/2, 24);
        ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(17, 35, 4, 0, Math.PI*2); ctx.arc(e.w-17,35,4,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle='#111827'; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(16,53); ctx.lineTo(e.w/2,45); ctx.lineTo(e.w-16,53); ctx.stroke();
      } else {
        roundRect(0, 0, e.w, e.h, 10); const g=ctx.createLinearGradient(0,0,e.w,e.h); g.addColorStop(0,'#5B21B6'); g.addColorStop(1,'#312E81'); ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle='#C4B5FD'; ctx.lineWidth=3; ctx.stroke();
        ctx.fillStyle='#FFF'; ctx.font='700 16px sans-serif'; ctx.textAlign='center'; ctx.fillText('تقرير',e.w/2,22);
        ctx.fillStyle='#FDE047'; ctx.beginPath(); ctx.arc(18,42,4,0,Math.PI*2); ctx.arc(e.w-18,42,4,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#3F2A1F'; ctx.fillRect(7,e.h-2,14,8); ctx.fillRect(e.w-21,e.h-2,14,8); ctx.restore();
    };

    const drawPlayer = (p: typeof playerRef.current, cam: number, time: number) => {
      const x=p.x-cam, y=p.y; ctx.save(); ctx.translate(x+p.w/2,y+p.h/2); if(p.facing<0)ctx.scale(-1,1);
      const moving=Math.abs(p.vx)>20; const step=moving?Math.sin(time*14)*7:0; const bounce=moving?Math.abs(Math.sin(time*14))*2:Math.sin(time*3)*1.5; ctx.translate(0,-bounce);
      if(p.invincible>0 && Math.floor(p.invincible*14)%2===0)ctx.globalAlpha=.35;
      ctx.fillStyle='rgba(15,23,42,.2)'; ctx.beginPath(); ctx.ellipse(0,p.h/2+4,24,7,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#D6B06C'; ctx.lineWidth=10; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(-10,22); ctx.lineTo(-12+step,37); ctx.moveTo(10,22); ctx.lineTo(12-step,37); ctx.stroke();
      ctx.strokeStyle='#FFFFFF'; ctx.lineWidth=9; ctx.beginPath(); ctx.moveTo(-14,-8); ctx.lineTo(-21-step*.35,10); ctx.moveTo(14,-8); ctx.lineTo(21+step*.35,10); ctx.stroke();
      const body=ctx.createLinearGradient(0,-18,0,25); body.addColorStop(0,'#FFFFFF'); body.addColorStop(1,'#E5E7EB'); ctx.fillStyle=body; roundRect(-17,-18,34,47,12); ctx.fill(); ctx.strokeStyle='#CBD5E1'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='#DDAE73'; ctx.beginPath(); ctx.arc(0,-31,15,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#2A1D19'; ctx.beginPath(); ctx.arc(0,-36,14,Math.PI,Math.PI*2); ctx.fill();
      // Omani mussar
      ctx.fillStyle='#E8B4A7'; ctx.beginPath(); ctx.ellipse(0,-42,17,8,0,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#0F766E'; ctx.lineWidth=2; ctx.stroke();
      ctx.fillStyle='#0F172A'; ctx.beginPath(); ctx.arc(5,-31,2,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#7C2D12'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(3,-25,5,0.1,1.4); ctx.stroke();
      ctx.restore();
    };

    const drawDoor = (cam: number) => {
      const x=5060-cam; if(x>canvas.clientWidth+150)return; roundRect(x,GROUND_Y-205,125,205,10); ctx.fillStyle='#E8D2A5'; ctx.fill(); ctx.strokeStyle='#8B5E34'; ctx.lineWidth=5; ctx.stroke(); roundRect(x+25,GROUND_Y-165,76,165,12); ctx.fillStyle='#183B56'; ctx.fill(); ctx.strokeStyle='#8EC5E8'; ctx.stroke(); ctx.fillStyle='#FACC15'; ctx.beginPath(); ctx.arc(x+88,GROUND_Y-78,5,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#0F172A';ctx.font='700 19px sans-serif';ctx.textAlign='center';ctx.fillText('الفصل الدراسي',x+62,GROUND_Y-220);
    };

    const update = (dt: number, w: number) => {
      if (stateRef.current !== 'playing' || showIntro) return;
      const p=playerRef.current, inp=inputRef.current; const speed=inp.run?RUN_SPEED:MOVE_SPEED;
      p.vx = inp.left&&!inp.right?-speed:inp.right&&!inp.left?speed:p.vx*.78; if(Math.abs(p.vx)<4)p.vx=0; if(p.vx)p.facing=Math.sign(p.vx);
      if(inp.jump&&p.grounded){p.vy=-JUMP_SPEED;p.grounded=false;inp.jump=false;spawnBurst(p.x+p.w/2,p.y+p.h,'#F8FAFC',6);} p.vy+=GRAVITY*dt; p.invincible=Math.max(0,p.invincible-dt);
      const prevY=p.y; p.x=clamp(p.x+p.vx*dt,0,WORLD_W-p.w); p.y+=p.vy*dt; p.grounded=false;
      for(const plat of levelRef.current.platforms){
        if(plat.kind==='moving'){plat.x+=(plat.vx||0)*dt;if(plat.x<(plat.minX||0)||plat.x+(plat.w)> (plat.maxX||WORLD_W)){plat.vx=-(plat.vx||0);plat.x=clamp(plat.x,plat.minX||0,(plat.maxX||WORLD_W)-plat.w);}}
        if(p.vy>=0 && prevY+p.h<=plat.y+10 && p.y+p.h>=plat.y && p.x+p.w>plat.x+5 && p.x<plat.x+plat.w-5){p.y=plat.y-p.h;p.vy=0;p.grounded=true;if(plat.kind==='moving')p.x+=(plat.vx||0)*dt;}
      }
      if(p.y>850){statsRef.current.lives--;syncStats();if(statsRef.current.lives<=0){finish(false);return;}p.x=Math.max(80,cameraRef.current+100);p.y=GROUND_Y-PLAYER_H;p.vx=0;p.vy=0;p.invincible=1.5;}
      for(const c of levelRef.current.coins){if(!c.collected&&overlap(p,{x:c.x-16,y:c.y-18,w:32,h:36})){c.collected=true;statsRef.current.coins++;statsRef.current.score+=2;spawnBurst(c.x,c.y,'#FACC15',8);syncStats();}}
      for(const b of levelRef.current.boxes){if(!b.opened&&overlap(p,b)){openQuestion(b);break;}}
      for(const e of levelRef.current.enemies){if(!e.alive)continue;e.x+=e.vx*dt;if(e.x<e.minX||e.x+e.w>e.maxX){e.vx*=-1;e.x=clamp(e.x,e.minX,e.maxX-e.w);}e.hitFlash=Math.max(0,e.hitFlash-dt);
        if(overlap(p,e)&&p.invincible<=0){const stomp=p.vy>120&&prevY+p.h<=e.y+18;if(stomp){e.hp--;e.hitFlash=.2;p.vy=-520;spawnBurst(e.x+e.w/2,e.y+10,'#F59E0B',12);if(e.hp<=0){e.alive=false;statsRef.current.score+=e.kind==='report'?12:6;syncStats();}}else{statsRef.current.lives--;syncStats();p.invincible=1.4;p.vx=-p.facing*300;p.vy=-420;if(statsRef.current.lives<=0){finish(false);return;}}}
      }
      if(p.x>5000){finish(true);return;}
      const logicalW = w / (dimensionsForCameraRef.current || 1); const target=clamp(p.x-logicalW*.32,0,WORLD_W-logicalW);cameraRef.current+= (target-cameraRef.current)*Math.min(1,dt*6);
      for(const q of particlesRef.current){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=550*dt;q.life-=dt;}particlesRef.current=particlesRef.current.filter(q=>q.life>0);
    };

    const render = (timeMs: number) => {
      const w=canvas.clientWidth,h=canvas.clientHeight,t=timeMs/1000,cam=cameraRef.current;ctx.clearRect(0,0,w,h);drawBackground(w,h,cam);
      ctx.save(); const portraitView = h > w;
      const sceneScale = portraitView ? clamp(h / 790, .86, 1.08) : clamp(h / 760, .72, 1.04);
      dimensionsForCameraRef.current = sceneScale;
      const sy = (h - 760 * sceneScale) / 2;
      ctx.translate(0, sy);
      ctx.scale(sceneScale, sceneScale);
      for(const p of levelRef.current.platforms)drawPlatform(p,cam);
      drawDoor(cam);
      for(const c of levelRef.current.coins)drawCoin(c,cam,t);
      for(const b of levelRef.current.boxes)drawQuestionBox(b,cam,t);
      for(const e of levelRef.current.enemies)drawEnemy(e,cam,t);
      drawPlayer(playerRef.current,cam,t);
      for(const q of particlesRef.current){ctx.globalAlpha=clamp(q.life*1.7,0,1);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x-cam,q.y,q.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;ctx.restore();
    };

    const loop=(ts:number)=>{const dt=Math.min(.033,(ts-lastRef.current)/1000||0);lastRef.current=ts;update(dt,canvas.clientWidth);render(ts);rafRef.current=requestAnimationFrame(loop);};rafRef.current=requestAnimationFrame(loop);
    return()=>{window.removeEventListener('resize',handleViewportChange);window.removeEventListener('orientationchange',handleViewportChange);if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  }, [finish, openQuestion, showIntro, syncStats]);

  const touchButton=(key:keyof typeof inputRef.current)=>(down:boolean)=>()=>{inputRef.current[key]=down;};

  return <div dir="rtl" style={{position:'fixed',inset:0,zIndex:9999,background:'#07152F',fontFamily:'Tajawal, system-ui, sans-serif',overflow:'hidden',userSelect:'none'}}>
    <canvas ref={canvasRef} style={{width:'100%',height:'100%',display:'block',touchAction:'none'}} />

    {gameState==='playing' && <>
      <div style={{position:'absolute',top:orientation==='landscape'?8:12,left:12,right:12,display:'flex',justifyContent:'space-between',alignItems:'center',pointerEvents:'none',transform:orientation==='landscape'?'scale(.92)':'none',transformOrigin:'top center'}}>
        <button onClick={onClose} style={{pointerEvents:'auto',width:46,height:46,borderRadius:16,border:'1px solid rgba(255,255,255,.35)',background:'rgba(7,21,47,.85)',color:'#fff',fontSize:23}}>×</button>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <Hud text={`❤️ ${stats.lives}`} color="#EF4444" />
          <Hud text={`⭐ ${stats.stars}`} color="#FACC15" />
          <Hud text={`🪙 ${stats.coins}`} color="#F59E0B" />
          <Hud text={`النقاط ${stats.score}`} color="#38BDF8" />
        </div>
      </div>
      <div style={{position:'absolute',bottom:orientation==='landscape'?10:22,left:orientation==='landscape'?28:18,right:orientation==='landscape'?28:18,display:'flex',justifyContent:'space-between',alignItems:'flex-end'}}>
        <div style={{display:'flex',gap:12,direction:'ltr'}}>
          <Control label="◀" onDown={touchButton('left')(true)} onUp={touchButton('left')(false)} />
          <Control label="▶" onDown={touchButton('right')(true)} onUp={touchButton('right')(false)} />
        </div>
        <div style={{display:'flex',gap:12}}>
          <Control label="قفز" accent onDown={touchButton('jump')(true)} onUp={touchButton('jump')(false)} />
          <button onClick={() => { const next = !runEnabled; setRunEnabled(next); inputRef.current.run = next; }} style={{width:64,height:64,borderRadius:22,border:runEnabled?'3px solid #FDE68A':'2px solid rgba(255,255,255,.55)',background:runEnabled?'linear-gradient(145deg,#0EA5E9,#0369A1)':'rgba(7,21,47,.78)',color:'#fff',fontSize:16,fontWeight:900,boxShadow:runEnabled?'0 0 24px rgba(56,189,248,.65)':'0 10px 28px rgba(0,0,0,.28)',touchAction:'none'}}>جري</button>
        </div>
      </div>
    </>}

    {gameState==='menu' && <Overlay><Card>
      <div style={{fontSize:58}}>🎓</div><h1 style={title}>سوبر طالب</h1><p style={sub}>المرحلة الأولى: مدرسة راصد للتعليم</p>
      <p style={body}>تحرك واقفز، اجمع العملات ونجوم المعرفة، وافتح صناديق الأسئلة حتى تصل إلى الفصل الدراسي.</p>
      <button style={primary} onClick={resetGame}>ابدأ المرحلة</button><button style={secondary} onClick={onClose}>العودة</button>
    </Card></Overlay>}

    {gameState==='playing' && showIntro && <Overlay><Card>
      <div style={{fontSize:50}}>🏫</div><h2 style={title}>مرحبًا بك يا سوبر طالب</h2><p style={body}>استخدم أزرار الحركة والقفز. افتح صناديق المعرفة، وتجاوز ورقة العمل والتقرير حتى تصل إلى باب الفصل.</p>
      <button style={primary} onClick={()=>setShowIntro(false)}>ابدأ الرحلة</button>
    </Card></Overlay>}

    {gameState==='question' && activeQuestion && <Overlay blur>
      <div style={{width:'min(640px,92vw)',background:'#fff',border:'3px solid #38BDF8',borderRadius:28,padding:24,boxShadow:'0 25px 80px rgba(0,0,0,.42)'}}>
        <div style={{color:'#0369A1',fontWeight:900,fontSize:18}}>⚡ صندوق المعرفة</div>
        <h2 style={{color:'#0F172A',fontSize:'clamp(22px,4vw,34px)',margin:'14px 0 20px',lineHeight:1.5}}>{activeQuestion.q.question}</h2>
        <div style={{display:'grid',gap:11}}>{activeQuestion.q.options.map((o,i)=>{
          const correct=i===getCorrectIndex(activeQuestion.q); const chosen=selectedAnswer===i; let bg='#fff',border='#BAE6FD',color='#0F172A';
          if(selectedAnswer!==null&&correct){bg='#16A34A';border='#15803D';color='#fff';}else if(chosen){bg='#EF4444';border='#B91C1C';color='#fff';}
          return <button key={i} disabled={selectedAnswer!==null} onClick={()=>answer(i)} style={{display:'flex',gap:12,alignItems:'center',padding:'15px 17px',borderRadius:16,border:`2px solid ${border}`,background:bg,color,fontSize:18,fontWeight:800,textAlign:'right'}}><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:chosen||correct?'rgba(255,255,255,.22)':'#E0F2FE'}}>{i+1}</span>{o}</button>
        })}</div>
        {feedback&&<div style={{marginTop:14,fontWeight:900,color:feedback==='correct'?'#15803D':'#B91C1C',fontSize:20}}>{feedback==='correct'?'أحسنت! حصلت على نجمة معرفة ⭐':'حاول في الصندوق التالي، تستطيع النجاح'}</div>}
      </div>
    </Overlay>}

    {(gameState==='won'||gameState==='gameover')&&<Overlay><Card>
      <div style={{fontSize:60}}>{gameState==='won'?'🏆':'🌟'}</div><h2 style={title}>{gameState==='won'?'اكتملت المرحلة الأولى':'انتهت المحاولات'}</h2>
      <p style={sub}>{gameState==='won'?'وصلت إلى الفصل الدراسي بنجاح':'أعد المرحلة واجمع مزيدًا من المعرفة'}</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,margin:'20px 0'}}><Stat label="النقاط" value={stats.score}/><Stat label="العملات" value={stats.coins}/><Stat label="نجوم المعرفة" value={stats.stars}/><Stat label="الإجابات الصحيحة" value={stats.correct}/></div>
      <button style={primary} onClick={resetGame}>إعادة المرحلة</button><button style={secondary} onClick={onClose}>العودة إلى الألعاب</button>
    </Card></Overlay>}
  </div>;
}

function Hud({text,color}:{text:string;color:string}){return <div style={{padding:'9px 13px',borderRadius:14,background:'rgba(7,21,47,.84)',border:`1px solid ${color}88`,color:'#fff',fontWeight:900,fontSize:15,boxShadow:'0 8px 25px rgba(0,0,0,.18)'}}>{text}</div>}
function Control({label,accent,onDown,onUp}:{label:string;accent?:boolean;onDown:()=>void;onUp:()=>void}){return <button onPointerDown={e=>{e.preventDefault();onDown()}} onPointerUp={e=>{e.preventDefault();onUp()}} onPointerCancel={onUp} onPointerLeave={onUp} style={{width:64,height:64,borderRadius:22,border:'2px solid rgba(255,255,255,.55)',background:accent?'linear-gradient(145deg,#F59E0B,#EA580C)':'rgba(7,21,47,.78)',color:'#fff',fontSize:label.length>1?16:27,fontWeight:900,boxShadow:'0 10px 28px rgba(0,0,0,.28)',touchAction:'none'}}>{label}</button>}
function Overlay({children,blur}:{children:React.ReactNode;blur?:boolean}){return <div style={{position:'absolute',inset:0,display:'grid',placeItems:'center',padding:18,background:'rgba(2,12,32,.64)',backdropFilter:blur?'blur(5px)':'blur(2px)',overflow:'auto'}}>{children}</div>}
function Card({children}:{children:React.ReactNode}){return <div style={{width:'min(560px,92vw)',textAlign:'center',padding:'30px 26px',borderRadius:30,background:'linear-gradient(145deg,rgba(7,28,60,.98),rgba(10,54,91,.97))',border:'2px solid rgba(56,189,248,.65)',boxShadow:'0 30px 90px rgba(0,0,0,.53)',color:'#fff'}}>{children}</div>}
function Stat({label,value}:{label:string;value:number}){return <div style={{padding:14,borderRadius:16,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.16)'}}><div style={{fontSize:24,fontWeight:950,color:'#FACC15'}}>{value}</div><div style={{fontSize:14,color:'#D7E7F6'}}>{label}</div></div>}
const title:React.CSSProperties={margin:'8px 0',fontSize:'clamp(30px,6vw,48px)',fontWeight:950,color:'#F8FAFC'};
const sub:React.CSSProperties={margin:'5px 0 12px',color:'#38BDF8',fontSize:19,fontWeight:900};
const body:React.CSSProperties={color:'#D7E7F6',fontSize:17,lineHeight:1.75,margin:'12px auto 22px',maxWidth:460};
const primary:React.CSSProperties={width:'100%',padding:'15px 20px',border:0,borderRadius:17,background:'linear-gradient(135deg,#F59E0B,#EA580C)',color:'#fff',fontSize:19,fontWeight:950,boxShadow:'0 12px 30px rgba(234,88,12,.3)',marginTop:8};
const secondary:React.CSSProperties={width:'100%',padding:'13px 20px',border:'1px solid rgba(255,255,255,.24)',borderRadius:17,background:'rgba(255,255,255,.06)',color:'#fff',fontSize:16,fontWeight:800,marginTop:10};

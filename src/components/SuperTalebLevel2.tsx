import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SuperTalebLevelComponentProps,
  SuperTalebLevelResult,
  SuperTalebQuestion,
} from './SuperTalebCampaign';

type StationId = 'social' | 'science' | 'math';
type Motion = { left: boolean; right: boolean; jump: boolean; run: boolean };
type Player = {
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  grounded: boolean; facing: 1 | -1; lives: number; invulnerableUntil: number;
};
type Platform = { x: number; y: number; w: number; h: number; kind: 'floor'|'desk'|'books'|'ruler' };
type Station = { id: StationId; x: number; y: number; title: string; color: string; active: boolean };
type Hazard = { id: string; x: number; y: number; w: number; h: number; minX: number; maxX: number; vx: number; alive: boolean; kind: 'eraser'|'paper'|'bag' };
type Projectile = { x: number; y: number; vx: number; alive: boolean };

const WORLD_W = 5200;
const WORLD_H = 720;
const GROUND_Y = 590;
const POINTS_PER_CORRECT = 10;

const FALLBACK_QUESTIONS: SuperTalebQuestion[] = [
  { id: 'l2-fallback-1', question: 'ما عاصمة سلطنة عُمان؟', options: ['مسقط', 'صلالة', 'صحار', 'نزوى'], correctAnswerIndex: 0 },
  { id: 'l2-fallback-2', question: 'أي أداة تُستخدم لقياس الزمن؟', options: ['الساعة', 'المسطرة', 'الميزان', 'المجهر'], correctAnswerIndex: 0 },
  { id: 'l2-fallback-3', question: 'ناتج 6 × 4 يساوي:', options: ['20', '22', '24', '26'], correctAnswerIndex: 2 },
];

function questionText(q: SuperTalebQuestion): string { return String(q.question || q.text || 'اختر الإجابة الصحيحة'); }
function answerIndex(q: SuperTalebQuestion): number {
  if (Number.isInteger(q.correctAnswerIndex)) return Number(q.correctAnswerIndex);
  const opts = Array.isArray(q.options) ? q.options : [];
  const byText = opts.findIndex((option) => String(option) === String(q.correctAnswerText || ''));
  return Math.max(0, byText);
}
function stationIndex(id: StationId): number { return id === 'social' ? 0 : id === 'science' ? 1 : 2; }

const SuperTalebLevel2: React.FC<SuperTalebLevelComponentProps> = ({
  questions,
  savedLevelState,
  onProgress,
  onComplete,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(performance.now());
  const motionRef = useRef<Motion>({ left: false, right: false, jump: false, run: false });
  const playerRef = useRef<Player>({ x: 120, y: GROUND_Y - 82, vx: 0, vy: 0, w: 48, h: 82, grounded: true, facing: 1, lives: 3, invulnerableUntil: 0 });
  const cameraRef = useRef(0);
  const projectilesRef = useRef<Projectile[]>([]);
  const answerLockedRef = useRef(false);
  const completionSentRef = useRef(false);
  const safeXRef = useRef(120);

  const usableQuestions = useMemo(() => (questions.length ? questions : FALLBACK_QUESTIONS).slice(0, Math.max(3, questions.length)), [questions]);
  const initialActivated = (savedLevelState?.activatedStations as StationId[] | undefined) || [];
  const initialAnswered = (savedLevelState?.answeredQuestionIds as string[] | undefined) || [];
  const initialCorrect = (savedLevelState?.correctQuestionIds as string[] | undefined) || [];
  const initialWeak = (savedLevelState?.weakQuestionIds as string[] | undefined) || [];

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(Number(savedLevelState?.score || 0));
  const [pencilAmmo, setPencilAmmo] = useState(Number(savedLevelState?.pencilAmmo || 0));
  const [activatedStations, setActivatedStations] = useState<StationId[]>(initialActivated);
  const [answeredIds, setAnsweredIds] = useState<string[]>(initialAnswered);
  const [correctIds, setCorrectIds] = useState<string[]>(initialCorrect);
  const [weakIds, setWeakIds] = useState<string[]>(initialWeak);
  const [activeStation, setActiveStation] = useState<StationId | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<SuperTalebQuestion | null>(null);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [message, setMessage] = useState('شغّل محطات الدراسات الاجتماعية والعلوم والرياضيات');
  const [orientation, setOrientation] = useState<'portrait'|'landscape'>(() => window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const [lives, setLives] = useState(3);

  const stationsRef = useRef<Station[]>([
    { id: 'social', x: 1050, y: 466, title: 'الدراسات الاجتماعية', color: '#d97706', active: initialActivated.includes('social') },
    { id: 'science', x: 2620, y: 466, title: 'العلوم', color: '#0891b2', active: initialActivated.includes('science') },
    { id: 'math', x: 4050, y: 466, title: 'الرياضيات', color: '#7c3aed', active: initialActivated.includes('math') },
  ]);

  const platformsRef = useRef<Platform[]>([
    { x: 0, y: GROUND_Y, w: 5200, h: 130, kind: 'floor' },
    { x: 560, y: 500, w: 250, h: 36, kind: 'desk' },
    { x: 870, y: 445, w: 175, h: 32, kind: 'books' },
    { x: 1420, y: 500, w: 270, h: 36, kind: 'desk' },
    { x: 1780, y: 455, w: 200, h: 30, kind: 'ruler' },
    { x: 2170, y: 510, w: 260, h: 34, kind: 'books' },
    { x: 2850, y: 485, w: 245, h: 36, kind: 'desk' },
    { x: 3200, y: 430, w: 190, h: 32, kind: 'books' },
    { x: 3550, y: 500, w: 260, h: 32, kind: 'ruler' },
    { x: 4310, y: 475, w: 260, h: 38, kind: 'desk' },
  ]);

  const hazardsRef = useRef<Hazard[]>([
    { id: 'eraser-1', x: 740, y: GROUND_Y - 42, w: 58, h: 42, minX: 640, maxX: 900, vx: 55, alive: true, kind: 'eraser' },
    { id: 'paper-1', x: 1900, y: GROUND_Y - 70, w: 58, h: 70, minX: 1700, maxX: 2100, vx: 70, alive: true, kind: 'paper' },
    { id: 'bag-1', x: 3000, y: GROUND_Y - 58, w: 64, h: 58, minX: 2980, maxX: 3200, vx: 0, alive: true, kind: 'bag' },
    { id: 'eraser-2', x: 3780, y: GROUND_Y - 42, w: 58, h: 42, minX: 3640, maxX: 3990, vx: 75, alive: true, kind: 'eraser' },
  ]);

  const persist = useCallback((patch: Record<string, unknown> = {}) => {
    onProgress?.({
      activatedStations,
      answeredQuestionIds: answeredIds,
      correctQuestionIds: correctIds,
      weakQuestionIds: weakIds,
      score,
      pencilAmmo,
      lives,
      playerX: playerRef.current.x,
      ...patch,
    });
  }, [activatedStations, answeredIds, correctIds, weakIds, score, pencilAmmo, lives, onProgress]);

  useEffect(() => { persist(); }, [persist]);

  useEffect(() => {
    const handleResize = () => setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('orientationchange', handleResize); };
  }, []);

  const clearMotion = useCallback(() => { motionRef.current = { left: false, right: false, jump: false, run: false }; playerRef.current.vx = 0; }, []);

  const openStationQuestion = useCallback((station: Station) => {
    if (station.active || activeQuestion) return;
    clearMotion();
    const index = stationIndex(station.id);
    const unanswered = usableQuestions.filter((q) => !answeredIds.includes(String(q.id)));
    const selected = unanswered[0] || usableQuestions[index % usableQuestions.length];
    setActiveStation(station.id);
    setActiveQuestion(selected);
    answerLockedRef.current = false;
  }, [activeQuestion, answeredIds, clearMotion, usableQuestions]);

  const handleAnswer = useCallback((choice: number) => {
    if (!activeQuestion || !activeStation || answerLockedRef.current) return;
    answerLockedRef.current = true;
    const id = String(activeQuestion.id);
    const correct = choice === answerIndex(activeQuestion);
    const nextAnswered = Array.from(new Set([...answeredIds, id]));
    const nextCorrect = correct ? Array.from(new Set([...correctIds, id])) : correctIds;
    const nextWeak = correct ? weakIds : Array.from(new Set([...weakIds, id]));
    const nextScore = score + (correct ? POINTS_PER_CORRECT : 0);
    const nextAmmo = pencilAmmo + (correct ? 1 : 0);

    setAnsweredIds(nextAnswered); setCorrectIds(nextCorrect); setWeakIds(nextWeak);
    setScore(nextScore); setPencilAmmo(nextAmmo);
    setFeedback({ correct, text: correct ? 'إجابة صحيحة! +10 نقاط وطلقة قلم' : 'إجابة غير صحيحة — تستمر المغامرة دون خصم قلب' });

    window.setTimeout(() => {
      const nextActivated = Array.from(new Set([...activatedStations, activeStation])) as StationId[];
      setActivatedStations(nextActivated);
      stationsRef.current.forEach((station) => { if (station.id === activeStation) station.active = true; });
      setMessage(`تم تشغيل محطة ${stationsRef.current.find((s) => s.id === activeStation)?.title || ''}`);
      setActiveQuestion(null); setActiveStation(null); setFeedback(null);
      persist({ activatedStations: nextActivated, answeredQuestionIds: nextAnswered, correctQuestionIds: nextCorrect, weakQuestionIds: nextWeak, score: nextScore, pencilAmmo: nextAmmo });
    }, 850);
  }, [activeQuestion, activeStation, activatedStations, answeredIds, correctIds, weakIds, score, pencilAmmo, persist]);

  const shootPencil = useCallback(() => {
    if (pencilAmmo <= 0 || activeQuestion || !started || finished) return;
    const p = playerRef.current;
    projectilesRef.current.push({ x: p.x + (p.facing === 1 ? p.w : -10), y: p.y + 35, vx: p.facing * 620, alive: true });
    setPencilAmmo((value) => Math.max(0, value - 1));
  }, [pencilAmmo, activeQuestion, started, finished]);

  const finishLevel = useCallback(() => {
    if (completionSentRef.current) return;
    completionSentRef.current = true;
    setFinished(true); clearMotion();
    const result: SuperTalebLevelResult = {
      score: correctIds.length * POINTS_PER_CORRECT,
      pointsEarned: correctIds.length * POINTS_PER_CORRECT,
      correct: correctIds.length,
      wrong: weakIds.length,
      correctAnswers: correctIds.length,
      wrongAnswers: weakIds.length,
      completed: true,
      weakQuestionIds: weakIds,
      answeredQuestionIds: answeredIds,
      correctQuestionIds: correctIds,
      pencilAmmo,
      activatedStations,
      keysCollected: activatedStations.length,
    };
    onComplete(result);
  }, [activatedStations, answeredIds, clearMotion, correctIds, onComplete, pencilAmmo, weakIds]);

  const damagePlayer = useCallback((sourceX: number) => {
    const now = performance.now(); const p = playerRef.current;
    if (now < p.invulnerableUntil) return;
    p.invulnerableUntil = now + 2200;
    p.x = Math.max(80, safeXRef.current); p.y = GROUND_Y - p.h; p.vx = sourceX > p.x ? -80 : 80; p.vy = -180;
    const nextLives = Math.max(0, p.lives - 1); p.lives = nextLives; setLives(nextLives); clearMotion();
    if (nextLives <= 0) { p.lives = 3; setLives(3); p.x = safeXRef.current; setMessage('عدت إلى آخر نقطة آمنة'); }
  }, [clearMotion]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') motionRef.current.left = true;
      if (event.key === 'ArrowRight' || event.key === 'd') motionRef.current.right = true;
      if (event.key === 'ArrowUp' || event.key === ' ' || event.key === 'w') motionRef.current.jump = true;
      if (event.key === 'Shift') motionRef.current.run = true;
      if (event.key === 'f') shootPencil();
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a') motionRef.current.left = false;
      if (event.key === 'ArrowRight' || event.key === 'd') motionRef.current.right = false;
      if (event.key === 'ArrowUp' || event.key === ' ' || event.key === 'w') motionRef.current.jump = false;
      if (event.key === 'Shift') motionRef.current.run = false;
    };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [shootPencil]);

  useEffect(() => {
    if (!started || activeQuestion || finished) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);

    const overlap = (a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;

    const loop = (time: number) => {
      const dt = Math.min(0.033, (time - lastTimeRef.current) / 1000 || 0); lastTimeRef.current = time;
      const p = playerRef.current; const motion = motionRef.current;
      const speed = motion.run ? 260 : 175;
      const axis = (motion.right ? 1 : 0) - (motion.left ? 1 : 0);
      p.vx += (axis * speed - p.vx) * Math.min(1, dt * 12);
      if (axis) p.facing = axis > 0 ? 1 : -1;
      if (motion.jump && p.grounded) { p.vy = -465; p.grounded = false; motion.jump = false; }
      p.vy += 1250 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.x = Math.max(0, Math.min(WORLD_W - p.w, p.x));

      const previousBottom = p.y + p.h - p.vy * dt; p.grounded = false;
      platformsRef.current.forEach((platform) => {
        if (p.x + p.w * 0.8 > platform.x && p.x + p.w * 0.2 < platform.x + platform.w && previousBottom <= platform.y + 12 && p.y + p.h >= platform.y && p.vy >= 0) {
          p.y = platform.y - p.h; p.vy = 0; p.grounded = true;
          if (platform.kind === 'floor' && p.x > safeXRef.current + 180) safeXRef.current = p.x;
        }
      });
      if (p.y > WORLD_H + 100) damagePlayer(p.x);

      hazardsRef.current.forEach((hazard) => {
        if (!hazard.alive) return;
        hazard.x += hazard.vx * dt;
        if (hazard.x <= hazard.minX || hazard.x >= hazard.maxX) hazard.vx *= -1;
        const body = { x: p.x + 10, y: p.y + 14, w: p.w - 20, h: p.h - 18 };
        const target = { x: hazard.x + 9, y: hazard.y + 8, w: hazard.w - 18, h: hazard.h - 10 };
        if (overlap(body, target)) damagePlayer(hazard.x);
      });

      projectilesRef.current.forEach((shot) => {
        if (!shot.alive) return; shot.x += shot.vx * dt;
        hazardsRef.current.forEach((hazard) => { if (hazard.alive && overlap({x:shot.x,y:shot.y,w:24,h:8}, hazard)) { hazard.alive = false; shot.alive = false; } });
        if (shot.x < cameraRef.current - 100 || shot.x > cameraRef.current + 1500) shot.alive = false;
      });
      projectilesRef.current = projectilesRef.current.filter((shot) => shot.alive);

      stationsRef.current.forEach((station) => {
        if (!station.active && Math.abs((p.x+p.w/2) - station.x) < 72 && p.y + p.h > station.y - 20) openStationQuestion(station);
      });

      if (p.x > 4820) {
        if (activatedStations.length === 3) finishLevel();
        else { p.x = 4740; setMessage(`فعّل المحطات المتبقية: ${3 - activatedStations.length}`); }
      }

      const viewW = canvas.clientWidth; const viewH = canvas.clientHeight;
      cameraRef.current += (Math.max(0, Math.min(WORLD_W - viewW, p.x - viewW * 0.34)) - cameraRef.current) * Math.min(1, dt * 6);
      const camera = cameraRef.current;

      const bg = ctx.createLinearGradient(0, 0, 0, viewH); bg.addColorStop(0, '#dff4ff'); bg.addColorStop(1, '#f8e7bd'); ctx.fillStyle = bg; ctx.fillRect(0,0,viewW,viewH);
      ctx.save(); ctx.translate(-camera, 0);
      // جدار الفصل والنوافذ واللوحات
      ctx.fillStyle = '#f4dfb3'; ctx.fillRect(0, 90, WORLD_W, 500);
      for (let x = 250; x < WORLD_W; x += 640) { ctx.fillStyle = '#bfe8ff'; ctx.fillRect(x, 155, 250, 145); ctx.strokeStyle = '#8b5e3c'; ctx.lineWidth = 12; ctx.strokeRect(x,155,250,145); ctx.beginPath(); ctx.moveTo(x+125,155); ctx.lineTo(x+125,300); ctx.moveTo(x,227); ctx.lineTo(x+250,227); ctx.stroke(); }
      ctx.fillStyle = '#78350f'; ctx.fillRect(0, 365, WORLD_W, 18);
      ctx.fillStyle = '#0f766e'; ctx.fillRect(90, 110, 430, 120); ctx.fillStyle = 'white'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('فصل راصد الذكي', 305, 180);

      platformsRef.current.forEach((platform) => {
        if (platform.kind === 'floor') { ctx.fillStyle = '#c28b50'; ctx.fillRect(platform.x,platform.y,platform.w,platform.h); ctx.fillStyle='#e8c086'; for(let x=platform.x;x<platform.x+platform.w;x+=92) ctx.fillRect(x,platform.y+4,86,8); }
        if (platform.kind === 'desk') { ctx.fillStyle='#8b5a2b'; ctx.fillRect(platform.x,platform.y,platform.w,platform.h); ctx.fillStyle='#c98a47'; ctx.fillRect(platform.x,platform.y,platform.w,10); }
        if (platform.kind === 'books') { const colors=['#2563eb','#dc2626','#16a34a','#eab308']; for(let i=0;i<4;i++){ctx.fillStyle=colors[i];ctx.fillRect(platform.x+i*platform.w/4,platform.y,platform.w/4-3,platform.h);} }
        if (platform.kind === 'ruler') { ctx.fillStyle='#facc15'; ctx.fillRect(platform.x,platform.y,platform.w,platform.h); ctx.strokeStyle='#92400e'; ctx.lineWidth=3; for(let x=platform.x+15;x<platform.x+platform.w;x+=25){ctx.beginPath();ctx.moveTo(x,platform.y);ctx.lineTo(x,platform.y+12);ctx.stroke();} }
      });

      stationsRef.current.forEach((station) => {
        ctx.save(); ctx.translate(station.x, station.y); ctx.fillStyle=station.active?'#22c55e':station.color; ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=station.active?24:10; ctx.fillRect(-44,-72,88,72); ctx.shadowBlur=0; ctx.fillStyle='#0f172a'; ctx.fillRect(-30,-55,60,40); ctx.fillStyle='white'; ctx.font='bold 16px sans-serif'; ctx.textAlign='center'; const label=station.id==='social'?'اجتماعيات':station.id==='science'?'علوم':'رياضيات'; ctx.fillText(label,0,-30); ctx.fillStyle=station.active?'#facc15':'#94a3b8'; ctx.beginPath(); ctx.arc(0,18,16,0,Math.PI*2); ctx.fill(); ctx.restore();
      });

      hazardsRef.current.forEach((hazard) => { if(!hazard.alive)return; ctx.save(); ctx.translate(hazard.x,hazard.y); ctx.fillStyle=hazard.kind==='eraser'?'#f472b6':hazard.kind==='paper'?'#f8fafc':'#7c2d12'; ctx.strokeStyle='#0f172a'; ctx.lineWidth=3; ctx.fillRect(0,0,hazard.w,hazard.h); ctx.strokeRect(0,0,hazard.w,hazard.h); ctx.fillStyle='#111827'; ctx.fillRect(13,12,7,7); ctx.fillRect(hazard.w-20,12,7,7); ctx.restore(); });
      projectilesRef.current.forEach((shot)=>{ctx.fillStyle='#facc15';ctx.fillRect(shot.x,shot.y,28,7);ctx.fillStyle='#ec4899';ctx.beginPath();ctx.moveTo(shot.x+28,shot.y);ctx.lineTo(shot.x+36,shot.y+3.5);ctx.lineTo(shot.x+28,shot.y+7);ctx.fill();});

      // السبورة الذكية النهائية
      ctx.fillStyle=activatedStations.length===3?'#0ea5e9':'#334155'; ctx.fillRect(4830,260,270,230); ctx.strokeStyle='#e2e8f0';ctx.lineWidth=12;ctx.strokeRect(4830,260,270,230); ctx.fillStyle='white';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText(activatedStations.length===3?'السبورة جاهزة':'السبورة مغلقة',4965,370);

      // الطالب (رسم مؤقت متماسك إلى أن تُربط أصول الشخصية المشتركة)
      const blink = performance.now() < p.invulnerableUntil && Math.floor(performance.now()/100)%2===0;
      if(!blink){ctx.save();ctx.translate(p.x+p.w/2,p.y+p.h);ctx.scale(p.facing,1);ctx.fillStyle='#fff';ctx.strokeStyle='#1f2937';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-18,-61,36,55,8);ctx.fill();ctx.stroke();ctx.fillStyle='#d6a56c';ctx.beginPath();ctx.arc(0,-71,14,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#8b5e3c';ctx.fillRect(-23,-54,9,35);ctx.fillStyle='#0f172a';ctx.fillRect(-14,-8,11,8);ctx.fillRect(3,-8,11,8);ctx.fillStyle='#f97316';ctx.fillRect(-16,-88,32,8);ctx.restore();}
      ctx.restore();

      // HUD
      ctx.fillStyle='rgba(15,23,42,.88)';ctx.fillRect(12,12,Math.min(560,viewW-24),58);ctx.fillStyle='white';ctx.font='bold 17px sans-serif';ctx.textAlign='left';ctx.fillText(`❤️ ${lives}   ⭐ ${correctIds.length}   ✏️ ${pencilAmmo}   النقاط ${score}`,28,48);
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(14,78,Math.min(680,viewW-28),46);ctx.fillStyle='#0f172a';ctx.font='bold 15px sans-serif';ctx.fillText(message,28,107);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => { observer.disconnect(); if(frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [started, activeQuestion, finished, activatedStations.length, correctIds.length, pencilAmmo, score, lives, damagePlayer, finishLevel, openStationQuestion, message]);

  const press = (key: keyof Motion, value: boolean) => { motionRef.current[key] = value; };
  const controlSize = orientation === 'landscape' ? 76 : 68;
  const baseBtn: React.CSSProperties = { width: controlSize, height: controlSize, borderRadius: 22, border: '2px solid rgba(255,255,255,.65)', background: 'rgba(15,23,42,.85)', color: 'white', fontWeight: 900, fontSize: 23, boxShadow: '0 8px 22px rgba(0,0,0,.25)', touchAction: 'none' };

  return (
    <div className="fixed inset-0 z-[120] overflow-hidden bg-slate-950" dir="rtl">
      <canvas ref={canvasRef} className="h-full w-full" />
      {!started && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-sky-300/40 bg-slate-900 p-6 text-center text-white shadow-2xl">
            <div className="text-6xl">📚</div><h2 className="mt-2 text-3xl font-black">فصل راصد الذكي</h2>
            <p className="mt-3 leading-7 text-slate-300">شغّل محطة الدراسات الاجتماعية ومحطة العلوم ومحطة الرياضيات، واجمع مفاتيح المعرفة لفتح السبورة الذكية.</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm"><div className="rounded-xl bg-amber-500/20 p-3">🗺️ الدراسات الاجتماعية</div><div className="rounded-xl bg-cyan-500/20 p-3">🔬 العلوم</div><div className="rounded-xl bg-violet-500/20 p-3">➗ الرياضيات</div></div>
            <button onClick={()=>setStarted(true)} className="mt-6 rounded-2xl bg-sky-400 px-8 py-3 font-black text-slate-950">ابدأ المرحلة الثانية</button>
          </div>
        </div>
      )}
      {activeQuestion && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-3xl border-2 border-sky-300 bg-white p-5 text-right shadow-2xl">
            <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">محطة {stationsRef.current.find(s=>s.id===activeStation)?.title}</span><span className="text-sm font-bold text-slate-500">سؤال المعرفة</span></div>
            <h3 className="mb-5 text-xl font-black leading-8 text-slate-900">{questionText(activeQuestion)}</h3>
            <div className="grid gap-3">{(activeQuestion.options || []).map((option,index)=><button key={index} disabled={Boolean(feedback)} onClick={()=>handleAnswer(index)} className="rounded-2xl border-2 border-sky-200 bg-white p-4 text-right font-bold text-slate-800 shadow-sm disabled:opacity-80">{index+1}. {option}</button>)}</div>
            {feedback && <div className={`mt-4 rounded-2xl p-4 text-center font-black ${feedback.correct?'bg-emerald-100 text-emerald-800':'bg-rose-100 text-rose-800'}`}>{feedback.text}</div>}
          </div>
        </div>
      )}
      {started && !activeQuestion && !finished && (
        <>
          <button onPointerDown={()=>press('run',true)} onPointerUp={()=>press('run',false)} onPointerCancel={()=>press('run',false)} style={{...baseBtn,position:'absolute',left:18,bottom:20,fontSize:15}}>جري</button>
          {pencilAmmo>0 && <button onClick={shootPencil} style={{...baseBtn,position:'absolute',left:18+controlSize+14,bottom:20,fontSize:18}}>✏️ {pencilAmmo}</button>}
          <div style={{position:'absolute',right:18,bottom:20,display:'flex',gap:18}}><button onPointerDown={()=>press('right',true)} onPointerUp={()=>press('right',false)} onPointerCancel={()=>press('right',false)} style={baseBtn}>▶</button><button onPointerDown={()=>press('left',true)} onPointerUp={()=>press('left',false)} onPointerCancel={()=>press('left',false)} style={baseBtn}>◀</button><button onPointerDown={()=>press('jump',true)} onPointerUp={()=>press('jump',false)} style={{...baseBtn,background:'#f97316',fontSize:16}}>قفز</button></div>
          <button onClick={onClose} className="absolute left-4 top-4 rounded-2xl bg-slate-900/90 px-4 py-3 font-black text-white">×</button>
        </>
      )}
      {finished && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-amber-300 bg-slate-900 p-6 text-center text-white"><div className="text-6xl">🖥️</div><h2 className="mt-2 text-2xl font-black">تم تشغيل فصل راصد الذكي</h2><p className="mt-3 text-slate-300">جمعت مفاتيح المعرفة وفتحت السبورة الذكية.</p><div className="my-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-800 p-3"><b className="text-amber-300">{score}</b><small className="block">النقاط</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-emerald-300">{correctIds.length}</b><small className="block">صحيح</small></div><div className="rounded-xl bg-slate-800 p-3"><b className="text-sky-300">3</b><small className="block">المفاتيح</small></div></div><button onClick={onClose} className="w-full rounded-2xl bg-amber-400 py-3 font-black text-slate-950">متابعة الرحلة</button></div></div>
      )}
    </div>
  );
};

export default SuperTalebLevel2;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Castle, Play, RotateCcw, PenTool, BookOpen, Lightbulb, Heart, Coins, Trophy, Zap } from 'lucide-react';

export type KnowledgeFortressQuestion = {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number | string;
  explanation?: string;
};

export type KnowledgeFortressResult = {
  gameType: 'knowledge_fortress';
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  wavesCompleted: number;
  fortressHealth: number;
  playedAt: string;
  totalQuestions: number;
  completed: boolean;
};

type Props = {
  questions: KnowledgeFortressQuestion[];
  onComplete?: (result: KnowledgeFortressResult) => void;
  onExit?: () => void;
  onClose?: () => void;
  studentId?: string;
};

type TowerKind = 'pencil' | 'book' | 'lamp';
type Screen = 'menu' | 'game' | 'quiz' | 'result';
type Tower = { id: number; slot: number; kind: TowerKind; level: number };
type Enemy = { id: number; lane: number; progress: number; hp: number; maxHp: number; speed: number };

const TOWERS: Record<TowerKind, { name: string; cost: number; damage: number; fireRate: number; Icon: typeof PenTool; color: string }> = {
  pencil: { name: 'برج القلم', cost: 70, damage: 18, fireRate: 620, Icon: PenTool, color: 'from-sky-400 to-blue-700' },
  book: { name: 'برج الكتاب', cost: 110, damage: 34, fireRate: 920, Icon: BookOpen, color: 'from-orange-400 to-red-700' },
  lamp: { name: 'برج المصباح', cost: 95, damage: 13, fireRate: 760, Icon: Lightbulb, color: 'from-yellow-300 to-amber-700' },
};

const SLOTS = [
  { left: 19, top: 23 }, { left: 29, top: 66 }, { left: 44, top: 35 },
  { left: 57, top: 68 }, { left: 68, top: 26 }, { left: 79, top: 61 },
];

const DEFAULT_QUESTIONS: KnowledgeFortressQuestion[] = [
  { question: 'كم يساوي 8 × 7؟', options: ['48', '54', '56', '64'], correctAnswer: 2 },
  { question: 'ما الكوكب الأقرب إلى الشمس؟', options: ['الأرض', 'عطارد', 'المريخ', 'الزهرة'], correctAnswer: 1 },
  { question: 'أي الكلمات الآتية اسم؟', options: ['يكتب', 'كتاب', 'اكتب', 'يقرأ'], correctAnswer: 1 },
  { question: 'ما الغاز الذي تحتاجه النباتات لصنع غذائها؟', options: ['الأكسجين', 'الهيدروجين', 'ثاني أكسيد الكربون', 'النيتروجين'], correctAnswer: 2 },
];

const answerIndex = (q: KnowledgeFortressQuestion) => {
  if (typeof q.correctAnswer === 'number') return q.correctAnswer;
  return q.options.findIndex(option => option === q.correctAnswer);
};

export default function StudentKnowledgeFortressGame({ questions, onComplete, onExit, onClose }: Props) {
  const deck = useMemo(() => (questions?.length ? questions : DEFAULT_QUESTIONS).slice(0, 4), [questions]);
  const [screen, setScreen] = useState<Screen>('menu');
  const [energy, setEnergy] = useState(230);
  const [health, setHealth] = useState(5);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [selected, setSelected] = useState<TowerKind>('pencil');
  const [towers, setTowers] = useState<Tower[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [waveActive, setWaveActive] = useState(false);
  const [feedback, setFeedback] = useState<{ selected: number; ok: boolean } | null>(null);
  const [message, setMessage] = useState('ابنِ برجًا ثم ابدأ الموجة');
  const nextId = useRef(1);
  const spawnTimer = useRef(0);
  const spawnRemaining = useRef(0);
  const waveResolved = useRef(false);
  const answerTimer = useRef<number | null>(null);

  const reset = () => {
    if (answerTimer.current) window.clearTimeout(answerTimer.current);
    setEnergy(230); setHealth(5); setScore(0); setWave(1); setCorrect(0); setWrong(0);
    setSelected('pencil'); setTowers([]); setEnemies([]); setWaveActive(false); setFeedback(null);
    setMessage('ابنِ برجًا ثم ابدأ الموجة'); nextId.current = 1; waveResolved.current = false;
  };

  const start = () => { reset(); setScreen('game'); };

  const placeTower = (slot: number) => {
    if (waveActive || towers.some(t => t.slot === slot)) return;
    const cfg = TOWERS[selected];
    if (energy < cfg.cost) { setMessage('الطاقة غير كافية لبناء هذا البرج'); return; }
    setEnergy(value => value - cfg.cost);
    setTowers(value => [...value, { id: nextId.current++, slot, kind: selected, level: 1 }]);
    setMessage(`تم بناء ${cfg.name}`);
  };

  const beginWave = () => {
    if (waveActive || towers.length === 0) {
      if (!towers.length) setMessage('ابنِ برجًا واحدًا على الأقل قبل بدء الموجة');
      return;
    }
    waveResolved.current = false;
    spawnRemaining.current = 4 + wave * 2;
    spawnTimer.current = 0;
    setEnemies([]);
    setWaveActive(true);
    setMessage(`بدأت الموجة ${wave}`);
  };

  useEffect(() => {
    if (!waveActive || screen !== 'game') return;
    let frame = 0;
    let last = performance.now();
    let attackAccumulator = 0;
    const loop = (now: number) => {
      const dt = Math.min(32, now - last); last = now;
      spawnTimer.current -= dt;
      if (spawnRemaining.current > 0 && spawnTimer.current <= 0) {
        const maxHp = 50 + wave * 20;
        setEnemies(value => [...value, { id: nextId.current++, lane: Math.floor(Math.random() * 3), progress: 0, hp: maxHp, maxHp, speed: 0.000075 + wave * 0.000008 }]);
        spawnRemaining.current -= 1;
        spawnTimer.current = 700;
      }
      attackAccumulator += dt;
      setEnemies(current => current.map(enemy => ({ ...enemy, progress: enemy.progress + enemy.speed * dt })).map(enemy => {
        if (attackAccumulator < 360 || towers.length === 0) return enemy;
        const totalDamage = towers.reduce((sum, tower) => sum + TOWERS[tower.kind].damage * 0.38, 0);
        return { ...enemy, hp: enemy.hp - totalDamage };
      }).filter(enemy => {
        if (enemy.hp <= 0) { setScore(value => value + 2); setEnergy(value => value + 8); return false; }
        if (enemy.progress >= 1) { setHealth(value => Math.max(0, value - 1)); return false; }
        return true;
      }));
      if (attackAccumulator >= 360) attackAccumulator = 0;
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [waveActive, screen, towers, wave]);

  useEffect(() => {
    if (!waveActive || waveResolved.current || spawnRemaining.current > 0 || enemies.length > 0) return;
    waveResolved.current = true;
    setWaveActive(false);
    setFeedback(null);
    setScreen('quiz');
  }, [enemies.length, waveActive]);

  useEffect(() => {
    if (health > 0 || screen !== 'game') return;
    setWaveActive(false);
    setScreen('result');
  }, [health, screen]);

  const chooseAnswer = (index: number) => {
    if (feedback) return;
    const q = deck[(wave - 1) % deck.length];
    const ok = index === answerIndex(q);
    setFeedback({ selected: index, ok });
    if (ok) { setCorrect(value => value + 1); setScore(value => value + 10); setEnergy(value => value + 100); }
    else setWrong(value => value + 1);
    answerTimer.current = window.setTimeout(() => {
      setFeedback(null);
      if (wave >= 4 || health <= 0) setScreen('result');
      else { setWave(value => value + 1); setMessage(ok ? 'تعزيز ناجح: +100 طاقة' : 'استمرت المعركة دون تعزيز'); setScreen('game'); }
    }, 1100);
  };

  useEffect(() => () => { if (answerTimer.current) window.clearTimeout(answerTimer.current); }, []);

  useEffect(() => {
    if (screen !== 'result') return;
    onComplete?.({ gameType: 'knowledge_fortress', score, correctAnswers: correct, wrongAnswers: wrong, wavesCompleted: Math.min(wave, 4), fortressHealth: health, playedAt: new Date().toISOString(), totalQuestions: deck.length, completed: true });
  }, [screen]);

  const currentQuestion = deck[(wave - 1) % deck.length];

  return <div dir="rtl" className="fixed inset-0 z-[2147483647] overflow-hidden bg-[#06152e] text-white">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,#164e63_0%,#07152f_45%,#020617_100%)]" />

    {screen === 'menu' && <div className="relative h-full flex items-center justify-center p-4">
      <section className="w-full max-w-lg rounded-[2.2rem] p-7 text-center border border-cyan-300/35 bg-gradient-to-b from-[#163b67]/95 to-[#07152f]/98 shadow-2xl">
        <div className="mx-auto mb-4 w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-300 to-blue-700 flex items-center justify-center"><Castle className="w-14 h-14" /></div>
        <p className="text-xs text-cyan-200 font-black mb-2">مركز ألعاب راصد</p>
        <h1 className="text-4xl font-black mb-4">حصن المعرفة</h1>
        <p className="text-slate-200 font-bold leading-7 mb-6">ابنِ أبراج المعرفة، أوقف موجات الروبوتات، وأجب عن بوابات الحسم لتحصل على الطاقة.</p>
        <div className="grid grid-cols-3 gap-2 mb-6">{Object.values(TOWERS).map(({ name, Icon, color }) => <div key={name} className="rounded-2xl p-3 bg-white/5 border border-white/10"><span className={`mx-auto mb-2 w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}><Icon className="w-5 h-5" /></span><p className="text-xs font-black">{name}</p></div>)}</div>
        <button onClick={start} className="w-full h-14 rounded-2xl bg-gradient-to-l from-orange-500 to-yellow-400 text-slate-950 font-black text-lg flex items-center justify-center gap-2"><Play className="w-6 h-6" />ابدأ الدفاع</button>
      </section>
    </div>}

    {screen === 'game' && <div className="relative h-full flex flex-col gap-3 p-3">
      <header className="grid grid-cols-4 gap-2">
        <Stat Icon={Heart} title="الحصن" value={health} color="text-red-300" />
        <Stat Icon={Coins} title="الطاقة" value={energy} color="text-yellow-300" />
        <Stat Icon={Zap} title="الموجة" value={`${wave}/4`} color="text-cyan-200" />
        <Stat Icon={Trophy} title="النقاط" value={score} color="text-orange-300" />
      </header>

      <main className="relative flex-1 min-h-0 rounded-[2rem] overflow-hidden border border-cyan-300/25 bg-[#174437] shadow-2xl">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,#22c55e55,transparent_65%)]" />
        <div className="absolute left-0 right-0 top-[31%] h-20 bg-slate-700 rotate-2 shadow-xl" />
        <div className="absolute left-[26%] top-0 bottom-0 w-20 bg-slate-700 -rotate-1" />
        <div className="absolute left-[26%] right-[11%] bottom-[19%] h-20 bg-slate-700 -rotate-1" />
        <div className="absolute right-3 bottom-[12%] w-24 h-28 rounded-3xl border-4 border-yellow-300 bg-gradient-to-br from-cyan-300 via-blue-600 to-slate-950 flex flex-col items-center justify-center shadow-xl"><Castle className="w-11 h-11" /><span className="text-xs font-black">حصن راصد</span></div>

        {SLOTS.map((slot, index) => {
          const tower = towers.find(value => value.slot === index);
          const cfg = tower ? TOWERS[tower.kind] : null;
          return <button key={index} onClick={() => placeTower(index)} style={{ left: `${slot.left}%`, top: `${slot.top}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-dashed border-cyan-100/60 bg-[#07152f]/75 flex items-center justify-center shadow-lg">
            {tower && cfg ? <span className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.color} flex items-center justify-center`}><cfg.Icon className="w-6 h-6" /></span> : <span className="text-2xl">+</span>}
          </button>;
        })}

        {enemies.map(enemy => <div key={enemy.id} style={{ left: `${8 + enemy.lane * 24 + enemy.progress * 62}%`, top: `${27 + Math.sin(enemy.progress * 8) * 14}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-14 transition-[left] duration-75">
          <div className="absolute -top-3 left-0 right-0 h-1.5 rounded-full bg-slate-950 overflow-hidden"><div className="h-full bg-lime-400" style={{ width: `${Math.max(0, enemy.hp / enemy.maxHp * 100)}%` }} /></div>
          <div className="w-full h-full rounded-2xl bg-gradient-to-b from-red-400 to-red-900 border-2 border-orange-200 flex items-center justify-center text-xl shadow-xl">🤖</div>
        </div>)}

        <div className="absolute bottom-3 left-3 right-3 rounded-2xl p-3 bg-[#07152f]/90 border border-white/10"><p className="text-xs font-black text-yellow-200">{message}</p></div>
      </main>

      <footer className="grid grid-cols-[1fr_auto] gap-2">
        <div className="grid grid-cols-3 gap-2">{Object.entries(TOWERS).map(([key, cfg]) => <button key={key} onClick={() => setSelected(key as TowerKind)} className={`rounded-2xl p-2 border flex items-center gap-2 ${selected === key ? 'bg-cyan-300/15 border-cyan-300' : 'bg-slate-950/90 border-white/10'}`}><span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.color} flex items-center justify-center`}><cfg.Icon className="w-5 h-5" /></span><span className="text-right"><b className="block text-[11px]">{cfg.name}</b><small className="text-yellow-300 font-black">{cfg.cost}</small></span></button>)}</div>
        <button disabled={waveActive} onClick={beginWave} className="px-5 rounded-2xl bg-gradient-to-l from-orange-500 to-yellow-400 disabled:opacity-50 text-slate-950 font-black">{waveActive ? 'الموجة جارية' : 'ابدأ الموجة'}</button>
      </footer>
    </div>}

    {screen === 'quiz' && <div className="relative h-full flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-md">
      <section className="w-full max-w-xl rounded-[2.2rem] p-6 bg-white border-2 border-cyan-300 text-slate-950 shadow-2xl">
        <div className="flex items-center justify-between mb-4"><h2 className="text-2xl font-black text-sky-700">⚡ بوابة المعرفة</h2><span className="rounded-full px-3 py-1 bg-sky-100 text-sky-800 text-xs font-black">الموجة {wave}</span></div>
        <div className="rounded-2xl p-4 mb-4 border border-sky-200"><p className="text-xs font-black text-orange-600 mb-2">الإجابة الصحيحة تمنحك 100 طاقة</p><h3 className="text-xl font-black leading-8">{currentQuestion.question}</h3></div>
        <div className="grid gap-3">{currentQuestion.options.map((option, index) => {
          const correctOption = index === answerIndex(currentQuestion);
          const selectedOption = feedback?.selected === index;
          const resultClass = feedback && correctOption ? 'bg-green-500 border-green-600 text-white' : feedback && selectedOption ? 'bg-red-500 border-red-600 text-white' : 'bg-white border-sky-200';
          return <button key={option} disabled={!!feedback} onClick={() => chooseAnswer(index)} className={`rounded-2xl border p-3 text-right font-black shadow-sm ${resultClass}`}><span className="inline-flex w-9 h-9 ml-3 rounded-xl bg-sky-100 text-sky-800 items-center justify-center">{index + 1}</span>{option}</button>;
        })}</div>
      </section>
    </div>}

    {screen === 'result' && <div className="relative h-full flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-[2.2rem] p-7 text-center bg-gradient-to-b from-[#183b68] to-[#07152f] border border-yellow-300/40 shadow-2xl">
        <Trophy className="w-20 h-20 mx-auto text-yellow-300 mb-3" />
        <h2 className="text-3xl font-black mb-2">{health > 0 ? 'تم حماية الحصن!' : 'انتهت طاقة الحصن'}</h2>
        <p className="text-5xl font-black text-yellow-300 mb-5">{score} <span className="text-base text-cyan-100">نقطة</span></p>
        <div className="grid grid-cols-2 gap-3 mb-5"><Mini label="الإجابات الصحيحة" value={correct} /><Mini label="الإجابات الخاطئة" value={wrong} /><Mini label="الأبراج" value={towers.length} /><Mini label="سلامة الحصن" value={health} /></div>
        <div className="grid grid-cols-2 gap-3"><button onClick={start} className="h-13 rounded-2xl bg-yellow-400 text-slate-950 font-black flex items-center justify-center gap-2"><RotateCcw className="w-5 h-5" />جولة جديدة</button><button onClick={onClose ?? onExit ?? (() => setScreen('menu'))} className="h-13 rounded-2xl border border-white/10 bg-white/5 font-black">العودة</button></div>
      </section>
    </div>}
  </div>;
}

function Stat({ Icon, title, value, color }: { Icon: typeof Heart; title: string; value: React.ReactNode; color: string }) {
  return <div className="rounded-2xl px-3 py-2 bg-slate-950/85 border border-white/10 flex items-center gap-2"><Icon className={`w-5 h-5 ${color}`} /><div><p className="text-[9px] text-slate-300 font-bold">{title}</p><p className={`font-black ${color}`}>{value}</p></div></div>;
}
function Mini({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded-2xl p-3 bg-white/5 border border-white/10"><p className="text-xs text-slate-300 font-bold">{label}</p><p className="text-2xl font-black text-cyan-100">{value}</p></div>; }

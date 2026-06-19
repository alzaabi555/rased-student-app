import React, { useEffect, useMemo, useRef } from 'react';

// =========================================================================
// 🐍🪜 SnakeLadderCanvasBoard
// -------------------------------------------------------------------------
// لوحة Canvas احترافية للسلم والثعبان:
// - ترسم لوحة 6x6 بأسلوب كرتوني 2.5D.
// - ترسم السلالم والثعابين بشكل ناعم.
// - ترسم قطعة اللاعب وتحرّكها بسلاسة عند تغيّر currentTile.
// - لا تحتوي على منطق الأسئلة أو النرد؛ هذه تبقى في StudentSnakeLadderGame.
// =========================================================================

export type SnakeLadderMoveType = 'normal' | 'ladder' | 'snake' | 'start' | 'finish';

export interface SnakeLadderCanvasBoardProps {
  currentTile: number;
  boardSize?: number;
  columns?: number;
  ladders?: Record<number, number>;
  snakes?: Record<number, number>;
  className?: string;
  showLabels?: boolean;
  animateToken?: boolean;
  reducedMotion?: boolean;
  onAnimationComplete?: (tile: number) => void;
}

type Point = {
  x: number;
  y: number;
};

type TileLayout = {
  boardX: number;
  boardY: number;
  boardW: number;
  tileSize: number;
  centers: Record<number, Point>;
};

type TokenAnimation = {
  from: Point;
  to: Point;
  startedAt: number;
  duration: number;
  targetTile: number;
} | null;

const DEFAULT_BOARD_SIZE = 36;
const DEFAULT_COLUMNS = 6;

const DEFAULT_LADDERS: Record<number, number> = {
  3: 12,
  8: 17,
  15: 24,
  22: 31
};

const DEFAULT_SNAKES: Record<number, number> = {
  14: 6,
  21: 11,
  29: 19,
  34: 25
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const interpolate = (from: number, to: number, t: number) => from + (to - from) * t;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const buildLayout = (
  width: number,
  height: number,
  boardSize: number,
  columns: number
): TileLayout => {
  const rows = Math.ceil(boardSize / columns);
  const padding = Math.max(10, Math.min(width, height) * 0.035);
  const boardW = Math.max(220, Math.min(width - padding * 2, height - padding * 2));
  const tileSize = boardW / columns;
  const boardX = (width - boardW) / 2;
  const boardY = (height - boardW) / 2;
  const centers: Record<number, Point> = {};

  for (let tile = 1; tile <= boardSize; tile++) {
    const rowFromBottom = Math.floor((tile - 1) / columns);
    const colInRow = (tile - 1) % columns;
    const visualRow = rows - 1 - rowFromBottom;
    const visualCol = rowFromBottom % 2 === 0 ? colInRow : columns - 1 - colInRow;

    centers[tile] = {
      x: boardX + visualCol * tileSize + tileSize / 2,
      y: boardY + visualRow * tileSize + tileSize / 2
    };
  }

  return { boardX, boardY, boardW, tileSize, centers };
};

const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#dbeafe');
  bg.addColorStop(0.42, '#e0e7ff');
  bg.addColorStop(1, '#fef3c7');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  const circles = [
    { x: width * 0.12, y: height * 0.16, r: Math.min(width, height) * 0.16, c: 'rgba(79,70,229,0.10)' },
    { x: width * 0.88, y: height * 0.18, r: Math.min(width, height) * 0.18, c: 'rgba(14,165,233,0.12)' },
    { x: width * 0.16, y: height * 0.86, r: Math.min(width, height) * 0.14, c: 'rgba(245,158,11,0.12)' }
  ];

  circles.forEach(circle => {
    ctx.fillStyle = circle.c;
    ctx.beginPath();
    ctx.arc(circle.x, circle.y, circle.r, 0, Math.PI * 2);
    ctx.fill();
  });
};

const drawBoardBase = (ctx: CanvasRenderingContext2D, layout: TileLayout) => {
  const { boardX, boardY, boardW } = layout;

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.22)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, boardX, boardY, boardW, boardW, 30);
  ctx.fill();
  ctx.restore();

  const rim = ctx.createLinearGradient(boardX, boardY, boardX + boardW, boardY + boardW);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(0.5, '#dbeafe');
  rim.addColorStop(1, '#c7d2fe');
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(5, boardW * 0.012);
  drawRoundedRect(ctx, boardX + 2, boardY + 2, boardW - 4, boardW - 4, 30);
  ctx.stroke();
};

const drawTile = (
  ctx: CanvasRenderingContext2D,
  tile: number,
  layout: TileLayout,
  boardSize: number,
  showLabels: boolean
) => {
  const { tileSize, centers } = layout;
  const center = centers[tile];
  const gap = Math.max(4, tileSize * 0.075);
  const x = center.x - tileSize / 2 + gap;
  const y = center.y - tileSize / 2 + gap;
  const w = tileSize - gap * 2;
  const radius = Math.max(10, tileSize * 0.16);

  const palette = ['#ffffff', '#dbeafe', '#dcfce7', '#fef3c7', '#fae8ff', '#e0f2fe'];
  const baseColor = tile === 1 ? '#bfdbfe' : tile === boardSize ? '#fde68a' : palette[tile % palette.length];

  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.13)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;

  const grad = ctx.createLinearGradient(x, y, x, y + w);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.26, baseColor);
  grad.addColorStop(1, baseColor);
  ctx.fillStyle = grad;
  drawRoundedRect(ctx, x, y, w, w, radius);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(148,163,184,0.65)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, x, y, w, w, radius);
  ctx.stroke();

  // Inner highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.78)';
  ctx.lineWidth = 1.2;
  drawRoundedRect(ctx, x + 3, y + 3, w - 6, w - 6, Math.max(7, radius - 4));
  ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.font = `900 ${Math.max(10, Math.round(tileSize * 0.14))}px Tajawal, Arial`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(String(tile), x + w - 7, y + 6);

  if (showLabels && tile === 1) {
    ctx.fillStyle = '#1d4ed8';
    ctx.font = `900 ${Math.max(10, Math.round(tileSize * 0.15))}px Tajawal, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('بداية', center.x, center.y + w * 0.18);
  }

  if (showLabels && tile === boardSize) {
    ctx.fillStyle = '#92400e';
    ctx.font = `900 ${Math.max(10, Math.round(tileSize * 0.15))}px Tajawal, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('النهاية', center.x, center.y + w * 0.18);

    ctx.font = `${Math.max(18, Math.round(tileSize * 0.28))}px Arial`;
    ctx.fillText('🏆', center.x, center.y - w * 0.12);
  }
};

const drawLadder = (ctx: CanvasRenderingContext2D, from: Point, to: Point, tileSize: number) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const gap = Math.max(12, tileSize * 0.15);
  const railWidth = Math.max(6, tileSize * 0.07);
  const rungWidth = Math.max(4, tileSize * 0.052);

  ctx.save();
  ctx.lineCap = 'round';

  ctx.shadowColor = 'rgba(22,101,52,0.26)';
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;

  ctx.strokeStyle = '#92400e';
  ctx.lineWidth = railWidth + 3;
  ctx.beginPath();
  ctx.moveTo(from.x + nx * gap, from.y + ny * gap);
  ctx.lineTo(to.x + nx * gap, to.y + ny * gap);
  ctx.moveTo(from.x - nx * gap, from.y - ny * gap);
  ctx.lineTo(to.x - nx * gap, to.y - ny * gap);
  ctx.stroke();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = railWidth;
  ctx.beginPath();
  ctx.moveTo(from.x + nx * gap, from.y + ny * gap);
  ctx.lineTo(to.x + nx * gap, to.y + ny * gap);
  ctx.moveTo(from.x - nx * gap, from.y - ny * gap);
  ctx.lineTo(to.x - nx * gap, to.y - ny * gap);
  ctx.stroke();

  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = rungWidth;
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const ax = from.x + nx * gap + dx * t;
    const ay = from.y + ny * gap + dy * t;
    const bx = from.x - nx * gap + dx * t;
    const by = from.y - ny * gap + dy * t;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  ctx.restore();
};

const drawSnake = (
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  tileSize: number,
  index: number
) => {
  const controlX = (from.x + to.x) / 2 + (index % 2 === 0 ? tileSize * 0.65 : -tileSize * 0.65);
  const controlY = (from.y + to.y) / 2;
  const width = Math.max(13, tileSize * 0.15);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(127,29,29,0.24)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  const bodyGrad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  bodyGrad.addColorStop(0, '#ef4444');
  bodyGrad.addColorStop(1, '#b91c1c');

  ctx.strokeStyle = bodyGrad;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(controlX, controlY, to.x, to.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.70)';
  ctx.lineWidth = Math.max(4, width * 0.28);
  ctx.setLineDash([Math.max(8, tileSize * 0.12), Math.max(10, tileSize * 0.14)]);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(controlX, controlY, to.x, to.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Head
  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, tileSize * 0.04);
  ctx.beginPath();
  ctx.arc(from.x, from.y, tileSize * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(from.x - tileSize * 0.075, from.y - tileSize * 0.055, Math.max(3, tileSize * 0.035), 0, Math.PI * 2);
  ctx.arc(from.x + tileSize * 0.075, from.y - tileSize * 0.055, Math.max(3, tileSize * 0.035), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.beginPath();
  ctx.arc(from.x - tileSize * 0.075, from.y - tileSize * 0.055, Math.max(1.5, tileSize * 0.015), 0, Math.PI * 2);
  ctx.arc(from.x + tileSize * 0.075, from.y - tileSize * 0.055, Math.max(1.5, tileSize * 0.015), 0, Math.PI * 2);
  ctx.fill();

  // Small tongue
  ctx.strokeStyle = '#fda4af';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y + tileSize * 0.17);
  ctx.lineTo(from.x, from.y + tileSize * 0.29);
  ctx.moveTo(from.x, from.y + tileSize * 0.29);
  ctx.lineTo(from.x - tileSize * 0.045, from.y + tileSize * 0.34);
  ctx.moveTo(from.x, from.y + tileSize * 0.29);
  ctx.lineTo(from.x + tileSize * 0.045, from.y + tileSize * 0.34);
  ctx.stroke();

  ctx.restore();
};

const drawToken = (
  ctx: CanvasRenderingContext2D,
  point: Point,
  tileSize: number,
  time: number,
  isAnimating: boolean
) => {
  const pulse = 1 + Math.sin(time / 220) * 0.035;
  const lift = isAnimating ? Math.sin(time / 95) * 4 : Math.sin(time / 500) * 2;
  const r = Math.max(15, tileSize * 0.23) * pulse;
  const x = point.x;
  const y = point.y + lift;

  ctx.save();

  ctx.fillStyle = 'rgba(15,23,42,0.20)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.74, r * 0.95, r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'rgba(79,70,229,0.38)';
  ctx.shadowBlur = 15;
  const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, '#a5b4fc');
  grad.addColorStop(0.55, '#4f46e5');
  grad.addColorStop(1, '#312e81');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, tileSize * 0.035);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.max(16, Math.round(tileSize * 0.28))}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', x, y + 1);

  ctx.restore();
};

const SnakeLadderCanvasBoard: React.FC<SnakeLadderCanvasBoardProps> = ({
  currentTile,
  boardSize = DEFAULT_BOARD_SIZE,
  columns = DEFAULT_COLUMNS,
  ladders = DEFAULT_LADDERS,
  snakes = DEFAULT_SNAKES,
  className = '',
  showLabels = true,
  animateToken = true,
  reducedMotion = false,
  onAnimationComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastTileRef = useRef(clamp(currentTile, 1, boardSize));
  const tokenPointRef = useRef<Point>({ x: 0, y: 0 });
  const animationRef = useRef<TokenAnimation>(null);
  const layoutRef = useRef<TileLayout | null>(null);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const safeTile = clamp(currentTile, 1, boardSize);

  const draw = (time: number) => {
    const canvas = canvasRef.current;
    const layout = layoutRef.current;
    if (!canvas || !layout) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    ctx.clearRect(0, 0, width, height);

    drawBackground(ctx, width, height);
    drawBoardBase(ctx, layout);

    for (let tile = 1; tile <= boardSize; tile++) {
      drawTile(ctx, tile, layout, boardSize, showLabels);
    }

    Object.entries(ladders).forEach(([from, to]) => {
      const start = layout.centers[Number(from)];
      const end = layout.centers[to];
      if (start && end) drawLadder(ctx, start, end, layout.tileSize);
    });

    Object.entries(snakes).forEach(([from, to], index) => {
      const start = layout.centers[Number(from)];
      const end = layout.centers[to];
      if (start && end) drawSnake(ctx, start, end, layout.tileSize, index);
    });

    let tokenPoint = tokenPointRef.current;
    const animation = animationRef.current;

    if (animation) {
      const raw = clamp((time - animation.startedAt) / animation.duration, 0, 1);
      const eased = easeOutBack(raw);
      tokenPoint = {
        x: interpolate(animation.from.x, animation.to.x, eased),
        y: interpolate(animation.from.y, animation.to.y, easeOutCubic(raw))
      };
      tokenPointRef.current = tokenPoint;

      if (raw >= 1) {
        tokenPointRef.current = animation.to;
        lastTileRef.current = animation.targetTile;
        animationRef.current = null;
        onAnimationComplete?.(animation.targetTile);
      }
    }

    drawToken(ctx, tokenPoint, layout.tileSize, time, Boolean(animation));

    frameRef.current = requestAnimationFrame(draw);
  };

  const resize = () => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dimensionsRef.current = { width, height };
    const layout = buildLayout(width, height, boardSize, columns);
    layoutRef.current = layout;

    const current = layout.centers[lastTileRef.current] || layout.centers[1];
    tokenPointRef.current = current;
    animationRef.current = null;
  };

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [boardSize, columns]);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [boardSize, columns, ladders, snakes, showLabels]);

  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout) return;

    const fromTile = lastTileRef.current;
    const targetTile = safeTile;
    const fromPoint = tokenPointRef.current.x || tokenPointRef.current.y
      ? tokenPointRef.current
      : layout.centers[fromTile] || layout.centers[1];
    const toPoint = layout.centers[targetTile] || layout.centers[1];

    if (!animateToken || reducedMotion || fromTile === targetTile) {
      tokenPointRef.current = toPoint;
      lastTileRef.current = targetTile;
      animationRef.current = null;
      onAnimationComplete?.(targetTile);
      return;
    }

    animationRef.current = {
      from: fromPoint,
      to: toPoint,
      startedAt: performance.now(),
      duration: 650,
      targetTile
    };
  }, [safeTile, animateToken, reducedMotion, onAnimationComplete]);

  const canvasClassName = useMemo(
    () => `w-full h-full block rounded-3xl ${className}`,
    [className]
  );

  return (
    <div ref={wrapperRef} className="relative w-full h-full min-h-[240px] overflow-hidden rounded-3xl bg-slate-100">
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        aria-label="لوحة السلم والثعبان التعليمية"
        role="img"
      />
    </div>
  );
};

export default SnakeLadderCanvasBoard;

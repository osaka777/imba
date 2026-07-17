export type Vec = { x: number; y: number };

export type SnakeEntity = {
  id: string;
  name: string;
  isPlayer: boolean;
  color: string;
  midColor: string;
  lightColor: string;
  headType: 0 | 1 | 2;
  angle: number;
  targetAngle: number;
  segments: Vec[];
  alive: boolean;
  killCount: number;
};

export type Food = Vec & { r: number; color: string };

export type SnakeWorld = {
  /** Arena diameter / square world size */
  size: number;
  radius: number;
  cx: number;
  cy: number;
  player: SnakeEntity;
  bots: SnakeEntity[];
  food: Food[];
  aimX: number;
  aimY: number;
  running: boolean;
  startedAt: number;
  ended: boolean;
  boosting: boolean;
  /** ms spent boosting this round (authoritative burn input) */
  boostMs: number;
  /** fraction of stake burned by boost 0..1 */
  burnFraction: number;
  /** food pellets eaten since last poll (for SFX) */
  eatsPending: number;
  stake: number;
};

const BOT_COLORS = [
  '#ff3b5c',
  '#ff9f1a',
  '#2ed573',
  '#1e90ff',
  '#a55eea',
  '#ff6b81',
  '#20c997',
  '#4dabf7',
  '#f783ac',
  '#ffd43b',
];

const FOOD_COLORS = [
  '#ff6b6b',
  '#fcc419',
  '#51cf66',
  '#339af0',
  '#cc5de8',
  '#ff922b',
  '#22b8cf',
  '#f06595',
];

const BOT_NAMES = [
  'Nova', 'Blitz', 'Echo', 'Pixel', 'Viper', 'Orbit', 'Dash', 'Flux',
  'Kiwi', 'Bolt', 'Neon', 'Zephyr', 'Comet', 'Drift', 'Halo', 'Jinx',
];

/** Mix hex toward white (t>0) or black (t<0). From bibhuticoder/snake.io util idea. */
function shadeColor(hex: string, t: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const mix = (c: number) => {
    const v = t >= 0 ? c + (255 - c) * t : c * (1 + t);
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  const r = mix(parseInt(m[1], 16));
  const g = mix(parseInt(m[2], 16));
  const b = mix(parseInt(m[3], 16));
  return `rgb(${r},${g},${b})`;
}

function rotatePoint(p: Vec, around: Vec, deg: number): Vec {
  const rad = (deg * Math.PI) / 180;
  const dx = p.x - around.x;
  const dy = p.y - around.y;
  return {
    x: around.x + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: around.y + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/** snake.io-like large map */
export const WORLD_SIZE = 4800;
const SEG_SPACING = 8.5;
/** % of stake burned per second while boosting */
export const BOOST_BURN_PER_SEC = 0.08;
export const MAX_BURN_FRACTION = 0.85;

function dist(a: Vec, b: Vec) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function makeSnake(
  id: string,
  isPlayer: boolean,
  x: number,
  y: number,
  color: string,
  length: number,
  name: string,
): SnakeEntity {
  const angle = Math.random() * Math.PI * 2;
  const segments: Vec[] = [];
  for (let i = 0; i < length; i++) {
    segments.push({
      x: x - Math.cos(angle) * i * SEG_SPACING,
      y: y - Math.sin(angle) * i * SEG_SPACING,
    });
  }
  return {
    id,
    name,
    isPlayer,
    color,
    midColor: shadeColor(color, 0.28),
    lightColor: shadeColor(color, 0.55),
    headType: (Math.floor(Math.random() * 3) as 0 | 1 | 2),
    angle,
    targetAngle: angle,
    segments,
    alive: true,
    killCount: 0,
  };
}

function randomInArena(world: SnakeWorld, minFromCenter = 0, margin = 80): Vec {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const maxR = world.radius - margin;
    const r = minFromCenter + Math.random() * Math.max(0, maxR - minFromCenter);
    const p = {
      x: world.cx + Math.cos(a) * r,
      y: world.cy + Math.sin(a) * r,
    };
    if (dist(p, { x: world.cx, y: world.cy }) <= maxR) return p;
  }
  return { x: world.cx, y: world.cy };
}

export function createWorld(size = WORLD_SIZE): SnakeWorld {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;
  const world: SnakeWorld = {
    size,
    radius,
    cx,
    cy,
    player: makeSnake('player', true, cx, cy, '#3dff9f', 16, 'You'),
    bots: [],
    food: [],
    aimX: 1,
    aimY: 0,
    running: false,
    startedAt: 0,
    ended: false,
    boosting: false,
    boostMs: 0,
    burnFraction: 0,
    eatsPending: 0,
    stake: 0,
  };

  for (let i = 0; i < 16; i++) {
    const p = randomInArena(world, 220);
    world.bots.push(
      makeSnake(
        `bot-${i}`,
        false,
        p.x,
        p.y,
        BOT_COLORS[i % BOT_COLORS.length],
        12 + Math.floor(Math.random() * 22),
        BOT_NAMES[i % BOT_NAMES.length],
      ),
    );
  }
  for (let i = 0; i < 520; i++) {
    const p = randomInArena(world, 0, 40);
    world.food.push({
      x: p.x,
      y: p.y,
      r: 3.2 + Math.random() * 3.4,
      color: FOOD_COLORS[i % FOOD_COLORS.length],
    });
  }
  return world;
}

export function startWorld(world: SnakeWorld, stake = 0) {
  world.running = true;
  world.ended = false;
  world.startedAt = performance.now();
  world.player.alive = true;
  world.boostMs = 0;
  world.burnFraction = 0;
  world.eatsPending = 0;
  world.stake = stake;
  world.boosting = false;
}

function turnToward(snake: SnakeEntity, targetAngle: number, turnSpeed: number) {
  let diff = targetAngle - snake.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  snake.angle += Math.max(-turnSpeed, Math.min(turnSpeed, diff));
}

function grow(snake: SnakeEntity, n: number) {
  const tail = snake.segments[snake.segments.length - 1];
  for (let i = 0; i < n; i++) snake.segments.push({ ...tail });
}

function shrink(snake: SnakeEntity, n: number) {
  for (let i = 0; i < n && snake.segments.length > 10; i++) {
    snake.segments.pop();
  }
}

function dropFood(world: SnakeWorld, snake: SnakeEntity) {
  for (let i = 0; i < snake.segments.length; i += 2) {
    const s = snake.segments[i];
    world.food.push({
      x: s.x + (Math.random() - 0.5) * 6,
      y: s.y + (Math.random() - 0.5) * 6,
      r: 3 + Math.random() * 2.5,
      color: snake.color,
    });
  }
}

function moveSnake(snake: SnakeEntity, speed: number) {
  const head = snake.segments[0];
  const next = {
    x: head.x + Math.cos(snake.angle) * speed,
    y: head.y + Math.sin(snake.angle) * speed,
  };
  const keep = snake.segments.length;
  snake.segments.unshift(next);
  for (let i = 1; i < snake.segments.length; i++) {
    const prev = snake.segments[i - 1];
    const cur = snake.segments[i];
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const d = Math.hypot(dx, dy) || 1;
    cur.x = prev.x + (dx / d) * SEG_SPACING;
    cur.y = prev.y + (dy / d) * SEG_SPACING;
  }
  while (snake.segments.length > keep) snake.segments.pop();
}

function updateBotAI(world: SnakeWorld, bot: SnakeEntity) {
  const head = bot.segments[0];
  let nearest: Food | null = null;
  let best = 480;
  for (const f of world.food) {
    const d = dist(head, f);
    if (d < best) {
      best = d;
      nearest = f;
    }
  }

  const ph = world.player.segments[0];
  const toPlayer = dist(head, ph);
  const toCenter = dist(head, { x: world.cx, y: world.cy });
  if (toCenter > world.radius * 0.82) {
    bot.targetAngle = Math.atan2(world.cy - head.y, world.cx - head.x);
  } else if (world.player.alive && toPlayer < 180) {
    if (world.player.segments.length > bot.segments.length + 4) {
      bot.targetAngle = Math.atan2(head.y - ph.y, head.x - ph.x);
    } else if (toPlayer < 90) {
      bot.targetAngle = Math.atan2(ph.y - head.y, ph.x - head.x) + 0.55;
    }
  } else if (nearest) {
    bot.targetAngle = Math.atan2(nearest.y - head.y, nearest.x - head.x);
  } else {
    bot.targetAngle += (Math.random() - 0.5) * 0.4;
  }
}

function eatFood(world: SnakeWorld, snake: SnakeEntity) {
  const head = snake.segments[0];
  const radius = 14 + Math.min(10, snake.segments.length * 0.04);
  for (let i = world.food.length - 1; i >= 0; i--) {
    const f = world.food[i];
    if (dist(head, f) < radius + f.r) {
      world.food.splice(i, 1);
      grow(snake, snake.isPlayer ? 2 : 1);
      if (snake.isPlayer) world.eatsPending += 1;
      if (world.food.length < 460) {
        const p = randomInArena(world, 0, 50);
        world.food.push({
          x: p.x,
          y: p.y,
          r: 3.2 + Math.random() * 3.4,
          color: FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)],
        });
      }
    }
  }
}

function hitWall(world: SnakeWorld, snake: SnakeEntity) {
  const head = snake.segments[0];
  return dist(head, { x: world.cx, y: world.cy }) >= world.radius - 4;
}

function checkCollisions(world: SnakeWorld) {
  const all = [world.player, ...world.bots].filter((s) => s.alive);
  for (const a of all) {
    const head = a.segments[0];
    const hitR = 9;
    for (const b of all) {
      if (a.id === b.id) continue;
      for (let i = 5; i < b.segments.length; i += 1) {
        if (dist(head, b.segments[i]) < hitR) {
          a.alive = false;
          dropFood(world, a);
          if (b.isPlayer) b.killCount += 1;
          if (a.isPlayer) {
            world.ended = true;
            world.running = false;
          }
          return;
        }
      }
    }
  }
}

export function computeBoostBurnAmount(stake: number, burnFraction: number) {
  const f = Math.max(0, Math.min(MAX_BURN_FRACTION, burnFraction));
  return Math.round(stake * f * 100) / 100;
}

export function tickWorld(world: SnakeWorld, dtMs: number) {
  if (!world.running || world.ended) return;

  const dt = Math.min(0.05, dtMs / 1000);
  const player = world.player;

  if (Math.abs(world.aimX) > 0.001 || Math.abs(world.aimY) > 0.001) {
    player.targetAngle = Math.atan2(world.aimY, world.aimX);
  }
  turnToward(player, player.targetAngle, 7.8 * dt);

  let playerSpeed = 168 * dt;
  if (world.boosting && player.segments.length > 12) {
    playerSpeed *= 1.9;
    world.boostMs += dtMs;
    world.burnFraction = Math.min(
      MAX_BURN_FRACTION,
      world.burnFraction + BOOST_BURN_PER_SEC * dt,
    );
    if (Math.random() < 0.18) {
      shrink(player, 1);
      const tail = player.segments[player.segments.length - 1];
      world.food.push({
        x: tail.x,
        y: tail.y,
        r: 3,
        color: player.color,
      });
    }
  }

  moveSnake(player, playerSpeed);
  eatFood(world, player);

  if (hitWall(world, player)) {
    player.alive = false;
    dropFood(world, player);
    world.ended = true;
    world.running = false;
    return;
  }

  for (const bot of world.bots) {
    if (!bot.alive) continue;
    updateBotAI(world, bot);
    turnToward(bot, bot.targetAngle, 3.5 * dt);
    moveSnake(bot, 132 * dt);
    eatFood(world, bot);
    if (hitWall(world, bot)) {
      bot.alive = false;
      dropFood(world, bot);
    }
  }

  for (let i = 0; i < world.bots.length; i++) {
    if (!world.bots[i].alive && Math.random() < 0.01) {
      const p = randomInArena(world, 320);
      world.bots[i] = makeSnake(
        `bot-${i}-${Date.now()}`,
        false,
        p.x,
        p.y,
        BOT_COLORS[i % BOT_COLORS.length],
        12 + Math.floor(Math.random() * 20),
        BOT_NAMES[i % BOT_NAMES.length],
      );
    }
  }

  checkCollisions(world);
}

function bodyRadius(snake: SnakeEntity) {
  const base = snake.isPlayer ? 13 : 11;
  return base + Math.min(6, snake.segments.length * 0.02);
}

/** Body segment — radial gradient style from bibhuticoder/snake.io (MIT). */
function drawBodySeg(
  ctx: CanvasRenderingContext2D,
  snake: SnakeEntity,
  x: number,
  y: number,
  i: number,
  baseR: number,
) {
  const radius = Math.max(2.5, baseR - i * 0.012);
  ctx.beginPath();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.arc(x + 1.5, y + 2.5, radius + 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = snake.color;
  ctx.arc(x, y, radius + 1.15, 0, Math.PI * 2);
  ctx.fill();

  const grd = ctx.createRadialGradient(x - 2, y - 2, 1, x + 3, y + 3, radius + 2);
  grd.addColorStop(0, snake.lightColor);
  grd.addColorStop(1, snake.midColor);
  ctx.beginPath();
  ctx.fillStyle = grd;
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHeadStyled(ctx: CanvasRenderingContext2D, snake: SnakeEntity, r: number) {
  const h = snake.segments[0];
  const ang = snake.angle;
  const x = h.x;
  const y = h.y;

  // branched eyes (type 2) or classic twin eyes
  if (snake.headType === 2) {
    const d = r * 1.75;
    let p1 = { x: x + d * Math.cos(ang), y: y + d * Math.sin(ang) };
    p1 = rotatePoint(p1, h, 30);
    const p2 = rotatePoint(p1, h, -60);
    for (const p of [p1, p2]) {
      ctx.beginPath();
      ctx.fillStyle = snake.color;
      ctx.arc(p.x, p.y, r * 0.48 + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#f8f9fa';
      ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(p.x + Math.cos(ang) * 1.5, p.y + Math.sin(ang) * 1.5, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    let p1 = {
      x: x + (r * 0.55) * Math.cos(ang),
      y: y + (r * 0.55) * Math.sin(ang),
    };
    p1 = rotatePoint(p1, h, -22);
    const p2 = rotatePoint(p1, h, 44);
    for (const p of [p1, p2]) {
      ctx.beginPath();
      ctx.fillStyle = '#f8f9fa';
      ctx.arc(p.x, p.y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#111';
      ctx.arc(p.x + Math.cos(ang) * 1.8, p.y + Math.sin(ang) * 1.8, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const grd = ctx.createRadialGradient(x - 2, y - 2, 2, x + 4, y + 4, r + 4);
  grd.addColorStop(0, snake.lightColor);
  grd.addColorStop(1, snake.midColor);
  ctx.beginPath();
  ctx.fillStyle = snake.color;
  ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = grd;
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(snake.name, x, y - r - 8);
  ctx.textAlign = 'left';
}

function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  viewW: number,
  viewH: number,
) {
  const size = 42;
  const h = size * Math.sqrt(3);
  ctx.strokeStyle = 'rgba(40, 110, 140, 0.18)';
  ctx.lineWidth = 1.2;
  const startCol = Math.floor(camX / (size * 1.5)) - 1;
  const endCol = Math.ceil((camX + viewW) / (size * 1.5)) + 1;
  const startRow = Math.floor(camY / h) - 1;
  const endRow = Math.ceil((camY + viewH) / h) + 1;

  for (let col = startCol; col <= endCol; col++) {
    for (let row = startRow; row <= endRow; row++) {
      const x = col * size * 1.5;
      const y = row * h + (col % 2 ? h / 2 : 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const px = x + size * Math.cos(a);
        const py = y + size * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: SnakeWorld,
  viewW: number,
  viewH: number,
) {
  const head = world.player.segments[0];
  const camX = head.x - viewW / 2;
  const camY = head.y - viewH / 2;

  const bg = ctx.createRadialGradient(
    viewW / 2,
    viewH / 2,
    40,
    viewW / 2,
    viewH / 2,
    Math.max(viewW, viewH) * 0.85,
  );
  bg.addColorStop(0, '#9fe8f0');
  bg.addColorStop(0.55, '#6ec8d8');
  bg.addColorStop(1, '#4aa8c0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, viewW, viewH);

  ctx.save();
  ctx.translate(-camX, -camY);

  ctx.beginPath();
  ctx.rect(camX - 40, camY - 40, viewW + 80, viewH + 80);
  ctx.arc(world.cx, world.cy, world.radius, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(30, 70, 90, 0.55)';
  ctx.fill('evenodd');

  ctx.save();
  ctx.beginPath();
  ctx.arc(world.cx, world.cy, world.radius, 0, Math.PI * 2);
  ctx.clip();

  drawHexGrid(ctx, camX, camY, viewW, viewH);

  const glow = ctx.createRadialGradient(world.cx, world.cy, 0, world.cx, world.cy, world.radius);
  glow.addColorStop(0, 'rgba(255,255,255,0.12)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(world.cx - world.radius, world.cy - world.radius, world.radius * 2, world.radius * 2);

  // food — double orb style from open-source snake.io clone
  for (const f of world.food) {
    if (
      f.x < camX - 24
      || f.y < camY - 24
      || f.x > camX + viewW + 24
      || f.y > camY + viewH + 24
    ) {
      continue;
    }
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.fillStyle = f.color;
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = shadeColor(f.color, 0.45);
    ctx.arc(f.x, f.y, f.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const drawSnake = (snake: SnakeEntity) => {
    if (!snake.alive && !snake.isPlayer) return;
    const r = bodyRadius(snake);
    ctx.globalAlpha = snake.alive ? 1 : 0.28;
    for (let i = snake.segments.length - 1; i >= 1; i--) {
      const s = snake.segments[i];
      if (
        s.x < camX - 50
        || s.y < camY - 50
        || s.x > camX + viewW + 50
        || s.y > camY + viewH + 50
      ) {
        continue;
      }
      drawBodySeg(ctx, snake, s.x, s.y, i, r);
    }
    drawHeadStyled(ctx, snake, r);
    ctx.globalAlpha = 1;
  };

  for (const bot of world.bots) drawSnake(bot);
  drawSnake(world.player);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(world.cx, world.cy, world.radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(20, 90, 120, 0.85)';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(world.cx, world.cy, world.radius - 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();

  if (world.running) {
    const len = Math.hypot(world.aimX, world.aimY) || 1;
    const nx = world.aimX / len;
    const ny = world.aimY / len;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.moveTo(viewW / 2 + nx * 32, viewH / 2 + ny * 32);
    ctx.lineTo(viewW / 2 + nx * 58, viewH / 2 + ny * 58);
    ctx.stroke();
  }
}

/** Compact radar in bottom-right (screen space). */
export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  world: SnakeWorld,
  viewW: number,
  viewH: number,
) {
  const size = Math.min(132, Math.floor(viewW * 0.18));
  const pad = 14;
  const x0 = viewW - size - pad;
  const y0 = viewH - size - pad;
  const scale = size / (world.radius * 2);

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = 'rgba(20, 50, 65, 0.72)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);

  ctx.beginPath();
  ctx.arc(x0 + size / 2, y0 + size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(110, 200, 216, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const toMap = (p: { x: number; y: number }) => ({
    x: x0 + size / 2 + (p.x - world.cx) * scale,
    y: y0 + size / 2 + (p.y - world.cy) * scale,
  });

  for (const bot of world.bots) {
    if (!bot.alive) continue;
    const m = toMap(bot.segments[0]);
    ctx.beginPath();
    ctx.fillStyle = bot.color;
    ctx.arc(m.x, m.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const you = toMap(world.player.segments[0]);
  ctx.beginPath();
  ctx.fillStyle = '#fff';
  ctx.arc(you.x, you.y, 3.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = world.player.color;
  ctx.arc(you.x, you.y, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

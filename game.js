const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hpEl = document.getElementById("hp");
const xpEl = document.getElementById("xp");
const levelEl = document.getElementById("level");
const waveEl = document.getElementById("wave");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const restartBtn = document.getElementById("restart");

const keys = new Set();
let mouseDown = false;
let mousePos = { x: canvas.width / 2, y: canvas.height / 2 };

const state = {
  running: true,
  wave: 1,
  waveTimer: 0,
  spawnTimer: 0,
  projectiles: [],
  enemies: [],
  pickups: [],
  particles: [],
  stars: Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 2,
    a: Math.random() * 0.5 + 0.2,
  })),
  player: null,
};

function createPlayer() {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    r: 18,
    speed: 220,
    maxHp: 100,
    hp: 100,
    shootCd: 0,
    fireRate: 0.24,
    bulletSpeed: 470,
    damage: 16,
    xp: 0,
    level: 1,
    xpToNext: 100,
  };
}

function resetGame() {
  state.running = true;
  state.wave = 1;
  state.waveTimer = 0;
  state.spawnTimer = 0;
  state.projectiles = [];
  state.enemies = [];
  state.pickups = [];
  state.particles = [];
  state.player = createPlayer();
  overlay.classList.add("hidden");
}

function inputDirection() {
  let x = 0;
  let y = 0;
  if (keys.has("a") || keys.has("arrowleft")) x -= 1;
  if (keys.has("d") || keys.has("arrowright")) x += 1;
  if (keys.has("w") || keys.has("arrowup")) y -= 1;
  if (keys.has("s") || keys.has("arrowdown")) y += 1;
  const mag = Math.hypot(x, y) || 1;
  return { x: x / mag, y: y / mag };
}

function shouldShoot() {
  return mouseDown || keys.has(" ");
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x;
  let y;
  if (edge === 0) {
    x = -40;
    y = Math.random() * canvas.height;
  } else if (edge === 1) {
    x = canvas.width + 40;
    y = Math.random() * canvas.height;
  } else if (edge === 2) {
    x = Math.random() * canvas.width;
    y = -40;
  } else {
    x = Math.random() * canvas.width;
    y = canvas.height + 40;
  }

  const eliteChance = Math.min(0.08 + state.wave * 0.01, 0.35);
  const elite = Math.random() < eliteChance;

  const hpBase = 28 + state.wave * 5;
  const speedBase = 70 + state.wave * 2;

  state.enemies.push({
    x,
    y,
    r: elite ? 26 : 18,
    hp: elite ? hpBase * 3 : hpBase,
    maxHp: elite ? hpBase * 3 : hpBase,
    speed: elite ? speedBase * 0.8 : speedBase,
    damage: elite ? 18 : 10,
    xp: elite ? 50 : 18,
    elite,
    shootTimer: elite ? Math.random() * 2 : 999,
  });
}

function addExplosion(x, y, color = "#ffcf6e") {
  for (let i = 0; i < 12; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * 120 + 40;
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.35,
      color,
      size: Math.random() * 4 + 2,
    });
  }
}

function levelUp(player) {
  player.level += 1;
  player.xp -= player.xpToNext;
  player.xpToNext = Math.floor(player.xpToNext * 1.3);
  const roll = Math.random();
  if (roll < 0.34) {
    player.damage += 4;
  } else if (roll < 0.67) {
    player.fireRate = Math.max(0.08, player.fireRate - 0.02);
  } else {
    player.maxHp += 15;
    player.hp = Math.min(player.maxHp, player.hp + 25);
  }
}

function endGame(victory = false) {
  state.running = false;
  overlay.classList.remove("hidden");
  overlayTitle.textContent = victory ? "¡Dominio del Mar!" : "Derrotado";
  overlayText.textContent = victory
    ? `Has sobrevivido hasta la ola ${state.wave} y te convertiste en la leyenda pirata.`
    : `Llegaste hasta la ola ${state.wave}. Intenta otra ruta marítima.`;
}

function update(dt) {
  const p = state.player;

  state.waveTimer += dt;
  if (state.waveTimer > 28) {
    state.wave += 1;
    state.waveTimer = 0;
    if (state.wave >= 10) {
      endGame(true);
      return;
    }
  }

  const dir = inputDirection();
  const accel = p.speed * 3.5;
  p.vx += dir.x * accel * dt;
  p.vy += dir.y * accel * dt;
  p.vx *= 0.88;
  p.vy *= 0.88;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  p.x = Math.max(p.r, Math.min(canvas.width - p.r, p.x));
  p.y = Math.max(p.r, Math.min(canvas.height - p.r, p.y));

  p.shootCd -= dt;
  if (shouldShoot() && p.shootCd <= 0) {
    p.shootCd = p.fireRate;
    const dx = mousePos.x - p.x;
    const dy = mousePos.y - p.y;
    const mag = Math.hypot(dx, dy) || 1;
    state.projectiles.push({
      x: p.x,
      y: p.y,
      vx: (dx / mag) * p.bulletSpeed,
      vy: (dy / mag) * p.bulletSpeed,
      life: 1.4,
      r: 5,
      damage: p.damage,
      hostile: false,
    });
  }

  state.spawnTimer -= dt;
  const interval = Math.max(0.28, 1.2 - state.wave * 0.08);
  if (state.spawnTimer <= 0) {
    state.spawnTimer = interval;
    spawnEnemy();
  }

  for (const shot of state.projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
  }
  state.projectiles = state.projectiles.filter(
    (s) =>
      s.life > 0 &&
      s.x > -20 &&
      s.x < canvas.width + 20 &&
      s.y > -20 &&
      s.y < canvas.height + 20,
  );

  for (const enemy of state.enemies) {
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const mag = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / mag) * enemy.speed * dt;
    enemy.y += (dy / mag) * enemy.speed * dt;

    enemy.shootTimer -= dt;
    if (enemy.elite && enemy.shootTimer <= 0) {
      enemy.shootTimer = 1.2;
      state.projectiles.push({
        x: enemy.x,
        y: enemy.y,
        vx: (dx / mag) * 240,
        vy: (dy / mag) * 240,
        life: 2,
        r: 6,
        damage: 8 + state.wave,
        hostile: true,
      });
    }

    if (Math.hypot(enemy.x - p.x, enemy.y - p.y) < enemy.r + p.r) {
      p.hp -= enemy.damage * dt;
    }
  }

  for (const shot of state.projectiles) {
    if (shot.hostile) {
      if (Math.hypot(shot.x - p.x, shot.y - p.y) < shot.r + p.r) {
        p.hp -= shot.damage;
        shot.life = -1;
        addExplosion(shot.x, shot.y, "#ff7b7b");
      }
      continue;
    }

    for (const enemy of state.enemies) {
      if (Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < shot.r + enemy.r) {
        enemy.hp -= shot.damage;
        shot.life = -1;
        if (enemy.hp <= 0) {
          addExplosion(enemy.x, enemy.y, enemy.elite ? "#ff6cd8" : "#ffd08f");
          if (Math.random() < 0.35) {
            state.pickups.push({
              x: enemy.x,
              y: enemy.y,
              r: 8,
              kind: Math.random() < 0.75 ? "xp" : "heal",
            });
          }
          p.xp += enemy.xp;
        }
        break;
      }
    }
  }

  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.projectiles = state.projectiles.filter((s) => s.life > 0);

  for (const pick of state.pickups) {
    const dx = p.x - pick.x;
    const dy = p.y - pick.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 130) {
      pick.x += (dx / (dist || 1)) * 190 * dt;
      pick.y += (dy / (dist || 1)) * 190 * dt;
    }
    if (dist < pick.r + p.r) {
      if (pick.kind === "xp") p.xp += 22;
      else p.hp = Math.min(p.maxHp, p.hp + 20);
      pick.collected = true;
    }
  }
  state.pickups = state.pickups.filter((pck) => !pck.collected);

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.94;
    particle.vy *= 0.94;
    particle.life -= dt;
  }
  state.particles = state.particles.filter((pcl) => pcl.life > 0);

  while (p.xp >= p.xpToNext) {
    levelUp(p);
  }

  if (p.hp <= 0) {
    endGame(false);
  }
}

function drawShip(x, y, r, color, heading) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading + Math.PI / 2);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(0, -r * 1.25);
  ctx.lineTo(r * 0.72, r * 0.55);
  ctx.lineTo(0, r * 0.3);
  ctx.lineTo(-r * 0.72, r * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f6f1ce";
  ctx.fillRect(-r * 0.18, -r * 0.3, r * 0.36, r * 0.7);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#2d9ae3");
  gradient.addColorStop(1, "#14517a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (const s of state.stars) {
    ctx.globalAlpha = s.a;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const pck of state.pickups) {
    ctx.fillStyle = pck.kind === "xp" ? "#7cffaa" : "#ffc4dd";
    ctx.beginPath();
    ctx.arc(pck.x, pck.y, pck.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const shot of state.projectiles) {
    ctx.fillStyle = shot.hostile ? "#ff6f6f" : "#ffe598";
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    const heading = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
    drawShip(enemy.x, enemy.y, enemy.r, enemy.elite ? "#913c6f" : "#5a2b2b", heading);

    const barW = enemy.r * 1.6;
    const hpRatio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.r - 12, barW, 4);
    ctx.fillStyle = enemy.elite ? "#ff6cd8" : "#ff8f8f";
    ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.r - 12, barW * hpRatio, 4);
  }

  for (const particle of state.particles) {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  }
  ctx.globalAlpha = 1;

  const p = state.player;
  const heading = Math.atan2(mousePos.y - p.y, mousePos.x - p.x);
  drawShip(p.x, p.y, p.r, "#2d2c39", heading);

  hpEl.textContent = Math.max(0, Math.round(p.hp));
  xpEl.textContent = `${Math.floor(p.xp)}/${p.xpToNext}`;
  levelEl.textContent = p.level;
  waveEl.textContent = state.wave;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (state.running) {
    update(dt);
    render();
    requestAnimationFrame(loop);
  } else {
    render();
  }
}

window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousedown", () => {
  mouseDown = true;
});
window.addEventListener("mouseup", () => {
  mouseDown = false;
});
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mousePos = {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
});
restartBtn.addEventListener("click", () => {
  resetGame();
  last = performance.now();
  requestAnimationFrame(loop);
});

resetGame();
requestAnimationFrame(loop);

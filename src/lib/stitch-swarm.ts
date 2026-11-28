// ClassFlow Multi-Cursor Swarm Engine
// Inspired by self-assembling UI wireframes (Ravi Paribrajak / ClassFlow Swarm)

const HUES = [
  '#38bdf8', // layout (cyan)
  '#818cf8', // type (indigo)
  '#34d399', // color (emerald)
  '#f472b6', // copy (pink)
  '#fbbf24', // motion (amber)
  '#a78bfa', // pixels (purple)
  '#22d3ee', // build (sky)
  '#fb923c', // notes (orange)
  '#4ade80', // sync (mint)
  '#c084fc', // vector (violet)
  '#f87171', // audit (coral)
  '#2dd4bf', // code (teal)
];

const ROLES = [
  'layout', 'type', 'color', 'copy',
  'motion', 'pixels', 'build', 'notes',
  'sync', 'vector', 'audit', 'code',
];

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const rnd = (min: number, max?: number) => (max === undefined ? Math.random() * min : min + Math.random() * (max - min));

// Crisp mechanical click sound
const sfx = {
  ctx: null as AudioContext | null,
  pop() {
    try {
      const C = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.ctx) this.ctx = new C();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(rnd(560, 820), t);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.08);
    } catch {}
  }
};

export function rectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  return {
    x: r.left + scrollX,
    y: r.top + scrollY,
    w: Math.max(r.width, 24),
    h: Math.max(r.height, 24),
    rawTop: r.top,
    rawBottom: r.bottom,
  };
}

class Agent {
  i: number;
  color: string;
  role: string;
  el: HTMLElement;
  x: number;
  y: number;
  idle: boolean = true;
  activeTween: {
    t0: number;
    dur: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    onUpdate?: (k: number) => void;
    onDone: () => void;
  } | null = null;
  opacity: number = 0;

  constructor(i: number, stage: HTMLElement) {
    this.i = i;
    this.color = HUES[i % HUES.length];
    this.role = ROLES[i % ROLES.length];
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    this.x = scrollX + (window.innerWidth / 2) + rnd(-160, 160);
    this.y = scrollY + (window.innerHeight / 2) + rnd(-120, 120);

    const el = document.createElement('div');
    el.className = 'stitch-agent';
    el.style.color = this.color;
    el.style.opacity = '0';
    el.innerHTML = `
      <svg class="arrow" viewBox="0 0 17 22">
        <path d="M2 1.5v16l4.4-4 3 7 2.6-1.1-3-6.9h6z" fill="${this.color}" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>
      <svg class="cross" viewBox="0 0 18 18">
        <path d="M9 1v16M1 9h16" stroke="#050506" stroke-width="4.4" stroke-linecap="round"/>
        <path d="M9 1v16M1 9h16" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="ring"></span>
      <label style="background:${this.color}">${this.role}</label>
    `;
    stage.appendChild(el);
    this.el = el;
    this.render();
  }

  setMode(mode: 'arrow' | 'cross') {
    this.el.dataset.mode = mode;
  }

  click() {
    this.el.classList.remove('click');
    void this.el.offsetWidth;
    this.el.classList.add('click');
    sfx.pop();
  }

  setOpacity(val: number) {
    this.opacity = val;
    this.el.style.opacity = String(val);
  }

  moveTo(targetX: number, targetY: number, dur: number, onUpdate?: (k: number) => void): Promise<void> {
    return new Promise(res => {
      this.activeTween = {
        t0: performance.now(),
        dur: Math.max(1, dur),
        fromX: this.x,
        fromY: this.y,
        toX: targetX,
        toY: targetY,
        onUpdate,
        onDone: () => {
          this.activeTween = null;
          res();
        }
      };
    });
  }

  render() {
    this.el.style.transform = `translate3d(${this.x.toFixed(1)}px, ${this.y.toFixed(1)}px, 0)`;
  }
}

// Elements eligible for cursor swarm stitching
const TARGET_SELECTOR = [
  '.resource-card',
  '.welcome-small-card',
  '.stats-card',
  '.dashboard-connect',
  '.copilot-shell',
  '.copilot-match',
  '.general-answer',
  '.admin-panel',
  '.admin-overview-card',
  '.duty-checkbox-card',
  '.integration-card',
  '.profile-view',
  '.feature-card',
  '.resource-tile',
  '.review-card',
  '.aside-note',
  '.person-card',
  '.auth-form-card'
].join(', ');

type Job = (agent: Agent) => Promise<void>;

class StitchSwarmManager {
  stage: HTMLElement | null = null;
  agents: Agent[] = [];
  io: IntersectionObserver | null = null;
  mo: MutationObserver | null = null;
  idleTimer: number | null = null;
  rafId: number | null = null;
  initialized: boolean = false;
  
  // Job Queue & concurrent worker pool
  queue: { job: Job; at: { x: number; y: number } }[] = [];
  waiters: { agent: Agent; resolve: (job: Job) => void }[] = [];
  activeJobs = new Set<HTMLElement>();

  init() {
    if (typeof window === 'undefined' || this.initialized) return;
    this.initialized = true;

    // Create Stage in document.body
    let stage = document.getElementById('stitch-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'stitch-stage';
      document.body.appendChild(stage);
    }
    this.stage = stage;

    // Spawn 12 concurrent agent cursors
    for (let i = 0; i < 12; i++) {
      const agent = new Agent(i, stage);
      this.agents.push(agent);
      this.startAgentWorker(agent);
    }

    this.startLoop();
    this.setupObservers();

    // Scan initial screen immediately and stitch
    setTimeout(() => {
      this.scanAndStitchVisible();
    }, 100);
  }

  // Worker loop for each agent: picks up jobs concurrently
  async startAgentWorker(agent: Agent) {
    while (true) {
      const job = await this.getNextJob(agent);
      agent.idle = false;
      try {
        await job(agent);
      } catch (err) {
        console.error(err);
      }
      agent.setMode('arrow');
      agent.idle = true;

      // When queue empty and all agents idle, schedule fade
      if (this.queue.length === 0 && this.activeJobs.size === 0) {
        this.scheduleIdleFade();
      }
    }
  }

  getNextJob(agent: Agent): Promise<Job> {
    if (this.queue.length > 0) {
      // Pick closest job to this agent
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        const dist = Math.hypot(agent.x - item.at.x, agent.y - item.at.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const [chosen] = this.queue.splice(bestIdx, 1);
      return Promise.resolve(chosen.job);
    }
    return new Promise(resolve => {
      this.waiters.push({ agent, resolve });
    });
  }

  enqueue(job: Job, at: { x: number; y: number }) {
    // Awaken idle fade
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.agents.forEach(a => a.setOpacity(1));

    if (this.waiters.length > 0) {
      // Find closest waiting agent
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < this.waiters.length; i++) {
        const w = this.waiters[i];
        const dist = Math.hypot(w.agent.x - at.x, w.agent.y - at.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const chosen = this.waiters.splice(bestIdx, 1)[0];
      chosen.resolve(job);
    } else {
      this.queue.push({ job, at });
    }
  }

  setupObservers() {
    this.io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          if (this.isEligible(el)) {
            this.dispatchElementStitch(el);
          }
        }
      });
    }, {
      rootMargin: '60px 0px -20px 0px',
      threshold: 0.05
    });

    const observeNew = () => {
      document.querySelectorAll<HTMLElement>(TARGET_SELECTOR).forEach(el => {
        if (this.isEligible(el)) {
          this.io?.observe(el);
        }
      });
    };

    this.mo = new MutationObserver(() => {
      observeNew();
    });
    this.mo.observe(document.body, { childList: true, subtree: true });
    observeNew();
  }

  isEligible(el: HTMLElement): boolean {
    if (!el || el.dataset.stitched === 'true' || this.activeJobs.has(el)) return false;
    // Strictly protect mobile navigation and layout roots from being hidden or stitched
    if (el.closest('.mobile-nav') || el.closest('.desktop-sidebar') || el.closest('.topbar')) {
      return false;
    }
    return true;
  }

  scanAndStitchVisible() {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(TARGET_SELECTOR));
    const inViewport = candidates.filter(el => {
      if (!this.isEligible(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight + 80 && r.bottom > -40 && r.width > 30 && r.height > 30;
    });

    // Enqueue all visible elements immediately to run concurrently
    inViewport.forEach(el => {
      this.dispatchElementStitch(el);
    });
  }

  dispatchElementStitch(el: HTMLElement) {
    if (!this.isEligible(el)) return;
    this.activeJobs.add(el);

    // Initial state: pending element is hidden so cursors assemble it in real-time
    el.classList.add('stitch-pending');

    // Safety timeout: in case of unmount or delay, card reveals automatically within 2.5s
    const fallbackTimer = setTimeout(() => {
      if (el.classList.contains('stitch-pending')) {
        el.classList.remove('stitch-pending');
        el.classList.add('stitch-assembled');
        el.dataset.stitched = 'true';
        this.activeJobs.delete(el);
      }
    }, 2500);

    const r = rectOf(el);
    const at = { x: r.x, y: r.y };

    this.enqueue(async (agent: Agent) => {
      clearTimeout(fallbackTimer);
      await this.runStitch(agent, el);
    }, at);
  }

  async runStitch(agent: Agent, el: HTMLElement) {
    if (!this.stage || !el.isConnected) {
      el.classList.remove('stitch-pending');
      el.classList.add('stitch-assembled');
      el.dataset.stitched = 'true';
      this.activeJobs.delete(el);
      return;
    }

    const r = rectOf(el);
    const sx = r.x;
    const sy = r.y;
    const w = r.w;
    const h = r.h;
    const ex = sx + w;
    const ey = sy + h;

    // 1. Move to top-left of the card
    const dist = Math.hypot(agent.x - sx, agent.y - sy);
    const flyDur = Math.min(360, Math.max(140, dist * 0.32));

    await agent.moveTo(sx, sy, flyDur);
    agent.setMode('cross');

    // 2. Spawn wireframe box
    const wire = document.createElement('div');
    wire.className = 'stitch-wire';
    wire.style.setProperty('--wire-color', agent.color);
    wire.style.left = `${sx}px`;
    wire.style.top = `${sy}px`;
    wire.style.width = '0px';
    wire.style.height = '0px';
    wire.innerHTML = `
      <u></u><u></u><u></u><u></u>
      <em>0 × 0</em>
    `;
    this.stage.appendChild(wire);

    const dim = wire.querySelector('em');

    // 3. Diagonal wireframe expansion
    const drawDur = Math.min(340, Math.max(180, Math.hypot(w, h) * 0.28));
    await agent.moveTo(ex, ey, drawDur, (k) => {
      const curW = Math.round(w * k);
      const curH = Math.round(h * k);
      wire.style.width = `${curW}px`;
      wire.style.height = `${curH}px`;
      if (dim) dim.textContent = `${curW} × ${curH}`;
    });

    // 4. Click ripple & snap card into full assembled state
    agent.setMode('arrow');
    agent.click();

    el.classList.remove('stitch-pending');
    el.classList.add('stitch-assembled');
    el.dataset.stitched = 'true';
    this.activeJobs.delete(el);

    // Fade wireframe
    wire.classList.add('done');
    setTimeout(() => {
      if (wire.parentNode) wire.remove();
    }, 220);
  }

  scheduleIdleFade() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.queue.length === 0 && this.activeJobs.size === 0) {
        this.agents.forEach(a => a.setOpacity(0));
      }
    }, 1800);
  }

  startLoop() {
    const loop = (now: number) => {
      for (const agent of this.agents) {
        if (agent.activeTween) {
          const { t0, dur, fromX, fromY, toX, toY, onUpdate, onDone } = agent.activeTween;
          const k = Math.min(1, (now - t0) / dur);
          const e = ease(k);
          agent.x = fromX + (toX - fromX) * e;
          agent.y = fromY + (toY - fromY) * e;
          if (onUpdate) onUpdate(e);
          agent.render();
          if (k >= 1) {
            onDone();
          }
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
}

export const stitchSwarm = new StitchSwarmManager();

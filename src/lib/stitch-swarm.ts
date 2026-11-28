// ClassFlow Cursor Stitching Engine
// Inspired by self-assembling UI wireframes (Ravi Paribrajak / ClassFlow Swarm)

const HUES = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c'];
const ROLES = ['layout', 'type', 'color', 'copy', 'motion', 'pixels', 'build', 'notes'];

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const rnd = (min: number, max?: number) => (max === undefined ? Math.random() * min : min + Math.random() * (max - min));

// Subtle mechanical stitch pop audio
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
      o.frequency.setValueAtTime(rnd(540, 780), t);
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.08);
    } catch {}
  }
};

interface Job {
  el: HTMLElement;
  rect: DOMRect;
  resolve?: () => void;
}

class Agent {
  i: number;
  color: string;
  role: string;
  el: HTMLElement;
  x: number;
  y: number;
  idle: boolean = true;
  activeTween: { t0: number; dur: number; fromX: number; fromY: number; toX: number; toY: number; onUpdate?: (k: number) => void; onDone: () => void } | null = null;
  opacity: number = 0;

  constructor(i: number, stage: HTMLElement) {
    this.i = i;
    this.color = HUES[i % HUES.length];
    this.role = ROLES[i % ROLES.length];
    this.x = window.scrollX + window.innerWidth / 2 + rnd(-100, 100);
    this.y = window.scrollY + window.innerHeight / 2 + rnd(-60, 60);

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

class StitchSwarmManager {
  stage: HTMLElement | null = null;
  agents: Agent[] = [];
  queue: Job[] = [];
  running: boolean = false;
  io: IntersectionObserver | null = null;
  mo: MutationObserver | null = null;
  idleTimer: number | null = null;
  rafId: number | null = null;
  initialized: boolean = false;

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

    // Create 8 agent cursors
    for (let i = 0; i < 8; i++) {
      this.agents.push(new Agent(i, stage));
    }

    // Start RAF tick
    this.startLoop();

    // Attach IntersectionObserver for scroll and view detection
    this.setupObservers();
  }

  setupObservers() {
    const selector = '.glass-panel, .resource-card, .notice-card, .dashboard-hero, .copilot-match, .general-answer, .admin-panel, .admin-overview-card, .duty-checkbox-card, .integration-card, .profile-view, .welcome-hero';

    this.io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          if (!el.dataset.stitched && !el.dataset.stitching) {
            this.enqueueElement(el);
          }
        }
      });
    }, {
      rootMargin: '20px 0px -20px 0px',
      threshold: 0.08
    });

    const scan = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (!el.dataset.stitched && !el.dataset.stitching) {
          this.io?.observe(el);
        }
      });
    };

    scan();

    this.mo = new MutationObserver(() => {
      scan();
    });
    this.mo.observe(document.body, { childList: true, subtree: true });
  }

  enqueueElement(el: HTMLElement) {
    if (el.dataset.stitched || el.dataset.stitching) return;
    el.dataset.stitching = 'true';

    const rect = el.getBoundingClientRect();
    if (rect.width < 30 || rect.height < 20) {
      el.dataset.stitched = 'true';
      return;
    }

    this.queue.push({ el, rect });
    this.wakeAgents();
  }

  wakeAgents() {
    // Show agents
    this.agents.forEach(a => a.setOpacity(1));

    if (this.idleTimer) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    this.processQueue();
  }

  async processQueue() {
    if (!this.stage || this.queue.length === 0) return;

    const idleAgents = this.agents.filter(a => a.idle);
    if (idleAgents.length === 0) return;

    let stagger = 0;
    while (this.queue.length > 0 && idleAgents.length > 0) {
      const agent = idleAgents.shift()!;
      const job = this.queue.shift()!;
      const delay = stagger * 50;
      stagger++;
      setTimeout(() => {
        void this.runStitchJob(agent, job);
      }, delay);
    }
  }

  async runStitchJob(agent: Agent, job: Job) {
    agent.idle = false;
    const { el } = job;
    const currentRect = el.getBoundingClientRect();

    // Calculate document coordinates
    const sx = currentRect.left + window.scrollX;
    const sy = currentRect.top + window.scrollY;
    const w = currentRect.width;
    const h = currentRect.height;
    const ex = sx + w;
    const ey = sy + h;

    // Step 1: Fly to top-left corner
    const distToStart = Math.hypot(agent.x - sx, agent.y - sy);
    const flyDur = Math.min(420, Math.max(180, distToStart * 0.4));

    await agent.moveTo(sx, sy, flyDur);
    agent.setMode('cross');

    // Step 2: Create wireframe container
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
    this.stage?.appendChild(wire);

    const dim = wire.querySelector('em');

    // Step 3: Draw wireframe diagonally across the card
    const drawDur = Math.min(380, Math.max(220, Math.hypot(w, h) * 0.35));

    await agent.moveTo(ex, ey, drawDur, (k) => {
      const curW = Math.round(w * k);
      const curH = Math.round(h * k);
      wire.style.width = `${curW}px`;
      wire.style.height = `${curH}px`;
      if (dim) {
        dim.textContent = `${curW} × ${curH}`;
      }
    });

    // Step 4: Click and snap into place
    agent.setMode('arrow');
    agent.click();

    // Snap card into stitched form
    el.classList.add('is-card-stitched');
    wire.classList.add('done');

    setTimeout(() => {
      if (wire.parentNode) wire.remove();
    }, 250);

    el.dataset.stitched = 'true';
    delete el.dataset.stitching;

    // Free agent for next job
    agent.idle = true;

    // Check if more jobs exist
    if (this.queue.length > 0) {
      this.processQueue();
    } else {
      if (this.agents.every(a => a.idle)) {
        this.scheduleIdleFade();
      }
    }
  }

  scheduleIdleFade() {
    if (this.idleTimer) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      if (this.queue.length === 0 && this.agents.every(a => a.idle)) {
        this.agents.forEach(a => a.setOpacity(0));
      }
    }, 2200);
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

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.io) this.io.disconnect();
    if (this.mo) this.mo.disconnect();
    if (this.stage && this.stage.parentNode) {
      this.stage.remove();
    }
    this.initialized = false;
  }
}

export const stitchSwarm = new StitchSwarmManager();

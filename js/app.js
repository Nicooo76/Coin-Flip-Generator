"use strict";

/* ---------------- Helpers ---------------- */
const $ = (id) => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const LS_KEY = "coin_canvas_deluxe_mobile_v3";
const HISTORY_LIMIT = 24;

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1400);
}

function fmtTime(d){
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

function setSwitch(sw, on){
  sw.dataset.on = on ? "true" : "false";
  sw.setAttribute("aria-checked", on ? "true" : "false");
}

function easeInOutCubic(t){
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
}
function smoothStep(t){
  return t*t*(3-2*t);
}

function roundedRectPath(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ---------------- DOM ---------------- */
const btnFlip  = $("btnFlip");
const btnAuto  = $("btnAuto");
const btnCopy  = $("btnCopy");
const btnReset = $("btnReset");

const prob = $("prob");
const probLabel = $("probLabel");
const skinSel = $("skin");
const speedSel = $("speed");
const autoSec = $("autoSec");

const swSound  = $("swSound");
const swHaptic = $("swHaptic");
const swTheme  = $("swTheme");
const swPersist= $("swPersist");

const dotState = $("dotState");
const stateText = $("stateText");
const pillProb = $("pillProb");
const pillSkin = $("pillSkin");

const resultText = $("resultText");
const countEl = $("count");
const headsEl = $("heads");
const tailsEl = $("tails");
const ratioHeadsEl = $("ratioHeads");

const sCount = $("sCount");
const sLast  = $("sLast");
const sBestHeads = $("sBestHeads");
const sBestTails = $("sBestTails");

const hudMode = $("hudMode");
const hudStreak = $("hudStreak");

const historyEl = $("history");

/* ---------------- State ---------------- */
let busy = false;
let autoTimer = null;

let count=0, heads=0, tails=0;
let last=null;

let streakType=null, streakLen=0;
let bestHeads=0, bestTails=0;
let history = [];

function setBusy(on){
  busy = on;
  btnFlip.disabled = on;
  stateText.textContent = on ? "Wirft…" : "Bereit";
  if(on){
    dotState.style.background = "var(--accent2)";
    dotState.style.boxShadow = "0 0 14px rgba(255,223,122,.45)";
  }else{
    dotState.style.background = "var(--accent)";
    dotState.style.boxShadow = "0 0 14px rgba(121,226,255,.55)";
  }
}

function applyTheme(){
  document.body.setAttribute("data-theme", swTheme.dataset.on === "true" ? "light" : "dark");
  Coin.requestRender();
}

function updateUI(){
  const p = Number(prob.value);
  probLabel.textContent = p + "%";
  pillProb.textContent = `${p}% Kopf`;
  pillSkin.textContent = ({
    gold:"Gold", silver:"Silber", copper:"Kupfer", platinum:"Platin"
  })[skinSel.value] || "Gold";

  countEl.textContent = String(count);
  headsEl.textContent = String(heads);
  tailsEl.textContent = String(tails);

  sCount.textContent = String(count);
  sLast.textContent  = last ?? "—";
  sBestHeads.textContent = String(bestHeads);
  sBestTails.textContent = String(bestTails);

  const ratio = count ? Math.round((heads / count) * 100) : 0;
  ratioHeadsEl.textContent = ratio + "%";

  hudMode.textContent = autoTimer ? "Mode: Auto" : "Mode: Normal";
  hudStreak.textContent = streakType ? `Streak: ${streakType} x${streakLen}` : "Streak: —";

  saveState();
}

function renderHistory(){
  historyEl.innerHTML = "";
  if(!history.length){
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "12px";
    empty.style.padding = "10px 4px";
    empty.textContent = "Noch keine Würfe.";
    historyEl.appendChild(empty);
    return;
  }

  let idx = history.length;
  for(const h of history){
    const wrap = document.createElement("div");
    wrap.className = "hItem";

    const left = document.createElement("div");
    left.className = "hLeft";

    const icon = document.createElement("div");
    icon.className = "hIcon";
    icon.textContent = h.result === "Kopf" ? "👑" : "🔢";

    const txt = document.createElement("div");
    txt.className = "hText";

    const b = document.createElement("b");
    b.textContent = h.result;

    const s = document.createElement("span");
    s.textContent = "Zeit: " + h.time;

    txt.appendChild(b); txt.appendChild(s);
    left.appendChild(icon); left.appendChild(txt);

    const right = document.createElement("div");
    right.className = "hRight";
    right.textContent = "#" + (idx--);

    wrap.appendChild(left);
    wrap.appendChild(right);
    historyEl.appendChild(wrap);
  }
}

function addHistoryItem(res){
  const now = new Date();
  history.unshift({ at: now.toISOString(), time: fmtTime(now), result: res });
  if(history.length > HISTORY_LIMIT) history.length = HISTORY_LIMIT;
  renderHistory();
  saveState();
}

function pickResult(){
  const p = Number(prob.value) / 100;
  return (Math.random() < p) ? "Kopf" : "Zahl";
}

function applyStreak(res){
  if(streakType === res) streakLen++;
  else { streakType = res; streakLen = 1; }
  if(res === "Kopf") bestHeads = Math.max(bestHeads, streakLen);
  else bestTails = Math.max(bestTails, streakLen);
}

async function copyResult(){
  const p = Number(prob.value);
  const text = last
    ? `Münzwurf: ${last} (Würfe: ${count}, Kopf: ${heads}, Zahl: ${tails}, Wahrscheinlichkeit Kopf: ${p}%)`
    : `Münzwurf bereit (Wahrscheinlichkeit Kopf: ${p}%)`;
  try{
    await navigator.clipboard.writeText(text);
    toast("Kopiert ✅");
  }catch(e){
    toast("Clipboard blockiert 😅");
  }
}

function resetAll(){
  stopAuto();
  count=0; heads=0; tails=0; last=null;
  streakType=null; streakLen=0;
  bestHeads=0; bestTails=0;
  history = [];
  resultText.innerHTML = "Bereit. <span class='spark'>✦</span>";
  updateUI();
  renderHistory();
  toast("Reset done");
  Coin.setIdle("Kopf");
}

/* ---------------- Audio / Haptics ---------------- */
let audioCtx = null;
function ensureAudio(){
  if(audioCtx) return;
  try{ audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){}
}
function beep(type){
  if(swSound.dataset.on !== "true") return;
  ensureAudio();
  if(!audioCtx) return;
  if(audioCtx.state === "suspended") audioCtx.resume().catch(()=>{});

  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";

  if(type === "flip"){
    o.frequency.setValueAtTime(520, now);
    o.frequency.exponentialRampToValueAtTime(220, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + 0.12);
  }else{
    o.frequency.setValueAtTime(190, now);
    o.frequency.exponentialRampToValueAtTime(120, now + 0.12);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(now); o.stop(now + 0.16);
  }
}
function vibrate(ms){
  if(swHaptic.dataset.on !== "true") return;
  if(navigator.vibrate) navigator.vibrate(ms);
}

/* ---------------- Persistence ---------------- */
function saveState(){
  if(swPersist.dataset.on !== "true") return;
  const data = {
    count, heads, tails, last,
    streakType, streakLen, bestHeads, bestTails,
    history,
    prob: Number(prob.value),
    skin: skinSel.value,
    speed: speedSel.value,
    autoSec: Number(autoSec.value),
    sound: swSound.dataset.on === "true",
    haptic: swHaptic.dataset.on === "true",
    theme: swTheme.dataset.on === "true" ? "light" : "dark",
    persist: swPersist.dataset.on === "true"
  };
  try{ localStorage.setItem(LS_KEY, JSON.stringify(data)); }catch(e){}
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return;
    const d = JSON.parse(raw);
    if(!d) return;

    count = d.count ?? 0;
    heads = d.heads ?? 0;
    tails = d.tails ?? 0;
    last  = d.last ?? null;

    streakType = d.streakType ?? null;
    streakLen  = d.streakLen ?? 0;
    bestHeads  = d.bestHeads ?? 0;
    bestTails  = d.bestTails ?? 0;

    history = Array.isArray(d.history) ? d.history : [];

    prob.value = clamp(Number(d.prob ?? 50), 0, 100);
    skinSel.value = d.skin ?? "gold";
    speedSel.value = d.speed ?? "normal";
    autoSec.value = clamp(Number(d.autoSec ?? 2), 1, 10);

    setSwitch(swSound, d.sound !== false);
    setSwitch(swHaptic, d.haptic !== false);
    setSwitch(swTheme, d.theme === "light");
    setSwitch(swPersist, d.persist !== false);

    applyTheme();
    updateUI();
    renderHistory();
  }catch(e){}
}

/* ---------------- Auto ---------------- */
function startAuto(){
  const sec = clamp(Number(autoSec.value) || 2, 1, 10);
  autoSec.value = sec;
  btnAuto.textContent = "⏱️ Auto: An";
  toast("Auto an ("+sec+"s)");
  autoTimer = setInterval(() => { if(!busy) doFlip(); }, sec*1000);
  updateUI();
}
function stopAuto(){
  if(autoTimer){ clearInterval(autoTimer); autoTimer=null; }
  btnAuto.textContent = "⏱️ Auto: Aus";
  updateUI();
}
function toggleAuto(){ autoTimer ? stopAuto() : startAuto(); }

/* ---------------- Canvas Coin Engine (STABLE) ---------------- */
const Coin = (() => {
  const canvas = $("coinCanvas");
  const ctx = canvas.getContext("2d", { alpha:true });

  const state = {
    running:false,
    t:0,
    dur:1.25,
    spin:0.25,
    tilt:0.18,
    yaw:0.22,
    x:0,
    y:0,
    targetFace:"Kopf",
    spinFrom:0.25,
    spinTo:0.25,
    tiltFrom:0.18,
    tiltTo:0.18,
    yawFrom:0.22,
    yawTo:0.22,
    yPeak:-280,
    x1:0, x2:0,
    needsRender:true,
    lastFrame: performance.now()
  };

  function getDpr(){
    return Math.max(1, Math.min(2.2, window.devicePixelRatio || 1));
  }

  function fitCanvas(){
    const W = 900, H = 900;
    const dpr = getDpr();
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    state.needsRender = true;
  }

  window.addEventListener("resize", () => { fitCanvas(); requestRender(); });
  fitCanvas();

  function requestRender(){ state.needsRender = true; }

  function getMaterial(){
    const s = skinSel.value;
    if(s === "silver")   return { top:"#f6f8ff", mid:"#cfd7e6", bot:"#8893a6", edge:"#cfd7e6" };
    if(s === "copper")   return { top:"#ffd3b0", mid:"#c97a3a", bot:"#6a2c10", edge:"#c97a3a" };
    if(s === "platinum") return { top:"#ffffff", mid:"#dfe8f6", bot:"#8fa1bf", edge:"#dfe8f6" };
    return { top:"#ffe8b0", mid:"#d7a31a", bot:"#7a4e00", edge:"#d7a31a" };
  }

  function drawSymbol(g, face, size){
    g.save();
    if(face === "Kopf"){
      g.beginPath();
      g.moveTo(-size*0.85, size*0.25);
      g.lineTo(-size*0.65, -size*0.30);
      g.lineTo(-size*0.25, size*0.05);
      g.lineTo(0, -size*0.40);
      g.lineTo(size*0.25, size*0.05);
      g.lineTo(size*0.65, -size*0.30);
      g.lineTo(size*0.85, size*0.25);
      g.quadraticCurveTo(0, size*0.55, -size*0.85, size*0.25);
      g.closePath();
      g.fill();

      g.beginPath(); g.arc(-size*0.45, -size*0.18, size*0.08, 0, Math.PI*2); g.fill();
      g.beginPath(); g.arc(0, -size*0.26, size*0.08, 0, Math.PI*2); g.fill();
      g.beginPath(); g.arc(size*0.45, -size*0.18, size*0.08, 0, Math.PI*2); g.fill();
    }else{
      const dotR = size*0.10;
      const step = size*0.35;
      for(let yy=-1;yy<=1;yy++){
        for(let xx=-1;xx<=1;xx++){
          g.beginPath();
          g.arc(xx*step, yy*step, dotR, 0, Math.PI*2);
          g.fill();
        }
      }
      const w = size*1.10;
      const h = size*0.18;
      const x = -w/2;
      const y = size*0.55;
      roundedRectPath(g, x, y, w, h, h/2);
      g.fill();
    }
    g.restore();
  }

  function drawFace(g, r, face){
    const mat = getMaterial();

    const grad = g.createRadialGradient(-r*0.2, -r*0.25, r*0.2, 0, 0, r*1.05);
    grad.addColorStop(0, mat.top);
    grad.addColorStop(0.55, mat.mid);
    grad.addColorStop(1, mat.bot);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0,0,r,0,Math.PI*2);
    g.fill();

    g.save();
    g.globalAlpha = 0.12;
    g.rotate(0.35);
    g.strokeStyle = "rgba(255,255,255,.25)";
    g.lineWidth = 1;
    for(let i=0;i<90;i++){
      const rr = (i/90)*r;
      g.beginPath(); g.arc(0,0,rr,0,Math.PI*2); g.stroke();
    }
    g.restore();

    g.save();
    g.lineWidth = r*0.09;
    const rimGrad = g.createLinearGradient(-r, -r, r, r);
    rimGrad.addColorStop(0, "rgba(255,255,255,.30)");
    rimGrad.addColorStop(0.5, "rgba(0,0,0,.18)");
    rimGrad.addColorStop(1, "rgba(255,255,255,.18)");
    g.strokeStyle = rimGrad;
    g.beginPath(); g.arc(0,0,r*0.94,0,Math.PI*2); g.stroke();
    g.restore();

    g.save();
    g.globalAlpha = 0.22;
    g.lineWidth = 2;
    g.strokeStyle = "rgba(0,0,0,.35)";
    g.beginPath(); g.arc(0,0,r*0.68,0,Math.PI*2); g.stroke();
    g.globalAlpha = 0.12;
    g.strokeStyle = "rgba(255,255,255,.45)";
    g.beginPath(); g.arc(0,0,r*0.70,0,Math.PI*2); g.stroke();
    g.restore();

    const lx = 0.55 + 0.25*Math.cos(state.spin*0.7);
    const ly = -0.55 + 0.25*Math.sin(state.spin*0.7);
    const ox = lx * r*0.03;
    const oy = ly * r*0.03;

    g.save();
    g.translate(0, -r*0.02);

    g.globalAlpha = 0.18;
    g.fillStyle = "rgba(0,0,0,.65)";
    g.save(); g.translate(ox, oy); drawSymbol(g, face, r*0.38); g.restore();

    g.globalAlpha = 0.18;
    g.fillStyle = "rgba(255,255,255,.55)";
    g.save(); g.translate(-ox, -oy); drawSymbol(g, face, r*0.38); g.restore();

    g.globalAlpha = 0.85;
    g.fillStyle = "rgba(0,0,0,.45)";
    drawSymbol(g, face, r*0.38);

    g.globalAlpha = 0.62;
    g.fillStyle = "rgba(0,0,0,.48)";
    g.font = `900 ${Math.floor(r*0.16)}px ${getComputedStyle(document.body).fontFamily}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(face === "Kopf" ? "KOPF" : "ZAHL", 0, r*0.46);
    g.restore();

    g.save();
    const shine = g.createRadialGradient(-r*0.35 + lx*r*0.25, -r*0.35 + ly*r*0.25, r*0.1, 0, 0, r*1.1);
    shine.addColorStop(0, "rgba(255,255,255,.45)");
    shine.addColorStop(0.25, "rgba(255,255,255,.16)");
    shine.addColorStop(0.55, "rgba(255,255,255,.06)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = "screen";
    g.fillStyle = shine;
    g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill();
    g.restore();

    g.save();
    const vign = g.createRadialGradient(0,0,r*0.30, 0,0,r*1.15);
    vign.addColorStop(0, "rgba(0,0,0,0)");
    vign.addColorStop(1, "rgba(0,0,0,.22)");
    g.globalAlpha = 0.60;
    g.fillStyle = vign;
    g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill();
    g.restore();
  }

  function render(){
    if(!state.needsRender && !state.running) return;
    state.needsRender = false;

    const W = 900, H = 900;
    ctx.clearRect(0,0,W,H);

    ctx.save();
    const bg = ctx.createRadialGradient(W*0.5, H*0.55, 10, W*0.5, H*0.55, H*0.55);
    bg.addColorStop(0, "rgba(255,255,255,.05)");
    bg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);
    ctx.restore();

    const baseY = H*0.62;
    const cx = W*0.5 + state.x;
    const cy = baseY + state.y;

    const height01 = clamp((-state.y) / (H*0.35), 0, 1);
    const shadowScale = 1 - height01*0.55;
    const shadowAlpha = 0.55 - height01*0.30;

    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    const sh = ctx.createRadialGradient(cx, baseY + H*0.12, 10, cx, baseY + H*0.12, H*0.20);
    sh.addColorStop(0, "rgba(0,0,0,.65)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + H*0.12, H*0.19*shadowScale, H*0.06*shadowScale, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    const c = Math.cos(state.spin);
    const face = (c >= 0) ? "Kopf" : "Zahl";

    const r = H*0.16;
    const thickness = r*0.18;

    const faceScaleY = clamp(Math.abs(c), 0.10, 1.0);
    const edgeStrength = 1 - faceScaleY;

    ctx.save();
    ctx.translate(cx, cy);

    const roll = state.yaw*0.35 + Math.sin(state.spin*0.15)*0.06;
    ctx.rotate(roll);

    if(edgeStrength > 0.02){
      const mat = getMaterial();
      const ew = thickness * (0.65 + edgeStrength*2.0);
      const eh = r*2 * (0.14 + edgeStrength*0.86);

      const eg = ctx.createLinearGradient(-ew, 0, ew, 0);
      eg.addColorStop(0, "rgba(255,255,255,.22)");
      eg.addColorStop(0.35, mat.edge);
      eg.addColorStop(0.65, "rgba(0,0,0,.18)");
      eg.addColorStop(1, "rgba(255,255,255,.14)");

      ctx.save();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = eg;
      roundedRectPath(ctx, -ew, -eh*0.5, ew*2, eh, Math.min(ew, 18));
      ctx.fill();

      ctx.globalAlpha = 0.20 + edgeStrength*0.40;
      ctx.strokeStyle = "rgba(0,0,0,.45)";
      ctx.lineWidth = 1;
      const ribCount = 52;
      for(let i=0;i<ribCount;i++){
        const yy = -eh*0.5 + (i/(ribCount-1))*eh;
        ctx.beginPath();
        ctx.moveTo(-ew, yy);
        ctx.lineTo(ew, yy);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.20 + edgeStrength*0.25;
      ctx.strokeStyle = "rgba(255,255,255,.65)";
      roundedRectPath(ctx, -ew, -eh*0.5, ew*2, eh, Math.min(ew, 18));
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.scale(1, faceScaleY);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.beginPath();
    ctx.arc(0, r*0.04, r*1.02, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.clip();

    drawFace(ctx, r, face);

    ctx.restore();
    ctx.restore();
  }

  function setIdle(face){
    state.spin = (face === "Kopf") ? 0.25 : Math.PI + 0.25;
    state.tilt = 0.18;
    state.yaw  = 0.22;
    state.x = 0;
    state.y = 0;
    state.running = false;
    state.needsRender = true;
    render();
  }

  function startFlip(target){
    state.running = true;
    state.t = 0;
    state.targetFace = target;

    const speed = speedSel.value;
    state.dur = (speed === "slow") ? 2.2 : (speed === "fast" ? 0.95 : 1.25);

    state.x = 0;
    state.y = 0;

    const base = state.spin;
    const turns = (speed === "slow") ? 10 : (speed === "fast" ? 16 : 14);
    const final = (target === "Kopf") ? 0.25 : Math.PI + 0.25;

    state.spinFrom = base;
    const baseMod = ((base % (Math.PI*2)) + (Math.PI*2)) % (Math.PI*2);
    const deltaToFinal = final - baseMod;
    state.spinTo = base + (turns * Math.PI) + deltaToFinal;

    state.tiltFrom = state.tilt;
    state.tiltTo   = 0.20 + Math.random()*0.08;

    state.yawFrom = state.yaw;
    state.yawTo   = 0.18 + Math.random()*0.22;

    const h = 260 + Math.random()*120;
    state.yPeak = -h;
    state.x1 = (-70 + Math.random()*140);
    state.x2 = (-90 + Math.random()*180);

    requestRender();
  }

  function tick(now){
    const dt = Math.min(0.05, (now - state.lastFrame)/1000);
    state.lastFrame = now;

    if(state.running){
      state.t += dt / state.dur;
      const t = clamp(state.t, 0, 1);
      const e = easeInOutCubic(t);

      state.spin = state.spinFrom + (state.spinTo - state.spinFrom) * e;
      state.tilt = state.tiltFrom + (state.tiltTo - state.tiltFrom) * smoothStep(t);
      state.yaw  = state.yawFrom  + (state.yawTo  - state.yawFrom)  * smoothStep(t);

      state.y = 4 * state.yPeak * t * (1-t);

      const xw = Math.sin(t*Math.PI);
      state.x = (state.x1 * xw) + (state.x2 * (xw*xw - xw*0.5));

      if(t > 0.92){
        const l = (t - 0.92) / 0.08;
        state.y += Math.sin(l*Math.PI) * 6;
      }

      if(t >= 1){
        state.running = false;
        state.x = 0; state.y = 0;
        state.spin = (state.targetFace === "Kopf") ? 0.25 : Math.PI + 0.25;
        state.tilt = 0.18;
        state.yaw  = 0.22;
      }

      state.needsRender = true;
    }

    render();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);

  return { requestRender, setIdle, startFlip };
})();

/* ---------------- Actions ---------------- */
function doFlip(){
  if(busy) return;
  setBusy(true);

  const res = pickResult();
  beep("flip");
  vibrate(18);

  Coin.startFlip(res);

  const speed = speedSel.value;
  const dur = (speed === "slow") ? 2.2 : (speed === "fast" ? 0.95 : 1.25);
  const revealMs = Math.floor(dur * 1000 * 0.90);

  setTimeout(() => {
    last = res;
    count++;
    if(res === "Kopf") heads++; else tails++;
    applyStreak(res);

    resultText.innerHTML = `Ergebnis: ${res} <span class="spark">✦</span>`;
    addHistoryItem(res);

    beep("land");
    vibrate(28);

    updateUI();
  }, revealMs);

  setTimeout(() => setBusy(false), Math.floor(dur * 1000) + 60);
}

/* ---------------- Switch binding ---------------- */
function bindSwitch(sw, onToggle){
  sw.addEventListener("click", onToggle);
  sw.addEventListener("keydown", (e) => {
    if(e.key === "Enter" || e.key === " "){
      e.preventDefault();
      onToggle();
    }
  });
}

/* ---------------- Events ---------------- */
btnFlip.addEventListener("click", doFlip);
btnAuto.addEventListener("click", () => (autoTimer ? stopAuto() : startAuto()));
btnCopy.addEventListener("click", copyResult);
btnReset.addEventListener("click", resetAll);

prob.addEventListener("input", () => { updateUI(); });

skinSel.addEventListener("change", () => {
  toast("Material: " + skinSel.options[skinSel.selectedIndex].text);
  updateUI();
  Coin.requestRender();
});

speedSel.addEventListener("change", () => {
  toast("Speed: " + speedSel.options[speedSel.selectedIndex].text);
});

autoSec.addEventListener("change", () => {
  autoSec.value = clamp(Number(autoSec.value) || 2, 1, 10);
  if(autoTimer){
    stopAuto();
    startAuto();
  }else{
    toast("Auto: " + autoSec.value + "s");
  }
  updateUI();
});

bindSwitch(swSound, () => {
  const on = swSound.dataset.on !== "true";
  setSwitch(swSound, on);
  toast("Sound: " + (on ? "an" : "aus"));
  if(on) beep("flip");
  updateUI();
});

bindSwitch(swHaptic, () => {
  const on = swHaptic.dataset.on !== "true";
  setSwitch(swHaptic, on);
  toast("Haptik: " + (on ? "an" : "aus"));
  if(on) vibrate(20);
  updateUI();
});

bindSwitch(swTheme, () => {
  const on = swTheme.dataset.on !== "true";
  setSwitch(swTheme, on);
  applyTheme();
  toast("Theme: " + (on ? "Light" : "Dark"));
  updateUI();
});

bindSwitch(swPersist, () => {
  const on = swPersist.dataset.on !== "true";
  setSwitch(swPersist, on);
  toast("Speichern: " + (on ? "an" : "aus"));
  if(!on){
    try{ localStorage.removeItem(LS_KEY); }catch(e){}
  }else{
    saveState();
  }
  updateUI();
});

document.addEventListener("keydown", (e) => {
  if(e.repeat) return;

  if(e.code === "Space" || e.key === "Enter"){
    e.preventDefault();
    doFlip();
  }
  if(e.key.toLowerCase() === "a"){
    if(autoTimer) stopAuto(); else startAuto();
  }
  if(e.key.toLowerCase() === "s"){
    const on = swSound.dataset.on !== "true";
    setSwitch(swSound, on);
    toast("Sound: " + (on ? "an" : "aus"));
    if(on) beep("flip");
    updateUI();
  }
  if(e.key.toLowerCase() === "t"){
    const on = swTheme.dataset.on !== "true";
    setSwitch(swTheme, on);
    applyTheme();
    toast("Theme: " + (on ? "Light" : "Dark"));
    updateUI();
  }
});

/* ---------------- Init ---------------- */
setSwitch(swSound, true);
setSwitch(swHaptic, true);
setSwitch(swTheme, false);
setSwitch(swPersist, true);

applyTheme();
loadState();
renderHistory();
updateUI();

Coin.setIdle(last || "Kopf");
setBusy(false);
setTimeout(() => toast("Tipp: Leertaste zum Werfen 😄"), 650);


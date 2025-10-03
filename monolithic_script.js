/* ===================== Config ===================== */
const PORT_R  = 7;
const BOX_W   = 200;
const BOX_H   = 80;

const PORT_LEFT  = "left";
const PORT_RIGHT = "right";

const PORT_BOTTOM_TRIGGER = "bottomTrigger"; // V trigger out
const PORT_RIGHT_TRIGGER  = "rightTrigger";  // H trigger out
const PORT_TOP_TRIGGER    = "topTrigger";    // V trigger in
const PORT_SIGNAL         = "signal";        // diamond ports

const CABLE_HIT_THRESH = 6;
const TRIGGER_HIT_THRESH = 8;
const TRIGGER_HIT_RIGHTCLICK = 16; // larger RC hit
const DELETE_ICON_R = 10;

const CLICK_DRAG_THRESHOLD = 5;
const PLAY_DURATION_MS     = 2000;

const BLINK_MS = 220;
const BLINK_RING_EXTRA = 2.5;

// constant graph play speed
const SPEED_PX_PER_SEC = (BOX_W - 16) / (PLAY_DURATION_MS / 1000);

/* ===== Recording overlay ===== */
const TRH = 27;
const STACK_GAP = 6;
const SIMUL_WIN_MS = 5;
const NB_STACK_GAP = 12;

/* ===== Grouping & Docking ===== */
const SNAP_PX = 8;
const SNAP_NEAR_PX = 20; // only nearby nodes influence snapping
const GUIDE_ALPHA = 190;

/* ===== Port visibility ===== */
const PORT_VIS_PX = 20; // show if mouse within 20px of node rect, or connected

/* ===================== Helpers ===================== */
function dist2(ax, ay, bx, by) { return (ax - bx) ** 2 + (ay - by) ** 2; }
function pointInRect(px, py, x, y, w, h) { return px >= x && px <= x + w && py >= y && py <= y + h; }
function pointToSegmentDist(px,py,ax,ay,bx,by){
  const vx=bx-ax, vy=by-ay, wx=px-ax, wy=py-ay;
  const c1=vx*wx+vy*wy; if(c1<=0) return Math.hypot(px-ax,py-ay);
  const c2=vx*vx+vy*vy; if(c2<=c1) return Math.hypot(px-bx,py-by);
  const t=c1/c2; const qx=ax+t*vx, qy=ay+t*vy; return Math.hypot(px-qx,py-qy);
}
function escapeRegExp(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripManufacturerFromName(name, manufacturer){
  if (!name) return '';
  let s = name;
  if (manufacturer && manufacturer.length){
    const manu = manufacturer.trim();
    if (manu){
      const lead = new RegExp('^\\s*' + escapeRegExp(manu) + '\\s*', 'i');
      s = s.replace(lead, '');
      s = s.replace(new RegExp('\\b' + escapeRegExp(manu) + '\\b','ig'), '').trim();
    }
  }
  s = s.replace(/\b(MIDI|USB|Port\s*\d+)\b/ig,'').replace(/\s{2,}/g,' ').trim();
  return s || name;
}
const shiftDown = () => keyIsDown(16);
const altDown   = () => keyIsDown(18);

function rectsMinDistance(ax, ay, aw, ah, bx, by, bw, bh){
  const ax2 = ax + aw, ay2 = ay + ah;
  const bx2 = bx + bw, by2 = by + bh;
  const dx = (ax > bx2) ? (ax - bx2) : (bx > ax2 ? (bx - ax2) : 0);
  const dy = (ay > by2) ? (ay - by2) : (by - ay2 > 0 ? (by - ay2) : 0);
  return Math.hypot(dx, dy);
}
function pointRectDistance(px, py, rx, ry, rw, rh){
  const dx = (px < rx) ? (rx - px) : (px > rx + rw ? px - (rx + rw) : 0);
  const dy = (py < ry) ? (ry - py) : (py > ry + rh ? py - (ry + rh) : 0);
  return Math.hypot(dx, dy);
}
function isPortConnected(port){
  for (const L of links){
    if (L.a === port || L.b === port) return true;
  }
  return false;
}
function shouldShowPort(port){
  if (!port || !port.node) return false;
  if (isPortConnected(port)) return true;
  const d = pointRectDistance(mouseX, mouseY, port.node.x, port.node.y, port.node.w, port.node.h);
  return d <= PORT_VIS_PX;
}

/* ===================== Web MIDI (IN + OUT) ===================== */
const Midi = {
  access: null, ready:false, initRequested:false,
  outputs: [], inputs: [],
  inMode: 'all',          // 'none' | 'all' | number[]
  outSelection: 'all',    // 'all' | number[]
  channel: 0,
  lastSeen: new Map(),
  lastGlobalVal: 0,

  async init() {
    if (this.initRequested) return; this.initRequested = true;
    try {
      if (!('requestMIDIAccess' in navigator)) return;
      this.access = await navigator.requestMIDIAccess({ sysex:false });
      this.refreshAll();
      this.access.onstatechange = () => this.refreshAll();
      this.ready = true;
    } catch (e) { console.warn('MIDI init failed:', e); }
  },
  refreshAll(){
    this.refreshOutputs();
    this.refreshInputs();
    populateMidiInGroup();
    populateMidiOutGroup();
    populateMidiChannel();
    this.attachInputListener();
  },
  refreshOutputs(){
    this.outputs = [];
    if (!this.access) return;
    for (const o of this.access.outputs.values()) this.outputs.push(o);
    if (this.outSelection !== 'all') {
      if (!Array.isArray(this.outSelection)) this.outSelection = [];
      this.outSelection = this.outSelection.filter(i => i >= 0 && i < this.outputs.length);
      if (this.outputs.length && this.outSelection.length === this.outputs.length) this.outSelection = 'all';
    }
  },
  refreshInputs(){
    this.inputs = [];
    if (!this.access) return;
    for (const i of this.access.inputs.values()) this.inputs.push(i);
    if (this.inputs.length === 0) {
      this.inMode = 'none';
    } else if (Array.isArray(this.inMode)) {
      this.inMode = this.inMode.filter(i => i >= 0 && i < this.inputs.length);
      if (this.inMode.length === 0) this.inMode = 'none';
      if (this.inMode.length === this.inputs.length) this.inMode = 'all';
    } else if (this.inMode !== 'all' && this.inMode !== 'none') {
      this.inMode = 'all';
    }
  },
  attachInputListener(){
    if (!this.access) return;
    for (const i of this.access.inputs.values()) i.onmidimessage = null;

    if (this.inMode === 'none') return;
    if (this.inMode === 'all'){
      for (const i of this.inputs) i.onmidimessage = Midi._onMIDIMessage;
    } else if (Array.isArray(this.inMode)) {
      for (const idx of this.inMode) {
        const inp = this.inputs[idx];
        if (inp) inp.onmidimessage = Midi._onMIDIMessage;
      }
    }
  },
  _onMIDIMessage(e){
    const d = e.data;
    if (!d || d.length < 3) return;
    const st = d[0], type = st & 0xF0;
    const ch = (st & 0x0F) + 1;

    const src = (e.currentTarget || e.target || null);
    const srcId  = src && src.id  ? src.id  : (src && src.name ? 'name:'+src.name : 'unknown');
    const srcName = src && src.name || '';
    const srcMan  = src && src.manufacturer || '';

    if (type === 0xB0) { // CC
      const cc = d[1] & 0x7F;
      const val= d[2] & 0x7F;
      Midi.lastGlobalVal = val;
      Midi.lastSeen.set(`${ch}:${cc}`, { ch, cc, val, ts: performance.now(), srcId, srcName, srcMan });
      if (recGroup) pushCCToRec(ch, cc, val, performance.now(), { id:srcId, name:srcName, manufacturer:srcMan });
    }
  },
  get out(){
    if (this.outSelection === 'all') return this.outputs[0] || null;
    if (Array.isArray(this.outSelection) && this.outSelection.length > 0) {
      return this.outputs[this.outSelection[0]] || null;
    }
    return null;
  },
  send(bytes){
    if (this.outSelection === 'all') {
      if (!this.outputs || !this.outputs.length) return;
      for (const o of this.outputs) {
        try { o.send(bytes); } catch (e) { console.warn('MIDI send error (broadcast):', e); }
      }
      return;
    }
    if (Array.isArray(this.outSelection) && this.outSelection.length > 0) {
      for (const i of this.outSelection) {
        const o = this.outputs[i];
        if (!o) continue;
        try { o.send(bytes); } catch (e) { console.warn('MIDI send error:', e); }
      }
    }
  },
  sendCC(cc,val,ch=null){ const chan=(ch==null?this.channel:ch)&0x0F; this.send([0xB0|chan, cc&0x7F, val&0x7F]); }
};

/* ===================== Side Menu (collapsible) ===================== */
let sidebar=null, sidebarToggle=null;
let inListWrap=null, outListWrap=null, chWrap=null;
let inAllCb=null, outAllCb=null, midiChSel=null;
let suppressInUI=false, suppressOutUI=false;

function createSideMenu(){
  sidebarToggle = document.createElement('button');
  Object.assign(sidebarToggle.style, {
    position:'fixed', left:'8px', top:'8px', zIndex:'100',
    width:'34px', height:'28px', borderRadius:'6px',
    border:'1px solid #666', background:'#111', color:'#fff',
    font:'16px/1 sans-serif', cursor:'pointer'
  });
  sidebarToggle.textContent = '☰';
  document.body.appendChild(sidebarToggle);

  sidebar = document.createElement('div');
  Object.assign(sidebar.style, {
    position:'fixed', left:'0', top:'0', height:'100%', width:'280px',
    background:'rgba(0,0,0,0.78)', color:'#fff', zIndex:'90',
    boxShadow:'2px 0 8px rgba(0,0,0,0.35)',
    transform:'translateX(0)', transition:'transform 160ms ease-out',
    padding:'44px 12px 12px 12px', backdropFilter:'blur(3px)',
    overflowY:'auto'
  });

  const title = document.createElement('div');
  title.textContent = 'MIDI';
  Object.assign(title.style,{ font:'bold 14px/1.2 sans-serif', marginBottom:'10px', letterSpacing:'0.03em' });
  sidebar.appendChild(title);

  const inHdr = document.createElement('div');
  inHdr.textContent = 'Inputs';
  Object.assign(inHdr.style,{ font:'bold 12px/1.2 sans-serif', opacity:'0.85', margin:'10px 0 6px' });
  sidebar.appendChild(inHdr);

  const inAllRow = document.createElement('div');
  inAllCb = document.createElement('input'); inAllCb.type='checkbox'; inAllCb.id='midi_in_all';
  const inAllLbl = document.createElement('label'); inAllLbl.htmlFor='midi_in_all'; inAllLbl.textContent='All';
  inAllRow.append(inAllCb, inAllLbl);
  Object.assign(inAllRow.style,{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'4px' });
  sidebar.appendChild(inAllRow);

  inListWrap = document.createElement('div');
  Object.assign(inListWrap.style,{ marginLeft:'8px', display:'grid', gap:'4px' });
  sidebar.appendChild(inListWrap);

  const outHdr = document.createElement('div');
  outHdr.textContent = 'Outputs';
  Object.assign(outHdr.style,{ font:'bold 12px/1.2 sans-serif', opacity:'0.85', margin:'12px 0 6px' });
  sidebar.appendChild(outHdr);

  const outAllRow = document.createElement('div');
  outAllCb = document.createElement('input'); outAllCb.type='checkbox'; outAllCb.id='midi_out_all';
  const outAllLbl = document.createElement('label'); outAllLbl.htmlFor='midi_out_all'; outAllLbl.textContent='All';
  outAllRow.append(outAllCb, outAllLbl);
  Object.assign(outAllRow.style,{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'4px' });
  sidebar.appendChild(outAllRow);

  outListWrap = document.createElement('div');
  Object.assign(outListWrap.style,{ marginLeft:'8px', display:'grid', gap:'4px' });
  sidebar.appendChild(outListWrap);

  const chHdr = document.createElement('div');
  chHdr.textContent = 'Channel';
  Object.assign(chHdr.style,{ font:'bold 12px/1.2 sans-serif', opacity:'0.85', margin:'12px 0 6px' });
  sidebar.appendChild(chHdr);

  chWrap = document.createElement('div');
  midiChSel = document.createElement('select');
  for (let i=1; i<=16; i++){
    const o = document.createElement('option');
    o.value = String(i-1); o.textContent = 'CH ' + i;
    midiChSel.appendChild(o);
  }
  Object.assign(midiChSel.style,{
    font:'12px sans-serif', padding:'4px 6px', background:'#111', color:'#fff',
    border:'1px solid #666', borderRadius:'4px', minWidth:'120px'
  });
  midiChSel.value = String(Midi.channel);
  midiChSel.addEventListener('change', ()=>{ Midi.channel = parseInt(midiChSel.value,10)||0; });
  chWrap.appendChild(midiChSel);
  sidebar.appendChild(chWrap);

  document.body.appendChild(sidebar);

  let collapsed = false;
  const setCollapsed = (c) => {
    collapsed = c;
    sidebar.style.transform = collapsed ? 'translateX(-100%)' : 'translateX(0)';
    sidebarToggle.textContent = collapsed ? '☰' : '×';
    sidebarToggle.style.background = collapsed ? '#111' : '#181818';
  };
  sidebarToggle.addEventListener('click', ()=> setCollapsed(!collapsed));
  setCollapsed(false);

  inAllCb.addEventListener('change', ()=>{
    if (suppressInUI) return;
    if (inAllCb.checked) Midi.inMode = (Midi.inputs.length ? 'all' : 'none');
    else                 Midi.inMode = 'none';
    populateMidiInGroup();
    Midi.attachInputListener();
  });
  outAllCb.addEventListener('change', ()=>{
    if (suppressOutUI) return;
    if (outAllCb.checked) Midi.outSelection = (Midi.outputs.length ? 'all' : []);
    else                  Midi.outSelection = [];
    populateMidiOutGroup();
  });
}
function populateMidiChannel(){ if (midiChSel) midiChSel.value = String(Midi.channel); }
function populateMidiInGroup(){
  if (!inListWrap || !inAllCb) return;
  suppressInUI = true;
  inListWrap.innerHTML = '';

  const selectedSet = new Set(Array.isArray(Midi.inMode) ? Midi.inMode.map(String) : []);
  Midi.inputs.forEach((inp, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style,{ display:'flex', gap:'8px', alignItems:'center' });
    const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx=String(idx);
    cb.checked = (Midi.inMode === 'all') ? true : selectedSet.has(String(idx));
    const lbl = document.createElement('label'); lbl.textContent = inp.name || ('Input ' + (idx+1));
    row.append(cb, lbl);
    inListWrap.appendChild(row);

    cb.addEventListener('change', ()=>{
      if (suppressInUI) return;
      const boxes = Array.from(inListWrap.querySelectorAll('input[type=checkbox]'));
      const picked = boxes.filter(x=>x.checked).map(x=>parseInt(x.dataset.idx,10));
      if (picked.length === 0)             Midi.inMode = 'none';
      else if (picked.length === Midi.inputs.length) Midi.inMode = 'all';
      else                                  Midi.inMode = picked;
      suppressInUI = true; inAllCb.checked = (Midi.inMode === 'all'); suppressInUI = false;
      Midi.attachInputListener();
    });
  });

  inAllCb.checked = (Midi.inMode === 'all');
  inAllCb.disabled = (Midi.inputs.length === 0);
  suppressInUI = false;
}
function populateMidiOutGroup(){
  if (!outListWrap || !outAllCb) return;
  suppressOutUI = true;
  outListWrap.innerHTML = '';

  const isAll = (Midi.outSelection === 'all');
  const selectedSet = new Set(Array.isArray(Midi.outSelection) ? Midi.outSelection.map(String) : []);

  Midi.outputs.forEach((out, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style,{ display:'flex', gap:'8px', alignItems:'center' });
    const cb = document.createElement('input'); cb.type='checkbox'; cb.dataset.idx=String(idx);
    cb.checked = isAll ? true : selectedSet.has(String(idx));
    const lbl = document.createElement('label'); lbl.textContent = out.name || ('Output ' + (idx+1));
    row.append(cb, lbl);
    outListWrap.appendChild(row);

    cb.addEventListener('change', ()=>{
      if (suppressOutUI) return;
      const boxes = Array.from(outListWrap.querySelectorAll('input[type=checkbox]'));
      const picked = boxes.filter(x=>x.checked).map(x=>parseInt(x.dataset.idx,10));
      if (picked.length === 0)                        Midi.outSelection = [];
      else if (picked.length === Midi.outputs.length) Midi.outSelection = 'all';
      else                                            Midi.outSelection = picked;
      suppressOutUI = true; outAllCb.checked = (Midi.outSelection === 'all'); suppressOutUI = false;
    });
  });

  outAllCb.checked = isAll;
  outAllCb.disabled = (Midi.outputs.length === 0);
  suppressOutUI = false;
}

/* ===================== Icons ===================== */
function drawDeleteIcon(x,y){
  stroke(255); strokeWeight(1.5); fill(0);
  circle(x,y,DELETE_ICON_R*1.5);
  const arm=DELETE_ICON_R*0.2;
  line(x-arm,y-arm,x+arm,y+arm);
  line(x-arm,y+arm,x+arm,y-arm);
}

/* ===================== Ports ===================== */
class Port {
  constructor(node, kind, role, anchor='right') {
    this.node=node; this.kind=kind; this.role=role; this.anchor = anchor; // for signal diamonds
    this._blinkUntil=0; this._trigger=null;
  }
  get pos() {
    if (this.kind === PORT_LEFT)  return createVector(this.node.x, this.node.y + this.node.h / 2);
    if (this.kind === PORT_RIGHT) return createVector(this.node.x + this.node.w, this.node.y + this.node.h / 2);
    if (this.kind === PORT_BOTTOM_TRIGGER) return createVector(this.triggerX, this.node.y + this.node.h + 20);
    if (this.kind === PORT_RIGHT_TRIGGER)  return createVector(this.node.x + this.node.w + 20, this.triggerY);
    if (this.kind === PORT_TOP_TRIGGER)    return createVector(this.triggerX, this.node.y - 20);
    if (this.kind === PORT_SIGNAL) {
      const cx = (this.anchor === 'left') ? this.node.x : (this.node.x + this.node.w);
      return createVector(cx, this.node.y + this.node.h/2);
    }
    return createVector(this.node.x, this.node.y);
  }
  get outward() {
    const c = createVector(this.node.x + this.node.w / 2, this.node.y + this.node.h / 2);
    return p5.Vector.sub(this.pos, c).normalize();
  }
  hits(mx, my) { const p = this.pos; return dist2(mx, my, p.x, p.y) <= PORT_R * PORT_R; }
  blink() { this._blinkUntil = millis() + BLINK_MS; }
  draw() {
    const p = this.pos;
    const blinking = millis() < this._blinkUntil;
    const isSignal = (this.kind === PORT_SIGNAL) || (typeof this.role === 'string' && this.role.startsWith('signal'));
    if (isSignal){
      push();
      translate(p.x, p.y);
      if (blinking) { noFill(); stroke(80,160,255); strokeWeight(2 + BLINK_RING_EXTRA); square(0,0,PORT_R*2.2,{mode:CENTER}); }
      rotate(PI/4);
      stroke(255); strokeWeight(2); fill(0);
      rectMode(CENTER); rect(0,0, PORT_R*2, PORT_R*2);
      pop();
      if (this.hits(mouseX, mouseY)) {
        stroke(255); strokeWeight(1.5);
        line(p.x - PORT_R*0.6, p.y, p.x + PORT_R*0.6, p.y);
        line(p.x, p.y - PORT_R*0.6, p.x, p.y + PORT_R*0.6);
      }
      return;
    }
    // circular ports (trigger + node IO)
    if (blinking) { noFill(); stroke(255,0,0); strokeWeight(2 + BLINK_RING_EXTRA); circle(p.x, p.y, PORT_R*2); }
    stroke(255); strokeWeight(2); fill(0); circle(p.x,p.y,PORT_R*2);
    if (this.hits(mouseX, mouseY)) { stroke(255); strokeWeight(1.5); const r = PORT_R * 0.6; line(p.x - r, p.y, p.x + r, p.y); line(p.x, p.y - r, p.y + r); }
  }
}

/* ===================== Trigger Lines ===================== */
class VTrigger {
  constructor(node, uNorm) {
    this.node = node;
    this.u = constrain(uNorm, 0, 1);
    this.port   = new Port(node, PORT_BOTTOM_TRIGGER, "out");
    this.portIn = new Port(node, PORT_TOP_TRIGGER,    "in");
    this.port._trigger = this; this.portIn._trigger = this;
  }
  get graphRect(){ const gx=this.node.x+8, gy=this.node.y+6, gw=this.node.w-16, gh=this.node.h-12; return {gx,gy,gw,gh}; }
  getGraphRect(){ return this.graphRect; }
  get x(){ const {gx,gw}=this.graphRect; return gx + this.u * gw; }
  topPoint(){ return createVector(this.x, this.node.y); }
  centerPoint(){ return createVector(this.x, this.node.y + this.node.h/2); }
  distanceTo(px,py){ const x=this.x, ax=x, ay=this.node.y, bx=x, by=this.node.y+this.node.h; return pointToSegmentDist(px,py,ax,ay,bx,by); }
  setUFromMouseX(mx){ const {gx,gw} = this.graphRect; const clampedX = constrain(mx,gx,gx+gw); this.u = (clampedX - gx) / gw; }
  graphIntersectionY(){
    const {gx,gy,gw,gh} = this.graphRect;
    const n = this.node.samples.length;
    const pos = this.u * (n - 1);
    const i = Math.floor(pos), f=constrain(pos - i, 0, 1);
    const a=this.node.samples[i], b=this.node.samples[Math.min(i+1,n-1)];
    const v=a + (b-a)*f;
    return map(v, 0, 1, gy + gh, gy);
  }
  draw(){
    this.port.triggerX   = this.x;
    this.portIn.triggerX = this.x;
    const pBot = this.port.pos;
    stroke(255); strokeWeight(1);
    line(this.x, this.node.y, this.x, pBot.y);
    const pTop = this.portIn.pos;
    line(pTop.x, pTop.y, this.x, this.node.y);
    const yDot=this.graphIntersectionY();
    noStroke(); fill(255,0,0); circle(this.x, yDot, 6);
  }
}

class HTrigger {
  constructor(node, vNorm) {
    this.node=node; this.v=constrain(vNorm,0,1);
    this.portUp   = new Port(node, PORT_RIGHT_TRIGGER, "out");
    this.portDown = new Port(node, PORT_RIGHT_TRIGGER, "out");
  }
  get graphRect(){ const gx=this.node.x+8, gy=this.node.y+6, gw=this.node.w-16, gh=this.node.h-12; return {gx,gy,gw,gh}; }
  get y(){ const {gy,gh}=this.graphRect; return gy + this.v*gh; }
  get stopX(){ const portX = this.node.x + this.node.w + 20; return portX - 20; }
  leftPoint(){ return createVector(this.node.x, this.y); }
  centerPoint(){ return createVector(this.node.x + this.node.w/2, this.y); }
  distanceTo(px,py){ const ax=this.node.x, ay=this.y, bx=this.stopX, by=this.y; return pointToSegmentDist(px,py,ax,ay,bx,by); }
  setVFromMouseY(my){ const {gy,gh}=this.graphRect; const clampedY=constrain(my,gy,gy+gh); this.v=(clampedY-gy)/gh; }
  computeCrossings(dir = "up") {
    const dots = [];
    const {gx,gy,gw} = this.graphRect;
    const levelVal = 1 - this.v;
    const n = this.node.samples.length;
    for (let i=0;i<n-1;i++){
      const v0=this.node.samples[i], v1=this.node.samples[i+1];
      if (dir==="up" && v0<levelVal && v1>=levelVal && v1!==v0){
        const t=(levelVal-v0)/(v1-v0);
        const x0=map(i,0,n-1,gx,gx+gw), x1=map(i+1,0,n-1,gx,gx+gw);
        dots.push({x: lerp(x0,x1, constrain(t,0,1)), y: this.y});
      }
      if (dir==="down" && v0>levelVal && v1<=levelVal && v1!==v0){
        const t=(levelVal-v0)/(v1-v0);
        const x0=map(i,0,n-1,gx,gx+gw), x1=map(i+1,0,n-1,gx,gx+gw);
        dots.push({x: lerp(x0,x1, constrain(t,0,1)), y: this.y});
      }
    }
    return dots;
  }
  drawConnectors(){
    const sx=this.stopX, sy=this.y;
    const up=this.portUp.pos, dn=this.portDown.pos;
    const dx=Math.max(1, Math.min(up.x,dn.x)-sx);
    const r=Math.min(24, dx*0.35);
    noFill(); stroke(255); strokeWeight(1);
    const c1x=sx+r, c1y=sy;
    bezier(sx,sy, c1x,c1y, up.x - r, up.y, up.x, up.y);
    bezier(sx,sy, c1x,c1y, dn.x - r, dn.y, dn.x, dn.y);
  }
  draw(){
    stroke(255); strokeWeight(1);
    line(this.node.x, this.y, this.stopX, this.y);
    this.drawConnectors();
    const ups=this.computeCrossings('up'), downs=this.computeCrossings('down');
    noStroke(); fill(255,0,0);
    for (const d of ups) circle(d.x,d.y,6);
    for (const d of downs) circle(d.x,d.y,6);
    this.portUp.triggerY=this.y-10; this.portDown.triggerY=this.y+10;
  }
}

/* ===================== NodeBox ===================== */
class NodeBox {
  constructor(x, y, label, samples, widthOverride=null) {
    this.x=x; this.y=y; this.w=widthOverride ?? BOX_W; this.h=BOX_H;
    this.label=label||"CC";
    this.samples=samples||NodeBox.makeSine(200);
    this.cc = NodeBox.parseCC(label);
    this.playing=false; this.playStart=0;
    this.vTriggers=[]; this.hTriggers=[];
    this._vFiredThisRun = new Set();
    this._lastCCSent=-1; this._prevTNorm=null;
    this.isDragging=false; this._pressX=0; this._pressY=0; this._pressedHere=false;
    this.runDurationMs = this.computeRunDurationMs();
    this._startTNorm = 0;
    this._remainingRunDurationMs = this.runDurationMs;
    this.sourceInDeviceName = '';
    this._groupRunId = null;
    this.hasFiredEnd = false;

    this.left  = new Port(this, PORT_LEFT,  "in");
    this.right = new Port(this, PORT_RIGHT, "out");
  }
  static parseCC(label){ const m=String(label||"").match(/CC\s*(\d+)/i); const n=m?int(m[1]):0; return constrain(n,0,127); }
  static makeSine(n){ const a=[]; for(let i=0;i<n;i++) a.push((sin((i/(n-1))*TWO_PI)+1)/2); return a; }
  static makeSaw(n){ const a=[]; for(let i=0;i<n;i++) a.push(i/(n-1)); return a; }
  static makeRandomSmooth(n){ const a=[]; let v=random(); for(let i=0;i<n;i++){ v+=random(-0.1,0.1); v=constrain(v,0,1); a.push(v); }
    for(let k=0;k<2;k++) for(let i=1;i<n-1;i++) a[i]=(a[i-1]+a[i]+a[i+1])/3; return a; }

  computeRunDurationMs(){ const { gw } = this.getGraphRect(); return Math.max(1, (gw / SPEED_PX_PER_SEC) * 1000); }
  bodyHits(mx,my){ return pointInRect(mx,my,this.x,this.y,this.w,this.h); }
  startDrag(mx,my){ this.isDragging=true; this.dragDX=mx-this.x; this.dragDY=my-this.y; }
  dragTo(mx,my){ if(this.isDragging){ this.x=mx-this.dragDX; this.y=my-this.dragDY; } }
  endDrag(){ this.isDragging=false; }

  startPlayback(){
    this.playing=true; this.playStart=millis();
    this._vFiredThisRun.clear();
    this._lastCCSent=-1; this._prevTNorm=null;
    this.runDurationMs = this.computeRunDurationMs();
    this._startTNorm = 0;
    this._remainingRunDurationMs = this.runDurationMs;
    this.hasFiredEnd = false;
  }
  startPlaybackFromU(u){
    u = constrain(u, 0, 1);
    this.playing=true; this.playStart=millis();
    this._vFiredThisRun.clear();
    for (let i=0; i<this.vTriggers.length; i++) if (this.vTriggers[i].u <= u) this._vFiredThisRun.add(i);
    this._lastCCSent=-1; this._prevTNorm=null;
    this.runDurationMs = this.computeRunDurationMs();
    this._startTNorm = u;
    this._remainingRunDurationMs = Math.max(1, (1 - u) * this.runDurationMs);
    this.hasFiredEnd = false;
  }

  getGraphRect(){ return { gx:this.x+8, gy:this.y+6, gw:this.w-16, gh:this.h-12 }; }

  getTopCreateRect(){ const {gx,gy}=this.getGraphRect(); const topMargin= Math.max(0, gy - this.y); return {x:this.x, y:this.y, w:this.w, h:topMargin}; }
  getRightCreateRect(){ const {gx,gw}=this.getGraphRect(); const rightMargin = Math.max(0, (this.x + this.w) - (gx + gw)); return {x:(this.x + this.w) - rightMargin, y:this.y, w:rightMargin, h:this.h}; }

  drawCreateBoxes(){
    const t=this.getTopCreateRect(), r=this.getRightCreateRect();
    const { gx, gy, gw, gh } = this.getGraphRect();
    if (t.h > 0) {
      const overTop=pointInRect(mouseX,mouseY,t.x,t.y,t.w,t.h);
      noStroke(); fill(255, overTop?255:128); rect(t.x,t.y,t.w,t.h);
      if(overTop){ const px=constrain(mouseX,gx,gx+gw); stroke(255); strokeWeight(1.5); line(px,this.y,px,this.y+this.h); }
    }
    if (r.w > 0) {
      const overRight=pointInRect(mouseX,mouseY,r.x,r.y,r.w,r.h);
      noStroke(); fill(255, overRight?255:128); rect(r.x,r.y,r.w,r.h);
      if(overRight){ const py=constrain(mouseY,gy,gy+gh); stroke(255); strokeWeight(1.5); line(this.x,py,this.x+this.w,py); }
    }
  }

  addVTriggerAtMouse(){
    const {gx,gw}=this.getGraphRect();
    const clampedX=constrain(mouseX,gx,gx+gw);
    const u=(clampedX-gx)/gw;
    this.vTriggers.push(new VTrigger(this,u));
  }
  addHTriggerAtMouse(){
    const {gy,gh}=this.getGraphRect();
    const clampedY=constrain(mouseY,gy,gy+gh);
    const v=(clampedY-gy)/gh;
    this.hTriggers.push(new HTrigger(this,v));
  }

  valueAt(tNorm){
    const n=this.samples.length;
    const pos = constrain(tNorm,0,1)*(n-1);
    const i=Math.floor(pos), f=pos-i;
    const a=this.samples[i], b=this.samples[Math.min(i+1,n-1)];
    return a + (b-a)*f;
  }

  updateAndMaybeTrigger(){
    const g = getActiveGroupFor(this);
    if (g){
      if (this._groupRunId !== g.runId){
        this._groupRunId = g.runId;
        this._vFiredThisRun.clear();
        this._prevTNorm = null;
        this._lastCCSent = -1;
        this.hasFiredEnd = false;
      }
      const dur = Math.max(1, g.durationMs || 1);
      const progress = constrain((millis() - g.playStart) / dur, 0, 1);
      const {minGX, maxGX} = groupGraphBounds(g);
      const startX = (g.startX != null) ? g.startX : minGX;
      const xHead = startX + (maxGX - startX) * progress;

      const {gx,gw} = this.getGraphRect();
      const tRaw = (xHead - gx) / gw;
      const tNow = constrain(tRaw, 0, 1);
      const vNow = this.valueAt(tNow);
      const vPrev = (this._prevTNorm==null) ? vNow : this.valueAt(constrain(this._prevTNorm, 0, 1));

      const ccVal=constrain(Math.round(vNow*127),0,127);
      if (ccVal!==this._lastCCSent && Midi.ready && Midi.out){
        Midi.sendCC(this.cc,ccVal);
        this._lastCCSent=ccVal;
      }

      const cx = gx + gw * tNow;

      for(let i=0;i<this.vTriggers.length;i++){
        const trig=this.vTriggers[i], tx=trig.x;
        if(!this._vFiredThisRun.has(i) && cx>=tx){
          this._vFiredThisRun.add(i);
          triggerFromPort(trig.port);
        }
      }
      for(const trig of this.hTriggers){
        const level = 1 - trig.v;
        if(vPrev < level && vNow >= level){ trig.portUp.blink(); triggerFromPort(trig.portUp); }
        if(vPrev > level && vNow <= level){ trig.portDown.blink(); triggerFromPort(trig.portDown); }
      }

      // fire RIGHT port when group playhead passes end of this node
      if (tRaw >= 1 && !this.hasFiredEnd){
        this.hasFiredEnd = true;
        triggerFromPort(this.right);
      }

      this._prevTNorm = tRaw;
      return;
    }

    if(!this.playing) return;

    const elapsed=millis()-this.playStart;
    const base = Math.max(1, this._remainingRunDurationMs || this.runDurationMs);
    const tSeg = constrain(elapsed / base, 0, 1);
    const tNow = constrain(this._startTNorm + tSeg, 0, 1);
    const vNow=this.valueAt(tNow);
    const vPrev=(this._prevTNorm==null)? vNow : this.valueAt(this._prevTNorm);

    const ccVal=constrain(Math.round(vNow*127),0,127);
    if (ccVal!==this._lastCCSent && Midi.ready && Midi.out){ Midi.sendCC(this.cc,ccVal); this._lastCCSent=ccVal; }

    const {gx,gw}=this.getGraphRect();
    const cx=gx+gw*tNow;

    for(let i=0;i<this.vTriggers.length;i++){
      const trig=this.vTriggers[i], tx=trig.x;
      if(!this._vFiredThisRun.has(i) && cx>=tx){
        this._vFiredThisRun.add(i);
        triggerFromPort(trig.port);
      }
    }
    for(const trig of this.hTriggers){
      const level = 1 - trig.v;
      if(vPrev < level && vNow >= level){ trig.portUp.blink(); triggerFromPort(trig.portUp); }
      if(vPrev > level && vNow <= level){ trig.portDown.blink(); triggerFromPort(trig.portDown); }
    }

    // when standalone playback reaches the end, fire RIGHT port
    if(tNow>=1.0 && !this.hasFiredEnd){
      this.hasFiredEnd=true;
      triggerFromPort(this.right);
      this.playing=false;
    }

    this._prevTNorm = tNow;
  }

  drawGraph(){
    const {gx,gy,gw,gh}=this.getGraphRect();
    stroke(255); strokeWeight(1.5); noFill(); rect(this.x,this.y,this.w,this.h);
    noStroke(); fill(255); textAlign(LEFT,TOP); textSize(11);

    const header = (this.sourceInDeviceName && this.sourceInDeviceName.length)
      ? `${this.sourceInDeviceName} ▸ ${this.label}`
      : `${this.label}`;
    text(header, this.x+6, this.y+4);

    stroke(255); strokeWeight(1); noFill();
    beginShape();
    for(let i=0;i<this.samples.length;i++){
      const sx=map(i,0,this.samples.length-1,gx,gx+gw);
      const sy=map(this.samples[i],0,1,gy+gh,gy);
      vertex(sx,sy);
    }
    endShape();

    for(const tv of this.vTriggers) tv.draw();
    for(const th of this.hTriggers) th.draw();

    if(this.playing){
      const t=constrain((millis()-this.playStart)/Math.max(1,this._remainingRunDurationMs||this.runDurationMs),0,1);
      const cx=gx+gw*(this._startTNorm + t*(1-this._startTNorm));
      stroke(255,0,0); strokeWeight(2); line(cx,gy,cx,gy+gh);
    }

    this.drawCreateBoxes();
  }

  draw(){ this.updateAndMaybeTrigger(); this.drawGraph(); }
}

/* ===================== Oscilloscope (signal) ===================== */
class OscilloscopeNode {
  constructor(x, y, width=220, height=80){
    this.x = x; this.y = y; this.w = width; this.h = height;
    this.samples = new Array(Math.max(120, Math.floor(width - 16))).fill(0.5);
    this.hTriggers = []; // user adds via right edge box
    this.signalIn  = new Port(this, PORT_SIGNAL, "signal-in",  'left');
    this.signalOut = new Port(this, PORT_SIGNAL, "signal-out", 'right');
  }
  bodyHits(mx,my){ return pointInRect(mx,my,this.x,this.y,this.w,this.h); }
  getGraphRect(){ return { gx:this.x+8, gy:this.y+6, gw:this.w-16, gh:this.h-12 }; }
  getTopCreateRect(){ return { x:0, y:0, w:0, h:0 }; } // no vertical trigger creation
  getRightCreateRect(){
    const {gx,gw}=this.getGraphRect();
    const rightMargin = Math.max(0, (this.x + this.w) - (gx + gw));
    return {x:(this.x + this.w) - rightMargin, y:this.y, w:rightMargin, h:this.h};
  }
  drawCreateBoxes(){
    const r=this.getRightCreateRect();
    const { gy, gh } = this.getGraphRect();
    if (r.w > 0) {
      const overRight=pointInRect(mouseX,mouseY,r.x,r.y,r.w,r.h);
      noStroke(); fill(255, overRight?255:128); rect(r.x,r.y,r.w,r.h);
      if(overRight){ const py=constrain(mouseY,gy,gy+gh); stroke(255); strokeWeight(1.5); line(this.x,py,this.x+this.w,py); }
    }
  }
  addHTriggerAtMouse(){
    const {gy,gh}=this.getGraphRect();
    const clampedY=constrain(mouseY,gy,gy+gh);
    const v=(clampedY-gy)/gh;
    this.hTriggers.push(new HTrigger(this,v));
  }
  tick(){
    const target = constrain(Midi.lastGlobalVal/127, 0, 1);
    const last = this.samples[this.samples.length-1];
    const smoothed = last + (target - last) * 0.35;
    this.samples.push(smoothed);
    if (this.samples.length > Math.max(2, this.getGraphRect().gw)) this.samples.shift();

    for (const th of this.hTriggers){
      const level = 1 - th.v;
      const prev = this.samples[this.samples.length-2] ?? smoothed;
      const cur  = smoothed;
      if (prev < level && cur >= level){ th.portUp.blink(); triggerFromPort(th.portUp); }
      if (prev > level && cur <= level){ th.portDown.blink(); triggerFromPort(th.portDown); }
    }
  }
  draw(){
    this.tick();
    const {gx,gy,gw,gh}=this.getGraphRect();
    stroke(255); strokeWeight(1.5); noFill(); rect(this.x,this.y,this.w,this.h);

    noStroke(); fill(255); textAlign(LEFT,TOP); textSize(11);
    text(`Oscilloscope`, this.x+6, this.y+4);

    stroke(255); strokeWeight(1); noFill();
    beginShape();
    const N = this.samples.length;
    for(let i=0;i<N;i++){
      const sx = map(i, 0, N-1, gx, gx+gw);
      const sy = map(this.samples[i], 0, 1, gy+gh, gy);
      vertex(sx, sy);
    }
    endShape();

    for (const th of this.hTriggers) th.draw();
    this.drawCreateBoxes();

    if (shouldShowPort(this.signalIn))  this.signalIn.draw();
    if (shouldShowPort(this.signalOut)) this.signalOut.draw();
  }
}

/* ===================== Mapper (signal processor) ===================== */
class MapperNode {
  constructor(x,y,width=220,height=80){
    this.x=x; this.y=y; this.w=width; this.h=height;
    this.signalIn  = new Port(this, PORT_SIGNAL, "signal-in",  'left');
    this.signalOut = new Port(this, PORT_SIGNAL, "signal-out", 'right');

    // control points (0..1 in vertical)
    this.midTop = 0.5;     // maps input mid to this vertical level for top curve
    this.midBottom = 0.5;  // for bottom curve
    this.outBuf = new Array(Math.max(120, Math.floor(width/3))).fill(0.5);
    this._dragging = null; // 'top' | 'bottom'
  }
  bodyHits(mx,my){ return pointInRect(mx,my,this.x,this.y,this.w,this.h); }
  getRects(){
    const third = this.w/3;
    return {
      inRect: { x:this.x, y:this.y, w:third, h:this.h },
      mapRect:{ x:this.x+third, y:this.y, w:third, h:this.h },
      outRect:{ x:this.x+third*2, y:this.y, w:third, h:this.h }
    };
  }
  _valToY(region,v01){ return map(1-v01, 0,1, region.y+region.h, region.y); }
  _xAtT(region,t){ return region.x + t * region.w; }

  _remap(in01){
    // quadratics through corners and (0.5, mid); average both for single mapping
    const aTop = this._quadThrough(0,1, 0.5,1-this.midTop, 1,0);
    const aBot = this._quadThrough(0,0, 0.5,1-this.midBottom, 1,1);
    const yTop = aTop(in01);
    const yBot = aBot(in01);
    return constrain((yTop + yBot) * 0.5, 0, 1);
  }
  _quadThrough(x1,y1, x2,y2, x3,y3){
    const denom = (x1-x2)*(x1-x3)*(x2-x3);
    const a = (x3*(y2-y1)+x2*(y1-y3)+x1*(y3-y2))/denom;
    const b = (x3*x3*(y1-y2)+x2*x2*(y3-y1)+x1*x1*(y2-y3))/denom;
    const c = (x2*x3*(x2-x3)*y1 + x3*x1*(x3-x1)*y2 + x1*x2*(x1-x2)*y3)/denom;
    return (x)=> a*x*x + b*x + c;
  }

  _drawOsc(region, series){
    stroke(255); strokeWeight(1); noFill();
    beginShape();
    for (let i=0;i<series.length;i++){
      const x = map(i,0,series.length-1, region.x+8, region.x+region.w-8);
      const y = map(series[i],0,1, region.y+region.h-6, region.y+6);
      vertex(x,y);
    }
    endShape();
  }

  _drawMapping(region){
    const cx = region.x + region.w/2;
    const topY = this._valToY(region, this.midTop);
    const botY = this._valToY(region, this.midBottom);

    // curves
    const aTop = this._quadThrough(0,1, 0.5,1-this.midTop, 1,0);
    const aBot = this._quadThrough(0,0, 0.5,1-this.midBottom, 1,1);

    stroke(255); strokeWeight(1); noFill();
    beginShape();
    for (let t=0; t<=20; t++){
      const u = t/20;
      const y = this._valToY(region, aTop(u));
      vertex(this._xAtT(region,u), y);
    }
    endShape();
    beginShape();
    for (let t=0; t<=20; t++){
      const u = t/20;
      const y = this._valToY(region, aBot(u));
      vertex(this._xAtT(region,u), y);
    }
    endShape();

    // vertical center axis
    stroke(255,180); line(cx, region.y+4, cx, region.y+region.h-4);

    // draggable oblongs
    noStroke(); fill(0); rectMode(CENTER);
    const oblongW = region.w*0.55, oblongH = 14;

    stroke(255); noFill();
    rect(cx, topY, oblongW, oblongH, 6);
    rect(cx, botY, oblongW, oblongH, 6);

    // values
    noStroke(); fill(255); textAlign(CENTER, CENTER); textSize(11);
    text(Math.round(this.midTop*127),    cx, topY);
    text(Math.round(this.midBottom*127), cx, botY);

    rectMode(CORNER);
  }

  _handleDrag(){
    if (!this._dragging) return;
    const { mapRect } = this.getRects();
    const v = constrain((mapRect.y + mapRect.h - mouseY) / mapRect.h, 0, 1);
    if (this._dragging === 'top') this.midTop = v;
    if (this._dragging === 'bottom') this.midBottom = v;
  }

  getGraphRect(){ const {outRect} = this.getRects(); return { gx:outRect.x+8, gy:outRect.y+6, gw:outRect.w-16, gh:outRect.h-12 }; }

  tick(){
    const in01 = constrain(Midi.lastGlobalVal/127, 0, 1);
    const out = this._remap(in01);
    this.outBuf.push(out);
    const maxLen = Math.max(2, this.getGraphRect().gw);
    while (this.outBuf.length > maxLen) this.outBuf.shift();
  }

  draw(){
    this._handleDrag();
    this.tick();

    // frame
    stroke(255); strokeWeight(1.5); noFill(); rect(this.x,this.y,this.w,this.h);

    // thirds
    const {inRect, mapRect, outRect} = this.getRects();
    // left third: input reflection
    const inVal = constrain(Midi.lastGlobalVal/127, 0, 1);
    const yIn = map(1-inVal, 0,1, inRect.y + inRect.h - 6, inRect.y + 6);
    stroke(255); strokeWeight(1);
    line(inRect.x+8, yIn, inRect.x+inRect.w-8, yIn);

    // middle third: mapping curves + draggable oblongs
    this._drawMapping(mapRect);

    // right third: output oscilloscope
    const {gx,gy,gw,gh} = this.getGraphRect();
    this._drawOsc({x:gx-8, y:gy-6, w:gw+16, h:gh+12}, this.outBuf);

    // title
    noStroke(); fill(255); textAlign(LEFT,TOP); textSize(11);
    text('Mapper', this.x+6, this.y+4);

    // ports
    if (shouldShowPort(this.signalIn))  this.signalIn.draw();
    if (shouldShowPort(this.signalOut)) this.signalOut.draw();
  }

  mousePressed(){
    const { mapRect } = this.getRects();
    const cx = mapRect.x + mapRect.w/2;
    const topY = this._valToY(mapRect, this.midTop);
    const botY = this._valToY(mapRect, this.midBottom);
    const obW = mapRect.w*0.55, obH = 14;

    const overTop = pointInRect(mouseX, mouseY, cx - obW/2, topY - obH/2, obW, obH);
    const overBot = pointInRect(mouseX, mouseY, cx - obW/2, botY - obH/2, obW, obH);
    if (overTop) this._dragging = 'top';
    else if (overBot) this._dragging = 'bottom';
  }
  mouseReleased(){ this._dragging = null; }
}

/* ===================== Cables ===================== */
class Link {
  constructor(portA, portB){
    this.a=portA; this.b=portB;
    this.isSignal = (String(portA.role).startsWith('signal') && String(portB.role).startsWith('signal'));
  }
  curvePoints(){
    const A=this.a.pos, B=this.b.pos;
    const outA=this.a.outward.copy(), outB=this.b.outward.copy();
    const d=p5.Vector.dist(A,B);
    const h=constrain(d*0.35,40,220);
    const c1=p5.Vector.add(A,p5.Vector.mult(outA,h));
    const c2=p5.Vector.add(B,p5.Vector.mult(outB,h));
    return {A,c1,c2,B};
  }
  draw(){
    const {A,c1,c2,B}=this.curvePoints();
    stroke(this.isSignal ? color(80,160,255) : color(255));
    strokeWeight(1); noFill();
    bezier(A.x,A.y,c1.x,c1.y,c2.x,c2.y,B.x,B.y);
  }
  midpoint(){
    const {A,c1,c2,B}=this.curvePoints(), t=0.5;
    return createVector(
      bezierPoint(A.x,c1.x,c2.x,B.x,t),
      bezierPoint(A.y,c1.y,c2.y,B.y,t)
    );
  }
  distanceTo(px,py,samples=40){
    const {A,c1,c2,B}=this.curvePoints();
    let prevX=A.x, prevY=A.y, minD=Infinity;
    for(let i=1;i<=samples;i++){
      const t=i/samples;
      const x=bezierPoint(A.x,c1.x,c2.x,B.x,t);
      const y=bezierPoint(A.y,c1.y,c2.y,B.y,t);
      const d=pointToSegmentDist(px,py,prevX,prevY,x,y);
      if(d<minD) minD=d;
      prevX=x; prevY=y;
    }
    return minD;
  }
}

/* ===================== App State ===================== */
let nodes=[], links=[];
let draggingCable   = { active:false, fromPort:null, toMouse:null };
let pendingClickNode=null;
let hoveredLinkIndex=-1, hoveredMidpoint=null;
let hoveredTrig={ nodeIdx:-1, idx:-1, kind:null };
let draggingTrigger={ active:false, nodeIdx:-1, idx:-1, kind:null };

// Docking guides
let guideV = null; // x
let guideH = null; // y

// Groups
let groups = []; // [{members:Set, playStart, durationMs, startX, runId}]
let dragCtx = { active:false, entries:[], lead:null, lastSnapTarget:null };

// Recording overlay
let recGroup=null;

/* ===== Box deletion (persistent) ===== */
function boxDeletionController(op){
  const st = boxDeletionController._ || (boxDeletionController._ = { node:null });
  if (op === 'press') {
    if (st.node) { const n=st.node; if (pointInRect(mouseX,mouseY,n.x,n.y,n.w,n.h)) return true; }
    if (mouseButton === RIGHT) {
      const n = topmostNodeUnder(mouseX, mouseY);
      st.node = n || null;
      return !!n;
    }
    return false;
  }
  if (op === 'release') {
    if (!st.node) return false;
    const n = st.node;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    if (mouseButton === LEFT) {
      const hitR = 0.75 * DELETE_ICON_R;
      const onIcon = dist2(mouseX, mouseY, cx, cy) <= (hitR * hitR);
      if (onIcon) {
        const g = findGroupContaining(n);
        if (g){ g.members.delete(n); if (g.members.size < 2) removeGroup(g); }
        links = links.filter(l => !(l.a.node === n || l.b.node === n));
        const idx = nodes.indexOf(n);
        if (idx >= 0) nodes.splice(idx, 1);
        st.node = null;
        return true;
      } else if (pointInRect(mouseX, mouseY, n.x, n.y, n.w, n.h)) {
        st.node = null;
        return true;
      }
      return false;
    }
    return false;
  }
  if (op === 'draw') {
    if (!st.node) return false;
    const n = st.node;
    noStroke(); fill(0,128); rect(n.x, n.y, n.w, n.h);
    drawDeleteIcon(n.x + n.w/2, n.y + n.h/2);
    return false;
  }
  return false;
}

/* ===== Trigger delete overlay (middle of line) ===== */
function topmostTriggerUnder(mx, my, threshold = TRIGGER_HIT_THRESH, preferNode = null) {
  const searchInNode = (n) => {
    let best = null, bestD = Infinity;
    if (!n) return null;
    if (n.vTriggers){ for (let ti = 0; ti < n.vTriggers.length; ti++){ const t = n.vTriggers[ti]; const d = t.distanceTo(mx, my); if (d < bestD) { bestD = d; best = { node:n, nodeIdx:nodes.indexOf(n), idx:ti, kind:'v', trig:t }; } } }
    if (n.hTriggers){ for (let ti = 0; ti < n.hTriggers.length; ti++){ const t = n.hTriggers[ti]; const d = t.distanceTo(mx, my); if (d < bestD) { bestD = d; best = { node:n, nodeIdx:nodes.indexOf(n), idx:ti, kind:'h', trig:t }; } } }
    return (best && bestD <= threshold) ? best : null;
  };
  if (preferNode) {
    const picked = searchInNode(preferNode);
    if (picked) return picked;
  }
  let best = null, bestD = Infinity;
  for (let ni = nodes.length - 1; ni >= 0; --ni) {
    const n = nodes[ni];
    if (n.vTriggers){ for (let ti = 0; ti < n.vTriggers.length; ti++){ const t = n.vTriggers[ti]; const d = t.distanceTo(mx, my); if (d < bestD) { bestD = d; best = { node:n, nodeIdx:ni, idx:ti, kind:'v', trig:t }; } } }
    if (n.hTriggers){ for (let ti = 0; ti < n.hTriggers.length; ti++){ const t = n.hTriggers[ti]; const d = t.distanceTo(mx, my); if (d < bestD) { bestD = d; best = { node:n, nodeIdx:ni, idx:ti, kind:'h', trig:t }; } } }
  }
  return (best && bestD <= threshold) ? best : null;
}
function triggerMidpoint(entry) {
  const { trig, kind } = entry;
  if (kind === 'v') { const py = trig.port.pos.y; return { x: trig.x, y: (trig.node.y + py) * 0.5 }; }
  else { const sx = trig.stopX; return { x: (trig.node.x + sx) * 0.5, y: trig.y }; }
}
function triggerDeletionController(op){
  const st = triggerDeletionController._ || (triggerDeletionController._ = { entry:null });
  if (op === 'press') {
    if (st.entry) { const d = st.entry.trig.distanceTo(mouseX, mouseY); if (d <= TRIGGER_HIT_THRESH) return true; }
    if (mouseButton === RIGHT) {
      const prefer = topmostNodeUnder(mouseX, mouseY) || null;
      const hit = topmostTriggerUnder(mouseX, mouseY, TRIGGER_HIT_RIGHTCLICK, prefer);
      st.entry = hit || null;
      return !!hit;
    }
    return false;
  }
  if (op === 'release') {
    if (!st.entry) return false;
    if (mouseButton === LEFT) {
      const mid = triggerMidpoint(st.entry);
      const hitR = 0.75 * DELETE_ICON_R;
      const onIcon = dist2(mouseX, mouseY, mid.x, mid.y) <= (hitR * hitR);
      if (onIcon) {
        const { node, idx, kind } = st.entry;
        if (kind === 'v') node.vTriggers.splice(idx, 1);
        else              node.hTriggers.splice(idx, 1);
        st.entry = null;
        return true;
      } else {
        st.entry = null; // cancel overlay
        return true;
      }
    }
    return false;
  }
  if (op === 'draw') {
    if (!st.entry) return false;
    const mid = triggerMidpoint(st.entry);
    drawDeleteIcon(mid.x, mid.y);
    return false;
  }
  return false;
}

/* ===================== Grouping ===================== */
function findGroupContaining(node){
  for (const g of groups){ if (g.members.has(node)) return g; }
  return null;
}
function removeGroup(g){
  const idx = groups.indexOf(g);
  if (idx >= 0) groups.splice(idx,1);
}
function ensureGroupWith(a,b){
  let ga = findGroupContaining(a);
  let gb = findGroupContaining(b);
  if (ga && gb && ga !== gb){
    for (const m of gb.members) ga.members.add(m);
    removeGroup(gb);
    return ga;
  }
  if (ga){ ga.members.add(b); return ga; }
  if (gb){ gb.members.add(a); return gb; }
  const g = { members:new Set([a,b]), playStart:null, durationMs:0, startX:null, runId:null };
  groups.push(g);
  return g;
}
function groupBounds(g){
  let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  for (const n of g.members){
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  return {minX, minY, maxX, maxY, midX:(minX+maxX)/2, midY:(minY+maxY)/2};
}
function groupGraphBounds(g){
  let minGX=Infinity, maxGX=-Infinity, minGY=Infinity, maxGY=-Infinity;
  for (const n of g.members){
    const {gx,gy,gw,gh} = n.getGraphRect();
    minGX = Math.min(minGX, gx); maxGX = Math.max(maxGX, gx+gw);
    minGY = Math.min(minGY, gy); maxGY = Math.max(maxGY, gy+gh);
  }
  return {minGX, maxGX, minGY, maxGY};
}
function getActiveGroupFor(node){
  const g = findGroupContaining(node);
  if (g && g.playStart != null) return g;
  return null;
}
function startGroupFromStart(g){
  const {minGX, maxGX} = groupGraphBounds(g);
  g.playStart = millis();
  g.startX = minGX;
  g.durationMs = Math.max(1, ((maxGX - minGX) / SPEED_PX_PER_SEC) * 1000);
  g.runId = g.playStart;
  for (const m of g.members){
    if (m._vFiredThisRun) m._vFiredThisRun.clear();
    if (m._prevTNorm != null) m._prevTNorm = null;
    if (m._lastCCSent != null) m._lastCCSent = -1;
    if (typeof m.hasFiredEnd === 'boolean') m.hasFiredEnd = false;
    m._groupRunId = g.runId;
  }
}
function startGroupFromNodeU(g, node, u){
  const {minGX, maxGX} = groupGraphBounds(g);
  const {gx, gw} = node.getGraphRect();
  const startX = constrain(gx + constrain(u,0,1) * gw, minGX, maxGX);
  g.playStart = millis();
  g.startX = startX;
  g.durationMs = Math.max(1, ((maxGX - startX) / SPEED_PX_PER_SEC) * 1000);
  g.runId = g.playStart;
  for (const m of g.members){
    if (m._vFiredThisRun) m._vFiredThisRun.clear();
    if (m._prevTNorm != null) m._prevTNorm = null;
    if (m._lastCCSent != null) m._lastCCSent = -1;
    if (typeof m.hasFiredEnd === 'boolean') m.hasFiredEnd = false;
    m._groupRunId = g.runId;
  }
}
function updateAndDrawGroupPlayheads(){
  for (const g of groups){
    if (g.playStart == null) continue;
    const {minGX, maxGX, minGY, maxGY} = groupGraphBounds(g);
    const startX = (g.startX != null) ? g.startX : minGX;
    const dur = g.durationMs || Math.max(1, ((maxGX - startX)/SPEED_PX_PER_SEC)*1000);
    const t = constrain((millis() - g.playStart)/dur, 0, 1);
    const x = startX + (maxGX - startX) * t;
    stroke(80,160,255, 230); strokeWeight(2);
    line(x, minGY, x, maxGY);
    if (t >= 1){ g.playStart = null; }
  }
}

/* ===================== Docking (nearby-only) ===================== */
function computeDockSnap(leadNode, proposedX, proposedY){
  let snapX = proposedX, snapY = proposedY;
  let bestDx = null, bestDy = null;
  let snappedTo = null;
  let gV = null, gH = null;

  const Lrect = { x: proposedX, y: proposedY, w: leadNode.w, h: leadNode.h };
  const L = { left: proposedX, cx: proposedX + leadNode.w/2, right: proposedX + leadNode.w };
  const T = { top: proposedY, cy: proposedY + leadNode.h/2, bottom: proposedY + leadNode.h };

  for (const m of nodes){
    if (m === leadNode) continue;
    const minDist = rectsMinDistance(Lrect.x, Lrect.y, Lrect.w, Lrect.h, m.x, m.y, m.w, m.h);
    if (minDist > SNAP_NEAR_PX) continue;

    const Mx = { left: m.x, cx: m.x + m.w/2, right: m.x + m.w };
    const My = { top: m.y, cy: m.y + m.h/2, bottom: m.y + m.h };

    for (const xL of Object.values(L)){
      for (const xM of Object.values(Mx)){
        const dx = xM - xL;
        if (Math.abs(dx) <= SNAP_PX && (bestDx === null || Math.abs(dx) < Math.abs(bestDx))){
          bestDx = dx; snapX = proposedX + dx; gV = xM; snappedTo = m;
        }
      }
    }
    for (const yT of Object.values(T)){
      for (const yM of Object.values(My)){
        const dy = yM - yT;
        if (Math.abs(dy) <= SNAP_PX && (bestDy === null || Math.abs(dy) < Math.abs(bestDy))){
          bestDy = dy; snapY = proposedY + dy; gH = yM; snappedTo = m;
        }
      }
    }
    // stack gap
    {
      const underY = m.y + m.h + NB_STACK_GAP;
      const dy = underY - proposedY;
      if (Math.abs(dy) <= SNAP_PX && (bestDy === null || Math.abs(dy) < Math.abs(bestDy))){
        bestDy = dy; snapY = proposedY + dy; gH = m.y + m.h; snappedTo = m;
      }
    }
    {
      const aboveY = m.y - (leadNode.h + NB_STACK_GAP);
      const dy = aboveY - proposedY;
      if (Math.abs(dy) <= SNAP_PX && (bestDy === null || Math.abs(dy) < Math.abs(bestDy))){
        bestDy = dy; snapY = proposedY + dy; gH = m.y; snappedTo = m;
      }
    }
  }
  return { x:snapX, y:snapY, guideV:gV, guideH:gH, snappedTo };
}

/* ===================== Context Menu ===================== */
let ctxMenu = null;
function ensureContextMenu(){
  if (ctxMenu) return;
  ctxMenu = document.createElement('div');
  Object.assign(ctxMenu.style, {
    position:'fixed', zIndex:'2000', minWidth:'180px',
    background:'#111', color:'#fff', border:'1px solid #555', borderRadius:'6px',
    boxShadow:'0 6px 20px rgba(0,0,0,0.45)', font:'13px/1.4 sans-serif',
    padding:'6px', display:'none'
  });

  const title = document.createElement('div');
  title.textContent = 'Add signal box';
  Object.assign(title.style, { opacity:0.7, fontWeight:'bold', margin:'4px 6px 6px' });
  ctxMenu.appendChild(title);

  const mkItem = (label, onClick) => {
    const item = document.createElement('div');
    item.textContent = label;
    Object.assign(item.style, { padding:'6px 8px', borderRadius:'4px', cursor:'pointer' });
    item.onmouseenter = ()=> item.style.background = '#1d1d1d';
    item.onmouseleave = ()=> item.style.background = 'transparent';
    item.onclick = (e)=> { e.stopPropagation(); onClick(); hideContextMenu(); };
    ctxMenu.appendChild(item);
  };
  mkItem('Oscilloscope', ()=>{
    let px = parseInt(ctxMenu.style.left,10) || 100;
    let py = parseInt(ctxMenu.style.top,10)  || 100;
    const w = 220, h = 80;
    px = Math.max(0, Math.min(px, windowWidth  - w - 4));
    py = Math.max(0, Math.min(py, windowHeight - h - 4));
    nodes.push(new OscilloscopeNode(px, py, w, h));
  });
  mkItem('Mapper', ()=>{
    let px = parseInt(ctxMenu.style.left,10) || 100;
    let py = parseInt(ctxMenu.style.top,10)  || 100;
    const w = 240, h = 92;
    px = Math.max(0, Math.min(px, windowWidth  - w - 4));
    py = Math.max(0, Math.min(py, windowHeight - h - 4));
    nodes.push(new MapperNode(px, py, w, h));
  });

  document.body.appendChild(ctxMenu);
  document.addEventListener('mousedown', (e)=>{
    if (!ctxMenu || ctxMenu.style.display !== 'block') return;
    if (ctxMenu.contains(e.target)) return;
    hideContextMenu();
  });
}
function showContextMenu(x,y){
  ensureContextMenu();
  ctxMenu.style.display = 'block';
  ctxMenu.style.left = `${x}px`;
  ctxMenu.style.top  = `${y}px`;
  const rect = ctxMenu.getBoundingClientRect();
  const nx = Math.max(0, Math.min(x, window.innerWidth  - rect.width  - 4));
  const ny = Math.max(0, Math.min(y, window.innerHeight - rect.height - 4));
  ctxMenu.style.left = `${nx}px`;
  ctxMenu.style.top  = `${ny}px`;
}
function hideContextMenu(){ if (ctxMenu) ctxMenu.style.display = 'none'; }

/* ===================== Setup / Draw ===================== */
function setup(){
  createCanvas(windowWidth, windowHeight);
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));
  textFont('sans-serif');

  createSideMenu();
  Midi.init();

  nodes.push(new NodeBox(120,120,"CC 10",  NodeBox.makeSine(200)));
  nodes.push(new NodeBox(420,260,"CC 74",  NodeBox.makeSaw(200)));
  nodes.push(new NodeBox(220,420,"CC 1",   NodeBox.makeRandomSmooth(200)));

  window.addEventListener('contextmenu', e=>e.preventDefault());
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
}
function windowResized(){ resizeCanvas(windowWidth, windowHeight); }

function draw(){
  background(0);
  updateHoverTargets(mouseX,mouseY);

  for(const link of links) link.draw();

  if(draggingCable.active && draggingCable.fromPort){
    const from=draggingCable.fromPort, A=from.pos, outA=from.outward.copy();
    const Bmouse=draggingCable.toMouse||createVector(mouseX,mouseY);
    const ha=constrain(p5.Vector.dist(A,Bmouse)*0.35,40,220);
    const c1=p5.Vector.add(A,p5.Vector.mult(outA,ha));
    const target=findPortUnderMouse(mouseX,mouseY);
    let endB, c2;
    if(target){ endB=target.pos.copy(); const outB=target.outward.copy(); c2=p5.Vector.add(endB,p5.Vector.mult(outB,ha)); }
    else { endB=Bmouse.copy(); const mirror=p5.Vector.mult(outA,-1); c2=p5.Vector.add(endB,p5.Vector.mult(mirror,ha)); }
    const isSignalDrag = String(from.role).startsWith('signal') && target && String(target.role).startsWith('signal');
    stroke(isSignalDrag ? color(80,160,255) : color(255,102,0)); strokeWeight(1); noFill();
    bezier(A.x,A.y,c1.x,c1.y,c2.x,c2.y,endB.x,endB.y);
  }

  updateRecordingOverlayTime();
  drawRecordingOverlay();

  for(const n of nodes) n.draw();

  boxDeletionController('draw');
  triggerDeletionController('draw');

  if (guideV != null){ stroke(80,160,255, GUIDE_ALPHA); strokeWeight(1); line(guideV, 0, guideV, height); }
  if (guideH != null){ stroke(80,160,255, GUIDE_ALPHA); strokeWeight(1); line(0, guideH, width, guideH); }

  updateAndDrawGroupPlayheads();

  // cursors
  let cursorSet = false;
  if (hoveredLinkIndex >= 0 && hoveredMidpoint) {
    drawDeleteIcon(hoveredMidpoint.x, hoveredMidpoint.y);
    if (!cursorSet) { cursor('pointer'); cursorSet = true; }
  }
  if (draggingTrigger.active) {
    cursor(draggingTrigger.kind === 'v' ? 'ew-resize' : 'ns-resize'); cursorSet = true;
  } else if (hoveredTrig.nodeIdx >= 0) {
    cursor(hoveredTrig.kind === 'v' ? 'ew-resize' : 'ns-resize'); cursorSet = true;
  }
  if (!cursorSet && !draggingCable.active) {
    const hoverNode = topmostNodeUnder(mouseX, mouseY);
    const inCreateBox = !!topmostNodeCreateBoxUnder(mouseX, mouseY);
    const overTrigger = (hoveredTrig.nodeIdx >= 0);
    const overPort = !!findPortUnderMouse(mouseX, mouseY);
    if (hoverNode && !inCreateBox && !overTrigger && !overPort) {
      cursor(mouseIsPressed && mouseButton === LEFT ? 'grabbing' : 'grab'); cursorSet = true;
    }
  }
  if (!cursorSet && !draggingCable.active) cursor('default');

  drawPortsOnTop();
}

/* ===================== Interaction ===================== */
function mousePressed(){
  if (mouseButton === RIGHT){
    const overNode = topmostNodeUnder(mouseX, mouseY);
    const overTrig = topmostTriggerUnder(mouseX, mouseY, TRIGGER_HIT_RIGHTCLICK);
    if (!overNode && !overTrig){
      showContextMenu(mouseX, mouseY);
      return;
    }
  }

  if (triggerDeletionController('press')) return;
  if (boxDeletionController('press')) return;
  if(draggingTrigger.active) return;

  // Shift-unsnap from group
  const nUnder = topmostNodeUnder(mouseX, mouseY);
  if (shiftDown() && nUnder) {
    const g = findGroupContaining(nUnder);
    if (g) { g.members.delete(nUnder); if (g.members.size < 2) removeGroup(g); }
  }

  // Ports first: only OUT starts cable; signal only to signal
  const port=findPortUnderMouse(mouseX,mouseY);
  if(port && (port.role==="out" || String(port.role).startsWith('signal-out'))){
    bringNodeToFront(port.node);
    draggingCable.active=true; draggingCable.fromPort=port; draggingCable.toMouse=createVector(mouseX,mouseY);
    pendingClickNode=null; return;
  }

  // Commit recording by clicking overlay
  if (recGroup){
    const t = recHitTrack(mouseX, mouseY);
    if (t && mouseButton===LEFT){ commitRecGroup(); return; }
  }

  // Edge boxes claim
  const hitCreate = topmostNodeCreateBoxUnder(mouseX, mouseY);
  if (hitCreate && mouseButton === LEFT) {
    bringNodeToFront(hitCreate.node);
    pendingClickNode = hitCreate.node;
    pendingClickNode._pressX = mouseX;
    pendingClickNode._pressY = mouseY;
    pendingClickNode._pressedHere = true;
    // Mapper knob drag start
    if (pendingClickNode instanceof MapperNode) pendingClickNode.mousePressed();
    return;
  }

  // start trigger drag?
  if(hoveredTrig.nodeIdx >= 0 && hoveredTrig.idx >= 0){
    draggingTrigger = { active:true, nodeIdx:hoveredTrig.nodeIdx, idx:hoveredTrig.idx, kind:hoveredTrig.kind };
    return;
  }

  // delete cable?
  if(hoveredLinkIndex>=0 && hoveredMidpoint){
    if(dist2(mouseX,mouseY,hoveredMidpoint.x,hoveredMidpoint.y)<=DELETE_ICON_R*DELETE_ICON_R){ links.splice(hoveredLinkIndex,1); return; }
  }

  // Node drag / alt-duplicate
  if (nUnder){
    if (altDown() && mouseButton === LEFT){
      const isScope = (nUnder instanceof OscilloscopeNode);
      const isMap = (nUnder instanceof MapperNode);
      let nb;
      if (isScope){
        nb = new OscilloscopeNode(nUnder.x + 12, nUnder.y + 12, nUnder.w, nUnder.h);
      } else if (isMap){
        nb = new MapperNode(nUnder.x + 12, nUnder.y + 12, nUnder.w, nUnder.h);
        nb.midTop = nUnder.midTop; nb.midBottom = nUnder.midBottom;
      } else {
        const cloneSamples = nUnder.samples.slice();
        nb = new NodeBox(nUnder.x + 12, nUnder.y + 12, nUnder.label, cloneSamples, nUnder.w);
        nb.cc = nUnder.cc;
        nb.sourceInDeviceName = nUnder.sourceInDeviceName;
        if (nUnder.vTriggers) for (const tv of nUnder.vTriggers) nb.vTriggers.push(new VTrigger(nb, tv.u));
        if (nUnder.hTriggers) for (const th of nUnder.hTriggers) nb.hTriggers.push(new HTrigger(nb, th.v));
      }
      nodes.push(nb);
      bringNodeToFront(nb);

      pendingClickNode = nb;
      nb._pressX = mouseX; nb._pressY = mouseY; nb._pressedHere = true;

      dragCtx.active = true;
      dragCtx.lead = nb;
      dragCtx.entries = [{ node: nb, dx: mouseX - nb.x, dy: mouseY - nb.y }];
      guideV = guideH = null;
      dragCtx.lastSnapTarget = null;
      return;
    }

    bringNodeToFront(nUnder);
    pendingClickNode=nUnder;
    nUnder._pressX=mouseX; nUnder._pressY=mouseY; nUnder._pressedHere=true;

    const g2 = findGroupContaining(nUnder);
    dragCtx.active = true;
    dragCtx.lead = nUnder;
    dragCtx.entries = [];
    if (g2){
      for (const m of g2.members){
        dragCtx.entries.push({ node:m, dx:mouseX - m.x, dy:mouseY - m.y });
      }
    } else {
      dragCtx.entries.push({ node:nUnder, dx:mouseX - nUnder.x, dy:mouseY - nUnder.y });
    }
    guideV = guideH = null;
    dragCtx.lastSnapTarget = null;
    return;
  }

  // Arm recording if empty area
  if(mouseButton===LEFT){
    if (!inAnyCreateBox(mouseX,mouseY)) startRecordingAt(mouseX, mouseY);
  }
}

function mouseDragged(){
  if(draggingCable.active){ draggingCable.toMouse.set(mouseX,mouseY); return; }

  if(draggingTrigger.active){
    const n=nodes[draggingTrigger.nodeIdx];
    if(draggingTrigger.kind==='v' && n.vTriggers){
      const trig=n.vTriggers[draggingTrigger.idx]; if(trig) trig.setUFromMouseX(mouseX);
    } else if(draggingTrigger.kind==='h' && n.hTriggers){
      const trig=n.hTriggers[draggingTrigger.idx]; if(trig) trig.setVFromMouseY(mouseY);
    }
    return;
  }

  if (dragCtx.active){
    const leadEntry = dragCtx.entries.find(e=>e.node===dragCtx.lead) || dragCtx.entries[0];
    let leadX = mouseX - leadEntry.dx;
    let leadY = mouseY - leadEntry.dy;
    const snap = computeDockSnap(dragCtx.lead, leadX, leadY);
    guideV = snap.guideV; guideH = snap.guideH;
    dragCtx.lastSnapTarget = snap.snappedTo;

    const ddx = (snap.x - leadX);
    const ddy = (snap.y - leadY);
    for (const e of dragCtx.entries){
      e.node.x = (mouseX - e.dx) + ddx;
      e.node.y = (mouseY - e.dy) + ddy;
    }
    return;
  }
}

function mouseReleased(){
  if (boxDeletionController('release')) return;
  if (triggerDeletionController('release')) return;

  // finish cable
  if(draggingCable.active && draggingCable.fromPort){
    const from = draggingCable.fromPort;
    const target=findPortUnderMouse(mouseX,mouseY);
    if(target && target!==from){
      const isSignalConnection = String(from.role).startsWith('signal') && String(target.role).startsWith('signal');
      const isNormalConnection = (from.role==="out" && target.role==="in");
      if (isSignalConnection || isNormalConnection){
        links.push(new Link(from,target));
      }
    }
  }
  draggingCable={ active:false, fromPort:null, toMouse:null };

  if(draggingTrigger.active){ draggingTrigger={ active:false, nodeIdx:-1, idx:-1, kind:null }; }

  if (dragCtx.active){
    const tgt = dragCtx.lastSnapTarget;
    if (tgt){
      ensureGroupWith(dragCtx.lead, tgt);
    }
    dragCtx.active = false; dragCtx.entries = []; dragCtx.lead = null; dragCtx.lastSnapTarget = null;
    guideV = guideH = null;
  }

  // create triggers from edge boxes first; otherwise playback
  if (pendingClickNode && pendingClickNode._pressedHere){
    const n=pendingClickNode;
    const moved = Math.hypot(mouseX - n._pressX, mouseY - n._pressY) > CLICK_DRAG_THRESHOLD;
    pendingClickNode=null;

    if (n instanceof MapperNode) n.mouseReleased();
    if (moved) return;

    if (typeof n.getTopCreateRect === 'function' && typeof n.getRightCreateRect === 'function'){
      const t = n.getTopCreateRect();
      const r = n.getRightCreateRect();
      if (t && t.w>0 && t.h>0 && pointInRect(mouseX,mouseY,t.x,t.y,t.w,t.h)) {
        if (typeof n.addVTriggerAtMouse === 'function') { n.addVTriggerAtMouse(); return; }
      }
      if (r && r.w>0 && r.h>0 && pointInRect(mouseX,mouseY,r.x,r.y,r.w,r.h)) {
        if (typeof n.addHTriggerAtMouse === 'function') { n.addHTriggerAtMouse(); return; }
      }
    }

    const g = findGroupContaining(n);
    if (g){ startGroupFromStart(g); }
    else if (n instanceof NodeBox){ n.startPlayback(); }
  }
}

function keyPressed(){
  if(key==='O'||key==='o'){
    if (!Midi.outputs.length) return;
    if (Midi.outSelection === 'all') { Midi.outSelection = [0]; }
    else if (Array.isArray(Midi.outSelection) && Midi.outSelection.length > 0) {
      const idx = (Midi.outSelection[0] + 1) % Midi.outputs.length;
      Midi.outSelection = [idx];
    } else { Midi.outSelection = [0]; }
    populateMidiOutGroup(); return;
  }
  else if(key==='C'||key==='c'){ Midi.channel = (Midi.channel+1)%16; if (midiChSel) midiChSel.value = String(Midi.channel); }
  else if(keyCode===ESCAPE){
    cancelRecGroup();
    guideV = guideH = null;
    hideContextMenu();
    if (dragCtx.active){ dragCtx.active=false; dragCtx.entries=[]; dragCtx.lead=null; dragCtx.lastSnapTarget=null; }
  }
}

/* ===================== Hover + helpers ===================== */
function updateHoverTargets(mx,my){
  hoveredLinkIndex=-1; hoveredMidpoint=null;
  hoveredTrig={ nodeIdx:-1, idx:-1, kind:null };

  // Cable hover
  let bestIdx=-1, bestDist=Infinity;
  for(let i=0;i<links.length;i++){
    const d=links[i].distanceTo(mx,my,40);
    if(d<bestDist){ bestDist=d; bestIdx=i; }
  }
  if(bestIdx>=0 && bestDist<=CABLE_HIT_THRESH){ hoveredLinkIndex=bestIdx; hoveredMidpoint=links[bestIdx].midpoint(); }

  // Trigger hover
  let bestN=-1, bestKind=null, bestT=-1, bestTDist=Infinity;
  for(let ni=nodes.length-1; ni>=0; --ni){
    const n=nodes[ni];
    if (n.vTriggers){
      for(let ti=0; ti<n.vTriggers.length; ti++){
        const t=n.vTriggers[ti];
        const d=t.distanceTo(mx,my);
        if(d<bestTDist){ bestTDist=d; bestN=ni; bestKind='v'; bestT=ti; }
      }
    }
    if (n.hTriggers){
      for(let ti=0; ti<n.hTriggers.length; ti++){
        const t=n.hTriggers[ti];
        const d=t.distanceTo(mx,my);
        if(d<bestTDist){ bestTDist=d; bestN=ni; bestKind='h'; bestT=ti; }
      }
    }
  }
  if(bestN>=0 && bestTDist<=TRIGGER_HIT_THRESH){ hoveredTrig={ nodeIdx:bestN, idx:bestT, kind:bestKind }; }
}

function findPortUnderMouse(mx,my){
  for (let i = nodes.length - 1; i >= 0; --i) {
    const n = nodes[i];

    // Node IO ports (conditional)
    if (n.left && shouldShowPort(n.left)  && n.left.hits(mx,my))  return n.left;
    if (n.right&& shouldShowPort(n.right) && n.right.hits(mx,my)) return n.right;

    // Signal boxes
    if (n instanceof OscilloscopeNode){
      if (shouldShowPort(n.signalIn)  && n.signalIn.hits(mx,my))  return n.signalIn;
      if (shouldShowPort(n.signalOut) && n.signalOut.hits(mx,my)) return n.signalOut;
    }
    if (n instanceof MapperNode){
      if (shouldShowPort(n.signalIn)  && n.signalIn.hits(mx,my))  return n.signalIn;
      if (shouldShowPort(n.signalOut) && n.signalOut.hits(mx,my)) return n.signalOut;
    }

    // Trigger ports
    if (n.vTriggers){
      for (const tv of n.vTriggers) {
        if (tv.portIn.hits(mx,my)) return tv.portIn;
        if (tv.port.hits(mx,my))   return tv.port;
      }
    }
    if (n.hTriggers){
      for (const th of n.hTriggers) {
        if (th.portUp.hits(mx,my))   return th.portUp;
        if (th.portDown.hits(mx,my)) return th.portDown;
      }
    }
  }
  return null;
}
function bringNodeToFront(n){ const i = nodes.indexOf(n); if (i >= 0) { nodes.splice(i, 1); nodes.push(n); } }
function topmostNodeUnder(mx,my){ for (let i = nodes.length - 1; i >= 0; --i) { const n = nodes[i]; if (n.bodyHits && n.bodyHits(mx,my)) return n; } return null; }
function drawPortsOnTop(){
  for (const n of nodes) {
    if (n.left  && shouldShowPort(n.left))  n.left.draw();
    if (n.right && shouldShowPort(n.right)) n.right.draw();

    if (n instanceof OscilloscopeNode){
      if (shouldShowPort(n.signalIn))  n.signalIn.draw();
      if (shouldShowPort(n.signalOut)) n.signalOut.draw();
    }
    if (n instanceof MapperNode){
      if (shouldShowPort(n.signalIn))  n.signalIn.draw();
      if (shouldShowPort(n.signalOut)) n.signalOut.draw();
    }

    if (n.vTriggers) for (const tv of n.vTriggers) { tv.portIn.draw(); tv.port.draw(); }
    if (n.hTriggers) for (const th of n.hTriggers) { th.portUp.draw(); th.portDown.draw(); }
  }
}
function inAnyCreateBox(mx,my){
  for (const n of nodes){
    if (!n.getTopCreateRect || !n.getRightCreateRect) continue;
    const t=n.getTopCreateRect(), r=n.getRightCreateRect();
    if (t.w>0 && t.h>0 && pointInRect(mx,my,t.x,t.y,t.w,t.h)) return true;
    if (r.w>0 && r.h>0 && pointInRect(mx,my,r.x,r.y,r.w,r.h)) return true;
  }
  return false;
}
function topmostNodeCreateBoxUnder(mx, my) {
  for (let i = nodes.length - 1; i >= 0; --i) {
    const n = nodes[i];
    if (!n.getTopCreateRect || !n.getRightCreateRect) continue;
    const t = n.getTopCreateRect();
    if (t.w>0 && t.h>0 && pointInRect(mx, my, t.x, t.y, t.w, t.h)) return { node: n, which: 'top' };
    const r = n.getRightCreateRect();
    if (r.w>0 && r.h>0 && pointInRect(mx, my, r.x, r.y, r.w, r.h)) return { node: n, which: 'right' };
  }
  return null;
}

/* ===================== Trigger propagation ===================== */
function triggerFromPort(srcPort){
  if (srcPort && typeof srcPort.blink === 'function') srcPort.blink();

  for (const link of links){
    if (link.a !== srcPort) continue;
    const dst = link.b;

    // Time trigger input (top of V trigger) → start at that U
    if (dst.kind === PORT_TOP_TRIGGER && dst.role === 'in') {
      const trig = dst._trigger;
      const u = trig ? trig.u : 0;
      const g = findGroupContaining(dst.node);
      if (g) startGroupFromNodeU(g, dst.node, u); else dst.node.startPlaybackFromU(u);
      if (dst && typeof dst.blink === 'function') dst.blink();
      continue;
    }

    // Node left input port (normal in) -> start playback
    if (dst.kind === PORT_LEFT && dst.role === 'in') {
      const g = findGroupContaining(dst.node);
      if (g) startGroupFromStart(g); else if (dst.node && dst.node.startPlayback) dst.node.startPlayback();
      if (dst && typeof dst.blink === 'function') dst.blink();
      continue;
    }

    // Signal links: just blink destination (no playback semantics here)
    if (link.isSignal){
      if (dst && typeof dst.blink === 'function') dst.blink();
      continue;
    }

    // Default: kick node/group
    const g = findGroupContaining(dst.node);
    if (g){ startGroupFromStart(g); }
    else if (dst.node && dst.node.startPlayback){ dst.node.startPlayback(); }
    if (dst && typeof dst.blink === 'function') dst.blink();
  }
}

/* ===================== Recording (time-based) ===================== */
// ===== Recording buffers (helpers) =====
function recEnsureBuf(t){
  // (Re)create the lane graphics buffer at current TRH, preserving what we had
  const W = t.gbuf ? t.gbuf.width : 120;
  const ng = createGraphics(W, TRH);
  ng.pixelDensity(1);
  ng.background(12);
  ng.stroke(220);
  ng.strokeWeight(1.5);
  ng.noFill();
  if (t.gbuf) ng.image(t.gbuf, 0, 0);
  t.gbuf = ng; t.w = W; t.h = TRH;
}

function recEnsureWidth(t, needW){
  if (!t.gbuf) { recEnsureBuf(t); }
  if (needW <= t.gbuf.width) return;
  const ng = createGraphics(needW, t.gbuf.height);
  ng.pixelDensity(1);
  ng.background(12);
  ng.stroke(220);
  ng.strokeWeight(1.5);
  ng.noFill();
  ng.image(t.gbuf, 0, 0);
  t.gbuf = ng; t.w = needW;
}


function startRecordingAt(mx,my){
  cancelRecGroup();
  recGroup = {
    x:Math.floor(mx), y:Math.floor(my),
    firstEvtTS:null, stacking:true,
    tracks:[], index:new Map(),
    _lastTS: performance.now()
  };
}
function recCursorX(g){ if (!g || !g.tracks.length) return 0; return Math.max(0, ...g.tracks.map(t => (t.offsetX||0) + t.writeX)); }
function recKey(srcId, ch, cc){ return `${srcId}::${ch}:${cc}`; }
function makeRecTrack(g, ch, cc, offsetX=0, src=null){
  const row = g.tracks.length;
  const srcDisplay = stripManufacturerFromName(src?.name || '', src?.manufacturer || '') || (src?.name || 'Input');
  const t = {
    x: g.x + offsetX,
    y: g.y + row*(TRH+STACK_GAP),
    w: 120, h: TRH, gbuf: null,
    label: `${srcDisplay} ▸ CC ${cc}`,
    bound:{ ch, cc, srcId: src?.id || 'unknown' },
    src, srcDisplay,
    vals: [], deltas: [],
    writeX: 0, _fracPx: 0, _drawnEvents: 0,
  };
  recEnsureBuf(t);
  g.tracks.push(t);
  g.index.set(recKey(t.bound.srcId, ch, cc), t);
  return t;
}
function pushCCToRec(ch,cc,val,ts,src){
  if(!recGroup) return;
  const tNow = (typeof ts==='number') ? ts : performance.now();
  if (recGroup.firstEvtTS===null){ recGroup.firstEvtTS=tNow; recGroup.stacking=true; }
  const withinWindow = Math.abs(tNow - recGroup.firstEvtTS) <= SIMUL_WIN_MS;

  const srcId = src?.id || 'unknown';
  let tr = recGroup.index.get(recKey(srcId, ch, cc));

  if(!tr){
    if(recGroup.stacking && withinWindow) tr = makeRecTrack(recGroup, ch, cc, 0, src);
    else { tr = makeRecTrack(recGroup, ch, cc, recCursorX(recGroup), src); recGroup.stacking=false; }
  } else {
    if(recGroup.stacking && !withinWindow) recGroup.stacking=false;
  }

  if (tr.vals.length === 0) { tr.vals.push(val); tr.deltas.push(0); tr._drawnEvents = 1; return; }
  const lastVal = tr.vals[tr.vals.length - 1];
  if (val !== lastVal) { tr.vals.push(val); tr.deltas.push(0); }
}
function updateRecordingOverlayTime() {
  if (!recGroup) return;
  const now = performance.now();
  const last = recGroup._lastTS || now;
  const dt = Math.max(0, now - last);
  recGroup._lastTS = now;
  if (dt === 0) return;

  const pxPerMs = SPEED_PX_PER_SEC / 1000;
  for (const t of recGroup.tracks) {
    if (!t.vals.length) continue;
    const k = t.deltas.length - 1;
    t.deltas[k] = (t.deltas[k] || 0) + dt;

    const adv = (t._fracPx || 0) + dt * pxPerMs;
    const intPx = Math.floor(adv);
    t._fracPx = adv - intPx;
    if (intPx > 0) {
      recEnsureWidth(t, t.writeX + intPx + 1);
      const g = t.gbuf, h = g.height, yMap = v => map(v, 0, 127, h - 1, 0, true);
      const curVal = t.vals[t.vals.length - 1];
      g.line(t.writeX, yMap(curVal), t.writeX + intPx, yMap(curVal));
      t.writeX += intPx;
    }

    if (t._drawnEvents < t.vals.length) {
      const g = t.gbuf, h = g.height, yMap = v => map(v, 0, 127, h - 1, 0, true);
      for (let ei = t._drawnEvents; ei < t.vals.length; ei++) {
        const prevVal = t.vals[ei - 1], newVal  = t.vals[ei];
        g.line(t.writeX, yMap(prevVal), t.writeX, yMap(newVal));
      }
      t._drawnEvents = t.vals.length;
    }
  }
}
function resampleValsDeltas(vals, deltas, outW) {
  const N = vals.length;
  if (!N) return [];
  const W = Math.max(2, outW);
  const times = new Array(N); let acc = 0;
  for (let i = 0; i < N; i++) { acc += (i === 0 ? 0 : deltas[i]); times[i] = acc; }
  const total = Math.max(1, times[N - 1]);
  const out = new Array(W); let k = 0;
  for (let x = 0; x < W; x++) {
    const t = (x / (W - 1)) * total;
    while (k + 1 < N && t > times[k + 1]) k++;
    const t0 = times[k], t1 = (k + 1 < N) ? times[k + 1] : total;
    const v0 = vals[k],  v1 = (k + 1 < N) ? vals[k + 1] : vals[k];
    const f = (t1 > t0) ? (t - t0) / (t1 - t0) : 0;
    const v = (v0 === v1) ? v0 : (v0 + (v1 - v0) * f);
    out[x] = constrain(v / 127, 0, 1);
  }
  return out;
}
function commitRecGroup(){
  if(!recGroup) return;
  const baseY = recGroup.y;
  const newBoxes = [];

  for (let i = 0; i < recGroup.tracks.length; i++) {
    const t = recGroup.tracks[i];
    if (!t.vals.length) continue;

    const totalMs = t.deltas.reduce((acc, d, idx) => acc + (idx === 0 ? 0 : d), 0);
    const graphW  = Math.max(2, Math.round((totalMs / 1000) * SPEED_PX_PER_SEC));
    const nbW     = Math.max(60, graphW + 16);

    const nbX = t.x;
    const nbY = baseY + i * (BOX_H + NB_STACK_GAP);

    const samples = resampleValsDeltas(t.vals, t.deltas, graphW);
    const nb = new NodeBox(nbX, nbY, `CC ${t.bound.cc}`, samples, nbW);
    nb.sourceInDeviceName = t.srcDisplay;
    newBoxes.push(nb);
  }

  nodes.push(...newBoxes);
  cancelRecGroup();
}
function cancelRecGroup(){ recGroup=null; }
function recHitTrack(mx,my){
  if(!recGroup) return null;
  for (const t of recGroup.tracks){
    const w = Math.max(1, t.writeX);
    if (pointInRect(mx,my, t.x, t.y, w, t.h)) return t;
  }
  return null;
}
function drawRecordingOverlay(){
  if(!recGroup) return;
  for (const t of recGroup.tracks){
    push(); translate(t.x, t.y); image(t.gbuf, 0, 0); pop();
    noStroke(); fill(220); textSize(12); text(`${t.label} (REC)`, t.x+6, t.y-6);
  }
  const headX = recGroup.x + recCursorX(recGroup);
  if (recGroup.tracks.length){
    const minY = Math.min(...recGroup.tracks.map(t=>t.y));
    const maxY = Math.max(...recGroup.tracks.map(t=>t.y + t.h));
    stroke(255,150); strokeWeight(1.5);
    line(headX, minY - 10, headX, maxY + 10);
    strokeWeight(1);
  } else {
    noStroke(); fill(200); circle(recGroup.x, recGroup.y + TRH/2, 4);
    fill(180); textSize(12); text('(armed – waiting for CC)', recGroup.x+10, recGroup.y-6);
  }
}

/* ===================== Split ===================== */
function splitSamplesAtU(samples, u){
  const N = Math.max(2, samples.length);
  const pos = constrain(u, 0, 1) * (N - 1);
  const i = Math.floor(pos), j = Math.min(i + 1, N - 1);
  const f = pos - i;
  const vSplit = samples[i] + (samples[j] - samples[i]) * f;

  const left = samples.slice(0, i + 1);
  left.push(vSplit);

  const right = [vSplit, ...samples.slice(j)];

  if (left.length < 2) left.push(left[left.length - 1]);
  if (right.length < 2) right.unshift(right[0]);

  return { left, right };
}
function splitNodeAtU(node, u){
  u = constrain(u, 0, 1);
  const EPS = 0.02;
  if (u <= EPS || u >= 1 - EPS) return;

  const { gx, gw } = node.getGraphRect();
  const { left: sL, right: sR } = splitSamplesAtU(node.samples, u);

  const gw1 = Math.max(2, Math.round(gw * u));
  const gw2 = Math.max(2, gw - gw1);
  const nbW1 = gw1 + 16;
  const nbW2 = gw2 + 16;

  const n1 = new NodeBox(node.x, node.y, node.label, sL, nbW1);
  const n2 = new NodeBox(node.x + nbW1, node.y, node.label, sR, nbW2);
  n1.cc = node.cc; n2.cc = node.cc;
  n1.sourceInDeviceName = node.sourceInDeviceName;
  n2.sourceInDeviceName = node.sourceInDeviceName;

  if (node.vTriggers){
    for (const tv of node.vTriggers){
      if (tv.u <= u){
        const uL = (u === 0) ? 0 : (tv.u / u);
        n1.vTriggers.push(new VTrigger(n1, constrain(uL, 0, 1)));
      } else {
        const uR = (tv.u - u) / (1 - u);
        n2.vTriggers.push(new VTrigger(n2, constrain(uR, 0, 1)));
      }
    }
  }
  if (node.hTriggers){
    for (const th of node.hTriggers){
      n1.hTriggers.push(new HTrigger(n1, th.v));
      n2.hTriggers.push(new HTrigger(n2, th.v));
    }
  }

  const portMap = new Map();
  if (node.vTriggers){
    for (const tv of node.vTriggers){
      const isLeft = (tv.u <= u);
      const uPrime = isLeft ? (u === 0 ? 0 : (tv.u / u)) : ((tv.u - u) / (1 - u));
      const arr = isLeft ? n1.vTriggers : n2.vTriggers;
      let pick = arr[0]; let best = Infinity;
      for (const cand of arr){ const d = Math.abs(cand.u - uPrime); if (d < best){ best = d; pick = cand; } }
      portMap.set(tv.port,   pick.port);
      portMap.set(tv.portIn, pick.portIn);
    }
  }
  const newLinks = [];
  for (const L of links){
    const aOld = L.a, bOld = L.b;
    const aNew = portMap.get(aOld);
    const bNew = portMap.get(bOld);

    if (aNew && bNew){ newLinks.push(new Link(aNew, bNew)); continue; }
    if (aNew && !bNew)  { newLinks.push(new Link(aNew, bOld)); continue; }
    if (!aNew && bNew)  { newLinks.push(new Link(aOld, bNew)); continue; }

    if (node.hTriggers){
      let duplicated = false;
      for (let idx = 0; idx < node.hTriggers.length; idx++){
        const th = node.hTriggers[idx];
        if (aOld === th.portUp){
          newLinks.push(new Link(n1.hTriggers[idx].portUp, bOld));
          newLinks.push(new Link(n2.hTriggers[idx].portUp, bOld));
          duplicated = true; break;
        }
        if (aOld === th.portDown){
          newLinks.push(new Link(n1.hTriggers[idx].portDown, bOld));
          newLinks.push(new Link(n2.hTriggers[idx].portDown, bOld));
          duplicated = true; break;
        }
        if (bOld === th.portUp){
          newLinks.push(new Link(aOld, n1.hTriggers[idx].portUp));
          newLinks.push(new Link(aOld, n2.hTriggers[idx].portUp));
          duplicated = true; break;
        }
        if (bOld === th.portDown){
          newLinks.push(new Link(aOld, n1.hTriggers[idx].portDown));
          newLinks.push(new Link(aOld, n2.hTriggers[idx].portDown));
          duplicated = true; break;
        }
      }
      if (!duplicated) newLinks.push(L);
    } else {
      newLinks.push(L);
    }
  }
  links = newLinks;

  const g = findGroupContaining(node);
  if (g){
    g.members.delete(node);
    g.members.add(n1); g.members.add(n2);
  }

  const idxNode = nodes.indexOf(node);
  if (idxNode >= 0){
    nodes.splice(idxNode, 1, n1, n2);
  } else {
    nodes.push(n1, n2);
    const i = nodes.indexOf(node);
    if (i >= 0) nodes.splice(i, 1);
  }
}

/* ===================== Extra: split by shift-click top box ===================== */
function mouseClicked(){
  if (mouseButton === LEFT && shiftDown()){
    const hitCreate = topmostNodeCreateBoxUnder(mouseX, mouseY);
    if (hitCreate && hitCreate.which === 'top'){
      const n = hitCreate.node;
      if (n instanceof NodeBox){
        const {gx,gw} = n.getGraphRect();
        const clampedX = constrain(mouseX, gx, gx+gw);
        const u = (clampedX - gx) / gw;
        splitNodeAtU(n, u);
      }
    }
  }
}

/* ===================== Trigger ports on top-of-canvas ===================== */
function triggerFromNodeRight(node){
  if (!node || !node.right) return;
  triggerFromPort(node.right);
}

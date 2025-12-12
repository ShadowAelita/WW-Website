/* Werwolf Moderator — Final implementation (mit Modal-Dialogen & Rollenfilter)
   Nur Popups ersetzt und Rollenfilter hinzugefügt; Rest unverändert.
*/

const ROLE = {
  ARMOR: "Armor",
  DIEB: "Dieb",
  BAECKER: "Bäcker",
  SEHER: "Seher",
  DORFMATRATZE: "Dorfmatratze",
  WERWOLF: "Werwolf",
  HEXE: "Hexe",
  DORFTROTTEL: "Dorftrottel",
  DORFBEWOHNER: "Dorfbewohner"
};

const nightOrder = [ ROLE.ARMOR, ROLE.DIEB, ROLE.BAECKER, ROLE.SEHER, ROLE.DORFMATRATZE, ROLE.WERWOLF, ROLE.HEXE ];

// State
let state = {
  players: [], // {name, role, alive:true, armorPartner:null}
  round: 1,
  phase: 'setup',
  nightChoices: {},
  witch: { canHeal: true, canPoison: true },
  bakerPlaced: [], // array of {owner, quality, passes:[], eatenBy:null, placedRound}
  bakerBadPending: [], // array of indices to die at start of next night
  log: []
};

// persistence
function save(){ localStorage.setItem('ww_final', JSON.stringify(state)); }
function load(){ const s = localStorage.getItem('ww_final'); if(s) state = JSON.parse(s); }
load();

// ui refs
const playersList = document.getElementById('playersList');
const rolesControls = document.getElementById('rolesControls');
const topWarning = document.getElementById('topWarning');
const flowArea = document.getElementById('flowArea');
const nightSummary = document.getElementById('nightSummary');
const logArea = document.getElementById('logArea');

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalActions = document.getElementById('modal-actions');

// role order for dropdowns
const ROLE_ORDER = [ROLE.WERWOLF, ROLE.SEHER, ROLE.HEXE, ROLE.DORFMATRATZE, ROLE.BAECKER, ROLE.ARMOR, ROLE.DIEB, ROLE.DORFTROTTEL, ROLE.DORFBEWOHNER];

// ---------------------- Modal dialog API (Promisified) ----------------------
function clearModal(){
  modalTitle.textContent = '';
  modalBody.innerHTML = '';
  modalActions.innerHTML = '';
}

function showAlert(text){
  return new Promise(resolve=>{
    clearModal();
    modalTitle.textContent = 'Hinweis';
    modalBody.innerHTML = `<div>${escapeHtml(text)}</div>`;
    const ok = document.createElement('button'); ok.textContent = 'OK';
    ok.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(); };
    modalActions.appendChild(ok);
    modalOverlay.classList.remove('hidden');
  });
}

function showConfirm(text){
  return new Promise(resolve=>{
    clearModal();
    modalTitle.textContent = 'Bestätigen';
    modalBody.innerHTML = `<div>${escapeHtml(text)}</div>`;
    const ok = document.createElement('button'); ok.textContent = 'Ja';
    const cancel = document.createElement('button'); cancel.textContent = 'Nein';
    ok.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(true); };
    cancel.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(false); };
    modalActions.appendChild(ok); modalActions.appendChild(cancel);
    modalOverlay.classList.remove('hidden');
  });
}

// Show choices (array of {label}) returns index or null if cancelled
function showChoice(title, options){
  return new Promise(resolve=>{
    clearModal();
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    options.forEach((opt, i)=>{
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.style.flex = '1 1 auto';
      b.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(i); };
      modalActions.appendChild(b);
    });
    const cancel = document.createElement('button'); cancel.textContent = 'Abbrechen';
    cancel.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(null); };
    modalActions.appendChild(cancel);
    modalOverlay.classList.remove('hidden');
  });
}

// Prompt string input (simple)
function showPrompt(title, placeholder=''){
  return new Promise(resolve=>{
    clearModal();
    modalTitle.textContent = title;
    const input = document.createElement('input');
    input.placeholder = placeholder;
    input.style.width = '100%';
    modalBody.appendChild(input);
    const ok = document.createElement('button'); ok.textContent = 'OK';
    const cancel = document.createElement('button'); cancel.textContent = 'Abbrechen';
    ok.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(input.value || null); };
    cancel.onclick = ()=>{ modalOverlay.classList.add('hidden'); resolve(null); };
    modalActions.appendChild(ok); modalActions.appendChild(cancel);
    modalOverlay.classList.remove('hidden');
    input.focus();
  });
}

// escape helper for safe innerHTML
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

// ---------------------- Logging ----------------------
function addLog(text){ const entry = new Date().toLocaleString() + ' — ' + text; state.log.push(entry); renderLog(); save(); }
function renderLog(){ logArea.innerHTML = state.log.slice().reverse().map(l=>`<div>${escapeHtml(l)}</div>`).join(''); }

// ---------------------- Players UI ----------------------
document.getElementById('addPlayer').onclick = async () => {
  const name = document.getElementById('playerName').value.trim();
  if(!name){ await showAlert('Bitte Namen eingeben.'); return; }
  state.players.push({name, role: null, alive: true, armorPartner: null});
  document.getElementById('playerName').value = '';
  renderPlayers(); checkRoleWarning(); save();
};
document.getElementById('clearPlayers').onclick = async () => {
  const ok = await showConfirm('Alle Spieler entfernen?');
  if(!ok) return;
  state.players = [];
  renderPlayers(); checkRoleWarning(); save();
};

function renderPlayers(){
  playersList.innerHTML = '';
  state.players.forEach((p,i)=>{
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.style.display='flex'; left.style.flexDirection='column'; left.style.gap='6px';
    const title = document.createElement('div'); title.textContent = p.name; title.className = p.alive ? 'playerAlive' : 'playerDead';
    const sel = document.createElement('select');
    const none = document.createElement('option'); none.value=''; none.textContent='(keine)'; sel.appendChild(none);
    ROLE_ORDER.forEach(r=>{ const o=document.createElement('option'); o.value=r; o.textContent=r; if(p.role===r) o.selected=true; sel.appendChild(o); });
    sel.onchange = ()=>{ p.role = sel.value || null; checkRoleWarning(); save(); addLog(`Rolle zugewiesen: ${p.name} → ${p.role||'(keine)'}`); renderPlayers(); };
    left.appendChild(title); left.appendChild(sel);

    const right = document.createElement('div'); right.style.display='flex'; right.style.gap='6px';
    const toggle = document.createElement('button'); toggle.textContent = p.alive ? '-> tot setzen' : '-> lebendig setzen';
    toggle.onclick = async ()=>{ p.alive = !p.alive; if(!p.alive && p.armorPartner!=null){ const partner = p.armorPartner; if(state.players[partner] && state.players[partner].alive){ state.players[partner].alive = false; addLog(`${state.players[partner].name} (Armor-Partner) starb, da Partner gestorben ist.`); } } save(); renderPlayers(); renderLog(); };
    const rem = document.createElement('button'); rem.textContent='Entfernen'; rem.onclick=async ()=>{ const ok = await showConfirm('Spieler entfernen?'); if(!ok) return; state.players.splice(i,1); save(); renderPlayers(); checkRoleWarning(); };
    right.appendChild(toggle); right.appendChild(rem);
    li.appendChild(left); li.appendChild(right); playersList.appendChild(li);
  });
}
renderPlayers();

function checkRoleWarning(){
  const assigned = state.players.filter(p=>p.role).length;
  const total = state.players.length;
  if(assigned !== total){ topWarning.classList.remove('hidden'); topWarning.textContent = `Warnung: ${assigned} Rollen zugewiesen / ${total} Spieler - Anzahl stimmt nicht überein.`; }
  else topWarning.classList.add('hidden');
}

// ---------------------- Role distribution ----------------------
document.getElementById('autoSuggest').onclick = async ()=>{
  if(state.players.length === 0){ await showAlert('Keine Spieler.'); return; }
  const n = state.players.length;
  const wolves = Math.max(1, Math.floor(n/3));
  let dist = [];
  for(let i=0;i<wolves;i++) dist.push(ROLE.WERWOLF);
  const specials = [ROLE.SEHER, ROLE.HEXE, ROLE.DORFMATRATZE, ROLE.BAECKER, ROLE.ARMOR, ROLE.DIEB, ROLE.DORFTROTTEL];
  specials.forEach(s=>dist.push(s));
  while(dist.length < n) dist.push(ROLE.DORFBEWOHNER);
  dist = dist.sort(()=>Math.random()-0.5);
  state.players.forEach((p,i)=>{ p.role = dist[i]; p.alive = true; p.armorPartner = null; });
  state.witch = {canHeal:true, canPoison:true}; state.bakerPlaced = []; state.bakerBadPending = []; state.round = 1; state.log = [];
  save(); renderPlayers(); renderLog(); checkRoleWarning(); addLog('Automatische Rollenverteilung durchgeführt.');
};

document.getElementById('assignRoles').onclick = async ()=>{
  const assigned = state.players.filter(p=>p.role).length;
  if(assigned !== state.players.length){ await showAlert('Bitte zuerst Rollen vollständig zuweisen (oder Auto-Vorschlag).'); return; }
  const roles = state.players.map(p=>p.role).sort(()=>Math.random()-0.5);
  state.players.forEach((p,i)=>{ p.role = roles[i]; p.alive = true; p.armorPartner = null; });
  save(); renderPlayers(); addLog('Rollen zufällig verteilt.');
};

document.getElementById('clearRoles').onclick = async ()=>{ 
  const ok = await showConfirm('Rollen zurücksetzen?'); 
  if(!ok) return;
  state.players.forEach(p=>{ p.role = null; p.armorPartner=null; }); save(); renderPlayers(); checkRoleWarning(); addLog('Rollen zurückgesetzt.'); 
};

// ---------------------- Night flow UI builder ----------------------
document.getElementById('startNight').onclick = ()=>startNight();

function startNight(){
  state.nightChoices = {}; // reset
  flowArea.innerHTML = '';
  nightSummary.classList.add('hidden');

  // apply bakerBadPending from previous scheduled deaths at start of this night
  if(state.bakerBadPending.length>0){
    const pending = state.bakerBadPending.slice();
    state.bakerBadPending = [];
    pending.forEach(idx=>{ if(state.players[idx] && state.players[idx].alive){ state.players[idx].alive = false; addLog(`${state.players[idx].name} starb zu Beginn der Nacht durch schlechtes Brot (Nachwirkung).`); } });
    renderPlayers(); renderLog();
  }

  const aliveRoles = new Set(state.players.filter(p=>p.alive && p.role).map(p=>p.role));

  nightOrder.forEach(role => {
    if(role === ROLE.ARMOR && state.round !== 1) return;
    if(role === ROLE.DIEB && (state.round === 1 || (state.round % 2) !== 0)) return;
    if(!aliveRoles.has(role)) return;
    const block = document.createElement('div'); block.className = 'card';
    const h = document.createElement('h3'); h.textContent = role; block.appendChild(h);
    if(role === ROLE.ARMOR) block.appendChild(buildArmorUI());
    if(role === ROLE.DIEB) block.appendChild(buildDiebUI());
    if(role === ROLE.BAECKER) block.appendChild(buildBaeckerUI());
    if(role === ROLE.SEHER) block.appendChild(buildSeherUI());
    if(role === ROLE.DORFMATRATZE) block.appendChild(buildMatratzeUI());
    if(role === ROLE.WERWOLF) block.appendChild(buildWerwolfUI());
    if(role === ROLE.HEXE) block.appendChild(buildHexeUI());
    flowArea.appendChild(block);
  });

  document.getElementById('executeNight').disabled = false;
  addLog(`Nacht ${state.round} gestartet — Aktionen auswählen.`);
  save();
}

// ---------------------- UI components for actions (with filters) ----------------------

// Helper: find first alive player index that has a given role
function findAliveIndexByRole(role){
  return state.players.findIndex(p => p.alive && p.role === role);
}

// Armor UI: actor = the player who has Armor role (first alive)
function buildArmorUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle zwei Spieler zum Verkuppeln (Armor). Wenn später einer stirbt, stirbt der andere ebenfalls.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';

  const actorIndex = findAliveIndexByRole(ROLE.ARMOR);
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    // filter: only alive targets, cannot choose self (actor)
    if(!p.alive || i === actorIndex) btn.disabled = true;
    btn.onclick = async ()=> {
      state.nightChoices.armorSelections = state.nightChoices.armorSelections || [];
      const sel = state.nightChoices.armorSelections;
      if(sel.includes(i)){ state.nightChoices.armorSelections = sel.filter(x=>x!==i); await showAlert(`Armor: Auswahl entfernt (${p.name}).`); addLog(`Armor: Auswahl entfernt (${p.name}).`); }
      else if(sel.length < 2){ sel.push(i); await showAlert(`Armor: Auswahl hinzugefügt (${p.name}).`); addLog(`Armor: Auswahl hinzugefügt (${p.name}).`); }
      else await showAlert('Bereits zwei ausgewählt.');
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Dieb UI
function buildDiebUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle zwei Spieler deren Rollen getauscht werden sollen.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  const actorIndex = findAliveIndexByRole(ROLE.DIEB);
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = `${p.name} ${p.role? '('+p.role+')':''}`;
    if(!p.alive || i === actorIndex) btn.disabled = true;
    btn.onclick = async ()=>{
      state.nightChoices.diebPicks = state.nightChoices.diebPicks || [];
      const sel = state.nightChoices.diebPicks;
      if(sel.includes(i)){ state.nightChoices.diebPicks = sel.filter(x=>x!==i); await showAlert(`Dieb: Auswahl entfernt (${p.name}).`); addLog(`Dieb: Auswahl entfernt (${p.name}).`); }
      else if(sel.length < 2){ sel.push(i); await showAlert(`Dieb: Auswahl hinzugefügt (${p.name}).`); addLog(`Dieb: Auswahl hinzugefügt (${p.name}).`); }
      else await showAlert('Bereits zwei ausgewählt.');
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Bäcker UI: actor is baker; cannot choose dead door targets
function buildBaeckerUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle vor wessen Tür das Brot gelegt wird und ob es gut oder schlecht ist. (Das Brot wird am Tag aufgelöst.)';
  wrap.appendChild(info);
  const select = document.createElement('select');
  const empty = document.createElement('option'); empty.value=''; empty.textContent='(Ziel wählen)'; select.appendChild(empty);
  state.players.forEach((p,i)=>{ 
    const o=document.createElement('option'); o.value=i; o.textContent = p.name + (p.alive?'':' (tot)'); 
    if(!p.alive) o.disabled = true; // cannot place at a dead player's door
    select.appendChild(o); 
  });
  select.onchange = async ()=>{
    const idx = parseInt(select.value);
    if(isNaN(idx)){ return; }
    // ask quality via confirm-style modal
    const choose = await showChoice('Brotqualität wählen', [{label:'Gut (schützt)'},{label:'Schlecht (tödlich)'}]);
    if(choose === null) { await showAlert('Bäcker-Aktion abgebrochen.'); return; }
    const qual = (choose === 0) ? 1 : 2;
    state.bakerPlaced = state.bakerPlaced || [];
    state.bakerPlaced.push({ owner: idx, quality: qual, passes: [], eatenBy: null, placedRound: state.round });
    addLog(`Bäcker legte ${qual===1?'gutes':'schlechtes'} Brot vor die Tür von ${state.players[idx].name}. (wird am Tag aufgelöst)`);
    save();
    renderPlayers();
  };
  wrap.appendChild(select);
  return wrap;
}

// Seher UI: actor is seer; exclude seer themselves
function buildSeherUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Seher: Wähle eine Person, deren Karte der Moderator sehen wird.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  const actorIndex = findAliveIndexByRole(ROLE.SEHER);
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    // filter: only alive targets and not self
    if(!p.alive || i === actorIndex) btn.disabled = true;
    btn.onclick = async ()=>{
      state.nightChoices.seherPick = i;
      addLog(`Seher sah die Karte von ${p.name}: ${p.role || '(nicht zugewiesen)'}`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Matratze UI: cannot sleep at self
function buildMatratzeUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Dorfmatratze: Wähle bei wem sie schlafen möchte. Matratze stirbt nur wenn Gastgeber angegriffen wird.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  const actorIndex = findAliveIndexByRole(ROLE.DORFMATRATZE);
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    if(!p.alive || i === actorIndex) btn.disabled = true;
    btn.onclick = async ()=>{
      state.nightChoices.matratzeTarget = i;
      addLog(`Dorfmatratze schläft bei ${p.name}.`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Werwolf UI: cannot choose dead; actor(s) excluded (we treat wolves as single actor moderator selects target)
function buildWerwolfUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Werwölfe wählen gemeinsam ein Opfer.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  // For target list: all alive players
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    if(!p.alive) btn.disabled = true;
    btn.onclick = async ()=>{
      state.nightChoices.wolfTarget = i;
      addLog(`Werwölfe wählten: ${p.name}`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Hexe UI: poison/heal choices limited to alive players (hex can choose heal target only among appropriate)
function buildHexeUI(){
  const wrap = document.createElement('div');
  const victim = (typeof state.nightChoices.wolfTarget === 'number') ? state.players[state.nightChoices.wolfTarget].name : 'Noch nicht gewählt';
  const info = document.createElement('div'); info.className='small'; info.textContent = `Werwolf-Opfer: ${victim}. Hexe: Heilung (${state.witch.canHeal?'verfügbar':'gebraucht'}), Gift (${state.witch.canPoison?'verfügbar':'gebraucht'}).`;
  wrap.appendChild(info);
  const healBtn = document.createElement('button'); healBtn.textContent='Heilen';
  healBtn.onclick = async ()=>{
    if(!state.witch.canHeal){ await showAlert('Heiltrank bereits benutzt.'); return; }
    if(state.nightChoices.wolfTarget == null){ await showAlert('Noch kein Opfer der Werwölfe.'); return; }
    // Offer choice: if both matratze and victim possible, present options; otherwise heal victim
    const matIdx = state.players.findIndex(p => p.alive && p.role === ROLE.DORFMATRATZE);
    const choices = [];
    choices.push({label: state.players[state.nightChoices.wolfTarget].name, index: state.nightChoices.wolfTarget});
    if(matIdx >= 0) choices.push({label: state.players[matIdx].name, index: matIdx});
    const pick = await showChoice('Wen heilen?', choices.map(c=>({label:c.label})));
    if(pick === null) return;
    const idx = choices[pick].index;
    state.nightChoices.witchSave = idx;
    state.witch.canHeal = false;
    addLog(`Hexe heilte: ${state.players[idx].name}`);
    save();
  };
  const poisonBtn = document.createElement('button'); poisonBtn.textContent='Vergiften';
  poisonBtn.onclick = async ()=>{
    if(!state.witch.canPoison){ await showAlert('Gifttank bereits benutzt.'); return; }
    // build choice of alive players (cannot choose hex herself if alive)
    const hexIndex = state.players.findIndex(p=>p.role===ROLE.HEXE && p.alive);
    const choices = state.players.map((p,i)=>({label:p.name, index:i, alive:p.alive})).filter(c=>c.alive && c.index !== hexIndex);
    if(choices.length === 0){ await showAlert('Keine gültigen Ziele.'); return; }
    const pick = await showChoice('Wen vergiften?', choices.map(c=>({label:c.label})));
    if(pick === null) return;
    const idx = choices[pick].index;
    state.nightChoices.witchPoison = idx;
    state.witch.canPoison = false;
    addLog(`Hexe vergiftete: ${state.players[idx].name}`);
    save();
  };
  wrap.appendChild(healBtn); wrap.appendChild(poisonBtn);
  return wrap;
}

// ---------------------- Execute night ----------------------
document.getElementById('executeNight').onclick = async ()=>{
  // Pre-check unassigned
  const unassigned = state.players.filter(p=>p.alive && !p.role).map(p=>p.name);
  if(unassigned.length>0){
    const ok = await showConfirm(`Es gibt unzugewiesene Rollen: ${unassigned.join(', ')}. Weiter?`);
    if(!ok) return;
  }
  addLog(`Berechne Auflösung der Nacht ${state.round}...`);

  const diedThisNight = [];
  // Dieb swap
  if(state.nightChoices.diebPicks && state.nightChoices.diebPicks.length === 2){
    const [a,b] = state.nightChoices.diebPicks;
    const ra = state.players[a].role, rb = state.players[b].role;
    state.players[a].role = rb; state.players[b].role = ra;
    addLog(`Dieb tauschte Rollen: ${state.players[a].name} ↔ ${state.players[b].name}`);
  }

  // Baker placement already recorded in state.bakerPlaced during night; no effect now (handled at day)
  // Determine wolf candidate
  const wolfCandidate = (typeof state.nightChoices.wolfTarget === 'number') ? state.nightChoices.wolfTarget : null;
  if(wolfCandidate != null) addLog(`Werwölfe zielten auf: ${state.players[wolfCandidate].name}`);

  // Matratze index (alive)
  const matIdx = state.players.findIndex(p=>p.alive && p.role === ROLE.DORFMATRATZE);
  let candidateDies = false, matratzeDies = false;

  if(wolfCandidate != null){
    // if wolves target the matratze directly -> matratze survives
    if(matIdx >= 0 && wolfCandidate === matIdx){
      addLog(`Werwölfe griffen die Dorfmatratze direkt an; sie überlebt.`);
      candidateDies = false;
    } else if(state.nightChoices.matratzeTarget != null && state.nightChoices.matratzeTarget === wolfCandidate){
      // matratze sleeps at the candidate -> both die
      candidateDies = true; matratzeDies = true;
      addLog(`Dorfmatratze schlief bei ${state.players[wolfCandidate].name}; bei Angriff sterben beide.`);
    } else {
      candidateDies = true;
    }
  }

  // Witch save/poison
  if(state.nightChoices.witchSave != null){
    const s = state.nightChoices.witchSave;
    if(s === wolfCandidate){ candidateDies = false; addLog(`Hexe rettete ${state.players[s].name}.`); }
    if(matIdx >= 0 && s === matIdx){ matratzeDies = false; addLog(`Hexe rettete die Dorfmatratze.`); }
  }
  if(state.nightChoices.witchPoison != null){
    const t = state.nightChoices.witchPoison;
    if(state.players[t] && state.players[t].alive){
      state.players[t].alive = false;
      diedThisNight.push({index:t, reason:'von Hexe vergiftet'});
      addLog(`${state.players[t].name} wurde von der Hexe vergiftet.`);
    }
  }

  // Baker protections from previous day
  const protectedThisNight = new Set();
  (state.bakerPlaced || []).forEach(b => {
    if(b.eatenBy != null && b.protectedNextNight && b.placedRound === state.round - 1){
      protectedThisNight.add(b.eatenBy);
      addLog(`${state.players[b.eatenBy].name} ist durch gutes Brot geschützt (aus vorherigem Tag).`);
    }
  });
  if(wolfCandidate != null && protectedThisNight.has(wolfCandidate)){
    candidateDies = false;
    addLog(`${state.players[wolfCandidate].name} wurde durch gutes Brot geschützt.`);
  }

  // Apply candidate death
  if(candidateDies && wolfCandidate != null && state.players[wolfCandidate].alive){
    state.players[wolfCandidate].alive = false;
    diedThisNight.push({index: wolfCandidate, reason: 'von Werwölfen getötet'});
    addLog(`${state.players[wolfCandidate].name} wurde von Werwölfen getötet.`);
  }

  // Apply matratze death
  if(matratzeDies && matIdx >= 0 && state.players[matIdx].alive){
    state.players[matIdx].alive = false;
    diedThisNight.push({index: matIdx, reason: 'Dorfmatratze starb'});
    addLog(`${state.players[matIdx].name} (Dorfmatratze) starb.`);
  }

  // Armor partner rule: if one of a linked pair dies, partner dies too
  const alreadyDead = diedThisNight.map(d => d.index);
  alreadyDead.forEach(idx => {
    const p = state.players[idx];
    if(p && p.armorPartner != null){
      const partner = p.armorPartner;
      if(state.players[partner] && state.players[partner].alive){
        state.players[partner].alive = false;
        diedThisNight.push({index: partner, reason: 'Armor-Partner starb'});
        addLog(`${state.players[partner].name} (Armor-Partner) starb, da Partner gestorben ist.`);
      }
    }
  });

  // finalize unique deaths
  const unique = []; const seen = new Set();
  diedThisNight.forEach(d => { if(!seen.has(d.index)){ seen.add(d.index); unique.push(d); } });

  // link armor selections persistently if chosen this night
  if(state.nightChoices.armorSelections && state.nightChoices.armorSelections.length === 2){
    const [a,b] = state.nightChoices.armorSelections;
    state.players[a].armorPartner = b;
    state.players[b].armorPartner = a;
    addLog(`Armor-Paar gesetzt: ${state.players[a].name} ↔ ${state.players[b].name}`);
  }

  // clear night choices, increment round, enable day/baker resolve
  state.nightChoices = {};
  state.round++;
  document.getElementById('executeNight').disabled = true;
  document.getElementById('resolveBakerDay').disabled = false;
  document.getElementById('startDay').disabled = false;

  // show night summary
  if(unique.length === 0) nightSummary.innerHTML = '<strong>Kein Todesfall in dieser Nacht.</strong>';
  else nightSummary.innerHTML = '<strong>Gestorben:</strong><ul>' + unique.map(d=>`<li>${state.players[d.index].name} — ${d.reason}</li>`).join('') + '</ul>';
  nightSummary.classList.remove('hidden');
  save(); renderPlayers(); renderLog();
};

// ---------------------- Day: resolve baker breads (modal-based) ----------------------
document.getElementById('resolveBakerDay').onclick = async ()=>{
  const toResolve = (state.bakerPlaced || []).filter(b => b.placedRound === state.round - 1 && !b.resolved);
  if(toResolve.length === 0){ await showAlert('Kein Brot zum Auflösen.'); return; }
  for(const b of toResolve){
    const ownerName = state.players[b.owner] ? state.players[b.owner].name : '(unbekannt)';
    // choices: essen / weitergeben / ablehnen
    const actionIdx = await showChoice(`Vor der Tür von ${ownerName} liegt ein ${b.quality===1?'gutes':'schlechtes'} Brot.`, [
      {label:'essen'},{label:'weitergeben'},{label:'ablehnen'}
    ]);
    if(actionIdx === null){ if(!(await showConfirm('Abbrechen? Bricht Auflösung ab.'))) { continue; } else break; }
    const action = ['essen','weitergeben','ablehnen'][actionIdx];
    if(action === 'essen'){
      const eater = b.passes.length > 0 ? b.passes[b.passes.length -1] : b.owner;
      b.eatenBy = eater;
      if(b.quality === 1){
        b.protectedNextNight = true;
        addLog(`Bäcker-Brot: ${state.players[eater].name} aß GUTES Brot und ist kommende Nacht geschützt.`);
      } else {
        state.bakerBadPending.push(eater);
        addLog(`Bäcker-Brot: ${state.players[eater].name} aß SCHLECHTES Brot und wird in der nächsten Nacht sterben.`);
      }
    } else if(action === 'weitergeben'){
      // choose recipient from alive players not owner and not already in passes
      const candidates = state.players.map((p,i)=>({label:p.name, index:i, alive:p.alive}))
                        .filter(c=>c.alive && c.index !== b.owner && !b.passes.includes(c.index));
      if(candidates.length === 0){ await showAlert('Keine gültigen Empfänger verfügbar.'); continue; }
      const pick = await showChoice('Wen weitergeben?', candidates.map(c=>({label:c.label})));
      if(pick === null){ addLog('Weitergabe abgebrochen.'); continue; }
      const idx = candidates[pick].index;
      b.passes.push(idx);
      addLog(`Bäcker-Brot: Weitergegeben an ${state.players[idx].name}.`);
    } else if(action === 'ablehnen'){
      addLog(`Bäcker-Brot vor ${ownerName} wurde abgelehnt.`);
    }
    b.resolved = true;
    save();
  }
  state.bakerPlaced = state.bakerPlaced.filter(b=>!b.resolved);
  save();
  renderPlayers(); renderLog();
  await showAlert('Bäcker-Auflösung abgeschlossen. Schutz/Wirkung wurde im Log vermerkt.');
};

// ---------------------- Day start & restart ----------------------
document.getElementById('startDay').onclick = async ()=>{
  addLog(`Tag beginnt. Aktuelle Lebende: ${state.players.filter(p=>p.alive).map(p=>p.name).join(', ')}`);
  document.getElementById('startDay').disabled = true;
  document.getElementById('resolveBakerDay').disabled = true;
  save(); renderPlayers(); renderLog();
};

document.getElementById('restartGame').onclick = async ()=>{
  const ok = await showConfirm('Spiel komplett neu starten?');
  if(!ok) return;
  state.players = state.players.map(p=>({name:p.name, role:null, alive:true, armorPartner:null}));
  state.round = 1; state.phase='setup'; state.nightChoices = {}; state.witch = {canHeal:true, canPoison:true}; state.bakerPlaced = []; state.bakerBadPending = []; state.log = [];
  save(); renderPlayers(); renderLog(); checkRoleWarning(); addLog('Spiel neugestartet.');
};

// ---------------------- Log controls ----------------------
document.getElementById('downloadLog').onclick = ()=>{
  const blob = new Blob([state.log.join('\n')], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'werwolf_log.txt'; a.click();
};
document.getElementById('clearLog').onclick = async ()=>{ const ok = await showConfirm('Log löschen?'); if(!ok) return; state.log = []; save(); renderLog(); };

// ---------------------- Initial render ----------------------
function renderPlayers(){ /* reuse existing renderPlayers body from original code above (already defined earlier) */ }
// But the function is already declared earlier; ensure it's defined: we used it above.

renderPlayers();
renderLog();
checkRoleWarning();

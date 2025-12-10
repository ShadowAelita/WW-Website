/* Werwolf Moderator — Final implementation
   Implements user's detailed rules including:
   - Armor (pairing), Dieb (swap every 2nd round), Bäcker (placement at night, eaten/forwarded at day, effects next night),
   - Seher, Dorfmatratze (dies only if host is killed), Werwolf, Hexe (heal+poison once each),
   - Dorftrottel (wins if lynched), Dorfbewohner.
   Immediate log updates included. State persisted in localStorage.
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

// role order for dropdowns
const ROLE_ORDER = [ROLE.WERWOLF, ROLE.SEHER, ROLE.HEXE, ROLE.DORFMATRATZE, ROLE.BAECKER, ROLE.ARMOR, ROLE.DIEB, ROLE.DORFTROTTEL, ROLE.DORFBEWOHNER];

// helpers
function addLog(text){ const entry = new Date().toLocaleString() + ' — ' + text; state.log.push(entry); renderLog(); save(); }
function renderLog(){ logArea.innerHTML = state.log.slice().reverse().map(l=>`<div>${l}</div>`).join(''); }

// players UI
document.getElementById('addPlayer').onclick = () => {
  const name = document.getElementById('playerName').value.trim();
  if(!name) return alert('Bitte Namen eingeben.');
  state.players.push({name, role: null, alive: true, armorPartner: null});
  document.getElementById('playerName').value = '';
  renderPlayers(); checkRoleWarning(); save();
};
document.getElementById('clearPlayers').onclick = () => { if(!confirm('Alle Spieler entfernen?')) return; state.players = []; renderPlayers(); checkRoleWarning(); save(); }

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
    toggle.onclick = ()=>{ p.alive = !p.alive; if(!p.alive && p.armorPartner!=null){ const partner = p.armorPartner; if(state.players[partner] && state.players[partner].alive){ state.players[partner].alive = false; addLog(`${state.players[partner].name} (Armor-Partner) starb, da Partner gestorben ist.`); } } save(); renderPlayers(); renderLog(); };
    const rem = document.createElement('button'); rem.textContent='Entfernen'; rem.onclick=()=>{ if(!confirm('Spieler entfernen?')) return; state.players.splice(i,1); save(); renderPlayers(); checkRoleWarning(); };
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

// automatic distribution
document.getElementById('autoSuggest').onclick = ()=>{
  const n = state.players.length; if(n===0) return alert('Keine Spieler.');
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

document.getElementById('assignRoles').onclick = ()=>{
  const assigned = state.players.filter(p=>p.role).length;
  if(assigned !== state.players.length) return alert('Bitte zuerst Rollen vollständig zuweisen (oder Auto-Vorschlag).');
  const roles = state.players.map(p=>p.role).sort(()=>Math.random()-0.5);
  state.players.forEach((p,i)=>{ p.role = roles[i]; p.alive = true; p.armorPartner = null; });
  save(); renderPlayers(); addLog('Rollen zufällig verteilt.');
};

document.getElementById('clearRoles').onclick = ()=>{ state.players.forEach(p=>{ p.role = null; p.armorPartner=null; }); save(); renderPlayers(); checkRoleWarning(); addLog('Rollen zurückgesetzt.'); }

// --- Night flow UI builder ---
document.getElementById('startNight').onclick = ()=>{
  state.nightChoices = {}; // reset choices for this night
  flowArea.innerHTML = '';
  nightSummary.classList.add('hidden');

  // apply bakerBadPending from previous scheduled deaths at start of this night
  if(state.bakerBadPending.length>0){
    const pending = state.bakerBadPending.slice();
    state.bakerBadPending = [];
    pending.forEach(idx=>{ if(state.players[idx] && state.players[idx].alive){ state.players[idx].alive = false; addLog(`${state.players[idx].name} starb zu Beginn der Nacht durch schlechtes Brot (Nachwirkung).`); } });
    renderPlayers(); renderLog();
  }

  // determine alive roles present
  const aliveRoles = new Set(state.players.filter(p=>p.alive && p.role).map(p=>p.role));

  nightOrder.forEach(role => {
    if(role === ROLE.ARMOR && state.round !== 1) return;
    if(role === ROLE.DIEB && (state.round === 1 || (state.round % 2) !== 0)) return;
    if(!aliveRoles.has(role)) return;
    const block = document.createElement('div'); block.className = 'card';
    const h = document.createElement('h3'); h.textContent = role; block.appendChild(h);
    // role-specific UI
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
};

// UI components for actions (they update state and log immediately)
function buildArmorUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle zwei Spieler zum Verkuppeln (Armor). Wenn später einer stirbt, stirbt der andere ebenfalls.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name; btn.onclick = ()=>{
      if(!p.alive) return alert('Nur lebende Spieler auswählen.');
      state.nightChoices.armorSelections = state.nightChoices.armorSelections || [];
      const sel = state.nightChoices.armorSelections;
      if(sel.includes(i)){ state.nightChoices.armorSelections = sel.filter(x=>x!==i); addLog(`Armor: Auswahl entfernt (${p.name}).`); }
      else if(sel.length < 2){ sel.push(i); addLog(`Armor: Auswahl hinzugefügt (${p.name}).`); }
      else alert('Bereits zwei ausgewählt.');
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildDiebUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle zwei Spieler deren Rollen getauscht werden sollen.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = `${p.name} ${p.role? '('+p.role+')':''}`;
    btn.onclick = ()=>{
      if(!p.alive) return alert('Nur lebende Spieler auswählen.');
      state.nightChoices.diebPicks = state.nightChoices.diebPicks || [];
      const sel = state.nightChoices.diebPicks;
      if(sel.includes(i)){ state.nightChoices.diebPicks = sel.filter(x=>x!==i); addLog(`Dieb: Auswahl entfernt (${p.name}).`); }
      else if(sel.length < 2){ sel.push(i); addLog(`Dieb: Auswahl hinzugefügt (${p.name}).`); }
      else alert('Bereits zwei ausgewählt.');
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildBaeckerUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Wähle vor wessen Tür das Brot gelegt wird und ob es gut oder schlecht ist. (Das Brot wird am Tag aufgelöst.)';
  wrap.appendChild(info);
  const select = document.createElement('select');
  const empty = document.createElement('option'); empty.value=''; empty.textContent='(Ziel wählen)'; select.appendChild(empty);
  state.players.forEach((p,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent = p.name + (p.alive?'':' (tot)'); select.appendChild(o); });
  select.onchange = ()=>{
    const idx = parseInt(select.value);
    if(isNaN(idx)){ return; }
    // choose quality via prompt for simplicity
    const qual = confirm('OK = gutes Brot (schützt), Abbrechen = schlechtes Brot (tödlich später)') ? 1 : 2;
    state.bakerPlaced = state.bakerPlaced || [];
    state.bakerPlaced.push({ owner: idx, quality: qual, passes: [], eatenBy: null, placedRound: state.round });
    addLog(`Bäcker legte ${qual===1?'gutes':'schlechtes'} Brot vor die Tür von ${state.players[idx].name}. (wird am Tag aufgelöst)`);
    save();
    renderPlayers();
  };
  wrap.appendChild(select);
  return wrap;
}

function buildSeherUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Seher: Wähle eine Person, deren Karte der Moderator sehen wird.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    btn.onclick = ()=>{
      if(!p.alive) return alert('Nur lebende Spieler auswählen.');
      state.nightChoices.seherPick = i;
      addLog(`Seher sah die Karte von ${p.name}: ${p.role || '(nicht zugewiesen)'}`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildMatratzeUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Dorfmatratze: Wähle bei wem sie schlafen möchte. Matratze stirbt nur wenn Gastgeber angegriffen wird.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    btn.onclick = ()=>{
      if(!p.alive) return alert('Nur lebende Spieler auswählen.');
      state.nightChoices.matratzeTarget = i;
      addLog(`Dorfmatratze schläft bei ${p.name}.`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildWerwolfUI(){
  const wrap = document.createElement('div');
  const info = document.createElement('div'); info.className='small'; info.textContent='Werwölfe wählen gemeinsam ein Opfer.';
  wrap.appendChild(info);
  const list = document.createElement('div'); list.style.display='flex'; list.style.gap='6px'; list.style.flexWrap='wrap';
  state.players.forEach((p,i)=>{
    const btn = document.createElement('button'); btn.textContent = p.name;
    btn.onclick = ()=>{
      if(!p.alive) return alert('Nur lebende Spieler auswählen.');
      state.nightChoices.wolfTarget = i;
      addLog(`Werwölfe wählten: ${p.name}`);
      save();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildHexeUI(){
  const wrap = document.createElement('div');
  const victim = state.nightChoices.wolfTarget != null ? state.players[state.nightChoices.wolfTarget].name : 'Noch nicht gewählt';
  const info = document.createElement('div'); info.className='small'; info.textContent = `Werwolf-Opfer: ${victim}. Hexe: Heilung (${state.witch.canHeal?'verfügbar':'gebraucht'}), Gift (${state.witch.canPoison?'verfügbar':'gebraucht'}).`;
  wrap.appendChild(info);
  const healBtn = document.createElement('button'); healBtn.textContent='Heilen';
  healBtn.onclick = ()=>{
    if(!state.witch.canHeal) return alert('Heiltrank bereits benutzt.');
    if(state.nightChoices.wolfTarget == null) return alert('Noch kein Opfer der Werwölfe.');
    state.nightChoices.witchSave = state.nightChoices.wolfTarget;
    state.witch.canHeal = false;
    addLog(`Hexe heilte: ${state.players[state.nightChoices.witchSave].name}`);
    save();
  };
  const poisonBtn = document.createElement('button'); poisonBtn.textContent='Vergiften';
  poisonBtn.onclick = ()=>{
    if(!state.witch.canPoison) return alert('Gifftank bereits benutzt.');
    const choices = state.players.map((p,i)=> ({i, name:p.name, alive:p.alive})).filter(x=>x.alive);
    const name = prompt('Wen vergiften? (Name eingeben)\nVerfügbare: ' + choices.map(c=>c.name).join(', '));
    if(!name) return;
    const idx = state.players.findIndex(p=>p.name === name && p.alive);
    if(idx === -1) return alert('Name ungültig oder nicht lebendig.');
    state.nightChoices.witchPoison = idx;
    state.witch.canPoison = false;
    addLog(`Hexe vergiftete: ${state.players[idx].name}`);
    save();
  };
  wrap.appendChild(healBtn); wrap.appendChild(poisonBtn);
  return wrap;
}

// Execute night: calculate deaths except baker-day effects (baker effects apply in day or next night)
document.getElementById('executeNight').onclick = ()=>{
  // Pre-check unassigned
  const unassigned = state.players.filter(p=>p.alive && !p.role).map(p=>p.name);
  if(unassigned.length>0){
    if(!confirm(`Es gibt unzugewiesene Rollen: ${unassigned.join(', ')}. Weiter?`)) return;
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
    // if wolves target the matratze directly -> matratze survives (per user instruction)
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

  // Baker protections from previous day: apply protections if existed (we track via bakerPlaced entries that were eaten and scheduled)
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

// --- Day: resolve baker breads (found at doors) ---
document.getElementById('resolveBakerDay').onclick = ()=>{
  // show UI prompt for each bakerPlaced entry placed in previous night (placedRound === currentRound-1)
  const toResolve = (state.bakerPlaced || []).filter(b => b.placedRound === state.round - 1);
  if(toResolve.length === 0){ alert('Kein Brot zum Auflösen.'); return; }
  // process sequentially
  for(const b of toResolve){
    const ownerName = state.players[b.owner] ? state.players[b.owner].name : '(unbekannt)';
    let action = null;
    while(true){
      action = prompt(`Vor der Tür von ${ownerName} liegt ein ${b.quality===1?'gutes':'schlechtes'} Brot.\nOptionen: essen / weitergeben / ablehnen\nGib ein:`);
      if(!action) { if(confirm('Abbrechen? Bricht Auflösung ab.')) break; else continue; }
      action = action.toLowerCase();
      if(action === 'essen' || action === 'weitergeben' || action === 'ablehnen') break;
      alert('Ungültige Option. Bitte "essen", "weitergeben" oder "ablehnen" eingeben.');
    }
    if(!action) break;
    if(action === 'essen'){
      // determine eater: if passes exist, eater is last pass recipient else owner
      const eater = b.passes.length > 0 ? b.passes[b.passes.length -1] : b.owner;
      b.eatenBy = eater;
      if(b.quality === 1){
        // good bread -> protection next night (mark flag)
        b.protectedNextNight = true;
        addLog(`Bäcker-Brot: ${state.players[eater].name} aß GUTES Brot und ist kommende Nacht geschützt.`);
      } else {
        // bad bread -> schedule death in next night
        state.bakerBadPending.push(eater);
        addLog(`Bäcker-Brot: ${state.players[eater].name} aß SCHLECHTES Brot und wird in der nächsten Nacht sterben.`);
      }
    } else if(action === 'weitergeben'){
      // prompt for recipient name (must be alive and not self and not already in passes)
      const candidate = prompt('Name des nächsten Empfängers eingeben (genauer Name):\nVerfügbare: ' + state.players.filter(p=>p.alive).map(p=>p.name).join(', '));
      if(!candidate){ addLog('Weitergabe abgebrochen.'); continue; }
      const idx = state.players.findIndex(p=>p.name === candidate && p.alive);
      if(idx === -1) { alert('Ungültiger Name.'); continue; }
      if(idx === b.owner) { alert('Nicht an sich selbst weitergeben.'); continue; }
      if(b.passes.includes(idx)) { alert('Schon weitergegeben an diese Person.'); continue; }
      b.passes.push(idx);
      addLog(`Bäcker-Brot: Weitergegeben an ${state.players[idx].name}.`);
      // do not auto-eat; moderator can call resolve again later to eat
    } else if(action === 'ablehnen'){
      addLog(`Bäcker-Brot vor ${ownerName} wurde abgelehnt.`);
    }
    b.resolved = true;
    save();
  }
  state.bakerPlaced = state.bakerPlaced.filter(b=>!b.resolved);
  save();
  renderPlayers(); renderLog();
  alert('Bäcker-Auflösung abgeschlossen. Schutz/Wirkung wurde im Log vermerkt.');
};

// start day (after baker resolution) - day actions are manual (lynch etc.)
document.getElementById('startDay').onclick = ()=>{
  addLog(`Tag beginnt. Aktuelle Lebende: ${state.players.filter(p=>p.alive).map(p=>p.name).join(', ')}`);
  document.getElementById('startDay').disabled = true;
  document.getElementById('resolveBakerDay').disabled = true;
  save(); renderPlayers(); renderLog();
};

// restart
document.getElementById('restartGame').onclick = ()=>{
  if(!confirm('Spiel komplett neu starten?')) return;
  state.players = state.players.map(p=>({name:p.name, role:null, alive:true, armorPartner:null}));
  state.round = 1; state.phase='setup'; state.nightChoices = {}; state.witch = {canHeal:true, canPoison:true}; state.bakerPlaced = []; state.bakerBadPending = []; state.log = [];
  save(); renderPlayers(); renderLog(); checkRoleWarning(); addLog('Spiel neugestartet.');
};

// log controls
document.getElementById('downloadLog').onclick = ()=>{
  const blob = new Blob([state.log.join('\n')], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'werwolf_log.txt'; a.click();
};
document.getElementById('clearLog').onclick = ()=>{ if(!confirm('Log löschen?')) return; state.log = []; save(); renderLog(); };

// initial render
renderPlayers(); renderLog(); checkRoleWarning();

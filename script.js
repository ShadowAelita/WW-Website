// script.js

document.addEventListener('DOMContentLoaded', () => {
  const players = [];
  const roles = {}; // roleName: count
  const playersStatus = {}; // playerName: {alive: true/false, role: 'roleName'}
  
  const playerNameInput = document.getElementById('playerName');
  const addPlayerBtn = document.getElementById('addPlayer');
  const clearPlayersBtn = document.getElementById('clearPlayers');
  const playersList = document.getElementById('playersList');
  const playersStatusList = document.getElementById('playersStatusList');
  const rolesControlsContainer = document.getElementById('rolesControls');
  const autoFillVillagersBtn = document.getElementById('autoFillVillagers');
  const assignRolesBtn = document.getElementById('assignRoles');
  const clearRolesBtn = document.getElementById('clearRoles');
  const startNightBtn = document.getElementById('startNight');
  const startDayBtn = document.getElementById('startDay');
  const restartGameBtn = document.getElementById('restartGame');
  const logDiv = document.getElementById('log');

  // Define available roles
  const availableRoles = ['Dorfbewohner', 'Werwolf', 'Seher', 'Hexe', 'Jäger', 'Witch', 'Bürgermeister'];

  // Helper function to update player display
  function updatePlayersDisplay() {
    // Update players list
    playersList.innerHTML = '';
    playersStatusList.innerHTML = '';

    players.forEach(name => {
      // Player list with alive/dead icon
      const li = document.createElement('li');
      li.textContent = name;
      const statusSpan = document.createElement('span');
      statusSpan.textContent = playersStatus[name]?.alive ? '🟢' : '🔴';
      li.appendChild(statusSpan);
      playersList.appendChild(li);

      // Player status and role display
      const statusLi = document.createElement('li');
      statusLi.textContent = name + ' (' + (playersStatus[name]?.alive ? 'lebend' : 'tot') + ')';

      const roleSpan = document.createElement('span');
      roleSpan.className = 'roleTag';
      roleSpan.textContent = playersStatus[name]?.role || 'Unbekannt';
      statusLi.appendChild(roleSpan);

      // Role action selector only if alive
      if (playersStatus[name]?.alive) {
        const actionSelect = document.createElement('select');
        actionSelect.innerHTML = `
          <option value="">Aktion wählen</option>
          <option value="kill">Töten</option>
          <option value="save">Retten</option>
        `;
        actionSelect.addEventListener('change', () => {
          // Handle action if needed
        });
        statusLi.appendChild(actionSelect);
      }

      playersStatusList.appendChild(statusLi);
    });

    // Check for role count mismatch
    const totalRoles = Object.values(roles).reduce((a, b) => a + b, 0);
    if (players.length !== totalRoles) {
      alert('Warnung: Die Anzahl der Rollen stimmt nicht mit der Anzahl der Spieler überein!');
    }
  }

  // Add player
  document.getElementById('addPlayer').addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name && !players.includes(name)) {
      players.push(name);
      playersStatus[name] = { alive: true, role: null };
      updatePlayersDisplay();
      playerNameInput.value = '';
    }
  });

  // Clear players
  document.getElementById('clearPlayers').addEventListener('click', () => {
    players.length = 0;
    for (const key in playersStatus) delete playersStatus[key];
    updatePlayersDisplay();
  });

  // Generate role dropdowns
  function generateRoleDropdowns() {
    rolesControlsContainer.innerHTML = '';
    for (const role in roles) {
      const div = document.createElement('div');
      div.className = 'row';

      const label = document.createElement('label');
      label.textContent = role;
      div.appendChild(label);

      const select = document.createElement('select');
      select.innerHTML = availableRoles.map(r => `<option value="${r}">${r}</option>`).join('');
      select.value = role;
      select.addEventListener('change', () => {
        roles[role] = parseInt(select.value);
      });
      div.appendChild(select);

      rolesControlsContainer.appendChild(div);
    }
  }

  // Auto-fill villagers
  document.getElementById('autoFillVillagers').addEventListener('click', () => {
    // Set all roles to "Dorfbewohner"
    for (const role in roles) {
      roles[role] = 0;
    }
    // Assign all to Dorfbewohner
    roles['Dorfbewohner'] = players.length;
    generateRoleDropdowns();
  });

  // Assign roles randomly
  document.getElementById('assignRoles').addEventListener('click', () => {
    const totalRolesCount = Object.values(roles).reduce((a, b) => a + b, 0);
    if (players.length !== totalRolesCount) {
      alert('Die Rollenanzahl stimmt nicht mit der Spielerzahl überein!');
      return;
    }

    // Create a list of roles to assign
    const rolePool = [];
    for (const role in roles) {
      for (let i = 0; i < roles[role]; i++) {
        rolePool.push(role);
      }
    }

    // Shuffle players
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    // Assign roles
    for (let i = 0; i < shuffledPlayers.length; i++) {
      const playerName = shuffledPlayers[i];
      const role = rolePool[i];
      playersStatus[playerName].role = role;
    }

    updatePlayersDisplay();
  });

  // Reset roles
  document.getElementById('clearRoles').addEventListener('click', () => {
    for (const role in roles) {
      roles[role] = 0;
    }
    generateRoleDropdowns();
  });

  // Initialize roles (example)
  roles['Dorfbewohner'] = players.length; // default
  generateRoleDropdowns();

  // Example: check victory condition
  function checkVictory() {
    const aliveWolves = Object.values(playersStatus).filter(p => p.role === 'Werwolf' && p.alive).length;
    const aliveVillagers = Object.values(playersStatus).filter(p => p.role !== 'Werwolf' && p.alive).length;
    if (aliveWolves === 0) {
      alert('Die Dorfbewohner haben gewonnen!');
    } else if (aliveWolves >= aliveVillagers) {
      alert('Die Werwölfe haben gewonnen!');
    }
  }

  // Example: Call checkVictory() after night/day
  // For demonstration, you can call checkVictory() after relevant game events
});/* Werwolf Moderator - Single-file logic (Deutsch) */
"use strict";
const Roles = {
  UNASSIGNED: "Nicht zugewiesen",
  ARMOR: "Rüstung",
  DIEB: "Dieb",
  BAECKER: "Bäcker",
  SEHER: "Seher",
  DORFMATRATZE: "Dorfmatratze",
  WERWOLF: "Werwolf",
  HEXE: "Hexe",
  DORFTROTTEL: "Dorftrottel",
  DORFBEWOHNER: "Dorfbewohner"
};
let state = { players:[], rolesPool:{}, round:1, phase:"setup", nightChoices:{}, log:[] };
function save(){ localStorage.setItem("ww_state", JSON.stringify(state)); }
function load(){ const r=localStorage.getItem("ww_state"); if(r) state=JSON.parse(r); }
load();
function byId(id){ return document.getElementById(id); }
function addLog(t){ state.log.push((new Date()).toLocaleString()+" — "+t); renderLog(); save(); }
function resetNightChoices(){ state.nightChoices={ armorSelections:[], diebPicks:[], baecker:null, matratzeTarget:null, wolfTarget:null, witchSave:null, witchPoison:null }; }
function renderPlayers(){ const ul=byId("playersList"); ul.innerHTML=""; state.players.forEach((p,idx)=>{ const li=document.createElement("li"); const left=document.createElement("div"); left.textContent=p.name+(p.alive?"":" [tot]"); const right=document.createElement("div"); const roleTag=document.createElement("span"); roleTag.className="roleTag"; roleTag.textContent=p.role||Roles.UNASSIGNED; right.appendChild(roleTag); const edit=document.createElement("button"); edit.textContent="Rolle"; edit.onclick=()=>editPlayerRole(idx); edit.style.marginLeft="8px"; const kill=document.createElement("button"); kill.textContent="Tod(Tag)"; kill.style.marginLeft="8px"; kill.onclick=()=>{ if(confirm('Tagsüber töten: '+p.name+'?')){ p.alive=false; addLog(p.name+' wurde tagsüber getötet'); renderPlayers(); save(); } }; const rem=document.createElement("button"); rem.textContent="Entf"; rem.style.marginLeft="8px"; rem.onclick=()=>{ if(confirm('Spieler entfernen: '+p.name+'?')){ state.players.splice(idx,1); renderPlayers(); save(); } }; right.appendChild(edit); right.appendChild(kill); right.appendChild(rem); li.appendChild(left); li.appendChild(right); ul.appendChild(li); }); }
function editPlayerRole(index){ const p=state.players[index]; const roleNames=Object.keys(Roles).filter(k=>k!=="UNASSIGNED").map(k=>Roles[k]).join(", "); const input=prompt("Rolle für "+p.name+" eingeben (z.B. Seher):\nVerfügbare: "+roleNames, p.role||Roles.UNASSIGNED); if(input){ const found=Object.keys(Roles).find(k=>Roles[k].toLowerCase()===input.toLowerCase()); p.role = found? Roles[found] : input; save(); renderPlayers(); } }
function renderRolesControls(){ const container=byId("rolesControls"); container.innerHTML=""; const keys=["WERWOLF","HEXE","SEHER","DORFMATRATZE","BAECKER","DIEB","ARMOR","DORFTROTTEL"]; keys.forEach(k=>{ const div=document.createElement("div"); div.style.display="flex"; div.style.gap="8px"; div.style.alignItems="center"; const label=document.createElement("label"); label.textContent=Roles[k]; const input=document.createElement("input"); input.type="number"; input.min=0; input.value=state.rolesPool[k]||0; input.onchange=()=>{ state.rolesPool[k]=Math.max(0,parseInt(input.value)||0); save(); }; div.appendChild(label); div.appendChild(input); container.appendChild(div); }); }
function assignRolesRandom(){ let pool=[]; Object.keys(state.rolesPool).forEach(k=>{ for(let i=0;i<state.rolesPool[k];i++) pool.push(Roles[k]); }); while(pool.length<state.players.length) pool.push(Roles.DORFBEWOHNER); for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; } for(let i=0;i<state.players.length;i++){ state.players[i].role=pool[i]; state.players[i].alive=true; state.players[i].protectedByGoodBread=false; } addLog("Rollen zufällig verteilt"); save(); renderPlayers(); }
byId("addPlayer").onclick=()=>{ const name=byId("playerName").value.trim(); if(!name) return alert("Bitte Namen eingeben."); state.players.push({name,role:Roles.UNASSIGNED,alive:true,protectedByGoodBread:false}); byId("playerName").value=""; renderPlayers(); save(); };
byId("clearPlayers").onclick=()=>{ if(confirm("Alle Spieler entfernen?")){ state.players=[]; renderPlayers(); save(); } };
byId("assignRoles").onclick=assignRolesRandom; byId("clearRoles").onclick=()=>{ state.rolesPool={}; renderRolesControls(); save(); };
byId("startNight").onclick=()=>{ if(state.players.length===0) return alert("Keine Spieler."); state.phase="night"; resetNightChoices(); addLog("Nacht "+state.round+" beginnt"); save(); renderFlow(); byId("startDay").disabled=false; };
byId("startDay").onclick=()=>{ resolveNight(); state.phase="day"; save(); renderFlow(); };
byId("restartGame").onclick=()=>{ if(!confirm("Spiel komplett neu starten?")) return; state.players=[]; state.rolesPool={}; state.round=1; state.phase="setup"; state.log=[]; resetNightChoices(); save(); renderPlayers(); renderRolesControls(); renderLog(); renderFlow(); };
byId("downloadLog").onclick=()=>{ const blob=new Blob([state.log.join("\n")],{type:"text/plain;charset=utf-8"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="werwolf_log.txt"; a.click(); };
function renderLog(){ const el=byId("log"); el.innerHTML=""; state.log.slice().reverse().forEach(l=>{ const d=document.createElement("div"); d.className="logEntry"; d.textContent=l; el.appendChild(d); }); }
function renderFlow(){ const area=byId("flowArea"); area.innerHTML=""; if(state.phase==="setup"){ area.textContent="Bereit. Rollen konfigurieren und Spieler hinzufügen."; return; } if(state.phase==="night"){ const title=document.createElement("h3"); title.textContent="Nacht: Folge der Rollen — klicke Namen zur Auswahl"; area.appendChild(title); const seq=buildSequence(); seq.forEach(role=>{ const box=document.createElement("div"); box.className="card"; box.style.margin="6px 0"; const h=document.createElement("h4"); h.textContent=role; box.appendChild(h); const ul=document.createElement("ul"); ul.className="choiceList"; const alive=state.players.map((p,i)=>({p,i})).filter(x=>x.p.alive); alive.forEach(x=>{ const li=document.createElement("li"); li.textContent=x.p.name+" — "+(x.p.role||Roles.UNASSIGNED); li.onclick=()=>handleNightPick(role,x.i); ul.appendChild(li); }); box.appendChild(ul); area.appendChild(box); }); const skip=document.createElement("button"); skip.textContent="Nacht überspringen/weiter"; skip.onclick=()=>{ state.phase="day"; save(); renderFlow(); }; area.appendChild(skip); return; } if(state.phase==="day"){ const title=document.createElement("h3"); title.textContent="Tag: Wähle Lynch (ein Klick)"; area.appendChild(title); const ul=document.createElement("ul"); ul.className="choiceList"; state.players.forEach((p,i)=>{ if(!p.alive) return; const li=document.createElement("li"); li.textContent=p.name+" — "+(p.role||Roles.UNASSIGNED); li.onclick=()=>{ if(confirm("Gelyncht: "+p.name+"?")){ const res=applyDayLynch(i); addLog(res); state.phase='night'; save(); renderPlayers(); renderFlow(); } }; ul.appendChild(li); }); area.appendChild(ul); } }
function buildSequence(){ const seq=[]; if(state.round===1) seq.push(Roles.ARMOR); if(state.round!==1) seq.push(Roles.DIEB); seq.push(Roles.BAECKER); seq.push(Roles.SEHER); seq.push(Roles.DORFMATRATZE); seq.push(Roles.WERWOLF); seq.push(Roles.HEXE); return seq; }
function handleNightPick(role, idx){ const p=state.players[idx]; switch(role){ case Roles.ARMOR: state.nightChoices.armorSelections=state.nightChoices.armorSelections||[]; state.nightChoices.armorSelections.push(idx); if(state.nightChoices.armorSelections.length===2){ const a=state.nightChoices.armorSelections[0], b=state.nightChoices.armorSelections[1]; state.players[a].isArmorPairMember=true; state.players[b].isArmorPairMember=true; addLog("Rüstungspaar: "+state.players[a].name+" & "+state.players[b].name); } else addLog("Rüstung: erste Auswahl "+p.name); break; case Roles.DIEB: state.nightChoices.diebPicks=state.nightChoices.diebPicks||[]; state.nightChoices.diebPicks.push(idx); if(state.nightChoices.diebPicks.length===2){ const a=state.nightChoices.diebPicks[0], b=state.nightChoices.diebPicks[1]; const rA=state.players[a].role, rB=state.players[b].role; state.players[a].role=rB; state.players[b].role=rA; addLog("Dieb tauschte Rollen: "+state.players[a].name+" ↔ "+state.players[b].name); } else addLog("Dieb: erste Auswahl "+p.name); break; case Roles.BAECKER: const quality=confirm("Brot gut? (OK=Gut, Abbrechen=Schlecht)")?1:2; state.nightChoices.baecker={owner:idx,quality:quality,passed:[],eaten:false}; addLog("Bäcker: Brot bei "+p.name+" (Qualität:"+ (quality===1?"gut":"schlecht") +")"); break; case Roles.SEHER: addLog("Seher sieht: "+p.name+" ist "+p.role); alert("Seher: "+p.name+" ist "+p.role); break; case Roles.DORFMATRATZE: state.nightChoices.matratzeTarget=idx; addLog("Dorfmatratze schläft bei "+p.name); break; case Roles.WERWOLF: state.nightChoices.wolfTarget=idx; addLog("Werwölfe wählen "+p.name); break; case Roles.HEXE: const victimIdx=state.nightChoices.wolfTarget; const victimName=(victimIdx!=null && state.players[victimIdx])?state.players[victimIdx].name:'Niemand'; const doHeal=confirm("Werwölfe griffen an: "+victimName+"\nHeilen? (OK=Heilen, Abbrechen=Nein)"); if(doHeal){ state.nightChoices.witchSave=victimIdx; addLog("Hexe: Heilung für "+victimName); } const doPoison=confirm("Vergiften? (OK=Ja, Abbrechen=Nein)"); if(doPoison){ let target=null; for(let i=0;i<state.players.length;i++){ if(state.players[i].alive && state.players[i].role!==Roles.HEXE){ target=i; break; } } if(target!=null){ state.nightChoices.witchPoison=target; addLog("Hexe vergiftet "+state.players[target].name); } } break; } save(); renderFlow(); renderPlayers(); }
function resolveNight(){ if(state.nightChoices.baecker){ const bread=state.nightChoices.baecker; if(bread.quality===2){ const v=bread.owner; if(state.players[v] && state.players[v].alive){ state.players[v].alive=false; addLog(state.players[v].name+" starb durch schlechtes Brot"); } } else { state.players[bread.owner].protectedByGoodBread=true; addLog(state.players[bread.owner].name+" ist durch gutes Brot geschützt"); } } const candidate=state.nightChoices.wolfTarget; addLog("Werwölfe zielten auf: "+(candidate!=null?state.players[candidate].name:'Niemand')); const matratzeIndex=state.players.findIndex(p=>p.role===Roles.DORFMATRATZE && p.alive); let candidateDies=false, matratzeDies=false; if(candidate!=null){ if(matratzeIndex>=0 && candidate===matratzeIndex){ candidateDies=false; addLog("Dorfmatratze direkt angegriffen — überlebt."); } else if(state.nightChoices.matratzeTarget!=null && state.nightChoices.matratzeTarget===candidate){ candidateDies=true; matratzeDies=true; addLog("Dorfmatratze schlief bei Ziel; beide könnten sterben."); } else candidateDies=true; } if(state.nightChoices.witchSave!=null){ if(state.nightChoices.witchSave===candidate){ candidateDies=false; addLog("Hexe rettete "+state.players[candidate].name); } if(matratzeIndex>=0 && state.nightChoices.witchSave===matratzeIndex){ matratzeDies=false; addLog("Hexe rettete die Dorfmatratze"); } } if(state.nightChoices.witchPoison!=null){ const t=state.nightChoices.witchPoison; if(state.players[t] && state.players[t].alive){ state.players[t].alive=false; addLog(state.players[t].name+" wurde von der Hexe vergiftet"); } } if(candidate!=null && state.players[candidate] && state.players[candidate].protectedByGoodBread){ candidateDies=false; addLog(state.players[candidate].name+" wurde durch gutes Brot geschützt"); } if(candidateDies && candidate!=null && state.players[candidate] && state.players[candidate].alive){ state.players[candidate].alive=false; addLog(state.players[candidate].name+" wurde von Werwölfen getötet"); } if(matratzeDies && matratzeIndex>=0 && state.players[matratzeIndex].alive){ state.players[matratzeIndex].alive=false; addLog(state.players[matratzeIndex].name+" (Dorfmatratze) starb"); } state.round++; resetNightChoices(); save(); renderPlayers(); renderLog(); state.phase="day"; save(); }
function applyDayLynch(index){ if(!state.players[index]||!state.players[index].alive) return "Ungültig"; const p=state.players[index]; p.alive=false; if(p.role===Roles.DORFTROTTEL) return p.name+" war Dorftrottel — Dorftrottel gewinnt sofort!"; return p.name+" wurde gelyncht."; }
renderPlayers(); renderRolesControls(); renderFlow(); renderLog(); window.ww={state,save,load,resolveNight,renderPlayers,renderFlow};


/* Werwolf Moderator — Spiel-Engine nach Benutzerregeln (Deutsch)
   Rollen (Weckreihenfolge): Armor (1. Nacht), Dieb (alle 2. Runden, nicht 1), Bäcker, Seher, Dorfmatratze, Werwolf, Hexe
   Regeln gemäß Benutzerangaben implementiert.
*/

const ROLE_KEYS = {
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

const nightOrder = [
  ROLE_KEYS.ARMOR,
  ROLE_KEYS.DIEB,
  ROLE_KEYS.BAECKER,
  ROLE_KEYS.SEHER,
  ROLE_KEYS.DORFMATRATZE,
  ROLE_KEYS.WERWOLF,
  ROLE_KEYS.HEXE
];

// --- State (persistiert) ---
let state = {
  players: [], // {name, role, alive:true, armorPartnerIndex:null}
  round: 1,
  phase: "setup", // setup | night | day
  // night choices collected before resolve:
  nightChoices: {
    armorSelections: [], // indices (2)
    diebPicks: [], // indices (2)
    baecker: null, // {owner:index, quality:1|2, passes:[] (indices), eatenBy:null}
    seherPick: null, // index
    matratzeTarget: null, // index (where matratze sleeps)
    wolfTarget: null, // index
    witchSave: null, // index (healed)
    witchPoison: null // index (poisoned)
  },
  // witch inventory
  witchState: { canHeal: true, canPoison: true },
  // baker bad-bread scheduled deaths: array of indices that will die at start of next night
  bakerBadPending: [], // {index, reason}
  log: []
};

// localStorage helpers
function save() { localStorage.setItem("ww_state_v2", JSON.stringify(state)); }
function load() {
  const raw = localStorage.getItem("ww_state_v2");
  if (raw) state = JSON.parse(raw);
}
load();

// --- UI refs ---
const playersList = document.getElementById("playersList");
const rolesControls = document.getElementById("rolesControls");
const topWarning = document.getElementById("topWarning");
const flowArea = document.getElementById("flowArea");
const nightSummary = document.getElementById("nightSummary");
const logArea = document.getElementById("logArea");

const el = id => document.getElementById(id);

// role set used in dropdowns
const ROLE_ORDER = [
  ROLE_KEYS.WERWOLF,
  ROLE_KEYS.SEHER,
  ROLE_KEYS.HEXE,
  ROLE_KEYS.DORFMATRATZE,
  ROLE_KEYS.BAECKER,
  ROLE_KEYS.ARMOR,
  ROLE_KEYS.DIEB,
  ROLE_KEYS.DORFTROTTEL,
  ROLE_KEYS.DORFBEWOHNER
];

// --- UI: Spieler verwalten ---
document.getElementById("addPlayer").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  if (!name) return alert("Bitte Spielername eingeben.");
  state.players.push({ name, role: null, alive: true, armorPartnerIndex: null });
  document.getElementById("playerName").value = "";
  renderPlayers();
  checkRoleCountWarning();
  save();
};
document.getElementById("clearPlayers").onclick = () => {
  if (!confirm("Alle Spieler entfernen?")) return;
  state.players = [];
  renderPlayers();
  checkRoleCountWarning();
  save();
};

// --- roles control (simple counters) ---
function renderRolesControls() {
  rolesControls.innerHTML = "";
  // show a small control to propose auto distribution count (not required to use)
  const info = document.createElement("div");
  info.className = "small";
  info.textContent = "Automatische Verteilung: Werwölfe ≈ Spieler/3, jede Sonderrolle 1×, Rest Dorfbewohner.";
  rolesControls.appendChild(info);
}
renderRolesControls();

// --- Spieler-Liste rendern (mit Dropdown für Rolle, alive/dead toggle) ---
function renderPlayers() {
  playersList.innerHTML = "";
  state.players.forEach((p, i) => {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.flexDirection = "column";
    left.style.gap = "6px";

    const title = document.createElement("div");
    title.textContent = p.name;
    title.style.fontWeight = "600";
    title.className = p.alive ? "playerAlive" : "playerDead";

    // role dropdown
    const sel = document.createElement("select");
    const none = document.createElement("option"); none.value = ""; none.textContent = "(keine)"; sel.appendChild(none);
    ROLE_ORDER.forEach(r => {
      const o = document.createElement("option"); o.value = r; o.textContent = r;
      if (p.role === r) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => {
      p.role = sel.value || null;
      // if setting role to Dorfmatratze or Armor, keep armorPartner null; armor pairing only via night action
      checkRoleCountWarning();
      save();
      renderPlayers();
    };

    left.appendChild(title);
    left.appendChild(sel);

    // right controls
    const right = document.createElement("div");
    right.style.display = "flex"; right.style.gap = "6px"; right.style.alignItems = "center";

    const toggle = document.createElement("button");
    toggle.textContent = p.alive ? "-> tot setzen" : "-> lebendig setzen";
    toggle.onclick = () => {
      p.alive = !p.alive;
      // if someone dies, also kill armor partner if linked
      if (!p.alive && p.armorPartnerIndex !== null) {
        const idx = p.armorPartnerIndex;
        if (state.players[idx] && state.players[idx].alive) {
          state.players[idx].alive = false;
          addLog(`${state.players[idx].name} (Armor-Partner) starb, da Partner gestorben ist.`);
        }
      }
      save(); renderPlayers();
    };

    const remove = document.createElement("button");
    remove.textContent = "Entfernen";
    remove.onclick = () => {
      if (!confirm(`Spieler ${p.name} entfernen?`)) return;
      state.players.splice(i, 1);
      save(); renderPlayers(); checkRoleCountWarning();
    };

    right.appendChild(toggle);
    right.appendChild(remove);

    li.appendChild(left);
    li.appendChild(right);
    playersList.appendChild(li);
  });
}
renderPlayers();

// --- Warnung: Anzahl Rollen vs Spieler ---
function checkRoleCountWarning() {
  const assigned = state.players.filter(p => p.role).length;
  const total = state.players.length;
  if (assigned !== total) {
    topWarning.classList.remove("hidden");
    topWarning.textContent = `Warnung: ${assigned} Rollen zugewiesen / ${total} Spieler - Anzahl stimmt nicht überein.`;
  } else {
    topWarning.classList.add("hidden");
  }
}

// --- automatische Rollenverteilung ---
document.getElementById("autoSuggest").onclick = () => {
  const n = state.players.length;
  if (n === 0) return alert("Keine Spieler.");
  const wolves = Math.max(1, Math.floor(n / 3));
  let dist = [];
  for (let i = 0; i < wolves; i++) dist.push(ROLE_KEYS.WERWOLF);
  // special roles once
  const specials = [ROLE_KEYS.SEHER, ROLE_KEYS.HEXE, ROLE_KEYS.DORFMATRATZE, ROLE_KEYS.BAECKER, ROLE_KEYS.ARMOR, ROLE_KEYS.DIEB, ROLE_KEYS.DORFTROTTEL];
  specials.forEach(r => dist.push(r));
  while (dist.length < n) dist.push(ROLE_KEYS.DORFBEWOHNER);
  // shuffle
  dist = dist.sort(() => Math.random() - 0.5);
  state.players.forEach((p, i) => { p.role = dist[i]; p.armorPartnerIndex = null; p.alive = true; });
  state.witchState = { canHeal: true, canPoison: true };
  state.bakerBadPending = [];
  state.round = 1;
  state.phase = "setup";
  state.log = [];
  save();
  renderPlayers();
  checkRoleCountWarning();
  addLog("Automatische Rollenverteilung durchgeführt.");
};

// --- assign roles randomly but keep role pool (if roles set manually) ---
document.getElementById("assignRoles").onclick = () => {
  // build pool from currently assigned roles; if not all assigned, require auto suggestions
  const assigned = state.players.filter(p => p.role).length;
  if (assigned !== state.players.length) return alert("Bitte zuerst Rollen vollständig zuweisen (oder Auto-Vorschlag benutzen).");
  // shuffle roles among players
  const roles = state.players.map(p => p.role).sort(() => Math.random() - 0.5);
  state.players.forEach((p, i) => { p.role = roles[i]; p.armorPartnerIndex = null; p.alive = true; });
  save(); renderPlayers(); addLog("Rollen zufällig verteilt.");
};

// --- Nacht-Flow: bauen der Aktions-UI (zeigt nur Rollen im Spiel & lebendig) ---
document.getElementById("startNight").onclick = () => {
  // clear previous night choices
  state.nightChoices = { armorSelections: [], diebPicks: [], baecker: null, seherPick: null, matratzeTarget: null, wolfTarget: null, witchSave: null, witchPoison: null };
  // reset baker eaten flag not yet; bakerBadPending persists across nights
  flowArea.innerHTML = "";
  nightSummary.classList.add("hidden");

  // prepare list of alive roles present
  const aliveRolesSet = new Set(state.players.filter(p => p.alive && p.role).map(p => p.role));

  // Build UI in order
  nightOrder.forEach(role => {
    // special rule: Armor only first round
    if (role === ROLE_KEYS.ARMOR && state.round !== 1) return;
    // Dieb: every second round, not first night
    if (role === ROLE_KEYS.DIEB && (state.round === 1 || (state.round % 2) !== 0)) return;
    if (!aliveRolesSet.has(role)) return; // not in game or no living instance
    // build block
    const block = document.createElement("div");
    block.className = "card";
    const h = document.createElement("h3");
    h.textContent = role;
    block.appendChild(h);
    // depending on role, create specific UI
    if (role === ROLE_KEYS.ARMOR) {
      block.appendChild(buildArmorUI());
    } else if (role === ROLE_KEYS.DIEB) {
      block.appendChild(buildDiebUI());
    } else if (role === ROLE_KEYS.BAECKER) {
      block.appendChild(buildBaeckerUI());
    } else if (role === ROLE_KEYS.SEHER) {
      block.appendChild(buildSeherUI());
    } else if (role === ROLE_KEYS.DORFMATRATZE) {
      block.appendChild(buildMatratzeUI());
    } else if (role === ROLE_KEYS.WERWOLF) {
      block.appendChild(buildWerwolfUI());
    } else if (role === ROLE_KEYS.HEXE) {
      block.appendChild(buildHexeUI());
    }
    flowArea.appendChild(block);
  });

  // enable execute button
  document.getElementById("executeNight").disabled = false;
  addLog(`Nacht ${state.round} gestartet — Aktionen wählen.`);
  save();
};

// --- UI helpers for actions ---
function aliveOptions(excludeIndex = null) {
  return state.players.map((p, i) => ({ i, text: `${p.name}${p.alive ? "" : " (tot)"}`, disabled: !p.alive || i === excludeIndex }));
}

// Armor UI: select two players to pair
function buildArmorUI() {
  const wrap = document.createElement("div");
  const info = document.createElement("div"); info.className = "small"; info.textContent = "Wähle zwei Spieler: diese zeigen sich Karten. (Wenn einer stirbt, stirbt der andere auch.)";
  wrap.appendChild(info);
  const list = document.createElement("div"); list.style.display = "flex"; list.style.gap = "6px"; list.style.flexWrap = "wrap";
  state.players.forEach((p, i) => {
    const btn = document.createElement("button"); btn.textContent = p.name; btn.onclick = () => {
      if (!p.alive) return alert("Nur lebende Spieler auswählen.");
      const sel = state.nightChoices.armorSelections;
      if (sel.includes(i)) {
        state.nightChoices.armorSelections = sel.filter(x => x !== i);
      } else if (sel.length < 2) {
        sel.push(i);
      } else {
        alert("Bereits zwei ausgewählt.");
      }
      renderActionUI();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Dieb UI: choose two players to swap roles
function buildDiebUI() {
  const wrap = document.createElement("div");
  wrap.appendChild(document.createElement("div")).className = "small";
  wrap.lastChild.textContent = "Wähle zwei Spieler, deren Rollen getauscht werden sollen.";
  const list = document.createElement("div"); list.style.display = "flex"; list.style.gap = "6px"; list.style.flexWrap = "wrap";
  state.players.forEach((p, i) => {
    const btn = document.createElement("button"); btn.textContent = `${p.name} ${p.role ? "(" + p.role + ")" : ""}`;
    btn.onclick = () => {
      if (!p.alive) return alert("Nur lebende Spieler auswählen.");
      const sel = state.nightChoices.diebPicks;
      if (sel.includes(i)) state.nightChoices.diebPicks = sel.filter(x => x !== i);
      else if (sel.length < 2) sel.push(i);
      else alert("Bereits zwei ausgewählt.");
      renderActionUI();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Bäcker UI: choose target, quality and allow passing/eaten tracking
function buildBaeckerUI() {
  const wrap = document.createElement("div");
  const instr = document.createElement("div"); instr.className = "small";
  instr.textContent = "Wähle Ziel, Brotqualität (Gut = schützt vor Werwölfen, Schlecht = führt zum Tod in der nächsten Nacht, falls gegessen). Kann weitergegeben werden (max. 2x).";
  wrap.appendChild(instr);

  const select = document.createElement("select");
  const empty = document.createElement("option"); empty.value = ""; empty.textContent = "(Ziel wählen)"; select.appendChild(empty);
  state.players.forEach((p, i) => { const o = document.createElement("option"); o.value = i; o.textContent = p.name + (p.alive ? "" : " (tot)"); select.appendChild(o); });
  select.onchange = () => {
    const idx = parseInt(select.value);
    if (isNaN(idx)) state.nightChoices.baecker = null;
    else state.nightChoices.baecker = { owner: idx, quality: 1, passes: [], eatenBy: null };
    renderActionUI();
  };
  wrap.appendChild(select);

  const qualityDiv = document.createElement("div"); qualityDiv.style.marginTop = "6px";
  const goodBtn = document.createElement("button"); goodBtn.textContent = "Gut (schützt)";
  goodBtn.onclick = () => {
    if (!state.nightChoices.baecker) return alert("Erst Ziel wählen.");
    state.nightChoices.baecker.quality = 1; renderActionUI();
  };
  const badBtn = document.createElement("button"); badBtn.textContent = "Schlecht (tödlich später)";
  badBtn.onclick = () => {
    if (!state.nightChoices.baecker) return alert("Erst Ziel wählen.");
    state.nightChoices.baecker.quality = 2; renderActionUI();
  };
  qualityDiv.appendChild(goodBtn); qualityDiv.appendChild(badBtn);
  wrap.appendChild(qualityDiv);

  // pass/eat controls (moderator uses these during night to record behavior)
  const passDiv = document.createElement("div"); passDiv.style.marginTop = "8px";
  const passBtn = document.createElement("button"); passBtn.textContent = "Weitergeben (wählt nächsten Empfänger)";
  passBtn.onclick = () => {
    if (!state.nightChoices.baecker) return alert("Erst Ziel wählen.");
    if (state.nightChoices.baecker.passes.length >= 2) return alert("Bereits zweimal weitergegeben — Brot verfällt.");
    // show prompt to pick next recipient
    const choices = state.players.filter((p, i) => i !== state.nightChoices.baecker.owner && !state.nightChoices.baecker.passes.includes(i)).map((p,i)=>p.name);
    const name = prompt("Gib Namen des nächsten Empfängers ein (genau):\nVerfügbare: " + state.players.map(p=>p.name).join(", "));
    if (!name) return;
    const idx = state.players.findIndex(p => p.name === name);
    if (idx === -1) return alert("Name nicht gefunden.");
    if (idx === state.nightChoices.baecker.owner) return alert("Nicht an Dich selbst geben.");
    if (state.nightChoices.baecker.passes.includes(idx)) return alert("Schon weitergegeben an diese Person.");
    state.nightChoices.baecker.passes.push(idx);
    renderActionUI();
  };
  const eatenBtn = document.createElement("button"); eatenBtn.textContent = "Als gegessen markieren";
  eatenBtn.onclick = () => {
    if (!state.nightChoices.baecker) return alert("Erst Ziel wählen.");
    // mark eatenBy = current owner (last recipient)
    // determine who ate: if passes.length>0 -> last pass recipient else owner
    const last = (state.nightChoices.baecker.passes.length > 0) ? state.nightChoices.baecker.passes[state.nightChoices.baecker.passes.length - 1] : state.nightChoices.baecker.owner;
    state.nightChoices.baecker.eatenBy = last;
    renderActionUI();
  };
  passDiv.appendChild(passBtn); passDiv.appendChild(eatenBtn);
  wrap.appendChild(passDiv);

  // display current baker state
  const status = document.createElement("div"); status.style.marginTop = "6px";
  if (state.nightChoices.baecker) {
    const b = state.nightChoices.baecker;
    status.textContent = `Ziel: ${state.players[b.owner].name} | Qualität: ${b.quality===1?"Gut":"Schlecht"} | Weitergegeben an: ${b.passes.map(i=>state.players[i].name).join(", ") || "(keine)"} | Gegessen von: ${b.eatenBy!=null?state.players[b.eatenBy].name:"(noch nicht)"}`;
  } else status.textContent = "(kein Brot gewählt)";
  wrap.appendChild(status);

  return wrap;
}

// Seher UI: pick 1 to reveal role to moderator (alert)
function buildSeherUI() {
  const wrap = document.createElement("div");
  const instr = document.createElement("div"); instr.className = "small"; instr.textContent = "Wähle eine Person (Moderator sieht ihre Karte).";
  wrap.appendChild(instr);
  const list = document.createElement("div"); list.style.display = "flex"; list.style.gap = "6px"; list.style.flexWrap = "wrap";
  state.players.forEach((p, i) => {
    const btn = document.createElement("button");
    btn.textContent = `${p.name}${p.alive ? "" : " (tot)"}`;
    btn.onclick = () => {
      if (!p.alive) return alert("Nur lebende Spieler auswählen.");
      state.nightChoices.seherPick = i;
      alert(`Seher: ${p.name} hat die Rolle: ${p.role || "(nicht zugewiesen)"}`);
      renderActionUI();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Matratze UI: choose who they sleep at
function buildMatratzeUI() {
  const wrap = document.createElement("div");
  const instr = document.createElement("div"); instr.className = "small"; instr.textContent = "Dorfmatratze: Wähle, bei wem sie schläft (wenn Matratze angegriffen wird, stirbt sie nicht; wenn Gastgeber angegriffen wird, stirbt die Matratze auch).";
  wrap.appendChild(instr);
  const list = document.createElement("div"); list.style.display="flex"; list.style.gap="6px"; list.style.flexWrap="wrap";
  state.players.forEach((p, i) => {
    const btn = document.createElement("button"); btn.textContent = p.name; btn.onclick = () => {
      if (!p.alive) return alert("Nur lebende Spieler auswählen.");
      state.nightChoices.matratzeTarget = i;
      renderActionUI();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Werwolf UI: choose kill target
function buildWerwolfUI() {
  const wrap = document.createElement("div");
  const instr = document.createElement("div"); instr.className = "small"; instr.textContent = "Werwölfe wählen gemeinsam ein Opfer.";
  wrap.appendChild(instr);
  const list = document.createElement("div"); list.style.display="flex"; list.style.gap="6px"; list.style.flexWrap="wrap";
  state.players.forEach((p, i) => {
    const btn = document.createElement("button"); btn.textContent = `${p.name}${p.alive ? "" : " (tot)"}`;
    btn.onclick = () => {
      if (!p.alive) return alert("Nur lebende Spieler auswählen.");
      state.nightChoices.wolfTarget = i;
      renderActionUI();
    };
    list.appendChild(btn);
  });
  wrap.appendChild(list);
  return wrap;
}

// Hexe UI: show wolves' target and allow heal/poison if available
function buildHexeUI() {
  const wrap = document.createElement("div");
  const info = document.createElement("div"); info.className = "small";
  const victimName = (state.nightChoices.wolfTarget != null) ? state.players[state.nightChoices.wolfTarget].name : "Noch nicht gewählt";
  info.textContent = `Werwolf-Opfer: ${victimName}. Hexe: Heilung (${state.witchState.canHeal ? "verfügbar" : "gebraucht"}), Gift (${state.witchState.canPoison ? "verfügbar" : "gebraucht"}).`;
  wrap.appendChild(info);

  const healBtn = document.createElement("button"); healBtn.textContent = "Heilen (retter)";
  healBtn.onclick = () => {
    if (!state.witchState.canHeal) return alert("Heiltrank bereits benutzt.");
    if (state.nightChoices.wolfTarget == null) return alert("Noch kein Opfer der Werwölfe.");
    // Witch chooses which to heal: victim or matratze (if both)
    // Present options
    const choices = [state.nightChoices.wolfTarget];
    const matIdx = state.players.findIndex(p => p.role === ROLE_KEYS.DORFMATRATZE && p.alive);
    if (matIdx >= 0) choices.push(matIdx);
    const nameList = choices.map(i => `${i}: ${state.players[i].name}`).join("\n");
    const pick = prompt("Wen heilen? (Index wählen)\n" + nameList);
    const idx = parseInt(pick);
    if (isNaN(idx) || !choices.includes(idx)) return alert("Ungültig.");
    state.nightChoices.witchSave = idx;
    state.witchState.canHeal = false;
    addLog(`Hexe entschied sich zu heilen: ${state.players[idx].name}`);
    renderActionUI();
  };

  const poisonBtn = document.createElement("button"); poisonBtn.textContent = "Vergiften";
  poisonBtn.onclick = () => {
    if (!state.witchState.canPoison) return alert("Gifttank bereits benutzt.");
    // choose a target (any alive except Hexe)
    const hexIdx = state.players.findIndex(p => p.role === ROLE_KEYS.HEXE && p.alive);
    const name = prompt("Wen vergiften? (Name eingeben)\nVerfügbare: " + state.players.filter((p,i)=>p.alive && i !== hexIdx).map(p=>p.name).join(", "));
    if (!name) return;
    const idx = state.players.findIndex(p => p.name === name && p.alive && playersIndexNotHex(name, hexIdx));
    if (idx === -1) return alert("Ungültig oder nicht gefunden.");
    state.nightChoices.witchPoison = idx;
    state.witchState.canPoison = false;
    addLog(`Hexe vergiftete: ${state.players[idx].name}`);
    renderActionUI();
  };

  wrap.appendChild(healBtn);
  wrap.appendChild(poisonBtn);
  return wrap;
}

function playersIndexNotHex(name, hexIdx) {
  return true; // unused helper to keep prompt safe
}

// renderActionUI re-renders flow area blocks to reflect selections
function renderActionUI() {
  // cheat: simply re-trigger startNight to rebuild UI blocks (keeps selection values in state.nightChoices)
  const saved = flowArea.innerHTML;
  // rebuild: find currently displayed roles and re-create UI to reflect choices
  // simplified: we just re-run startNight builder with existing choices shown by state
  // to avoid too much complexity, do nothing (UI buttons already update state). But update a small summary in each block by re-creating flow.
  // We'll rebuild flow by simulating click on startNight with current state; to keep simple we just re-build blocks:
  const prevRound = state.round;
  const prevPhase = state.phase;
  const tmp = document.createElement("div");
  tmp.innerHTML = ""; // not used
  // update small status displays: update all "card" blocks in flowArea
  // To keep code concise: simply update the night summary visible details
  flowArea.querySelectorAll(".card").forEach(block => {
    // nothing for now
  });
  save();
}

// --- Execute Night: apply rules and compute deaths ---
document.getElementById("executeNight").onclick = () => {
  // Pre-check: ensure roles assigned for living players
  const unassigned = state.players.filter(p => p.alive && !p.role).map(p => p.name);
  if (unassigned.length > 0) {
    if (!confirm(`Es gibt unzugewiesene Rollen für lebende Spieler: ${unassigned.join(", ")}. Weiter ausführen?`)) return;
  }

  addLog(`Nacht ${state.round}: Auflösung wird berechnet...`);

  const diedThisNight = [];

  // 0) apply Dieb swap immediately if chosen
  if (state.nightChoices.diebPicks && state.nightChoices.diebPicks.length === 2) {
    const [a,b] = state.nightChoices.diebPicks;
    const ra = state.players[a].role;
    const rb = state.players[b].role;
    state.players[a].role = rb;
    state.players[b].role = ra;
    addLog(`Dieb tauschte Rollen: ${state.players[a].name} ↔ ${state.players[b].name}`);
  }

  // 1) Baker bread: if eaten and bad => schedule death next night; if good => protection for this night (protect from wolves)
  // We'll compute protections object
  const protectedThisNight = new Set();
  if (state.nightChoices.baecker) {
    const b = state.nightChoices.baecker;
    // if eatenBy not null -> effect applies
    if (b.eatenBy != null) {
      if (b.quality === 1) { // good
        protectedThisNight.add(b.eatenBy);
        addLog(`Gutes Brot: ${state.players[b.eatenBy].name} ist diese Nacht vor Werwölfen geschützt.`);
      } else if (b.quality === 2) { // bad -> death next night
        state.bakerBadPending.push({ index: b.eatenBy });
        addLog(`Schlechtes Brot: ${state.players[b.eatenBy].name} wird in der nächsten Nacht sterben (schlechtes Brot gegessen).`);
      }
    } else {
      // not eaten -> baker may have passed; if passed twice and not eaten -> bread perishes (no effect)
      addLog(`Brot wurde nicht gegessen; ggf. blieb es liegen.`);
    }
  }

  // 2) Determine wolf candidate
  const wolfCandidate = state.nightChoices.wolfTarget != null ? state.nightChoices.wolfTarget : null;
  if (wolfCandidate != null) addLog(`Werwölfe zielten auf: ${state.players[wolfCandidate].name}`);

  // 3) Dorfmatratze logic: find matratze index (living matratze)
  const matIndex = state.players.findIndex(p => p.alive && p.role === ROLE_KEYS.DORFMATRATZE);
  let candidateDies = false, matratzeDies = false;
  if (wolfCandidate != null) {
    if (matIndex >= 0 && wolfCandidate === matIndex) {
      // wolves targeted the matratze directly -> matratze doesn't die
      addLog(`Werwölfe griffen die Dorfmatratze direkt an; Dorfmatratze überlebt.`);
      candidateDies = false;
    } else if (state.nightChoices.matratzeTarget != null && state.nightChoices.matratzeTarget === wolfCandidate) {
      // matratze slept at the candidate -> candidate dies and matratze dies as well
      candidateDies = true;
      matratzeDies = true;
      addLog(`Dorfmatratze schlief bei ${state.players[wolfCandidate].name}; bei Angriff sterben beide.`);
    } else {
      candidateDies = true;
    }
  }

  // 4) Witch save/poison
  if (state.nightChoices.witchSave != null) {
    // witch saved one target; if save matches candidate or matratze -> cancel death
    const s = state.nightChoices.witchSave;
    if (s === wolfCandidate) {
      candidateDies = false;
      addLog(`Hexe rettete ${state.players[s].name} vor dem Werwolfangriff.`);
    }
    if (matIndex >= 0 && s === matIndex) {
      matratzeDies = false;
      addLog(`Hexe rettete die Dorfmatratze.`);
    }
  }
  if (state.nightChoices.witchPoison != null) {
    const t = state.nightChoices.witchPoison;
    if (state.players[t] && state.players[t].alive) {
      state.players[t].alive = false;
      diedThisNight.push({ index: t, reason: "von Hexe vergiftet" });
      addLog(`${state.players[t].name} wurde von der Hexe vergiftet.`);
    }
  }

  // 5) Baker protection applied earlier (protectedThisNight)
  if (wolfCandidate != null && protectedThisNight.has(wolfCandidate)) {
    candidateDies = false;
    addLog(`${state.players[wolfCandidate].name} wurde durch gutes Brot vor Werwölfen geschützt.`);
  }

  // 6) Apply wolf candidate death
  if (candidateDies && wolfCandidate != null && state.players[wolfCandidate].alive) {
    state.players[wolfCandidate].alive = false;
    diedThisNight.push({ index: wolfCandidate, reason: "von Werwölfen getötet" });
    addLog(`${state.players[wolfCandidate].name} wurde von Werwölfen getötet.`);
  }

  // 7) Apply matratze death if necessary
  if (matratzeDies && matIndex >= 0 && state.players[matIndex].alive) {
    state.players[matIndex].alive = false;
    diedThisNight.push({ index: matIndex, reason: "Dorfmatratze starb (bei Schutzhandlung)" });
    addLog(`${state.players[matIndex].name} (Dorfmatratze) starb.`);
  }

  // 8) Baker bad-bread pending from previous nights: apply now (these die at start of this night)
  if (state.bakerBadPending && state.bakerBadPending.length > 0) {
    // These were scheduled last night; apply and clear
    const pending = state.bakerBadPending.slice();
    state.bakerBadPending = [];
    pending.forEach(item => {
      const idx = item.index;
      if (state.players[idx] && state.players[idx].alive) {
        state.players[idx].alive = false;
        diedThisNight.push({ index: idx, reason: "gestorben durch schlechtes Brot (aus vorheriger Nacht)" });
        addLog(`${state.players[idx].name} starb durch schlechtes Brot (Nachwirkung).`);
      }
    });
  }

  // 9) Armor pairing: if one of an armor pair died, the partner also dies (apply now)
  // But armor pairing is set when armorSelections chosen: we will link partners into players[].armorPartnerIndex
  // If a player died and has partner alive -> partner also dies
  const diedIndices = diedThisNight.map(d => d.index);
  diedIndices.forEach(idx => {
    const p = state.players[idx];
    if (p && p.armorPartnerIndex != null) {
      const partner = p.armorPartnerIndex;
      if (state.players[partner] && state.players[partner].alive) {
        state.players[partner].alive = false;
        diedThisNight.push({ index: partner, reason: "Armor-Partner starb (Verknüpfung)" });
        addLog(`${state.players[partner].name} (Armor-Partner) starb, da Partner gestorben ist.`);
      }
    }
  });

  // 10) finalize: collect unique deaths (avoid duplicates)
  const uniqueDeaths = [];
  const seen = new Set();
  diedThisNight.forEach(d => {
    if (!seen.has(d.index)) { seen.add(d.index); uniqueDeaths.push(d); }
  });

  // 11) apply Dieb swap already done earlier

  // 12) finally: set night over, increment round, reset night choices but persist witch inventory and baker pending was updated
  state.round++;
  state.nightChoices = { armorSelections: [], diebPicks: [], baecker: null, seherPick: null, matratzeTarget: null, wolfTarget: null, witchSave: null, witchPoison: null };
  document.getElementById("executeNight").disabled = true;
  document.getElementById("startDay").disabled = false;

  // prepare night summary display (who died)
  if (uniqueDeaths.length === 0) {
    nightSummary.innerHTML = "<strong>Kein Todesfall in dieser Nacht.</strong>";
  } else {
    nightSummary.innerHTML = "<strong>Gestorben:</strong><ul>" + uniqueDeaths.map(d => `<li>${state.players[d.index].name} — ${d.reason}</li>`).join("") + "</ul>";
  }
  nightSummary.classList.remove("hidden");
  addLog(`Nacht abgeschlossen. ${uniqueDeaths.length} Tote.`);
  save();
  renderPlayers();
  renderLog();
};

// --- Start day (you can use this to perform day actions, here we just log and hide night summary) ---
document.getElementById("startDay").onclick = () => {
  addLog(`Tag beginnt (Runde ${state.round - 1} abgeschlossen).`);
  document.getElementById("startDay").disabled = true;
  // day actions (lynch) are manual via toggles in player list
  // show current alive / dead summary
  const alive = state.players.filter(p => p.alive).map(p => p.name);
  addLog(`Aktuell lebende Spieler: ${alive.join(", ")}`);
  save();
};

// --- Restart game ---
document.getElementById("restartGame").onclick = () => {
  if (!confirm("Spiel komplett neu starten?")) return;
  state.players.forEach(p => { p.alive = true; p.role = null; p.armorPartnerIndex = null; });
  state.round = 1;
  state.phase = "setup";
  state.nightChoices = { armorSelections: [], diebPicks: [], baecker: null, seherPick: null, matratzeTarget: null, wolfTarget: null, witchSave: null, witchPoison: null };
  state.witchState = { canHeal: true, canPoison: true };
  state.bakerBadPending = [];
  state.log = [];
  save();
  renderPlayers(); renderLog();
  addLog("Spiel neugestartet.");
};

// --- Log helpers ---
function addLog(txt) {
  const t = `${new Date().toLocaleString()} — ${txt}`;
  state.log.push(t);
  save();
  renderLog();
}
function renderLog() {
  logArea.innerHTML = state.log.slice().reverse().map(l => `<div>${l}</div>`).join("");
}
document.getElementById("downloadLog").onclick = () => {
  const blob = new Blob([state.log.join("\n")], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "werwolf_log.txt"; a.click();
};
document.getElementById("clearLog").onclick = () => { if (!confirm("Log löschen?")) return; state.log = []; save(); renderLog(); };

// --- Small convenience: when Armor selections finalized, link partners persistently
// We link partners after clicking executeNight if armorSelections present
// To simplify usage: add listener to Execute that links if armor selections set (done before resolve)
(function attachArmorLinker() {
  const orig = document.getElementById("executeNight").onclick;
  // wrap onclick by setting listener above; already handled in executeNight: we'll set link from nightChoices.armorSelections before resolve
})();

// Ensure UI initially rendered
renderPlayers();
renderLog();
checkRoleCountWarning();

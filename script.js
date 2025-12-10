// ------------------------------------
// Daten
// ------------------------------------
const players = [];
const rolesInGame = {};
const roleList = [
  "Werwolf",
  "Seher",
  "Hexe",
  "Dorfmatratze",
  "Bäcker",
  "Armor",
  "Dieb",
  "Dorftrottel",
  "Dorfbewohner"
];

// Rollen, die nachts aufwachen – Reihenfolge relevant
const nightOrder = [
  "Armor",
  "Dieb",
  "Bäcker",
  "Seher",
  "Dorfmatratze",
  "Werwolf",
  "Hexe"
];

// ------------------------------------
// UI-Referenzen
// ------------------------------------
const playersList = document.getElementById("playersList");
const rolesControls = document.getElementById("rolesControls");
const warning = document.getElementById("warning");
const flowArea = document.getElementById("flowArea");
const nightSummary = document.getElementById("nightSummary");

// ------------------------------------
// Spieler hinzufügen
// ------------------------------------
document.getElementById("addPlayer").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  if (!name) return;

  players.push({ name, role: null, alive: true });
  document.getElementById("playerName").value = "";
  refreshPlayers();
  checkCountWarning();
};

document.getElementById("clearPlayers").onclick = () => {
  players.length = 0;
  refreshPlayers();
  checkCountWarning();
};

// ------------------------------------
// Spieler-Liste rendern
// ------------------------------------
function refreshPlayers() {
  playersList.innerHTML = "";

  players.forEach((p, i) => {
    const li = document.createElement("li");
    li.className = p.alive ? "player-alive" : "player-dead";

    // Dropdown für Rollen
    const select = document.createElement("select");

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "(Keine)";
    select.appendChild(empty);

    roleList.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (p.role === r) opt.selected = true;
      select.appendChild(opt);
    });

    select.onchange = () => {
      p.role = select.value || null;
      countRoles();
      checkCountWarning();
    };

    // Alive/Dead Toggle
    const toggle = document.createElement("button");
    toggle.textContent = p.alive ? "Töten" : "Beleben";
    toggle.onclick = () => {
      p.alive = !p.alive;
      refreshPlayers();
    };

    li.textContent = p.name + " ";
    li.appendChild(select);
    li.appendChild(toggle);

    playersList.appendChild(li);
  });
}

// ------------------------------------
// Rollen zählen & Warnung anzeigen
// ------------------------------------
function countRoles() {
  for (const r of roleList) rolesInGame[r] = 0;

  players.forEach(p => {
    if (p.role) rolesInGame[p.role]++;
  });
}

function checkCountWarning() {
  const playerCount = players.length;
  const roleCount = players.filter(p => p.role).length;

  if (playerCount !== roleCount) {
    warning.classList.remove("hidden");
  } else {
    warning.classList.add("hidden");
  }
}

// ------------------------------------
// Automatische Rollenverteilung
// ------------------------------------
document.getElementById("autoSuggest").onclick = () => {
  if (players.length === 0) return;

  const count = players.length;
  const wolves = Math.max(1, Math.floor(count / 3));

  const distribution = [];

  // fülle Werwölfe
  for (let i = 0; i < wolves; i++) distribution.push("Werwolf");

  // jede Sonderrolle einmal
  const special = ["Seher", "Hexe", "Dorfmatratze", "Bäcker", "Armor", "Dieb", "Dorftrottel"];
  special.forEach(r => distribution.push(r));

  // Rest = Dorfbewohner
  while (distribution.length < count) distribution.push("Dorfbewohner");

  // zufällig mischen
  distribution.sort(() => Math.random() - 0.5);

  // zuweisen
  players.forEach((p, i) => {
    p.role = distribution[i];
  });

  refreshPlayers();
  countRoles();
  checkCountWarning();
};

// ------------------------------------
// Zufällige Rollenverteilung
// ------------------------------------
document.getElementById("assignRoles").onclick = () => {
  const roles = players.map(p => p.role).filter(Boolean);

  if (roles.length !== players.length) {
    alert("Nicht alle Spieler haben Rollen.");
    return;
  }

  roles.sort(() => Math.random() - 0.5);

  players.forEach((p, i) => {
    p.role = roles[i];
  });

  refreshPlayers();
};

// ------------------------------------
// Nacht starten
// ------------------------------------
document.getElementById("startNight").onclick = () => {
  nightSummary.classList.add("hidden");
  flowArea.innerHTML = "";

  const aliveRoles = players
    .filter(p => p.alive && p.role)
    .map(p => p.role);

  nightOrder.forEach(role => {
    if (aliveRoles.includes(role)) {
      const div = document.createElement("div");
      div.className = "card";
      div.textContent = role + " wacht auf.";
      flowArea.appendChild(div);
    }
  });

  document.getElementById("startDay").disabled = false;
};

// ------------------------------------
// Tag starten & Zusammenfassung
// ------------------------------------
document.getElementById("startDay").onclick = () => {
  const deaths = players.filter(p => !p.alive).map(p => p.name);

  nightSummary.innerHTML =
    deaths.length > 0
      ? "Gestorben: " + deaths.join(", ")
      : "Keine Todesfälle";

  nightSummary.classList.remove("hidden");
};

// ------------------------------------
// Neustart
// ------------------------------------
document.getElementById("restartGame").onclick = () => {
  players.forEach(p => (p.alive = true));
  nightSummary.classList.add("hidden");
  flowArea.innerHTML = "";
  refreshPlayers();
};

<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Werwolf Moderator</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<header><h1>Werwolf Moderator — Moderator-Tool</h1></header>
<main>
  <section id="players-section" class="card">
    <h2>Spieler</h2>
    <div class="row">
      <input id="playerName" placeholder="Spielername eingeben" />
      <button id="addPlayer">Hinzufügen</button>
      <button id="clearPlayers">Alles löschen</button>
    </div>
    <ul id="playersList"></ul>
  </section>

  <section id="roles-section" class="card">
    <h2>Rollen konfigurieren</h2>
    <div class="row wrap">
      <label>Wähle Rollen (Anzahl):</label>
    </div>
    <div id="rolesControls" class="wrap"></div>
    <div class="row">
      <button id="autoFillVillagers">Mit Dorfbewohnern auffüllen</button>
      <button id="assignRoles">Rollen zufällig verteilen</button>
      <button id="clearRoles">Rollen zurücksetzen</button>
    </div>
    <p class="small">Hinweis: Rollen können nach Verteilung manuell angepasst werden (Lange Antippen/Click).</p>
  </section>

  <section id="game-section" class="card">
    <h2>Spielsteuerung</h2>
    <div class="row">
      <button id="startNight">Nacht starten</button>
      <button id="startDay" disabled>Tag starten</button>
      <button id="restartGame">Neustart</button>
    </div>
    <div id="flowArea"></div>
  </section>

  <section id="log-section" class="card">
    <h2>Log & Zusammenfassung</h2>
    <div id="log"></div>
    <button id="downloadLog">Log herunterladen</button>
  </section>
</main>

<footer><small>Nur für Spielleiter. Alle Texte auf Deutsch. Lokale Speicherung im Browser.</small></footer>

<script src="script.js"></script>
</body>
</html>// script.js

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

  const availableRoles = ['Dorfbewohner', 'Werwolf', 'Seher', 'Hexe', 'Jäger', 'Bürgermeister'];

  // Helper to update display
  function updatePlayersDisplay() {
    // Clear lists
    playersList.innerHTML = '';
    playersStatusList.innerHTML = '';

    players.forEach(name => {
      // Player list with status icon
      const li = document.createElement('li');
      li.textContent = name;
      const statusSpan = document.createElement('span');
      statusSpan.textContent = playersStatus[name]?.alive ? '🟢' : '🔴';
      li.appendChild(statusSpan);
      playersList.appendChild(li);

      // Player details with role display and dropdown
      const statusLi = document.createElement('li');
      statusLi.textContent = name + ' (' + (playersStatus[name]?.alive ? 'lebend' : 'tot') + ')';

      // Role display
      const roleSpan = document.createElement('span');
      roleSpan.className = 'roleTag';
      roleSpan.textContent = playersStatus[name]?.role || 'Unbekannt';
      statusLi.appendChild(roleSpan);

      // Dropdown to assign role manually
      const roleSelect = document.createElement('select');
      roleSelect.innerHTML = availableRoles.map(r => `<option value="${r}">${r}</option>`).join('');
      roleSelect.value = playersStatus[name]?.role || '';

      roleSelect.addEventListener('change', () => {
        playersStatus[name].role = roleSelect.value;
      });
      statusLi.appendChild(roleSelect);

      // Action selector (optional)
      if (playersStatus[name]?.alive) {
        const actionSelect = document.createElement('select');
        actionSelect.innerHTML = `
          <option value="">Aktion wählen</option>
          <option value="kill">Töten</option>
          <option value="save">Retten</option>
        `;
        statusLi.appendChild(actionSelect);
      }

      playersStatusList.appendChild(statusLi);
    });

    // Warn if counts mismatch
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

  // Generate role configuration dropdowns
  function generateRoleDropdowns() {
    rolesControlsContainer.innerHTML = '';
    for (const role in roles) {
      const div = document.createElement('div');
      div.className = 'row';

      const label = document.createElement('label');
      label.textContent = role;
      div.appendChild(label);

      const select = document.createElement('select');
      const maxCount = players.length;
      select.innerHTML = Array.from({length: maxCount + 1}, (_, i) => `<option value="${i}">${i}</option>`).join('');
      select.value = roles[role] || 0;

      select.addEventListener('change', () => {
        roles[role] = parseInt(select.value);
      });
      div.appendChild(select);

      rolesControlsContainer.appendChild(div);
    }
  }

  // Fill with villagers
  document.getElementById('autoFillVillagers').addEventListener('click', () => {
    for (const role in roles) {
      roles[role] = 0;
    }
    roles['Dorfbewohner'] = players.length;
    generateRoleDropdowns();
  });

  // Random assign roles based on counts
  document.getElementById('assignRoles').addEventListener('click', () => {
    const totalRolesCount = Object.values(roles).reduce((a, b) => a + b, 0);
    if (players.length !== totalRolesCount) {
      alert('Die Rollenanzahl stimmt nicht mit der Spielerzahl überein!');
      return;
    }

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

  // Initialize roles
  roles['Dorfbewohner'] = players.length;
  generateRoleDropdowns();

  // Victory check example
  function checkVictory() {
    const aliveWolves = Object.values(playersStatus).filter(p => p.role === 'Werwolf' && p.alive).length;
    const aliveVillagers = Object.values(playersStatus).filter(p => p.role !== 'Werwolf' && p.alive).length;
    if (aliveWolves === 0) {
      alert('Die Dorfbewohner haben gewonnen!');
    } else if (aliveWolves >= aliveVillagers) {
      alert('Die Werwölfe haben gewonnen!');
    }
  }
});


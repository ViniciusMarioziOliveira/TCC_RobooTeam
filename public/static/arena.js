/* Arena RobooTeam — página de jogo do aluno.
   O servidor guarda equipes, tempos e pedidos de ajuda; o programa em blocos
   fica no navegador e é enviado a cada execução (o servidor confere o resultado). */
(() => {
  const page = document.body;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const RR = window.RobooRobo;
  const imgBase = page.dataset.robotImgBase || "/static/img/";
  const studentId = String(page.dataset.studentId);
  const firstName = (page.dataset.studentName || "Explorador").split(" ")[0];
  const myRobot = RR.load(studentId);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const DELTA = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const DIRS = ["N", "E", "S", "W"];
  const ANGLE = { N: 0, E: 90, S: 180, W: 270 };
  const DIR_NAME = { N: "para cima", E: "para a direita", S: "para baixo", W: "para a esquerda" };
  // ícones do sprite (templates/_icones.html)
  const BLOCKS = {
    avancar: { label: "Avançar", ico: "arrow-up", cls: "b-avancar" },
    virar_esquerda: { label: "Virar à esquerda", ico: "corner-up-left", cls: "b-esquerda" },
    virar_direita: { label: "Virar à direita", ico: "corner-up-right", cls: "b-direita" },
    repetir: { label: "Repetir", ico: "repeat", cls: "b-repetir" },
  };
  const TEAM_COLORS = ["cyan", "purple", "pink", "orange", "green", "yellow"];
  const TEAM_ICONS = {
    rocket: "Foguete", zap: "Raio", star: "Estrela", turtle: "Tartaruga", fish: "Peixe", cat: "Gato",
    bug: "Joaninha", rainbow: "Arco-íris", flame: "Fogo", clover: "Trevo", target: "Alvo", satellite: "Satélite",
  };
  const TEAM_NAMES = ["Foguetes", "Robôs Turbo", "Estrelas Cadentes", "Dinobots", "Raios Azuis", "Astronautas", "Chips Malucos", "Galáxia Kids"];
  const STATUS_LABEL = { aguardando: "Aguardando", em_jogo: "Valendo!", finalizada: "Encerrada" };
  const WAIT_TIPS = [
    { ico: "arrow-up", text: "O bloco Avançar anda uma casa na direção em que o robô está olhando." },
    { ico: "repeat", text: "Repetir economiza blocos: 3 blocos Avançar viram um Repetir 3 vezes!" },
    { ico: "brick-wall", text: "As paredes roxas não deixam o robô passar. Desvie delas!" },
    { ico: "users", text: "O tempo da equipe é somado. Ajude seus colegas!" },
    { ico: "hand", text: "Travou? Use o botão Preciso de ajuda: o robô tem dicas!" },
  ];
  const ESCALATE_REASON = "equipe_toda";

  let state = null;
  let serverOffset = 0;
  let choosingTeam = false;
  let mapSignature = "";
  let program = [];
  let target = "raiz";
  let nextId = 1;
  let running = false;
  let runToken = 0;
  let robot = { r: 0, c: 0, dir: "E", angle: 90 };
  let token = null;
  let fast = false;
  let soundOn = readSetting("robooteam-som", "1") === "1";
  const teamIconKeys = Object.keys(TEAM_ICONS);
  let selectedIcon = teamIconKeys[Math.floor(Math.random() * teamIconKeys.length)];
  let selectedColor = TEAM_COLORS[Math.floor(Math.random() * TEAM_COLORS.length)];
  let selectedReason = null;
  let cancellingHelp = false;
  let pollTimer = null;
  let tipTimer = null;
  let tipIndex = 0;
  let finalCelebrated = false;
  let guideTab = "missao";
  const seenMateHelp = new Set();
  const escalateShown = new Set();

  /* ---------------------------------------------------------------- utilidades */
  function readSetting(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeSetting(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // preferência só vale nesta visita
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function icon(name, extra = "") {
    return `<svg class="ico${extra ? ` ${extra}` : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  }

  function starsHtml(count) {
    return `<i class="stars-row" aria-label="${count} ${count === 1 ? "estrela" : "estrelas"}">${icon("star", "ico-fill").repeat(count)}</i>`;
  }

  function medal(index, fallback) {
    return index < 3
      ? `<span class="medal m${index + 1}" aria-label="${index + 1}º lugar">${icon("medal")}</span>`
      : String(fallback);
  }

  function firstNameOf(name) {
    return String(name || "").split(" ")[0];
  }

  function formatTime(seconds) {
    if (seconds === null || seconds === undefined) return "--:--";
    const total = Math.max(0, Math.round(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function serverNow() {
    return Date.now() + serverOffset;
  }

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/);
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function restartAnimation(element) {
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.animation = "";
  }

  async function api(url, options = {}) {
    let authToken = null;
    try {
      authToken = localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
    } catch {
      // sem token salvo: o cookie de login continua valendo
    }
    const headers = {};
    if (options.body) headers["Content-Type"] = "application/json";
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      window.location.href = page.dataset.loginUrl;
      throw new Error("Faça login novamente");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "Algo deu errado. Tente de novo!");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  /* ---------------------------------------------------------------- som */
  let audioContext = null;
  function tone(frequency, duration = 0.12, type = "sine", delay = 0, volume = 0.07) {
    if (!soundOn) return;
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const start = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch {
      // navegador sem áudio
    }
  }
  const sfx = {
    add: () => tone(660, 0.07, "triangle"),
    move: () => tone(520, 0.08, "square", 0, 0.035),
    turn: () => tone(392, 0.09, "triangle"),
    crash: () => { tone(190, 0.22, "sawtooth", 0, 0.05); tone(120, 0.3, "sawtooth", 0.12, 0.05); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.2, "triangle", i * 0.12, 0.08)),
    alert: () => { tone(880, 0.12); tone(1175, 0.16, "sine", 0.13); },
    tick: () => tone(740, 0.1, "square", 0, 0.05),
    go: () => tone(1046, 0.35, "triangle", 0, 0.08),
  };

  /* ---------------------------------------------------------------- feedback */
  function toast(text, tone = "", iconName = "") {
    const element = document.createElement("div");
    element.className = `toast${tone ? ` ${tone}` : ""}`;
    element.innerHTML = `${iconName ? icon(iconName) : ""}<span>${escapeHtml(text)}</span>`;
    $("#toasts").append(element);
    setTimeout(() => {
      element.classList.add("leaving");
      setTimeout(() => element.remove(), 300);
    }, 4200);
  }

  function say(text, tone = "") {
    const bubble = $(".says-bubble");
    $("#says-text").textContent = text;
    bubble.className = `says-bubble${tone ? ` tone-${tone}` : ""}`;
    RR.replayClass(bubble, "bump", 400);
  }

  function confetti(origin) {
    if (reduceMotion) return;
    const rect = origin?.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 3;
    const colors = ["#2DD4E8", "#F6B93B", "#FF7AB6", "#8B6FEA", "#20C671", "#2F5DE0"];
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 60; i += 1) {
      const piece = document.createElement("span");
      piece.className = `confetti-piece${i % 3 === 0 ? " round" : ""}`;
      piece.style.cssText = [
        `left:${x}px`, `top:${y}px`,
        `--c:${colors[i % colors.length]}`,
        `--dx:${Math.round((Math.random() - 0.5) * 520)}px`,
        `--up:${Math.round(-90 - Math.random() * 170)}px`,
        `--dy:${Math.round(140 + Math.random() * 280)}px`,
        `--r:${Math.round((Math.random() - 0.5) * 720)}deg`,
        `--d:${(Math.random() * 0.15).toFixed(2)}s`,
      ].join(";");
      layer.append(piece);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  function paintMyRobots(root = document) {
    $$("[data-my-robot]", root).forEach((figure) => {
      const imageId = figure.dataset.image ? Number(figure.dataset.image) : null;
      RR.paintFigure(figure, myRobot, imgBase, { imageId });
    });
  }

  /* ---------------------------------------------------------------- telas */
  function showView(name) {
    ["loading", "lobby", "waiting", "game", "final"].forEach((view) => {
      $(`#view-${view}`).hidden = view !== name;
    });
    page.dataset.view = name;
  }

  function render(data) {
    const previous = state;
    state = data;
    serverOffset = Date.parse(data.agora) - Date.now();
    const { sala, eu } = data;

    $("#arena-name").textContent = sala.nome;
    document.title = `${sala.nome} — Arena RobooTeam`;
    const statusChip = $("#arena-status");
    statusChip.dataset.status = sala.status;
    statusChip.textContent = STATUS_LABEL[sala.status] || sala.status;

    renderHeader();
    updateTimer();

    if (!eu && sala.status === "finalizada") {
      renderFinal();
    } else if (!eu || (choosingTeam && sala.status === "aguardando")) {
      renderLobby();
    } else if (sala.status === "aguardando") {
      renderWaiting();
    } else if (sala.status === "em_jogo") {
      const justStarted = previous && previous.eu && previous.sala.status === "aguardando";
      renderGame();
      if (justStarted) countdown();
    } else {
      renderFinal();
    }

    if (previous && eu) {
      notifyChanges(previous, data);
    } else {
      // pedidos que já existiam ao abrir a página aparecem nos cards, sem novo aviso sonoro
      data.colegas_pedindo_ajuda.forEach((mate) => seenMateHelp.add(`${mate.id}:${mate.ajuda.pedida_em}`));
    }
  }

  function renderHeader() {
    const { sala, eu, minha_equipe: team } = state;
    const teamChip = $("#arena-team-chip");
    teamChip.hidden = !team;
    if (team) {
      teamChip.className = `chip chip-team c-${team.cor}`;
      teamChip.innerHTML = `${icon(team.icone)}<span>${escapeHtml(team.nome)}</span>`;
    }

    const helpButton = $("#open-help");
    helpButton.hidden = !(eu && sala.status === "em_jogo" && !eu.concluiu);
    helpButton.classList.toggle("is-waiting", Boolean(eu?.ajuda));
    $("#open-help-label").textContent = eu?.ajuda ? "Ajuda pedida" : "Preciso de ajuda";
  }

  function updateTimer() {
    const chip = $("#arena-timer");
    const eu = state?.eu;
    if (!eu || !eu.inicio_em || state.sala.status === "aguardando") {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    let seconds;
    if (eu.concluiu && eu.tempo !== null) {
      seconds = eu.tempo;
    } else if (state.sala.status === "finalizada" && state.sala.finalizada_em) {
      seconds = (Date.parse(state.sala.finalizada_em) - Date.parse(eu.inicio_em)) / 1000;
    } else {
      seconds = (Date.now() + serverOffset - Date.parse(eu.inicio_em)) / 1000;
    }
    chip.classList.toggle("done", Boolean(eu.concluiu));
    $("#arena-timer-value").textContent = formatTime(seconds);
  }

  /* ---------------------------------------------------------------- lobby */
  function renderLobby() {
    showView("lobby");
    const { equipes, eu } = state;
    setHtml($("#team-list"), equipes.length
      ? equipes.map((team) => {
        const seats = Array.from({ length: 4 }, (_, i) => `<i class="${i < team.membros.length ? "on" : ""}"></i>`).join("");
        const mine = eu && eu.equipe === team.chave;
        return `
          <button type="button" class="team-tile c-${team.cor}" data-team="${escapeHtml(team.nome)}" ${team.lotada && !mine ? "disabled" : ""}>
            <span class="team-icon">${icon(team.icone)}</span>
            <span class="team-info">
              <strong>${escapeHtml(team.nome)}</strong>
              <span>${escapeHtml(team.membros.join(", "))}</span>
            </span>
            <span class="team-seats" aria-label="${team.membros.length} de 4 lugares">${seats}</span>
            <span class="team-join">${mine ? "Sua equipe" : team.lotada ? "Lotada" : `Entrar ${icon("arrow-right")}`}</span>
          </button>`;
      }).join("")
      : `<p class="empty-note">${icon("rocket")} Nenhuma equipe ainda. Seja o primeiro a criar uma!</p>`);

    const used = new Set(equipes.map((team) => team.nome.toLowerCase()));
    setHtml($("#team-suggestions"), TEAM_NAMES
      .filter((name) => !used.has(name.toLowerCase()))
      .slice(0, 5)
      .map((name) => `<button type="button" class="suggestion" data-suggestion="${escapeHtml(name)}">${escapeHtml(name)}</button>`)
      .join(""));
    renderTeamPickers();
  }

  function renderTeamPickers() {
    setHtml($("#team-icons"), Object.entries(TEAM_ICONS).map(([name, label]) =>
      `<button type="button" class="icon-opt" data-icon="${name}" title="${label}" aria-label="Mascote ${label}" aria-pressed="${name === selectedIcon}">${icon(name)}</button>`).join(""));
    setHtml($("#team-colors"), TEAM_COLORS.map((color) =>
      `<button type="button" class="color-opt c-${color}" data-color="${color}" aria-label="Cor ${color}" aria-pressed="${color === selectedColor}"></button>`).join(""));
  }

  async function joinTeam(nome, cor, icone) {
    $("#team-error").textContent = "";
    try {
      const data = await api(page.dataset.teamUrl, { method: "POST", body: JSON.stringify({ nome, cor, icone }) });
      choosingTeam = false;
      sfx.add();
      toast(`Você entrou na equipe ${data.minha_equipe.nome}!`, "good", data.minha_equipe.icone);
      render(data);
    } catch (error) {
      $("#team-error").textContent = error.message;
      toast(error.message, "bad");
    }
  }

  /* ---------------------------------------------------------------- espera */
  function renderWaiting() {
    showView("waiting");
    const { minha_equipe: team, equipes } = state;
    $("#waiting-name").textContent = firstName;
    setHtml($("#waiting-team-title"), `<span class="title-ico">${icon(team.icone)}${escapeHtml(team.nome)}</span>`);
    setHtml($("#waiting-members"), renderMembers(team.membros, false));
    $("#waiting-count").textContent = `${equipes.length} ${equipes.length === 1 ? "equipe" : "equipes"}`;
    setHtml($("#waiting-teams"), equipes.map((item, i) => `
      <span class="team-pill c-${item.cor}" style="animation-delay:${i * 0.05}s">
        <span class="pill-icon">${icon(item.icone)}</span>${escapeHtml(item.nome)} · ${item.membros.length}
      </span>`).join(""));
    if (!tipTimer) {
      rotateTip();
      tipTimer = setInterval(rotateTip, 5000);
    }
  }

  function rotateTip() {
    const tip = $("#waiting-tip");
    const { ico, text } = WAIT_TIPS[tipIndex % WAIT_TIPS.length];
    tip.innerHTML = `${icon(ico)}<span>${text}</span>`;
    restartAnimation(tip);
    tipIndex += 1;
  }

  function renderMembers(members, detailed) {
    return members.map((member) => {
      const me = String(member.id) === studentId;
      let badge = `<span class="member-badge playing">${icon("bot")} programando</span>`;
      let info = me ? "Você" : "Explorador";
      if (member.concluiu) {
        badge = `<span class="member-badge done">${icon("circle-check")} ${formatTime(member.tempo)}</span>`;
        info = `${starsHtml(member.estrelas || 1)} · ${member.blocos} blocos`;
      } else if (member.ajuda) {
        badge = `<span class="member-badge help">${icon("hand")} ajuda</span>`;
        info = escapeHtml(member.ajuda.ajudante ? `${member.ajuda.ajudante} está ajudando` : member.ajuda.motivo_texto);
      } else if (!detailed) {
        badge = '<span class="member-badge playing">pronto!</span>';
      }
      return `
        <div class="member${me ? " me" : ""}${member.ajuda && !member.concluiu ? " needs-help" : ""}">
          <span class="member-avatar${member.online ? " online" : ""}" aria-hidden="true">${escapeHtml(initials(member.nome))}</span>
          <span class="member-info"><strong>${escapeHtml(member.nome)}${me ? " (você)" : ""}</strong><span>${info}</span></span>
          ${badge}
        </div>`;
    }).join("");
  }

  /* ---------------------------------------------------------------- jogo */
  function renderGame() {
    if (tipTimer) {
      clearInterval(tipTimer);
      tipTimer = null;
    }
    showView("game");
    const { sala, eu, minha_equipe: team, ranking } = state;
    const signature = `${sala.tamanho}:${sala.mapa}:${sala.direcao}`;
    if (signature !== mapSignature && !running) {
      mapSignature = signature;
      buildBoard();
      say(`Oi, ${firstName}! Eu começo olhando ${DIR_NAME[sala.direcao]}. Me leve até a bandeira!`);
    }

    $("#says-name").textContent = myRobot.name;
    $("#block-limit").textContent = blockLimit();
    updateCounter();
    $("#train-note").hidden = !eu.concluiu;

    setHtml($("#team-card-title"), `<span class="title-ico">${icon(team.icone)}${escapeHtml(team.nome)}</span>`);
    const done = team.membros.filter((member) => member.concluiu).length;
    $("#team-card-sub").textContent = `${done}/${team.membros.length} na bandeira`;
    setHtml($("#game-members"), renderMembers(team.membros, true));
    renderRanking($("#rank-list"), ranking);
    renderHelpBanner();
    renderMateCards();
  }

  // só troca o HTML quando ele muda (evita reiniciar animações a cada atualização)
  const lastHtml = new WeakMap();
  function setHtml(element, html) {
    if (lastHtml.get(element) === html) return;
    lastHtml.set(element, html);
    element.innerHTML = html;
  }

  function renderRanking(container, ranking) {
    const myTeam = state.minha_equipe?.chave;
    setHtml(container, ranking.length
      ? ranking.map((item, i) => `
        <li class="rank-item c-${item.cor}${item.chave === myTeam ? " mine" : ""}" style="animation-delay:${i * 0.04}s">
          <span class="rank-pos">${medal(i, item.posicao)}</span>
          <span class="rank-icon">${icon(item.icone)}</span>
          <span class="rank-name"><strong>${escapeHtml(item.nome)}</strong><span>${item.concluidos}/${item.jogadores} na bandeira</span></span>
          <span class="rank-time">${item.concluidos ? formatTime(item.tempo_total) : "--:--"}</span>
        </li>`).join("")
      : '<li class="rank-empty">O ranking aparece quando as equipes entrarem.</li>');
  }

  /* ---------------------------------------------------------------- pedido de ajuda
     A ajuda é presencial. O pedido tem um tempo de chamada (segundos_ajuda): se a
     equipe não resolver nesse tempo, aparece "A equipe toda está com dúvida?". */
  function helpSeconds() {
    return state?.segundos_ajuda || 30;
  }

  function helpElapsed(help) {
    return Math.max(0, (serverNow() - Date.parse(help.pedida_em)) / 1000);
  }

  function renderHelpBanner() {
    const { eu } = state;
    $("#help-status").hidden = !eu.ajuda || eu.concluiu;
    updateHelpBanner();
  }

  // roda a cada segundo, contando a partir do horário do servidor
  function updateHelpBanner() {
    const eu = state?.eu;
    const help = eu?.ajuda;
    const banner = $("#help-status");
    if (!help || banner.hidden) return;

    const total = helpSeconds();
    const left = Math.max(0, Math.ceil(total - helpElapsed(help)));
    const team = help.tipo === "equipe";
    const coming = help.status === "a_caminho";
    const expired = left === 0;
    let tone = "prof";
    let iconName = "presentation";
    let title;
    let text;
    if (team && expired) {
      tone = "alert";
      iconName = "users";
      title = coming ? `${help.ajudante} está te ajudando` : "Ainda com dúvida?";
      text = "Conseguiram resolver? Se a equipe toda estiver com dúvida, chame o professor.";
    } else if (coming) {
      tone = "coming";
      iconName = "footprints";
      title = `${help.ajudante} está vindo te ajudar!`;
      text = team
        ? "Mostre o seu programa e descubram juntos o que o robô está fazendo."
        : "Fique no seu lugar: a ajuda é pessoalmente!";
    } else if (team) {
      tone = "team";
      iconName = "handshake";
      title = "Sua equipe foi avisada!";
      text = "Espere um colega vir até o seu computador para te ajudar.";
    } else if (!expired) {
      iconName = "megaphone";
      title = "Chamando o professor...";
      text = "Ele recebeu o seu pedido na tela dele e logo vem até você.";
    } else {
      title = "O professor já sabe que você precisa de ajuda!";
      text = eu.posicao_fila
        ? `Você é o ${eu.posicao_fila}º da fila. Fique no seu lugar: ele vai até você.`
        : "Fique no seu lugar: ele vai até você.";
    }

    const counting = !expired && !(coming && !team);
    banner.dataset.tone = tone;
    banner.classList.toggle("is-done", !counting);
    $("#help-ring-value").textContent = left;
    $("#help-ring-bar").style.strokeDashoffset = counting ? String(100 - (left / total) * 100) : "0";
    const ringIcon = $("#help-status-icon");
    if (ringIcon.dataset.icon !== iconName) {
      ringIcon.dataset.icon = iconName;
      ringIcon.innerHTML = icon(iconName);
    }
    // só troca o texto quando ele muda (a região é lida por leitores de tela)
    if ($("#help-status-title").textContent !== title) $("#help-status-title").textContent = title;
    if ($("#help-status-text").textContent !== text) $("#help-status-text").textContent = text;
    $("#help-escalate").hidden = !(team && expired);
    $("#help-guide-btn").hidden = team || coming;

    // acabou o tempo da equipe: pergunta uma vez se a equipe toda está com dúvida
    const key = `${help.tipo}:${help.pedida_em}`;
    const otherModalOpen = $$(".modal").some((modal) => !modal.hidden);
    if (team && expired && !escalateShown.has(key) && !otherModalOpen) {
      escalateShown.add(key);
      openEscalate();
    }
  }

  /* colegas da equipe que pediram ajuda (vão até o computador deles) */
  let mateSignature = "";
  function renderMateCards() {
    const mates = state?.colegas_pedindo_ajuda || [];
    const signature = mates.map((mate) => [
      mate.id, mate.ajuda.tipo, mate.ajuda.pedida_em, mate.ajuda.status, mate.ajuda.ajudante,
      helpElapsed(mate.ajuda) >= helpSeconds(),
    ].join("|")).join(";");
    if (signature !== mateSignature) {
      mateSignature = signature;
      const list = $("#mate-help");
      list.hidden = !mates.length;
      list.innerHTML = mates.map(mateCardHtml).join("");
    }
    $$("#mate-help [data-since]").forEach((element) => {
      const seconds = (serverNow() - Date.parse(element.dataset.since)) / 1000;
      element.lastElementChild.textContent = `há ${formatTime(seconds)}`;
    });
  }

  function mateCardHtml(mate) {
    const name = firstNameOf(mate.nome);
    const help = mate.ajuda;
    const team = help.tipo === "equipe";
    const coming = help.status === "a_caminho";
    const mine = coming && String(help.ajudante_id) === studentId;
    const expired = team && helpElapsed(help) >= helpSeconds();
    let cls = "";
    let title;
    let text;
    if (mine) {
      cls = "is-coming";
      title = `Você está ajudando ${name}!`;
      text = `Vá até o computador de ${name} e expliquem juntos. Quando resolverem, ${name} toca em "Já resolvi".`;
    } else if (coming) {
      cls = "is-coming";
      title = help.ajudante_professor ? `O professor está ajudando ${name}` : `${help.ajudante} está ajudando ${name}`;
      text = "Valeu, equipe! Ajudar os colegas também conta pontos no ranking.";
    } else if (expired) {
      cls = "is-alert";
      title = `${name} ainda está com dúvida`;
      text = `Se a equipe toda também não souber, chamem o professor pelo computador de ${name}.`;
    } else if (team) {
      title = `${name} está precisando de ajuda!`;
      text = `Vá até o computador de ${name} para ajudar pessoalmente.`;
    } else {
      title = `${name} chamou o professor`;
      text = `Dúvida: ${help.motivo_texto}. Se você souber, pode ajudar também!`;
    }
    return `
      <div class="mate-card ${cls}">
        <span class="mate-avatar" aria-hidden="true">${escapeHtml(initials(mate.nome))}${icon(coming ? "footprints" : "hand")}</span>
        <div class="mate-copy"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>
        <div class="mate-actions">
          <span class="mate-time" data-since="${escapeHtml(help.pedida_em)}" aria-hidden="true">${icon("clock")}<span>há 00:00</span></span>
          ${coming ? "" : `<button type="button" class="btn-candy small" data-help-mate="${mate.id}">${icon("hand-heart")} Vou ajudar!</button>`}
        </div>
      </div>`;
  }

  function notifyChanges(previous, current) {
    const before = previous.eu?.ajuda;
    const now = current.eu?.ajuda;
    if (now?.status === "a_caminho" && before?.status !== "a_caminho") {
      sfx.alert();
      toast(`${now.ajudante} está vindo te ajudar!`, "good", "footprints");
    }
    if (before && !now && !cancellingHelp && !current.eu.concluiu && current.sala.status === "em_jogo") {
      sfx.alert();
      toast(before.tipo === "professor"
        ? "O professor marcou a sua dúvida como resolvida!"
        : "Sua dúvida foi marcada como resolvida!", "good", "circle-check");
      say("Oba, dúvida resolvida! Agora é com você: monte os blocos e tente de novo!", "good");
      closeModal($("#escalate-modal"));
    }
    cancellingHelp = false;

    current.colegas_pedindo_ajuda.forEach((mate) => {
      const key = `${mate.id}:${mate.ajuda.pedida_em}`;
      if (!seenMateHelp.has(key)) {
        seenMateHelp.add(key);
        if (mate.ajuda.status !== "a_caminho") {
          sfx.alert();
          const name = firstNameOf(mate.nome);
          if (mate.ajuda.tipo === "professor") toast(`${name} chamou o professor.`, "", "presentation");
          else toast(`${name} da sua equipe precisa de ajuda!`, "", "hand");
        }
      }
    });

    if (previous.sala.status === "em_jogo" && current.sala.status === "finalizada") {
      toast("O professor encerrou a partida!", "good", "flag");
    }
  }

  async function countdown() {
    const layer = $("#countdown");
    const value = $("#countdown-value");
    layer.hidden = false;
    for (const number of ["3", "2", "1", "Já!"]) {
      value.textContent = number;
      restartAnimation(value);
      if (number === "Já!") sfx.go();
      else sfx.tick();
      await sleep(reduceMotion ? 250 : 800);
    }
    layer.hidden = true;
  }

  /* ---------------------------------------------------------------- tabuleiro */
  const board = $("#board");

  function cellAt(row, col) {
    return board.querySelector(`.cell[data-index="${row * state.sala.tamanho + col}"]`);
  }

  function buildBoard() {
    const { tamanho, mapa } = state.sala;
    board.style.setProperty("--size", tamanho);
    board.innerHTML = "";
    const labels = { O: "parede", I: "início", F: "bandeira", L: "caminho livre" };
    for (let index = 0; index < tamanho * tamanho; index += 1) {
      const cell = document.createElement("div");
      const type = mapa[index];
      cell.className = `cell${type === "O" ? " wall" : ""}${type === "I" ? " start" : ""}${type === "F" ? " goal" : ""}`;
      cell.dataset.index = index;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Linha ${Math.floor(index / tamanho) + 1}, coluna ${(index % tamanho) + 1}: ${labels[type]}`);
      if (type === "F") cell.innerHTML = `<span class="goal-flag">${icon("bandeira")}</span>`;
      board.append(cell);
    }
    token = document.createElement("div");
    token.className = "robot-token";
    token.innerHTML = `
      <div class="token-body"><span class="robot-figure" data-my-robot><img src="${imgBase}${myRobot.pose}.png" alt=""><span class="robot-acc"></span></span></div>
      <span class="token-arrow" aria-hidden="true"></span>`;
    board.append(token);
    paintMyRobots(token);
    resetRobot();
  }

  function setTokenImage(imageId) {
    const figure = token?.querySelector("[data-my-robot]");
    if (!figure) return;
    figure.dataset.image = imageId || "";
    RR.paintFigure(figure, myRobot, imgBase, { imageId: imageId || null });
  }

  function placeRobot() {
    token.style.setProperty("--r", robot.r);
    token.style.setProperty("--c", robot.c);
    token.dataset.dir = robot.dir;
    token.querySelector(".token-arrow").style.setProperty("--angle", `${robot.angle}deg`);
    token.setAttribute("aria-label", `Robô na linha ${robot.r + 1}, coluna ${robot.c + 1}, olhando ${DIR_NAME[robot.dir]}`);
  }

  function stepDuration() {
    return fast ? 300 : 620;
  }

  function resetRobot() {
    if (!state || !token) return;
    const { tamanho, mapa, direcao } = state.sala;
    const start = mapa.indexOf("I");
    robot = { r: Math.floor(start / tamanho), c: start % tamanho, dir: direcao, angle: ANGLE[direcao] };
    token.style.setProperty("--step", "0s");
    token.classList.remove("walking", "crashing", "cheering");
    placeRobot();
    void token.offsetWidth;
    token.style.setProperty("--step", `${(stepDuration() * 0.75) / 1000}s`);
    setTokenImage(null);
    $$(".cell.visited, .cell.crash, .cell.oob", board).forEach((cell) => cell.classList.remove("visited", "crash", "oob"));
    clearHighlights();
  }

  function clearHint() {
    $$(".cell.hint", board).forEach((cell) => cell.classList.remove("hint"));
    $("#hint-toggle").hidden = true;
  }

  /* ---------------------------------------------------------------- programa */
  const programRoot = $("#program");

  function blockLimit() {
    return state?.sala.limite_blocos || state?.max_blocos || 40;
  }

  function countBlocks() {
    return program.reduce((total, node) => total + 1 + (node.comandos ? node.comandos.length : 0), 0);
  }

  function updateCounter() {
    const count = countBlocks();
    $("#block-count").textContent = count;
    $("#block-counter").classList.toggle("full", count >= blockLimit());
  }

  function findNode(id) {
    for (const node of program) {
      if (node.id === id) return { node, list: program, parent: null };
      if (node.comandos) {
        const inner = node.comandos.find((item) => item.id === id);
        if (inner) return { node: inner, list: node.comandos, parent: node };
      }
    }
    return null;
  }

  function createNode(tipo) {
    const node = { id: nextId, tipo };
    nextId += 1;
    if (tipo === "repetir") {
      node.vezes = 2;
      node.comandos = [];
    }
    return node;
  }

  function insertNode(node, listId, index) {
    if (countBlocks() >= blockLimit()) {
      say(`Ops! Aqui o limite é de ${blockLimit()} blocos. Tente usar o Repetir para economizar!`, "hint");
      RR.replayClass($("#block-counter"), "bump", 400);
      return false;
    }
    let list = program;
    if (listId !== "raiz") {
      const repeat = program.find((item) => item.id === Number(listId));
      if (repeat && node.tipo !== "repetir") {
        list = repeat.comandos;
      } else if (repeat) {
        // Repetir dentro de Repetir não vale: coloca logo depois dele
        index = program.indexOf(repeat) + 1;
      }
    }
    const position = index === undefined || index > list.length ? list.length : index;
    list.splice(position, 0, node);
    return true;
  }

  function addFromPalette(tipo, listId = target, index) {
    if (running) return;
    const node = createNode(tipo);
    if (!insertNode(node, listId, index)) return;
    sfx.add();
    if (tipo === "repetir") {
      target = node.id;
      say("Agora clique nos blocos para colocá-los dentro do Repetir! Quando terminar, clique em Pronto.", "hint");
    }
    renderProgram();
  }

  function removeNode(id) {
    const found = findNode(id);
    if (!found) return;
    found.list.splice(found.list.indexOf(found.node), 1);
    if (target === id) target = "raiz";
    renderProgram();
  }

  function listHtml(nodes, listId) {
    if (!nodes.length) {
      return listId === "raiz" ? "" : '<div class="repeat-hint">Clique aqui e depois nos blocos (ou arraste para cá)</div>';
    }
    return `<ol class="prog-list" data-lista="${listId}">${nodes.map((node, index) => nodeHtml(node, index, listId)).join("")}</ol>`;
  }

  function nodeHtml(node, index, listId) {
    const info = BLOCKS[node.tipo];
    const number = listId === "raiz" ? index + 1 : "";
    if (node.tipo !== "repetir") {
      return `
        <li class="prog-block" data-id="${node.id}">
          <span class="prog-num">${number}</span>
          <div class="block ${info.cls}" draggable="true" data-drag="${node.id}"><span class="b-ico">${icon(info.ico)}</span>${info.label}</div>
          <button type="button" class="prog-remove" data-remove="${node.id}" aria-label="Remover ${info.label}">${icon("x")}</button>
        </li>`;
    }
    const isTarget = target === node.id;
    return `
      <li class="prog-block" data-id="${node.id}">
        <span class="prog-num">${number}</span>
        <div class="repeat${isTarget ? " target" : ""}" data-repeat="${node.id}">
          <div class="repeat-head" draggable="true" data-drag="${node.id}">
            <span class="b-ico">${icon("repeat")}</span> Repetir
            <span class="stepper">
              <button type="button" data-step="-1" data-repeat-id="${node.id}" aria-label="Menos vezes">−</button>
              <output>${node.vezes}</output>
              <button type="button" data-step="1" data-repeat-id="${node.id}" aria-label="Mais vezes">+</button>
            </span>
            vezes
            <span class="repeat-lap" hidden></span>
          </div>
          <div class="repeat-body" data-lista="${node.id}">${listHtml(node.comandos, node.id)}</div>
          ${isTarget ? `<button type="button" class="repeat-done" data-done="${node.id}">${icon("check")} Pronto</button>` : ""}
        </div>
        <button type="button" class="prog-remove" data-remove="${node.id}" aria-label="Remover Repetir">${icon("x")}</button>
      </li>`;
  }

  function renderProgram() {
    $$(":scope > .prog-list", programRoot).forEach((list) => list.remove());
    $("#program-empty").hidden = program.length > 0;
    programRoot.insertAdjacentHTML("beforeend", listHtml(program, "raiz"));
    updateCounter();
  }

  programRoot.addEventListener("click", (event) => {
    if (running) return;
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      removeNode(Number(remove.dataset.remove));
      return;
    }
    const step = event.target.closest("[data-step]");
    if (step) {
      const repeat = program.find((item) => item.id === Number(step.dataset.repeatId));
      if (repeat) {
        repeat.vezes = Math.min(state?.max_repeticoes || 10, Math.max(1, repeat.vezes + Number(step.dataset.step)));
        sfx.turn();
        renderProgram();
      }
      return;
    }
    const done = event.target.closest("[data-done]");
    if (done) {
      target = "raiz";
      say("Beleza! Os próximos blocos vão para fora do Repetir.");
      renderProgram();
      return;
    }
    const body = event.target.closest(".repeat-body");
    if (body) {
      target = Number(body.dataset.lista);
      say("Os próximos blocos vão para dentro deste Repetir.", "hint");
      renderProgram();
      return;
    }
    if (!event.target.closest(".repeat") && target !== "raiz") {
      target = "raiz";
      renderProgram();
    }
  });

  /* arrastar e soltar */
  let dragData = null;

  $("#palette").addEventListener("click", (event) => {
    const block = event.target.closest("[data-tipo]");
    if (block) addFromPalette(block.dataset.tipo);
  });
  $("#palette").addEventListener("dragstart", (event) => {
    const block = event.target.closest("[data-tipo]");
    if (!block || running) return event.preventDefault();
    dragData = { from: "palette", tipo: block.dataset.tipo };
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", block.dataset.tipo);
  });
  programRoot.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-drag]");
    if (!handle || running) return event.preventDefault();
    dragData = { from: "program", id: Number(handle.dataset.drag) };
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", handle.dataset.drag);
    handle.closest(".prog-block").classList.add("dragging");
  });

  function dropContainer(event) {
    return event.target.closest(".repeat-body") || programRoot;
  }

  function clearDragMarks() {
    $$(".drag-over").forEach((element) => element.classList.remove("drag-over"));
  }

  programRoot.addEventListener("dragover", (event) => {
    if (!dragData) return;
    event.preventDefault();
    clearDragMarks();
    dropContainer(event).classList.add("drag-over");
  });
  programRoot.addEventListener("dragleave", (event) => {
    if (!programRoot.contains(event.relatedTarget)) clearDragMarks();
  });
  programRoot.addEventListener("drop", (event) => {
    event.preventDefault();
    clearDragMarks();
    if (!dragData) return;
    const container = dropContainer(event);
    const listId = container === programRoot ? "raiz" : container.dataset.lista;
    const listElement = container.querySelector(":scope > .prog-list");
    const items = listElement ? [...listElement.children] : [];
    let index = items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    if (index === -1) index = items.length;

    if (dragData.from === "palette") {
      addFromPalette(dragData.tipo, listId, index);
    } else {
      const found = findNode(dragData.id);
      const repeat = listId === "raiz" ? null : program.find((item) => item.id === Number(listId));
      if (found && found.node !== repeat) {
        const { node } = found;
        // Repetir não entra em outro Repetir: vai para logo depois dele
        const destination = repeat && node.tipo !== "repetir" ? repeat.comandos : program;
        const oldIndex = found.list.indexOf(node);
        found.list.splice(oldIndex, 1);
        let position = index;
        if (repeat && node.tipo === "repetir") {
          position = program.indexOf(repeat) + 1;
        } else if (found.list === destination && oldIndex < position) {
          position -= 1;
        }
        destination.splice(Math.min(position, destination.length), 0, node);
        sfx.add();
        renderProgram();
      }
    }
    dragData = null;
  });
  document.addEventListener("dragend", () => {
    dragData = null;
    clearDragMarks();
    $$(".prog-block.dragging").forEach((element) => element.classList.remove("dragging"));
  });

  /* ---------------------------------------------------------------- execução */
  function flatten() {
    const steps = [];
    program.forEach((node) => {
      if (node.tipo === "repetir") {
        for (let lap = 1; lap <= node.vezes; lap += 1) {
          node.comandos.forEach((inner) => steps.push({ tipo: inner.tipo, id: inner.id, repeatId: node.id, lap, total: node.vezes }));
        }
      } else {
        steps.push({ tipo: node.tipo, id: node.id });
      }
    });
    return steps;
  }

  function payload() {
    return program.map((node) => (node.tipo === "repetir"
      ? { tipo: "repetir", vezes: node.vezes, comandos: node.comandos.map((inner) => ({ tipo: inner.tipo })) }
      : { tipo: node.tipo }));
  }

  function blockNumber(step) {
    const rootId = step.repeatId || step.id;
    return program.findIndex((node) => node.id === rootId) + 1;
  }

  function clearHighlights() {
    $$(".prog-block.running, .prog-block.error, .repeat.running", programRoot)
      .forEach((element) => element.classList.remove("running", "error"));
    $$(".repeat-lap", programRoot).forEach((lap) => { lap.hidden = true; });
  }

  function highlight(step) {
    clearHighlights();
    programRoot.querySelector(`.prog-block[data-id="${step.id}"]`)?.classList.add("running");
    if (step.repeatId) {
      const repeat = programRoot.querySelector(`.repeat[data-repeat="${step.repeatId}"]`);
      repeat?.classList.add("running");
      const lap = repeat?.querySelector(".repeat-lap");
      if (lap) {
        lap.hidden = false;
        lap.textContent = `${step.lap}/${step.total}`;
      }
    }
  }

  function setRunning(value) {
    running = value;
    $("#run-btn").disabled = value;
    $("#run-btn").innerHTML = value ? `${icon("loader-circle", "spin")} Executando...` : `${icon("play", "ico-fill")} Executar`;
    $("#clear-btn").disabled = value;
    $("#reset-btn").innerHTML = value ? `${icon("square", "ico-fill")} Parar` : `${icon("rotate-ccw")} Reiniciar`;
    $$("#palette .block").forEach((block) => { block.disabled = value; });
  }

  async function animate(steps, myToken) {
    const { tamanho, mapa } = state.sala;
    for (const step of steps) {
      if (myToken !== runToken) return { aborted: true };
      highlight(step);
      if (step.tipo === "avancar") {
        const [dr, dc] = DELTA[robot.dir];
        const row = robot.r + dr;
        const col = robot.c + dc;
        if (row < 0 || row >= tamanho || col < 0 || col >= tamanho) {
          cellAt(robot.r, robot.c)?.classList.add("oob");
          return { ok: false, motivo: "fora_do_mapa", step };
        }
        if (mapa[row * tamanho + col] === "O") {
          cellAt(row, col)?.classList.add("crash");
          return { ok: false, motivo: "parede", step };
        }
        cellAt(robot.r, robot.c)?.classList.add("visited");
        robot.r = row;
        robot.c = col;
        RR.replayClass(token, "walking", stepDuration());
        sfx.move();
        placeRobot();
        if (mapa[row * tamanho + col] === "F") {
          await sleep(stepDuration() * 0.8);
          return { ok: true, step };
        }
      } else {
        const turnLeft = step.tipo === "virar_esquerda";
        robot.dir = DIRS[(DIRS.indexOf(robot.dir) + (turnLeft ? 3 : 1)) % 4];
        robot.angle += turnLeft ? -90 : 90;
        sfx.turn();
        placeRobot();
      }
      await sleep(stepDuration());
    }
    return { ok: false, motivo: "nao_chegou" };
  }

  function describeDistance(rows, cols) {
    const parts = [];
    if (rows < 0) parts.push(`${-rows} ${-rows === 1 ? "casa" : "casas"} para cima`);
    if (rows > 0) parts.push(`${rows} ${rows === 1 ? "casa" : "casas"} para baixo`);
    if (cols > 0) parts.push(`${cols} ${cols === 1 ? "casa" : "casas"} para a direita`);
    if (cols < 0) parts.push(`${-cols} ${-cols === 1 ? "casa" : "casas"} para a esquerda`);
    return parts.join(" e ");
  }

  async function run() {
    if (running || !state) return;
    if (!program.length) {
      say("Coloque alguns blocos primeiro! Eu só me mexo com os blocos do programa.", "hint");
      return;
    }
    if (program.some((node) => node.tipo === "repetir" && !node.comandos.length)) {
      say("Tem um Repetir vazio! Coloque blocos dentro dele.", "hint");
      return;
    }

    const myToken = ++runToken;
    setRunning(true);
    resetRobot();
    // no celular o tabuleiro fica acima dos blocos: mostra o robô andando
    if (window.matchMedia("(max-width: 860px)").matches) {
      $(".board-wrap").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
    let result;
    try {
      result = await api(page.dataset.runUrl, { method: "POST", body: JSON.stringify({ programa: payload() }) });
    } catch (error) {
      setRunning(false);
      say(error.message, "bad");
      toast(error.message, "bad");
      return;
    }

    say("Lá vou eu!");
    const outcome = await animate(flatten(), myToken);
    if (outcome.aborted) return;
    setRunning(false);

    if (outcome.ok) {
      clearHighlights();
      token.classList.add("cheering");
      setTokenImage(3);
      sfx.win();
      confetti(token);
      if (result.ja_concluiu) {
        say(`Treino concluído! Você usou ${result.blocos} blocos. Dá para usar menos com o Repetir?`, "good");
      } else {
        say("Chegueeei! Você é demais!", "good");
        openWin(result);
      }
    } else {
      token.classList.add("crashing");
      setTokenImage(2);
      sfx.crash();
      if (outcome.step) programRoot.querySelector(`.prog-block[data-id="${outcome.step.id}"]`)?.classList.add("error");
      const number = outcome.step ? blockNumber(outcome.step) : 0;
      if (outcome.motivo === "parede") {
        say(`Ops! Bati numa parede no bloco ${number}. Eu estava olhando ${DIR_NAME[robot.dir]}: talvez eu precise virar antes de avançar.`, "bad");
      } else if (outcome.motivo === "fora_do_mapa") {
        say(`Epa! No bloco ${number} eu quase saí do mapa! Eu estava olhando ${DIR_NAME[robot.dir]}.`, "bad");
      } else {
        const { tamanho, mapa } = state.sala;
        const goal = mapa.indexOf("F");
        const distance = describeDistance(Math.floor(goal / tamanho) - robot.r, (goal % tamanho) - robot.c);
        say(`Os blocos acabaram e eu parei. A bandeira ainda está ${distance}. Faltam mais passos!`, "bad");
      }
      if (!result.ja_concluiu && result.tentativas >= 3 && !state.eu?.ajuda && (state.eu?.dicas || 0) === 0) {
        setTimeout(() => toast("Travou? Toque em Preciso de ajuda e veja as dicas do robô!", "", "lightbulb"), 1200);
      }
    }
    refresh();
  }

  function openWin(result) {
    $("#win-time").textContent = formatTime(result.tempo);
    $("#win-blocks").textContent = result.blocos;
    $("#win-tries").textContent = result.tentativas;
    const stars = result.estrelas || 1;
    $("#win-stars").innerHTML = [1, 2, 3]
      .map((n) => `<span class="${n <= stars ? "" : "off"}" style="animation-delay:${0.2 + n * 0.15}s">${icon("star", "ico-fill")}</span>`).join("");
    const myTeam = state.minha_equipe?.chave;
    const position = result.ranking.find((item) => item.chave === myTeam)?.posicao;
    $("#win-team").textContent = position ? `Sua equipe está em ${position}º lugar no ranking!` : "";
    paintMyRobots($("#win-modal"));
    openModal($("#win-modal"));
  }

  $("#run-btn").addEventListener("click", run);
  $("#reset-btn").addEventListener("click", () => {
    if (running) {
      runToken += 1;
      setRunning(false);
      say("Parei! Ajuste os blocos e tente de novo.");
    }
    resetRobot();
  });
  $("#clear-btn").addEventListener("click", () => {
    if (running || !program.length) return;
    program = [];
    target = "raiz";
    renderProgram();
    resetRobot();
    say("Programa apagado. Vamos recomeçar!");
  });
  $("#speed-btn").addEventListener("click", (event) => {
    fast = !fast;
    event.currentTarget.setAttribute("aria-pressed", String(fast));
    $("#speed-icon").innerHTML = icon(fast ? "rabbit" : "turtle");
    $("#speed-label").textContent = fast ? "Rápido" : "Devagar";
    token?.style.setProperty("--step", `${(stepDuration() * 0.75) / 1000}s`);
  });
  function paintSoundToggle() {
    const button = $("#sound-toggle");
    button.innerHTML = icon(soundOn ? "volume-2" : "volume-x");
    button.setAttribute("aria-pressed", String(soundOn));
    button.title = soundOn ? "Som ligado" : "Som desligado";
  }

  $("#sound-toggle").addEventListener("click", () => {
    soundOn = !soundOn;
    writeSetting("robooteam-som", soundOn ? "1" : "0");
    paintSoundToggle();
    sfx.add();
  });

  /* ---------------------------------------------------------------- ajuda */
  const helpModal = $("#help-modal");

  function openModal(modal) {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".modal-close, [data-close]:not(.modal-backdrop)")?.focus();
  }

  function closeModal(modal) {
    modal.hidden = true;
    if (!$$(".modal").some((item) => !item.hidden)) document.body.classList.remove("modal-open");
  }

  $$(".modal").forEach((modal) => {
    modal.querySelectorAll("[data-close]").forEach((element) => element.addEventListener("click", () => closeModal(modal)));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") $$(".modal").forEach((modal) => closeModal(modal));
  });

  function canAskForHelp() {
    return Boolean(state?.eu && state.sala.status === "em_jogo" && !state.eu.concluiu);
  }

  // menu com os três tipos de ajuda
  function prepareHelpMenu() {
    const { eu, minha_equipe: team, motivos_ajuda: reasons } = state;
    const used = Math.min(eu.dicas || 0, 3);
    $$("#hint-meter i").forEach((bar, index) => bar.classList.toggle("on", index < used));
    const alone = team.membros.length < 2;
    const waiting = Boolean(eu.ajuda);
    $("#help-team").disabled = alone || waiting;
    $("#help-team-text").textContent = alone
      ? "Você ainda está sozinho na equipe."
      : waiting ? "Você já pediu ajuda. Aguarde!" : "Um colega vem até o seu computador.";
    $("#help-prof").disabled = waiting;
    $("#help-prof-text").textContent = waiting
      ? "Você já pediu ajuda. Aguarde!"
      : "Conte qual é a dúvida e ele vem até você.";
    $("#help-prof").classList.remove("selected");
    $("#reason-box").hidden = true;
    selectedReason = null;
    $("#send-prof-help").disabled = true;
    $("#reason-chips").innerHTML = Object.entries(reasons)
      .map(([key, text]) => `<button type="button" class="reason-chip" data-reason="${key}" aria-pressed="false">${escapeHtml(text)}</button>`)
      .join("");
    $$("[data-help-seconds]").forEach((element) => { element.textContent = helpSeconds(); });
  }

  function setHelpView(view) {
    const guide = view === "guia";
    $("#help-menu").hidden = guide;
    $("#help-guide").hidden = !guide;
    $("#help-head-ico").innerHTML = icon(guide ? "lightbulb" : "hand");
    $("#help-title").textContent = guide ? "Guia do robô" : "Precisa de uma forcinha?";
    $("#help-subtitle").textContent = guide
      ? "Aprenda como a fase funciona e o que cada bloco faz."
      : "Escolha o tipo de ajuda. Pedir ajuda é coisa de quem quer aprender!";
    $("#guide-back").hidden = !canAskForHelp();
    if (guide) renderGuide();
    helpModal.querySelector(".modal-panel").scrollTop = 0;
  }

  function openHelp(view = "menu", tab = null) {
    if (view === "menu") prepareHelpMenu();
    if (tab) guideTab = tab;
    setHelpView(view);
    openModal(helpModal);
  }

  $("#open-help").addEventListener("click", () => openHelp(canAskForHelp() ? "menu" : "guia"));
  $$("[data-open-guide]").forEach((button) => {
    button.addEventListener("click", () => openHelp("guia", button.dataset.openGuide));
  });
  $("#help-guide-btn").addEventListener("click", () => openHelp("guia", "blocos"));
  $("#help-open-guide").addEventListener("click", () => setHelpView("guia"));
  $("#guide-back").addEventListener("click", () => {
    prepareHelpMenu();
    setHelpView("menu");
  });

  /* guia do robô: como a fase funciona, o que cada bloco faz, lógica e dicas do mapa */
  function robotTip() {
    const { sala, eu } = state;
    const facing = DIR_NAME[sala.direcao];
    if (!eu || sala.status === "aguardando") {
      return `Quando o jogo começar, eu vou estar olhando ${facing}. Leia o guia para chegar preparado!`;
    }
    if (eu.concluiu) return "Você já chegou à bandeira! Agora tente chegar usando menos blocos com o Repetir.";
    if (eu.ultimo_erro === "parede") {
      return "Na última tentativa eu bati numa parede. Veja o bloco que ficou vermelho: antes dele, talvez eu precise virar.";
    }
    if (eu.ultimo_erro === "fora_do_mapa") {
      return "Na última tentativa eu quase saí do mapa! Antes de avançar, confira para onde a setinha amarela aponta.";
    }
    if (eu.ultimo_erro === "nao_chegou") {
      return "Na última tentativa os blocos acabaram antes da bandeira. Continue o programa de onde eu parei!";
    }
    if (!program.length) {
      return `Comece devagar: eu estou olhando ${facing}. Quantas casinhas consigo andar antes de precisar virar?`;
    }
    return "Aperte Executar para testar o que você já montou. Testar aos pouquinhos ajuda a achar os erros!";
  }

  function renderGuide() {
    const { sala, eu, minha_equipe: team } = state;
    $("#guide-tip").textContent = robotTip();
    const facts = [
      `${icon("map")} Mapa ${sala.tamanho} × ${sala.tamanho}`,
      `<span class="dir-arrow" style="--angle:${ANGLE[sala.direcao]}deg">${icon("arrow-up")}</span> Eu começo olhando ${DIR_NAME[sala.direcao]}`,
      `${icon("puzzle")} Até ${blockLimit()} blocos`,
    ];
    if (team) facts.push(`${icon(team.icone)} Equipe ${escapeHtml(team.nome)}`);
    $("#guide-facts").innerHTML = facts.map((fact) => `<span class="fact">${fact}</span>`).join("");

    // a dica do mapa só existe durante a partida
    const mapAllowed = Boolean(eu && sala.status === "em_jogo");
    $("#tab-mapa").hidden = !mapAllowed;
    if (!mapAllowed && guideTab === "mapa") guideTab = "missao";
    const used = Math.min(eu?.dicas || 0, 3);
    $$("#hint-levels li").forEach((item) => {
      const level = Number(item.dataset.level);
      item.classList.toggle("done", level <= used);
      item.classList.toggle("next", level === used + 1);
    });
    $("#help-hint-label").textContent = used < 3 ? `Ver dica ${used + 1}` : "Ver o caminho de novo";
    selectTab(guideTab, false);
    paintMyRobots($("#help-guide"));
  }

  function selectTab(name, focus = true) {
    guideTab = name;
    $$(".guide-tabs [role='tab']").forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    $$(".guide-panel").forEach((panel) => { panel.hidden = panel.id !== `panel-${name}`; });
  }

  $(".guide-tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) selectTab(tab.dataset.tab);
  });
  $(".guide-tabs").addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = $$(".guide-tabs [role='tab']").filter((tab) => !tab.hidden);
    const index = tabs.findIndex((tab) => tab.dataset.tab === guideTab);
    let next = (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    event.preventDefault();
    selectTab(tabs[next].dataset.tab);
  });

  $("#help-hint").addEventListener("click", async () => {
    closeModal(helpModal);
    try {
      showHint(await api(page.dataset.hintUrl, { method: "POST" }));
      refresh();
    } catch (error) {
      toast(error.message, "bad");
    }
  });

  function showHint(hint) {
    clearHint();
    const { tamanho, mapa, direcao } = state.sala;
    let text;
    if (hint.nivel === 1) {
      const start = mapa.indexOf("I");
      const goal = mapa.indexOf("F");
      const distance = describeDistance(
        Math.floor(goal / tamanho) - Math.floor(start / tamanho),
        (goal % tamanho) - (start % tamanho),
      );
      text = `Dica 1: eu começo olhando ${DIR_NAME[direcao]}. A bandeira está ${distance} de mim. Desvie das paredes roxas!`;
    } else {
      hint.casas.forEach((spot, order) => {
        const cell = cellAt(spot.linha, spot.coluna);
        if (cell && !cell.classList.contains("goal")) {
          cell.classList.add("hint");
          cell.style.setProperty("--order", order);
        }
      });
      $("#hint-toggle").hidden = false;
      const first = hint.primeiros_comandos.map((command) => BLOCKS[command].label).join(", ");
      text = hint.nivel === 2
        ? `Dica 2: siga as pegadas amarelas no mapa! Comece com: ${first}.`
        : `Dica 3: as pegadas mostram o caminho todinho! São ${hint.total_comandos} comandos. Dá para economizar com o Repetir?`;
    }
    say(text, "hint");
    sfx.alert();
    if (window.matchMedia("(max-width: 860px)").matches) {
      $(".board-card").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  $("#hint-toggle").addEventListener("click", clearHint);

  /* pedidos de ajuda: a equipe ou o professor vão até o computador do aluno */
  async function askForHelp(body, message, iconName) {
    try {
      render(await api(page.dataset.helpUrl, { method: "POST", body: JSON.stringify(body) }));
      closeModal(helpModal);
      closeModal($("#escalate-modal"));
      toast(message, "good", iconName);
    } catch (error) {
      toast(error.message, "bad");
    }
  }

  async function resolveHelp() {
    try {
      cancellingHelp = true;
      render(await api(page.dataset.helpUrl, { method: "DELETE" }));
      closeModal($("#escalate-modal"));
      toast("Que bom que deu certo!", "good", "party-popper");
    } catch (error) {
      cancellingHelp = false;
      toast(error.message, "bad");
    }
  }

  function openEscalate() {
    paintMyRobots($("#escalate-modal"));
    openModal($("#escalate-modal"));
    sfx.alert();
  }

  $("#help-team").addEventListener("click", () => askForHelp(
    { tipo: "equipe" }, "Avisei sua equipe! Um colega vai até você.", "megaphone"));

  $("#help-prof").addEventListener("click", (event) => {
    event.currentTarget.classList.add("selected");
    $("#reason-box").hidden = false;
    $("#reason-chips button")?.focus();
  });

  $("#reason-chips").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-reason]");
    if (!chip) return;
    selectedReason = chip.dataset.reason;
    $$("#reason-chips [data-reason]").forEach((item) => item.setAttribute("aria-pressed", String(item === chip)));
    $("#send-prof-help").disabled = false;
  });

  $("#send-prof-help").addEventListener("click", () => {
    if (!selectedReason) return;
    askForHelp({ tipo: "professor", motivo: selectedReason }, "Professor chamado! Você entrou na fila.", "presentation");
  });

  $("#help-cancel").addEventListener("click", resolveHelp);
  $("#help-escalate").addEventListener("click", openEscalate);
  $("#escalate-solved").addEventListener("click", resolveHelp);
  $("#escalate-call").addEventListener("click", () => askForHelp(
    { tipo: "professor", motivo: ESCALATE_REASON }, "Professor chamado! Ele vai até vocês.", "presentation"));

  $("#mate-help").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-help-mate]");
    if (!button) return;
    const url = page.dataset.helpMateUrl.replace(/0$/, button.dataset.helpMate);
    button.disabled = true;
    try {
      render(await api(url, { method: "POST" }));
      toast("Obrigado por ajudar! Agora vá até o computador do seu colega.", "good", "heart");
    } catch (error) {
      button.disabled = false;
      toast(error.message, "bad");
    }
  });

  /* ---------------------------------------------------------------- lobby: eventos */
  $("#team-list").addEventListener("click", (event) => {
    const tile = event.target.closest("[data-team]");
    if (tile && !tile.disabled) joinTeam(tile.dataset.team);
  });
  $("#team-suggestions").addEventListener("click", (event) => {
    const chip = event.target.closest("[data-suggestion]");
    if (!chip) return;
    $("#team-name").value = chip.dataset.suggestion;
    $("#team-name").focus();
  });
  $("#team-icons").addEventListener("click", (event) => {
    const option = event.target.closest("[data-icon]");
    if (!option) return;
    selectedIcon = option.dataset.icon;
    renderTeamPickers();
  });
  $("#team-colors").addEventListener("click", (event) => {
    const option = event.target.closest("[data-color]");
    if (!option) return;
    selectedColor = option.dataset.color;
    renderTeamPickers();
  });
  $("#team-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("#team-name").value.trim();
    if (name.length < 2) {
      $("#team-error").textContent = "Dê um nome para a sua equipe (pelo menos 2 letras).";
      $("#team-name").focus();
      return;
    }
    joinTeam(name, selectedColor, selectedIcon);
  });
  $("#change-team").addEventListener("click", () => {
    choosingTeam = true;
    render(state);
  });

  /* ---------------------------------------------------------------- fim */
  function renderFinal() {
    showView("final");
    const { ranking } = state;
    const myTeam = state.minha_equipe?.chave;
    const winner = ranking[0];
    $("#final-title").textContent = winner && winner.chave === myTeam
      ? "Sua equipe venceu!"
      : "Parabéns, exploradores!";
    $("#final-text").textContent = state.eu?.concluiu
      ? `Você levou o robô até a bandeira em ${formatTime(state.eu.tempo)}. Mandou muito bem!`
      : "Veja como ficou o ranking das equipes. Na próxima, você chega lá!";

    const order = [ranking[1], ranking[0], ranking[2]];
    const classes = ["p2", "p1", "p3"];
    setHtml($("#podium"), order.map((item, i) => (item ? `
      <div class="podium-step ${classes[i]} c-${item.cor}">
        <span class="podium-icon">${icon(item.icone)}</span>
        <strong>${escapeHtml(item.nome)}</strong>
        <span>${item.concluidos}/${item.jogadores} · ${item.concluidos ? formatTime(item.tempo_total) : "--:--"}</span>
        <div class="podium-block">${medal(item.posicao - 1, item.posicao)}</div>
      </div>` : "")).join(""));
    renderRanking($("#final-rank"), ranking);
    paintMyRobots($("#view-final"));
    if (!finalCelebrated && winner && winner.chave === myTeam) {
      finalCelebrated = true;
      sfx.win();
      confetti($("#podium"));
    }
  }

  /* ---------------------------------------------------------------- atualização */
  async function refresh() {
    try {
      render(await api(page.dataset.stateUrl));
    } catch (error) {
      if (error.status === 404) {
        toast("Esta arena foi removida pelo professor.", "bad");
        clearTimeout(pollTimer);
        setTimeout(() => { window.location.href = page.dataset.dashboardUrl; }, 2500);
        return false;
      }
    }
    return true;
  }

  function schedule() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      const keepGoing = document.hidden || await refresh();
      if (keepGoing !== false) schedule();
    }, 3000);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });

  paintSoundToggle();
  paintMyRobots();
  renderProgram();
  setInterval(() => {
    updateTimer();
    if (page.dataset.view === "game") {
      updateHelpBanner();
      renderMateCards();
    }
  }, 1000);
  refresh().then(schedule);
})();

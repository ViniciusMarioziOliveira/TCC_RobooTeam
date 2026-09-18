/* =========================================================================
   TRILHA DA IA - PÁGINA DA AULA
   Leitura + quiz com justificativas + minijogo + mascote companheiro.
   ========================================================================= */

const lessonShell = document.querySelector(".lesson-shell");
const questions = [...document.querySelectorAll(".quiz-question")];
const quizProgress = document.querySelector("#quiz-progress");
const finishButton = document.querySelector("#finish-button");
const checklistText = document.querySelector("#completion-checklist");

const lessonId = Number(lessonShell.dataset.lessonId);
const quizData = JSON.parse(lessonShell.dataset.quiz || "[]");
const minigameData = JSON.parse(lessonShell.dataset.minigame || "{}");
const mascotBase = lessonShell.dataset.mascotBase || "/static/img/";
const jaConcluida = lessonShell.dataset.jaConcluida === "true";

const answeredCorrectly = new Set();
const selectedAnswers = Array(questions.length).fill(null);
let isMinigameComplete = minigameData.type === "nenhum" || !minigameData.type;

// =========================================================================
// 1. SOM (WEB AUDIO API)
// =========================================================================
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx && AudioContextClass) audioCtx = new AudioContextClass();
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "correct") {
      osc.type = "sine";
      [523.25, 659.25, 783.99].forEach((hz, i) => osc.frequency.setValueAtTime(hz, now + i * 0.08));
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "error") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(110, now + 0.1);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "victory") {
      osc.type = "triangle";
      [440, 554.37, 659.25, 880].forEach((hz, i) => osc.frequency.setValueAtTime(hz, now + i * 0.1));
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    }
  } catch {
    /* navegador pode bloquear áudio antes da primeira interação */
  }
}

// =========================================================================
// 2. MASCOTE COMPANHEIRO
// =========================================================================
const MASCOT_MOODS = {
  ola: "1.png",
  dica: "2.png",
  festa: "3.png",
  aponta: "4.png",
  calmo: "5.png",
  ops: "6.png",
};

const DICAS_GERAIS = [
  "Leia os blocos numerados devagar: a resposta do quiz está escondida neles!",
  "Errou uma pergunta? Sem problema! Leia a explicação e tente de novo.",
  "Cada etapa tem um minijogo. Jogar também é aprender!",
  "Se travar, volte ao texto lá de cima. Eu espero por você.",
  "Respire fundo, pense com calma e siga em frente. Você consegue!",
];

const mascotBuddy = document.querySelector("#mascot-buddy");
const mascotBubble = document.querySelector("#mascot-bubble");
const mascotImage = document.querySelector("#mascot-image");
const mascotAvatar = document.querySelector("#mascot-avatar");
let mascotTimer = null;
let dicaIndex = 0;

function mascotSay(texto, mood = "ola", duracao = 5200) {
  if (!mascotBubble || !mascotImage) return;

  mascotImage.src = `${mascotBase}${MASCOT_MOODS[mood] || MASCOT_MOODS.ola}`;
  mascotBubble.textContent = texto;
  mascotBuddy.classList.add("falando");
  mascotBuddy.classList.toggle("comemorando", mood === "festa");

  window.clearTimeout(mascotTimer);
  if (duracao > 0) {
    mascotTimer = window.setTimeout(() => {
      mascotBuddy.classList.remove("falando", "comemorando");
    }, duracao);
  }
}

mascotAvatar?.addEventListener("click", () => {
  mascotSay(DICAS_GERAIS[dicaIndex % DICAS_GERAIS.length], "dica", 6000);
  dicaIndex += 1;
});

// =========================================================================
// 3. CONFETE
// =========================================================================
const confettiCanvas = document.querySelector("#confetti-layer");
const confettiCtx = confettiCanvas?.getContext("2d");
let confettiPieces = [];
let confettiRaf = null;

function soltarConfete(quantidade = 90) {
  if (!confettiCanvas || !confettiCtx) return;

  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const cores = ["#2DD4E8", "#2F5DE0", "#20C671", "#F6B93B", "#8B6FEA", "#FF7BAC"];

  for (let i = 0; i < quantidade; i += 1) {
    confettiPieces.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * 120,
      w: 6 + Math.random() * 7,
      h: 9 + Math.random() * 9,
      cor: cores[Math.floor(Math.random() * cores.length)],
      vy: 2.2 + Math.random() * 3.2,
      vx: -1.4 + Math.random() * 2.8,
      giro: Math.random() * Math.PI,
      vGiro: -0.12 + Math.random() * 0.24,
    });
  }

  if (!confettiRaf) confettiRaf = requestAnimationFrame(animarConfete);
}

function animarConfete() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

  confettiPieces = confettiPieces.filter((p) => p.y < confettiCanvas.height + 40);
  confettiPieces.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.giro += p.vGiro;

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.giro);
    confettiCtx.fillStyle = p.cor;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  });

  if (confettiPieces.length) {
    confettiRaf = requestAnimationFrame(animarConfete);
  } else {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiRaf = null;
  }
}

// =========================================================================
// 4. QUIZ COM JUSTIFICATIVAS
// =========================================================================
const ELOGIOS = ["Isso aí!", "Mandou bem!", "Boa!", "Show de bola!", "Perfeito!"];
const INCENTIVOS = [
  "Quase lá! Leia a explicação e escolha outra opção.",
  "Não faz mal errar: é assim que a gente aprende!",
  "Ops! Volte no texto e tente de novo.",
];

function sorteio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

questions.forEach((questionEl, qIdx) => {
  const options = [...questionEl.querySelectorAll(".quiz-option")];
  const feedbackBox = questionEl.querySelector(".quiz-feedback-box");
  const statusEl = questionEl.querySelector(".quiz-feedback-status");
  const justificationEl = questionEl.querySelector(".quiz-justification");
  const qInfo = quizData[qIdx] || {};

  options.forEach((optionBtn) => {
    optionBtn.addEventListener("click", () => {
      options.forEach((opt) => opt.classList.remove("selected", "incorrect", "correct"));
      optionBtn.classList.add("selected");

      const selectedOptIdx = Number(optionBtn.dataset.option);
      selectedAnswers[qIdx] = selectedOptIdx;
      feedbackBox.classList.add("visivel");

      if (selectedOptIdx === qInfo.answer) {
        optionBtn.classList.add("correct");
        statusEl.textContent = "Resposta correta!";
        statusEl.className = "quiz-feedback-status correct-text";
        justificationEl.textContent = qInfo.justification || "Conceito compreendido corretamente.";
        feedbackBox.className = "quiz-feedback-box visivel acerto";
        answeredCorrectly.add(qIdx);
        playSound("correct");
        mascotSay(`${sorteio(ELOGIOS)} ${qInfo.justification || "Você acertou!"}`, "festa", 4200);
      } else {
        optionBtn.classList.add("incorrect");
        statusEl.textContent = "Ainda não é essa. Leia a explicação:";
        statusEl.className = "quiz-feedback-status incorrect-text";
        justificationEl.textContent = qInfo.justification || "Revise o conteúdo teórico e responda novamente.";
        feedbackBox.className = "quiz-feedback-box visivel erro";
        answeredCorrectly.delete(qIdx);
        playSound("error");
        mascotSay(sorteio(INCENTIVOS), "ops", 4200);
      }

      quizProgress.textContent = `${answeredCorrectly.size} de ${questions.length} questões corretas`;
      checkOverallCompletion();
    });
  });
});

// =========================================================================
// 5. MINIJOGO: LABIRINTO DOS ROBÔS
// =========================================================================
const MAZE_LEVELS = [
  {
    level: 1,
    instruction: "Pegue o circuito dourado e alcance a saída verde!",
    chipsNeeded: 1,
    start: { x: 1, y: 1 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 3, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 4, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    level: 2,
    instruction: "Encontre os 2 circuitos e chegue até a saída!",
    chipsNeeded: 2,
    start: { x: 1, y: 1 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 3, 1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1, 0, 1],
      [1, 0, 0, 0, 1, 3, 0, 4, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
  {
    level: 3,
    instruction: "Colete os 3 circuitos e ative a saída final!",
    chipsNeeded: 3,
    start: { x: 1, y: 1 },
    grid: [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1, 3, 0, 0, 1, 3, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
      [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [1, 3, 0, 0, 1, 0, 0, 0, 1, 4, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
  },
];

function initMazeMinigame() {
  const canvas = document.querySelector("#maze-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const levelDisplay = document.querySelector("#maze-level-display");
  const chipsDisplay = document.querySelector("#maze-chips-display");
  const statusText = document.querySelector("#maze-status-text");
  const restartBtn = document.querySelector("#maze-restart-btn");
  const feedbackEl = document.querySelector("#minigame-feedback");

  const totalFases = Math.min(Math.max(Number(minigameData.total_levels) || 3, 1), MAZE_LEVELS.length);
  const fases = MAZE_LEVELS.slice(0, totalFases);

  let currentLevelIdx = 0;
  let playerPos = { x: 1, y: 1 };
  let playerDir = "down";
  let currentGrid = [];
  let collectedChips = 0;
  let animTick = 0;
  let isLevelTransitioning = false;

  function updateHUD() {
    const lvl = fases[currentLevelIdx];
    if (levelDisplay) levelDisplay.textContent = `${currentLevelIdx + 1} / ${fases.length}`;
    if (chipsDisplay) chipsDisplay.textContent = `${collectedChips} / ${lvl.chipsNeeded}`;
  }

  function loadLevel(idx) {
    currentLevelIdx = idx;
    const lvl = fases[currentLevelIdx];
    currentGrid = lvl.grid.map((row) => [...row]);
    playerPos = { ...lvl.start };
    playerDir = "down";
    collectedChips = 0;
    isLevelTransitioning = false;
    updateHUD();

    if (statusText) {
      statusText.textContent = lvl.instruction;
      statusText.className = "";
    }
    if (feedbackEl && !isMinigameComplete) {
      feedbackEl.textContent = "";
      feedbackEl.className = "minigame-feedback";
    }
  }

  function movePlayer(dx, dy) {
    if (isLevelTransitioning) return;

    if (dx === 1) playerDir = "right";
    else if (dx === -1) playerDir = "left";
    else if (dy === 1) playerDir = "down";
    else if (dy === -1) playerDir = "up";

    const nextX = playerPos.x + dx;
    const nextY = playerPos.y + dy;
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;

    if (nextX < 0 || nextX >= cols || nextY < 0 || nextY >= rows) return;
    if (currentGrid[nextY][nextX] === 1) return;

    playerPos.x = nextX;
    playerPos.y = nextY;

    const lvl = fases[currentLevelIdx];

    if (currentGrid[nextY][nextX] === 3) {
      currentGrid[nextY][nextX] = 0;
      collectedChips += 1;
      playSound("correct");
      updateHUD();

      if (collectedChips >= lvl.chipsNeeded) {
        if (statusText) {
          statusText.textContent = "Todos os circuitos coletados! Vá para a saída verde!";
          statusText.className = "success-text";
        }
        mascotSay("Boa! Agora corra até a saída verde!", "aponta", 3800);
      }
    }

    if (currentGrid[nextY][nextX] === 4) {
      if (collectedChips < lvl.chipsNeeded) {
        if (statusText) {
          statusText.textContent = `Colete todos os circuitos antes de sair! Faltam ${lvl.chipsNeeded - collectedChips}.`;
          statusText.className = "error-text";
        }
        playSound("error");
        return;
      }

      isLevelTransitioning = true;
      playSound("victory");

      if (currentLevelIdx < fases.length - 1) {
        if (statusText) {
          statusText.textContent = `Fase ${currentLevelIdx + 1} concluída! Carregando a próxima...`;
          statusText.className = "success-text";
        }
        mascotSay(`Fase ${currentLevelIdx + 1} vencida! Preparado para a próxima?`, "festa", 3500);
        window.setTimeout(() => loadLevel(currentLevelIdx + 1), 850);
      } else {
        concluirMinijogo(
          `<strong>Sensacional!</strong> Você venceu as ${fases.length} fases do labirinto!`,
          "Uhuuul! Você guiou o robô até o fim do labirinto!",
        );
        if (statusText) {
          statusText.textContent = "Parabéns! Labirinto completo!";
          statusText.className = "success-text";
        }
      }
    }
  }

  bindDirecionais(movePlayer, {
    up: "#maze-btn-up",
    down: "#maze-btn-down",
    left: "#maze-btn-left",
    right: "#maze-btn-right",
  });

  restartBtn?.addEventListener("click", () => loadLevel(currentLevelIdx));

  function draw() {
    animTick += 1;
    const rows = currentGrid.length;
    const cols = currentGrid[0].length;
    const cellSize = Math.min(
      Math.floor((canvas.width - 32) / cols),
      Math.floor((canvas.height - 32) / rows),
    );
    const offsetX = Math.floor((canvas.width - cols * cellSize) / 2);
    const offsetY = Math.floor((canvas.height - rows * cellSize) / 2);

    ctx.fillStyle = "#f7fafe";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const lvl = fases[currentLevelIdx];
    const isExitUnlocked = collectedChips >= lvl.chipsNeeded;

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;
        const type = currentGrid[r][c];

        if (type === 1) {
          ctx.fillStyle = "#1c2541";
          desenharRetanguloArredondado(ctx, x + 1, y + 1, cellSize - 2, cellSize - 2, 6);
          ctx.fill();
          continue;
        }

        ctx.fillStyle = (r + c) % 2 === 0 ? "#ffffff" : "#eef3fd";
        ctx.fillRect(x, y, cellSize, cellSize);
        ctx.strokeStyle = "#e0e7f5";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);

        const cx = x + cellSize / 2;
        const cy = y + cellSize / 2;

        if (type === 3) {
          const pulse = Math.sin(animTick * 0.1) * 2;
          const raio = Math.max(8, cellSize * 0.28) + pulse;

          ctx.fillStyle = "rgba(246, 185, 59, 0.28)";
          ctx.beginPath();
          ctx.arc(cx, cy, raio + 4, 0, Math.PI * 2);
          ctx.fill();

          const grad = ctx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, raio);
          grad.addColorStop(0, "#fff3c4");
          grad.addColorStop(0.7, "#f6b93b");
          grad.addColorStop(1, "#d98c06");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, raio, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        if (type === 4) {
          const pulse = isExitUnlocked ? Math.sin(animTick * 0.12) * 3 : 0;
          const raio = Math.max(10, cellSize * 0.36) + pulse;

          if (isExitUnlocked) {
            ctx.fillStyle = "rgba(32, 198, 113, 0.3)";
            ctx.beginPath();
            ctx.arc(cx, cy, raio + 6, 0, Math.PI * 2);
            ctx.fill();

            const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, raio);
            grad.addColorStop(0, "#c2f5db");
            grad.addColorStop(0.7, "#20c671");
            grad.addColorStop(1, "#0d7a44");
            ctx.fillStyle = grad;
          } else {
            ctx.fillStyle = "#dfe6f3";
          }

          ctx.beginPath();
          ctx.arc(cx, cy, raio, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = isExitUnlocked ? "#ffffff" : "#9aa6c0";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = isExitUnlocked ? "#ffffff" : "#6b7793";
          ctx.font = `bold ${Math.max(8, Math.floor(cellSize * 0.22))}px Nunito, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("SAÍDA", cx, cy);
        }
      }
    }

    // Robô jogador
    const px = offsetX + playerPos.x * cellSize + cellSize / 2;
    const py = offsetY + playerPos.y * cellSize + cellSize / 2;
    const raio = Math.max(9, cellSize * 0.34);

    ctx.fillStyle = "rgba(20, 40, 120, 0.18)";
    ctx.beginPath();
    ctx.ellipse(px, py + raio * 0.85, raio * 0.85, raio * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    const corpo = ctx.createLinearGradient(px - raio, py - raio, px + raio, py + raio);
    corpo.addColorStop(0, "#2DD4E8");
    corpo.addColorStop(0.55, "#2F5DE0");
    corpo.addColorStop(1, "#2347B8");
    ctx.fillStyle = corpo;
    ctx.beginPath();
    ctx.arc(px, py, raio, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const desloc = { up: [0, -3], down: [0, 3], left: [-3, 0], right: [3, 0] }[playerDir] || [0, 2];
    const olhos = [
      { x: px - raio * 0.32 + desloc[0] * 0.4, y: py - raio * 0.1 + desloc[1] * 0.4 },
      { x: px + raio * 0.32 + desloc[0] * 0.4, y: py - raio * 0.1 + desloc[1] * 0.4 },
    ];

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    olhos.forEach((o) => {
      ctx.moveTo(o.x + raio * 0.24, o.y);
      ctx.arc(o.x, o.y, Math.max(2.4, raio * 0.24), 0, Math.PI * 2);
    });
    ctx.fill();

    ctx.fillStyle = "#101828";
    ctx.beginPath();
    olhos.forEach((o) => {
      ctx.moveTo(o.x + raio * 0.13, o.y);
      ctx.arc(o.x, o.y, Math.max(1.2, raio * 0.13), 0, Math.PI * 2);
    });
    ctx.fill();

    requestAnimationFrame(draw);
  }

  loadLevel(0);
  requestAnimationFrame(draw);
}

// =========================================================================
// 6. MINIJOGO: COBRINHA
// =========================================================================
function initSnakeMinigame() {
  const canvas = document.querySelector("#snake-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.querySelector("#snake-score-display");
  const statusText = document.querySelector("#snake-status-text");
  const restartBtn = document.querySelector("#snake-restart-btn");

  const gridCols = 24;
  const gridRows = 16;
  const cellSize = 25;
  const meta = Number(minigameData.target_score) || 20;

  let score = 0;
  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 0, y: 0 };
  let isDying = false;
  let tick = 0;

  // O mascote é a cabeça da cobrinha. Desenhamos a imagem uma única vez num
  // canvas fora da tela, no tamanho final, para não redimensionar a cada quadro.
  const LARGURA_CABECA = Math.round(cellSize * 1.7);
  let cabecaPronta = null;

  const imagemMascote = new Image();
  imagemMascote.addEventListener("load", () => {
    const proporcao = imagemMascote.naturalHeight / imagemMascote.naturalWidth || 1.25;
    const offscreen = document.createElement("canvas");
    offscreen.width = LARGURA_CABECA;
    offscreen.height = Math.round(LARGURA_CABECA * proporcao);
    offscreen.getContext("2d").drawImage(imagemMascote, 0, 0, offscreen.width, offscreen.height);
    cabecaPronta = offscreen;
  });
  imagemMascote.src = `${mascotBase}${MASCOT_MOODS.ola}`;

  function updateScoreUI() {
    if (scoreDisplay) scoreDisplay.textContent = `${score} / ${meta}`;
  }

  function spawnFood() {
    const livres = [];
    for (let r = 0; r < gridRows; r += 1) {
      for (let c = 0; c < gridCols; c += 1) {
        if (!snake.some((seg) => seg.x === c && seg.y === r)) livres.push({ x: c, y: r });
      }
    }
    food = livres.length
      ? livres[Math.floor(Math.random() * livres.length)]
      : { x: 0, y: 0 };
  }

  function resetGame() {
    score = 0;
    isDying = false;
    snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    spawnFood();
    updateScoreUI();

    if (statusText && !isMinigameComplete) {
      statusText.textContent = `Colete ${meta} bolinhas sem bater no próprio corpo!`;
      statusText.className = "";
    }
  }

  restartBtn?.addEventListener("click", () => {
    resetGame();
    mascotSay("Partida reiniciada! Boa sorte!", "aponta", 3000);
  });

  window.addEventListener("keydown", (e) => {
    const tecla = e.key;
    if (["ArrowUp", "w", "W"].includes(tecla) && dir.y === 0) nextDir = { x: 0, y: -1 };
    else if (["ArrowDown", "s", "S"].includes(tecla) && dir.y === 0) nextDir = { x: 0, y: 1 };
    else if (["ArrowLeft", "a", "A"].includes(tecla) && dir.x === 0) nextDir = { x: -1, y: 0 };
    else if (["ArrowRight", "d", "D"].includes(tecla) && dir.x === 0) nextDir = { x: 1, y: 0 };
    else return;
    e.preventDefault();
  });

  const bindDpad = (seletor, dx, dy) => {
    document.querySelector(seletor)?.addEventListener("click", (e) => {
      e.preventDefault();
      if (dx !== 0 && dir.x === 0) nextDir = { x: dx, y: 0 };
      if (dy !== 0 && dir.y === 0) nextDir = { x: 0, y: dy };
    });
  };
  bindDpad("#btn-up", 0, -1);
  bindDpad("#btn-down", 0, 1);
  bindDpad("#btn-left", -1, 0);
  bindDpad("#btn-right", 1, 0);

  function update() {
    if (isDying) return;

    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Bordas contínuas (estilo Google Snake)
    if (head.x < 0) head.x = gridCols - 1;
    if (head.x >= gridCols) head.x = 0;
    if (head.y < 0) head.y = gridRows - 1;
    if (head.y >= gridRows) head.y = 0;

    const vaiComer = head.x === food.x && head.y === food.y;
    // A cauda sai do lugar no mesmo passo, então só colide se a cobra crescer.
    const corpo = vaiComer ? snake : snake.slice(0, -1);

    if (corpo.some((seg) => seg.x === head.x && seg.y === head.y)) {
      isDying = true;
      playSound("error");
      if (statusText) {
        statusText.textContent = "Você bateu no próprio corpo! Reiniciando...";
        statusText.className = "error-text";
      }
      mascotSay("Ops! Cuidado com o rabinho. Vamos de novo!", "ops", 3200);
      window.setTimeout(resetGame, 1000);
      return;
    }

    snake.unshift(head);

    if (!vaiComer) {
      snake.pop();
      return;
    }

    score += 1;
    updateScoreUI();
    playSound("correct");

    if (score >= meta) {
      concluirMinijogo(
        `<strong>Sensacional!</strong> Você coletou as ${meta} bolinhas!`,
        `Incrível! ${meta} bolinhas coletadas!`,
      );
      if (statusText) {
        statusText.textContent = `Desafio vencido! Continue jogando se quiser.`;
        statusText.className = "success-text";
      }
      spawnFood();
      return;
    }

    spawnFood();
    if (statusText) {
      statusText.textContent = `Bolinha coletada! Faltam ${meta - score}.`;
      statusText.className = "success-text";
    }
  }

  function render() {
    tick += 1;
    for (let r = 0; r < gridRows; r += 1) {
      for (let c = 0; c < gridCols; c += 1) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "#eef4fe" : "#dfe9fb";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }

    // Bolinha
    const fx = food.x * cellSize + cellSize / 2;
    const fy = food.y * cellSize + cellSize / 2;
    const pulse = Math.sin(tick * 0.15) * 1.5;

    ctx.save();
    ctx.translate(fx, fy + pulse);
    ctx.fillStyle = "rgba(20, 40, 120, 0.14)";
    ctx.beginPath();
    ctx.ellipse(0, 10 - pulse, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246, 185, 59, 0.26)";
    ctx.beginPath();
    ctx.arc(0, 0, 12 + pulse, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 9);
    grad.addColorStop(0, "#fff3c4");
    grad.addColorStop(0.6, "#f6b93b");
    grad.addColorStop(1, "#d98c06");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Rastro de energia (do rabo até o pescoço), da cauda mais clara ao corpo vivo
    for (let index = snake.length - 1; index >= 1; index -= 1) {
      const seg = snake[index];
      const sx = seg.x * cellSize;
      const sy = seg.y * cellSize;
      const proximidade = 1 - index / Math.max(snake.length - 1, 1);
      const encolhe = 3 + (1 - proximidade) * 2.5;

      ctx.fillStyle = index % 2 === 0 ? "#2F5DE0" : "#5B8BF0";
      ctx.globalAlpha = 0.55 + proximidade * 0.45;
      desenharRetanguloArredondado(ctx, sx + encolhe, sy + encolhe, cellSize - encolhe * 2, cellSize - encolhe * 2, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Cabeça: o mascote do RobooTeam pilotando a cobrinha
    const cabeca = snake[0];
    const hx = cabeca.x * cellSize + cellSize / 2;
    const hy = cabeca.y * cellSize + cellSize / 2;
    const flutuar = Math.sin(tick * 0.22) * 1.6;

    // Halo para o mascote se destacar do tabuleiro
    const halo = ctx.createRadialGradient(hx, hy, 2, hx, hy, cellSize * 1.15);
    halo.addColorStop(0, "rgba(45, 212, 232, 0.5)");
    halo.addColorStop(0.6, "rgba(47, 93, 224, 0.22)");
    halo.addColorStop(1, "rgba(47, 93, 224, 0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(hx, hy, cellSize * 1.15, 0, Math.PI * 2);
    ctx.fill();

    if (cabecaPronta) {
      const largura = cabecaPronta.width;
      const altura = cabecaPronta.height;

      ctx.save();
      ctx.translate(hx, hy + flutuar);
      // Espelha ao ir para a esquerda e inclina de leve na vertical.
      if (dir.x < 0) ctx.scale(-1, 1);
      else if (dir.y !== 0) ctx.rotate(dir.y > 0 ? 0.16 : -0.16);
      ctx.drawImage(cabecaPronta, -largura / 2, -altura / 2, largura, altura);
      ctx.restore();
    } else {
      // Enquanto a imagem do mascote não carrega, mantém uma cabeça simples.
      ctx.fillStyle = "#2347B8";
      desenharRetanguloArredondado(ctx, hx - cellSize / 2 + 2, hy - cellSize / 2 + 2, cellSize - 4, cellSize - 4, 8);
      ctx.fill();
    }
  }

  resetGame();
  window.setInterval(() => {
    update();
    render();
  }, 165);
}

// =========================================================================
// 7. MINIJOGO: JOGO DA MEMÓRIA
// =========================================================================
function initMemoryMinigame() {
  const grid = document.querySelector("#memory-grid");
  if (!grid) return;

  const scoreDisplay = document.querySelector("#memory-score");
  const pairsDisplay = document.querySelector("#memory-pairs");
  const resetBtn = document.querySelector("#reset-memory-btn");
  const feedbackEl = document.querySelector("#minigame-feedback");

  const rawPairs = minigameData.pairs || [];
  let flippedCards = [];
  let matchedCount = 0;
  let score = 0;
  let isLocked = false;

  function updateHUD() {
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (pairsDisplay) pairsDisplay.textContent = `${matchedCount} / ${rawPairs.length}`;
  }

  function handleCardClick(cardEl, cardData) {
    if (isLocked || cardEl.classList.contains("flipped") || cardEl.classList.contains("matched")) return;

    cardEl.classList.add("flipped");
    flippedCards.push({ el: cardEl, data: cardData });
    if (flippedCards.length < 2) return;

    isLocked = true;
    const [first, second] = flippedCards;

    if (first.data.pairId !== second.data.pairId) {
      playSound("error");
      window.setTimeout(() => {
        first.el.classList.remove("flipped");
        second.el.classList.remove("flipped");
        flippedCards = [];
        isLocked = false;
      }, 900);
      return;
    }

    window.setTimeout(() => {
      first.el.classList.add("matched");
      second.el.classList.add("matched");
      matchedCount += 1;
      score += 10;
      updateHUD();
      playSound("correct");

      if (feedbackEl) {
        feedbackEl.innerHTML = `Par encontrado: <strong>${escapeHtml(first.data.termTitle)}</strong>!`;
        feedbackEl.className = "minigame-feedback success";
      }

      flippedCards = [];
      isLocked = false;

      if (matchedCount === rawPairs.length) {
        concluirMinijogo(
          `<strong>Parabéns!</strong> Você encontrou todos os ${rawPairs.length} pares!`,
          "Que memória! Você achou todos os pares!",
        );
      }
    }, 320);
  }

  function buildMemoryBoard() {
    grid.innerHTML = "";
    flippedCards = [];
    matchedCount = 0;
    score = 0;
    isLocked = false;
    updateHUD();

    if (feedbackEl && !isMinigameComplete) {
      feedbackEl.textContent = "";
      feedbackEl.className = "minigame-feedback";
    }

    const deck = [];
    rawPairs.forEach((p, pIdx) => {
      const base = {
        pairId: p.id || `p${pIdx + 1}`,
        termTitle: p.term,
        pairNumber: pIdx + 1,
        colorClass: `pair-theme-${pIdx % 6}`,
      };
      deck.push({ ...base, text: p.term });
      deck.push({ ...base, text: p.match });
    });

    embaralhar(deck).forEach((cardData) => {
      const cardEl = document.createElement("div");
      cardEl.className = `memory-card ${cardData.colorClass}`;
      cardEl.setAttribute("tabindex", "0");
      cardEl.setAttribute("role", "button");
      cardEl.setAttribute("aria-label", "Carta do jogo da memória");
      cardEl.innerHTML = `
        <div class="memory-card-front"></div>
        <div class="memory-card-back">
          <span class="pair-pill">Par ${cardData.pairNumber}</span>
          <span class="card-text">${escapeHtml(cardData.text)}</span>
        </div>`;

      cardEl.addEventListener("click", () => handleCardClick(cardEl, cardData));
      cardEl.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        handleCardClick(cardEl, cardData);
      });

      grid.appendChild(cardEl);
    });
  }

  resetBtn?.addEventListener("click", () => {
    buildMemoryBoard();
    mascotSay("Cartas embaralhadas de novo. Vamos lá!", "aponta", 3000);
  });

  buildMemoryBoard();
}

// =========================================================================
// 8. MINIJOGO: CAÇA-PALAVRAS (grade gerada automaticamente)
// =========================================================================
const DIRECOES_CACA = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function tentarPosicionar(grade, palavra, tamanho) {
  for (let tentativa = 0; tentativa < 250; tentativa += 1) {
    const [dr, dc] = DIRECOES_CACA[Math.floor(Math.random() * DIRECOES_CACA.length)];
    const r0 = Math.floor(Math.random() * tamanho);
    const c0 = Math.floor(Math.random() * tamanho);
    const rFim = r0 + dr * (palavra.length - 1);
    const cFim = c0 + dc * (palavra.length - 1);

    if (rFim < 0 || rFim >= tamanho || cFim < 0 || cFim >= tamanho) continue;

    let cabe = true;
    for (let i = 0; i < palavra.length; i += 1) {
      const atual = grade[r0 + dr * i][c0 + dc * i];
      if (atual && atual !== palavra[i]) {
        cabe = false;
        break;
      }
    }
    if (!cabe) continue;

    for (let i = 0; i < palavra.length; i += 1) {
      grade[r0 + dr * i][c0 + dc * i] = palavra[i];
    }
    return true;
  }
  return false;
}

function gerarGradeCacaPalavras(palavras) {
  const maior = palavras.reduce((max, p) => Math.max(max, p.length), 0);
  const tamanho = Math.min(Math.max(10, maior + 1), 12);
  const ordenadas = [...palavras].sort((a, b) => b.length - a.length);

  for (let rodada = 0; rodada < 40; rodada += 1) {
    const grade = Array.from({ length: tamanho }, () => Array(tamanho).fill(""));
    if (ordenadas.every((palavra) => tentarPosicionar(grade, palavra, tamanho))) {
      return preencherVazios(grade);
    }
  }

  // Plano B: uma palavra por linha, sempre cabe.
  const grade = Array.from({ length: tamanho }, () => Array(tamanho).fill(""));
  ordenadas.forEach((palavra, linha) => {
    const inicio = Math.floor(Math.random() * (tamanho - palavra.length + 1));
    for (let i = 0; i < palavra.length; i += 1) grade[linha % tamanho][inicio + i] = palavra[i];
  });
  return preencherVazios(grade);
}

function preencherVazios(grade) {
  return grade.map((linha) =>
    linha.map((letra) => letra || ALFABETO[Math.floor(Math.random() * ALFABETO.length)]),
  );
}

function initWordSearchMinigame() {
  const gridEl = document.querySelector("#ws-grid");
  if (!gridEl) return;

  const scoreDisplay = document.querySelector("#ws-score");
  const remainingDisplay = document.querySelector("#ws-remaining");
  const wordsListEl = document.querySelector("#ws-words-list");
  const themePillEl = document.querySelector("#ws-theme-pill");
  const resetBtn = document.querySelector("#reset-ws-btn");
  const feedbackEl = document.querySelector("#minigame-feedback");

  const variations = minigameData.variations?.length
    ? minigameData.variations
    : [{ theme: "Palavras da IA", words: minigameData.words || [] }];

  let varIndex = 0;
  let targetWords = [];
  let matrix = [];
  let foundWords = new Set();
  let score = 0;
  let selectedCells = [];
  let isPointerDown = false;
  let arrastou = false;
  let celulaInicial = null;
  let ignorarProximoClique = false;

  function updateHUD() {
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (remainingDisplay) remainingDisplay.textContent = Math.max(0, targetWords.length - foundWords.size);
  }

  function clearSelection() {
    selectedCells.forEach((item) => {
      if (!item.el.classList.contains("found")) item.el.classList.remove("selected");
    });
    selectedCells = [];
  }

  function celulasEmLinha(inicio, fim) {
    const dr = fim.r - inicio.r;
    const dc = fim.c - inicio.c;
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;

    const passos = Math.max(Math.abs(dr), Math.abs(dc));
    const stepR = Math.sign(dr);
    const stepC = Math.sign(dc);
    const celulas = [];

    for (let i = 0; i <= passos; i += 1) {
      const r = inicio.r + i * stepR;
      const c = inicio.c + i * stepC;
      const el = gridEl.querySelector(`.ws-cell[data-row="${r}"][data-col="${c}"]`);
      if (!el) return null;
      celulas.push({ r, c, letter: matrix[r][c], el });
    }
    return celulas;
  }

  function checarPalavra() {
    if (selectedCells.length < 2) {
      clearSelection();
      return;
    }

    const texto = selectedCells.map((c) => c.letter).join("").toUpperCase();
    const invertido = [...texto].reverse().join("");
    const encontrada = [texto, invertido].find((t) => targetWords.includes(t) && !foundWords.has(t));

    if (!encontrada) {
      clearSelection();
      return;
    }

    foundWords.add(encontrada);
    score += 10;
    updateHUD();
    playSound("correct");

    const corClasse = `ws-color-${targetWords.indexOf(encontrada) % 5}`;
    selectedCells.forEach((item) => {
      item.el.classList.remove("selected");
      item.el.classList.add("found", corClasse);
    });
    selectedCells = [];

    wordsListEl?.querySelector(`.ws-word-badge[data-word="${encontrada}"]`)
      ?.classList.add("found", corClasse);

    if (feedbackEl) {
      feedbackEl.innerHTML = `Palavra encontrada: <strong>${encontrada}</strong>!`;
      feedbackEl.className = "minigame-feedback success";
    }

    if (foundWords.size === targetWords.length) {
      concluirMinijogo(
        `<strong>Parabéns!</strong> Você encontrou todas as ${targetWords.length} palavras!`,
        "Caçador de palavras nível expert! Achou todas!",
      );
    }
  }

  const saoVizinhas = (a, b) =>
    Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1 && (a.r !== b.r || a.c !== b.c);

  function mantemLinhaReta(celulas, proxima) {
    if (celulas.length < 2) return true;
    const dr = celulas[1].r - celulas[0].r;
    const dc = celulas[1].c - celulas[0].c;
    const ultima = celulas[celulas.length - 1];
    return proxima.r - ultima.r === dr && proxima.c - ultima.c === dc;
  }

  function cliqueNaCelula(r, c, letter, el) {
    if (selectedCells.length === 0) {
      selectedCells.push({ r, c, letter, el });
      el.classList.add("selected");
      return;
    }

    const primeira = selectedCells[0];
    if (selectedCells.length === 1) {
      if (primeira.r === r && primeira.c === c) {
        clearSelection();
        return;
      }
      const linha = celulasEmLinha(primeira, { r, c });
      if (linha && linha.length >= 2) {
        clearSelection();
        selectedCells = linha;
        selectedCells.forEach((item) => item.el.classList.add("selected"));
        checarPalavra();
        return;
      }
    }

    clearSelection();
    selectedCells.push({ r, c, letter, el });
    el.classList.add("selected");
  }

  function buildGrid() {
    const ativa = variations[varIndex % variations.length];
    targetWords = (ativa.words || []).map((w) => String(w).toUpperCase());
    matrix = ativa.grid?.length ? ativa.grid : gerarGradeCacaPalavras(targetWords);

    foundWords = new Set();
    selectedCells = [];
    score = 0;
    updateHUD();

    if (themePillEl) {
      themePillEl.textContent = `Tema: ${ativa.theme || "Tecnologia"} (${(varIndex % variations.length) + 1} de ${variations.length})`;
    }
    if (wordsListEl) {
      wordsListEl.innerHTML = targetWords
        .map((w) => `<span class="ws-word-badge" data-word="${w}">${w}</span>`)
        .join("");
    }
    if (feedbackEl && !isMinigameComplete) {
      feedbackEl.textContent = "";
      feedbackEl.className = "minigame-feedback";
    }

    gridEl.innerHTML = "";
    gridEl.style.gridTemplateColumns = `repeat(${matrix.length}, 1fr)`;

    matrix.forEach((linha, r) => {
      linha.forEach((letra, c) => {
        const cellEl = document.createElement("button");
        cellEl.type = "button";
        cellEl.className = "ws-cell";
        cellEl.textContent = letra;
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;
        cellEl.setAttribute("aria-label", `Letra ${letra}, linha ${r + 1}, coluna ${c + 1}`);

        // Um clique simples seleciona a célula; arrastar desenha a palavra inteira.
        cellEl.addEventListener("click", () => {
          if (ignorarProximoClique) {
            ignorarProximoClique = false;
            return;
          }
          cliqueNaCelula(r, c, letra, cellEl);
        });

        cellEl.addEventListener("pointerdown", (e) => {
          isPointerDown = true;
          arrastou = false;
          celulaInicial = { r, c, letter: letra, el: cellEl };
          // Sem isto o toque prende o ponteiro na célula inicial e o arraste não avança.
          if (cellEl.hasPointerCapture?.(e.pointerId)) cellEl.releasePointerCapture(e.pointerId);
        });

        cellEl.addEventListener("pointerenter", () => {
          if (!isPointerDown || !celulaInicial) return;

          if (!arrastou) {
            clearSelection();
            selectedCells = [celulaInicial];
            celulaInicial.el.classList.add("selected");
            arrastou = true;
          }

          const ultima = selectedCells[selectedCells.length - 1];
          if (!saoVizinhas(ultima, { r, c }) || !mantemLinhaReta(selectedCells, { r, c })) return;
          if (selectedCells.some((item) => item.r === r && item.c === c)) return;

          selectedCells.push({ r, c, letter: letra, el: cellEl });
          cellEl.classList.add("selected");
        });

        gridEl.appendChild(cellEl);
      });
    });
  }

  window.addEventListener("pointerup", () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    celulaInicial = null;
    // Um toque simples fica por conta do clique da célula; só o arraste valida aqui.
    if (!arrastou) return;
    ignorarProximoClique = true;
    checarPalavra();
  });

  resetBtn?.addEventListener("click", () => {
    varIndex = (varIndex + 1) % variations.length;
    buildGrid();
    mascotSay(`Novo grupo de palavras: ${variations[varIndex % variations.length].theme}!`, "aponta", 3600);
  });

  buildGrid();
}

// =========================================================================
// 9. MINIJOGO: LIGAR OS BLOCOS (ARRASTAR OU TOCAR)
// =========================================================================
function initDragDropMinigame() {
  const itemsPool = document.querySelector("#items-pool");
  const targetsPool = document.querySelector("#targets-pool");
  if (!itemsPool || !targetsPool) return;

  const validateBtn = document.querySelector("#validate-minigame-btn");
  const resetBtn = document.querySelector("#reset-minigame-btn");
  const feedbackEl = document.querySelector("#minigame-feedback");

  const pairs = (minigameData.pairs || []).map((p, i) => ({ ...p, id: p.id || `p${i + 1}` }));
  let cartaSelecionada = null;

  function limparMarcacoes() {
    document.querySelectorAll(".target-slot").forEach((s) => s.classList.remove("correct-slot", "incorrect-slot"));
    if (feedbackEl && !isMinigameComplete) {
      feedbackEl.textContent = "";
      feedbackEl.className = "minigame-feedback";
    }
  }

  function devolverAoPool(card, dropZone) {
    itemsPool.appendChild(card);
    card.classList.remove("selected-card");
    if (dropZone) {
      dropZone.innerHTML = '<span class="drop-placeholder">Toque ou arraste aqui</span>';
      dropZone.closest(".target-slot")?.classList.remove("correct-slot", "incorrect-slot");
    }
    cartaSelecionada = null;
    limparMarcacoes();
  }

  function encaixar(card, dropZone) {
    const anterior = dropZone.querySelector(".match-card");
    if (anterior && anterior !== card) {
      itemsPool.appendChild(anterior);
      anterior.classList.remove("selected-card");
    }
    dropZone.innerHTML = "";
    card.classList.remove("selected-card");
    dropZone.appendChild(card);
    limparMarcacoes();
  }

  function aoClicarCarta(card) {
    if (card.parentElement?.classList.contains("drop-zone")) {
      devolverAoPool(card, card.parentElement);
      return;
    }
    document.querySelectorAll(".match-card").forEach((c) => c.classList.remove("selected-card"));
    if (cartaSelecionada === card) {
      cartaSelecionada = null;
      return;
    }
    cartaSelecionada = card;
    card.classList.add("selected-card");
  }

  function aoClicarSlot(dropZone) {
    if (cartaSelecionada) {
      encaixar(cartaSelecionada, dropZone);
      cartaSelecionada = null;
      return;
    }
    const existente = dropZone.querySelector(".match-card");
    if (existente) devolverAoPool(existente, dropZone);
  }

  function montarTabuleiro() {
    itemsPool.innerHTML = "";
    targetsPool.innerHTML = "";
    cartaSelecionada = null;
    if (validateBtn) validateBtn.disabled = false;
    if (feedbackEl && !isMinigameComplete) {
      feedbackEl.textContent = "";
      feedbackEl.className = "minigame-feedback";
    }

    embaralhar(pairs).forEach((pair) => {
      const card = document.createElement("div");
      card.className = "match-card";
      card.draggable = true;
      card.dataset.pairId = pair.id;
      card.innerHTML = `<span class="card-text">${escapeHtml(pair.left)}</span>`;

      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", pair.id);
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("click", () => aoClicarCarta(card));
      itemsPool.appendChild(card);
    });

    embaralhar(pairs).forEach((pair, idx) => {
      const slot = document.createElement("div");
      slot.className = "target-slot";
      slot.dataset.targetId = pair.id;
      slot.innerHTML = `
        <div class="target-definition">
          <span class="target-badge">${idx + 1}</span>
          <span class="target-text">${escapeHtml(pair.right)}</span>
        </div>
        <div class="drop-zone"><span class="drop-placeholder">Toque ou arraste aqui</span></div>`;

      const dropZone = slot.querySelector(".drop-zone");
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
      });
      dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const card = document.querySelector(`.match-card[data-pair-id="${e.dataTransfer.getData("text/plain")}"]`);
        if (card) encaixar(card, dropZone);
      });
      dropZone.addEventListener("click", () => aoClicarSlot(dropZone));

      targetsPool.appendChild(slot);
    });
  }

  validateBtn?.addEventListener("click", () => {
    const slots = [...document.querySelectorAll(".target-slot")];
    let preenchidos = 0;
    let corretos = 0;

    slots.forEach((slot) => {
      const card = slot.querySelector(".match-card");
      slot.classList.remove("correct-slot", "incorrect-slot");
      if (!card) return;
      preenchidos += 1;
      if (card.dataset.pairId === slot.dataset.targetId) {
        corretos += 1;
        slot.classList.add("correct-slot");
      } else {
        slot.classList.add("incorrect-slot");
      }
    });

    if (preenchidos < pairs.length) {
      feedbackEl.innerHTML = "<strong>Atenção:</strong> encaixe todos os blocos antes de validar!";
      feedbackEl.className = "minigame-feedback warning";
      playSound("error");
      mascotSay("Faltam alguns blocos para encaixar!", "aponta", 3400);
      return;
    }

    if (corretos === pairs.length) {
      validateBtn.disabled = true;
      concluirMinijogo(
        "<strong>Muito bem!</strong> Todas as ligações estão certinhas!",
        "Perfeito! Você ligou tudo corretamente!",
      );
      return;
    }

    playSound("error");
    feedbackEl.innerHTML = `Você acertou <strong>${corretos} de ${pairs.length}</strong> ligações. Os blocos em vermelho estão trocados!`;
    feedbackEl.className = "minigame-feedback retry";
    mascotSay("Quase! Troque os blocos vermelhos e valide de novo.", "ops", 4000);
  });

  resetBtn?.addEventListener("click", () => {
    montarTabuleiro();
    mascotSay("Tabuleiro reiniciado. Boa sorte!", "aponta", 3000);
  });

  montarTabuleiro();
}

// =========================================================================
// 10. UTILITÁRIOS COMPARTILHADOS
// =========================================================================
function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function desenharRetanguloArredondado(ctx, x, y, largura, altura, raio) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, largura, altura, raio);
    return;
  }
  ctx.moveTo(x + raio, y);
  ctx.arcTo(x + largura, y, x + largura, y + altura, raio);
  ctx.arcTo(x + largura, y + altura, x, y + altura, raio);
  ctx.arcTo(x, y + altura, x, y, raio);
  ctx.arcTo(x, y, x + largura, y, raio);
  ctx.closePath();
}

function bindDirecionais(mover, seletores) {
  window.addEventListener("keydown", (e) => {
    const mapa = {
      ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
      ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
    };
    const passo = mapa[e.key];
    if (!passo) return;
    e.preventDefault();
    mover(passo[0], passo[1]);
  });

  const direcoes = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  Object.entries(seletores).forEach(([nome, seletor]) => {
    document.querySelector(seletor)?.addEventListener("click", () => {
      const [dx, dy] = direcoes[nome];
      mover(dx, dy);
    });
  });
}

/** Marca o minijogo como vencido (uma vez só) e comemora. */
function concluirMinijogo(mensagemHtml, falaDoMascote) {
  const feedbackEl = document.querySelector("#minigame-feedback");
  if (feedbackEl) {
    feedbackEl.innerHTML = mensagemHtml;
    feedbackEl.className = "minigame-feedback victory";
  }

  if (isMinigameComplete) return;

  isMinigameComplete = true;
  playSound("victory");
  soltarConfete(70);
  mascotSay(falaDoMascote, "festa", 5200);
  document.querySelector("#secao-jogo")?.classList.add("concluido");
  checkOverallCompletion();
}

// =========================================================================
// 11. CONCLUSÃO DA ETAPA
// =========================================================================
let festaFinalDisparada = false;

function checkOverallCompletion() {
  const quizCompleto = answeredCorrectly.size === questions.length;
  const chipQuiz = document.querySelector('[data-step-chip="quiz"]');
  const chipJogo = document.querySelector('[data-step-chip="jogo"]');

  chipQuiz?.classList.toggle("concluido", quizCompleto);
  chipJogo?.classList.toggle("concluido", isMinigameComplete);

  if (quizCompleto && isMinigameComplete) {
    checklistText.innerHTML = "<strong>Quiz e atividade concluídos!</strong> Clique no botão para avançar na trilha.";
    checklistText.className = "checklist-ready";
    finishButton.disabled = false;

    if (!festaFinalDisparada) {
      festaFinalDisparada = true;
      soltarConfete(120);
      mascotSay("Etapa completa! Clique em Concluir etapa para avançar!", "festa", 7000);
    }
    return;
  }

  const pendentes = [];
  if (!quizCompleto) pendentes.push(`Quiz (${answeredCorrectly.size}/${questions.length})`);
  if (!isMinigameComplete) pendentes.push("Minijogo");

  checklistText.innerHTML = `Ainda falta: <span>${pendentes.join(" e ")}</span>.`;
  checklistText.className = "checklist-pending";
  finishButton.disabled = true;
}

function getStoredToken() {
  return localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
}

finishButton.addEventListener("click", async () => {
  if (answeredCorrectly.size !== questions.length || !isMinigameComplete) return;

  const headers = { "Content-Type": "application/json" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  finishButton.disabled = true;
  finishButton.textContent = "Salvando...";

  try {
    const response = await fetch(lessonShell.dataset.completeUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ respostas: selectedAnswers, minijogo_concluido: isMinigameComplete }),
    });

    if (response.status === 401 || response.status === 403) {
      window.location.href = lessonShell.dataset.loginUrl;
      return;
    }

    const resultado = await response.json();

    if (!response.ok) {
      checklistText.textContent = resultado.error || "Não foi possível concluir a etapa.";
      checklistText.className = "checklist-pending";
      finishButton.disabled = false;
      finishButton.textContent = "Tentar novamente";
      mascotSay(resultado.error || "Algo deu errado. Vamos tentar de novo?", "ops", 5000);
      return;
    }

    checklistText.innerHTML = resultado.next_title
      ? `<strong>Progresso salvo!</strong> Próxima etapa: ${escapeHtml(resultado.next_title)}.`
      : "<strong>Progresso salvo!</strong> Você concluiu toda a trilha. Parabéns!";
    checklistText.className = "checklist-ready";
    finishButton.textContent = "Concluído!";
    soltarConfete(150);
    mascotSay(
      resultado.next_title ? `Etapa salva! Próxima parada: ${resultado.next_title}` : "Você terminou a trilha inteira!",
      "festa",
      4000,
    );

    window.setTimeout(() => {
      window.location.href = lessonShell.dataset.returnUrl;
    }, 1400);
  } catch {
    checklistText.textContent = "Não foi possível conectar ao servidor.";
    checklistText.className = "checklist-pending";
    finishButton.disabled = false;
    finishButton.textContent = "Tentar novamente";
    mascotSay("Não consegui falar com o servidor. Tente de novo!", "ops", 5000);
  }
});

// =========================================================================
// 12. INICIALIZAÇÃO
// =========================================================================
const INICIALIZADORES = {
  snake: initSnakeMinigame,
  maze: initMazeMinigame,
  memory: initMemoryMinigame,
  word_search: initWordSearchMinigame,
  drag_drop: initDragDropMinigame,
};

INICIALIZADORES[minigameData.type]?.();

document.querySelector('[data-step-chip="leitura"]')?.classList.add("concluido");
checkOverallCompletion();

window.setTimeout(() => {
  mascotSay(
    jaConcluida
      ? "Você já concluiu esta etapa, mas pode revisar e jogar à vontade!"
      : "Leia os blocos, responda o quiz e vença o minijogo. Eu vou te ajudando!",
    jaConcluida ? "calmo" : "aponta",
    7000,
  );
}, 900);

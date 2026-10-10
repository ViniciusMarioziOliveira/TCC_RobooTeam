/* Oficina do Robô: o aluno personaliza o próprio robô (fica salvo neste navegador). */
(() => {
  const page = document.body;
  const imgBase = page.dataset.robotImgBase || "/static/img/";
  const studentId = page.dataset.studentId;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const {
    POSES, COLORS, ACCESSORIES, DEFAULT_ROBOT, findPose, findColor, findAcc, sanitize, replayClass, accessoryHtml,
  } = window.RobooRobo;
  const storageKey = window.RobooRobo.storageKey(studentId);
  const loadRobot = () => window.RobooRobo.load(studentId);
  const storeRobot = (robot) => window.RobooRobo.store(studentId, robot);
  const paintFigure = (figure, robot, options) => window.RobooRobo.paintFigure(figure, robot, imgBase, options);
  const randomItem = (list) => list[Math.floor(Math.random() * list.length)];

  const PHRASES = [
    (name) => `Oi! Eu sou o ${name}!`,
    () => "Bip bop! Vamos aprender juntos?",
    () => "Você está indo muito bem!",
    () => "Sabia que robôs usam sensores para “enxergar”?",
    () => "Mais uma missão? Eu topo!",
    () => "Hihi, isso faz cócegas nos meus circuitos!",
    () => "Cada etapa concluída me deixa mais forte!",
    () => "A IA aprende com exemplos, igualzinho a você!",
  ];

  /* ---------- robô salvo (destaque, card, sidebar e cabeçalho) ---------- */
  const showcase = document.querySelector("#robot-showcase");
  const bubble = document.querySelector("#robot-bubble");
  const moodText = document.querySelector("#robot-mood");
  const stageGlow = document.querySelector("#robot-stage-glow");
  const traitDot = document.querySelector("#robot-trait-dot");
  const traitColor = document.querySelector("#robot-trait-color");
  const traitAccWrap = document.querySelector("#robot-trait-acc-wrap");
  const traitAcc = document.querySelector("#robot-trait-acc");

  let current = loadRobot();

  function renderCurrent(options) {
    document.querySelectorAll('[data-robot-figure]:not([data-robot-figure="draft"])')
      .forEach((figure) => paintFigure(figure, current, options));
    document.querySelectorAll('[data-robot-name]:not([data-robot-name="draft"])')
      .forEach((element) => { element.textContent = current.name; });

    const pose = findPose(current.pose);
    const color = findColor(current.color);
    const acc = findAcc(current.acc);
    if (moodText) moodText.textContent = pose.mood;
    stageGlow?.style.setProperty("--robot-glow", color.glow);
    traitDot?.style.setProperty("--dot", color.swatch);
    if (traitColor) traitColor.textContent = color.label;
    if (traitAccWrap) traitAccWrap.hidden = !acc.icon;
    if (traitAcc) traitAcc.innerHTML = `<span class="trait-acc">${accessoryHtml(acc)}</span>${acc.label}`;
  }

  let bubbleTimer = null;
  function say(text) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), 3200);
  }

  function confetti(origin) {
    if (reduceMotion) return;
    const rect = origin?.getBoundingClientRect();
    const visible = rect && rect.width && rect.bottom > 0 && rect.top < window.innerHeight;
    const x = visible ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = visible ? rect.top + rect.height / 2 : window.innerHeight / 3;
    const colors = ["#2DD4E8", "#F6B93B", "#FF7AB6", "#8B6FEA", "#20C671", "#2F5DE0"];

    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    layer.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 46; i += 1) {
      const piece = document.createElement("span");
      piece.className = `confetti-piece${i % 3 === 0 ? " round" : ""}`;
      piece.style.cssText = [
        `left:${x}px`,
        `top:${y}px`,
        `--c:${randomItem(colors)}`,
        `--dx:${Math.round((Math.random() - 0.5) * 440)}px`,
        `--up:${Math.round(-80 - Math.random() * 150)}px`,
        `--dy:${Math.round(120 + Math.random() * 260)}px`,
        `--r:${Math.round((Math.random() - 0.5) * 720)}deg`,
        `--d:${(Math.random() * 0.15).toFixed(2)}s`,
      ].join(";");
      layer.append(piece);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 2200);
  }

  let phraseIndex = -1;
  showcase?.addEventListener("click", () => {
    let next = phraseIndex < 0 ? 0 : Math.floor(Math.random() * PHRASES.length);
    if (next === phraseIndex) next = (next + 1) % PHRASES.length;
    phraseIndex = next;
    say(PHRASES[phraseIndex](current.name));
    replayClass(showcase, "is-jumping", 700);
  });

  document.querySelector("#robot-dance")?.addEventListener("click", () => {
    replayClass(showcase, "is-dancing", 1800);
    say("Bip-bop-dança! Olha o meu passinho!");
    confetti(showcase);
  });

  function stepPose(direction) {
    const index = POSES.findIndex((pose) => pose.id === current.pose);
    current = { ...current, pose: POSES[(index + direction + POSES.length) % POSES.length].id };
    storeRobot(current);
    renderCurrent({ animateAcc: true });
    say(findPose(current.pose).mood);
    replayClass(showcase, "is-jumping", 700);
  }
  document.querySelector("#robot-prev-pose")?.addEventListener("click", () => stepPose(-1));
  document.querySelector("#robot-next-pose")?.addEventListener("click", () => stepPose(1));

  /* ---------- oficina (modal de personalização) ---------- */
  const workshop = document.querySelector("#robot-workshop");
  const nameInput = document.querySelector("#robot-name-input");
  const poseOptions = document.querySelector("#pose-options");
  const colorOptions = document.querySelector("#color-options");
  const accOptions = document.querySelector("#acc-options");
  const draftFigure = document.querySelector('[data-robot-figure="draft"]');
  const draftName = document.querySelector('[data-robot-name="draft"]');
  const workshopGlow = document.querySelector("#workshop-glow");
  const newBadges = document.querySelectorAll(".nav-new");
  const seenKey = `${storageKey}-visto`;
  let draft = { ...current };
  let lastFocus = null;

  poseOptions.innerHTML = POSES.map((pose) => `
    <button type="button" class="option-tile" data-pose="${pose.id}" aria-pressed="false">
      <span class="robot-figure"><img src="${imgBase}${pose.id}.png" alt=""><span class="robot-acc"></span></span>
      ${pose.label}
    </button>`).join("");
  colorOptions.innerHTML = COLORS.map((color) => `
    <button type="button" class="swatch" data-color="${color.id}" style="--swatch:${color.swatch}" title="${color.label}" aria-label="Cor ${color.label}" aria-pressed="false"></button>`).join("");
  accOptions.innerHTML = ACCESSORIES.map((acc) => `
    <button type="button" class="option-tile" data-acc="${acc.id}" title="${acc.label}" aria-label="${acc.label}" aria-pressed="false">${accessoryHtml(acc) || '<span class="acc-none">Nada</span>'}</button>`).join("");

  function renderDraft(options) {
    paintFigure(draftFigure, draft, options);
    if (draftName) draftName.textContent = draft.name.trim() || DEFAULT_ROBOT.name;
    workshopGlow?.style.setProperty("--robot-glow", findColor(draft.color).glow);
    poseOptions.querySelectorAll("[data-pose]").forEach((button) => {
      const poseId = Number(button.dataset.pose);
      button.setAttribute("aria-pressed", String(poseId === draft.pose));
      paintFigure(button.querySelector(".robot-figure"), { ...draft, pose: poseId });
    });
    colorOptions.querySelectorAll("[data-color]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.color === draft.color));
    });
    accOptions.querySelectorAll("[data-acc]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.acc === draft.acc));
    });
  }

  function openWorkshop() {
    lastFocus = document.activeElement;
    draft = { ...current };
    nameInput.value = draft.name;
    renderDraft();
    workshop.hidden = false;
    document.body.classList.add("modal-open");
    nameInput.focus();

    newBadges.forEach((badge) => badge.remove());
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      // ignora: o selo "NOVO" volta a aparecer na próxima visita
    }
  }

  function closeWorkshop() {
    workshop.hidden = true;
    document.body.classList.remove("modal-open");
    lastFocus?.focus?.({ preventScroll: true });
  }

  try {
    if (localStorage.getItem(seenKey)) newBadges.forEach((badge) => badge.remove());
  } catch {
    // mantém o selo
  }

  document.querySelectorAll("[data-open-workshop]").forEach((button) => button.addEventListener("click", openWorkshop));
  workshop.querySelectorAll("[data-workshop-close]").forEach((button) => button.addEventListener("click", closeWorkshop));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !workshop.hidden) closeWorkshop();
  });

  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value.slice(0, 16);
    renderDraft();
  });
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.querySelector("#robot-save").click();
  });

  poseOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pose]");
    if (!button) return;
    draft.pose = Number(button.dataset.pose);
    renderDraft({ animateAcc: true });
  });
  colorOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button) return;
    draft.color = button.dataset.color;
    renderDraft();
  });
  accOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-acc]");
    if (!button) return;
    draft.acc = button.dataset.acc;
    renderDraft({ animateAcc: true });
  });

  document.querySelector("#robot-random")?.addEventListener("click", (event) => {
    draft = { ...draft, pose: randomItem(POSES).id, color: randomItem(COLORS).id, acc: randomItem(ACCESSORIES).id };
    renderDraft({ animateAcc: true });
    replayClass(event.currentTarget, "rolling", 500);
  });

  document.querySelector("#robot-save")?.addEventListener("click", () => {
    current = sanitize({ ...draft, name: nameInput.value });
    storeRobot(current);
    renderCurrent({ animateAcc: true });
    closeWorkshop();
    say("Uau! Fiquei incrível! Valeu!");
    replayClass(showcase, "is-jumping", 700);
    confetti(showcase);
  });

  renderCurrent();
})();

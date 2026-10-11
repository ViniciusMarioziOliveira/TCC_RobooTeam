const studentPage = document.body;
const timelineElement = document.querySelector("#ai-timeline");
const continueButton = document.querySelector("#continue-mission");
// campos de código da turma (RBT) e da Arena (ARN): o começo já vem fixo na tela
const codeForms = [...document.querySelectorAll("form[data-code-prefix]")];
const roomJoinForm = document.querySelector("#join-room-form");
const arenaJoinForm = document.querySelector("#join-arena-form");
const roomStatus = document.querySelector("#student-room-status");
const CODE_LENGTH = 4;
const ARENA_LOCKED_MESSAGE = "Primeiro entre na turma com o código RBT. Depois a Arena fica liberada.";
let nextLessonUrl = null;

function getStoredToken() {
  return localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
}

function authHeaders(includeJson = false) {
  const token = getStoredToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ícones do sprite (templates/_icones.html)
function icon(name, extra = "") {
  return `<svg class="ico${extra ? ` ${extra}` : ""}" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
}

const ICONES_MINIJOGO = {
  memory: "brain",
  maze: "route",
  word_search: "text-search",
  snake: "worm",
  drag_drop: "puzzle",
  nenhum: "book-open",
};

function minigameBadge(minijogo) {
  if (!minijogo || !minijogo.type) return "";
  const icone = ICONES_MINIJOGO[minijogo.type] || "gamepad-2";
  return `<span class="ai-game-badge ${escapeHtml(minijogo.type)}">${icon(icone)}${escapeHtml(minijogo.label)}</span>`;
}

function renderTimeline(items) {
  timelineElement.innerHTML = items.map((item, index) => {
    const isLocked = item.estado === "bloqueada";
    const label = item.estado === "concluida" ? "Revisar etapa" : item.estado === "atual" ? "Iniciar etapa" : "Bloqueada";
    const marker = item.estado === "concluida" ? icon("check") : (item.posicao ?? index + 1);

    return `
      <article class="ai-timeline-card ${item.estado}" style="animation-delay:${index * 70}ms">
        <div class="ai-timeline-marker" aria-hidden="true">${marker}</div>
        <div>
          <div class="ai-timeline-period">${escapeHtml(item.period)}</div>
          <h3 class="ai-timeline-title">${escapeHtml(item.title)}</h3>
          <p class="ai-timeline-description">${escapeHtml(item.description)}</p>
          ${minigameBadge(item.minijogo)}
        </div>
        <button class="ai-step-button" type="button" data-lesson-url="${escapeHtml(item.url)}" ${isLocked ? "disabled" : ""}>${label}</button>
      </article>
    `;
  }).join("");
}

function setCodeFeedback(form, message, type = "") {
  const feedback = form.querySelector(".room-feedback");
  feedback.textContent = message;
  feedback.className = `room-feedback${type ? ` ${type}` : ""}`;
}

// volta o campo ao normal depois de um erro
function resetCodeFeedback(form) {
  form.querySelector(".code-field").classList.remove("is-error");
  setCodeFeedback(form, form.dataset.idleMessage, form.dataset.idleType);
}

function renderRoomState(room) {
  // a Arena só fica liberada para quem já está na turma do professor
  arenaJoinForm.dataset.idleMessage = room ? arenaJoinForm.dataset.defaultMessage : ARENA_LOCKED_MESSAGE;
  resetCodeFeedback(arenaJoinForm);
  if (!room) {
    roomStatus.hidden = true;
    return;
  }
  roomStatus.hidden = false;
  roomStatus.textContent = room.turma;
  roomJoinForm.dataset.idleMessage = `Sala conectada · Responsável: ${room.professor}`;
  roomJoinForm.dataset.idleType = "success";
  resetCodeFeedback(roomJoinForm);
}

function animateNumber(element, target) {
  if (!element) return;
  const start = Number(element.textContent) || 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (start === target || reduceMotion) {
    element.textContent = target;
    return;
  }
  const duration = 900;
  const startedAt = performance.now();
  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function popValue(element) {
  if (!element) return;
  element.classList.remove("pop");
  void element.offsetWidth;
  element.classList.add("pop");
}

function renderDashboard(data) {
  const { progress, usuario } = data;
  const firstName = usuario.nome.split(" ")[0];
  document.querySelector("#student-name").textContent = usuario.nome;
  document.querySelector("#greeting-name").textContent = firstName;
  animateNumber(document.querySelector("#student-points"), progress.points);
  animateNumber(document.querySelector("#sidebar-points"), progress.points);
  animateNumber(document.querySelector("#header-points"), progress.points);
  document.querySelector("#student-level").textContent = `Nível ${progress.level}`;
  document.querySelector("#sidebar-level").textContent = String(progress.level).padStart(2, "0");
  document.querySelector("#student-missions").textContent = `${progress.completed} / ${progress.total}`;
  document.querySelector("#sidebar-progress-text").textContent = `${progress.percent}%`;
  document.querySelector("#sidebar-progress-fill").style.width = `${progress.percent}%`;
  document.querySelector("#trail-progress-percent").textContent = `${progress.percent}%`;
  document.querySelector("#trail-progress-text").textContent = `${progress.completed} de ${progress.total} etapas concluídas`;
  document.querySelector("#trail-progress-fill").style.width = `${progress.percent}%`;
  ["#student-points", "#student-level", "#student-missions"].forEach((selector) => popValue(document.querySelector(selector)));
  renderRoomState(data.sala);

  if (data.next) {
    nextLessonUrl = data.next.url;
    document.querySelector("#current-mission-name").textContent = data.next.title;
    document.querySelector("#current-mission-description").textContent = data.next.description;
    continueButton.disabled = false;
    continueButton.innerHTML = `${icon("play", "ico-fill")} Continuar Etapa`;
  } else {
    nextLessonUrl = null;
    document.querySelector("#current-mission-name").textContent = "Trilha concluída!";
    document.querySelector("#current-mission-description").textContent = "Parabéns! Você concluiu todos os capítulos da história da IA.";
    continueButton.disabled = true;
    continueButton.textContent = "Trilha completa";
  }

  renderTimeline(data.items);
}

async function loadStudentJourney() {
  try {
    const response = await fetch(studentPage.dataset.trailUrl, { headers: authHeaders() });
    if (response.status === 401 || response.status === 403) {
      window.location.href = studentPage.dataset.loginUrl;
      return;
    }
    if (!response.ok) throw new Error("Falha ao carregar a trilha");
    renderDashboard(await response.json());
  } catch {
    timelineElement.innerHTML = '<div class="ai-error">Não foi possível carregar a trilha. Atualize a página e tente novamente.</div>';
  }
}

timelineElement?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-lesson-url]");
  if (!button || button.disabled) return;
  window.location.href = button.dataset.lessonUrl;
});

continueButton?.addEventListener("click", () => {
  if (nextLessonUrl) window.location.href = nextLessonUrl;
});

/* ---- CÓDIGOS DA TURMA E DA ARENA (8 quadradinhos, 4 para digitar) ---- */

// Lê o que foi digitado ou colado: "rbt-a1b2", "RBTA1B2" e "A1B2" viram "A1B2".
// Se for o código do outro campo (ARN no da turma, RBT no da Arena), devolve o dono dele.
function readCode(form, value) {
  let letters = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (letters.length > CODE_LENGTH) {
    const owner = codeForms.find((item) => letters.startsWith(item.dataset.codePrefix));
    if (owner && owner !== form) return { code: "", owner };
    if (owner) letters = letters.slice(owner.dataset.codePrefix.length);
  }
  return { code: letters.slice(0, CODE_LENGTH) };
}

function paintCode(form) {
  const input = form.querySelector(".code-input");
  const { code } = readCode(form, input.value);
  const active = document.activeElement === input ? Math.min(code.length, CODE_LENGTH - 1) : -1;
  form.querySelectorAll("[data-code-slot]").forEach((slot, index) => {
    slot.textContent = code[index] || "";
    slot.classList.toggle("is-filled", index < code.length);
    slot.classList.toggle("is-active", index === active);
  });
}

// deixa no campo só os 4 caracteres e redesenha os quadradinhos
function normalizeCode(form) {
  const input = form.querySelector(".code-input");
  const { code, owner } = readCode(form, input.value);
  if (input.value !== code) input.value = code;
  paintCode(form);
  return owner;
}

function shakeCodeField(form) {
  const field = form.querySelector(".code-field");
  field.classList.remove("is-error");
  void field.offsetWidth;
  field.classList.add("is-error");
}

function handleCodeInput(form) {
  const owner = normalizeCode(form);
  if (owner) {
    setCodeFeedback(form, owner.dataset.wrongField, "error");
    shakeCodeField(form);
  } else if (form.querySelector(".room-feedback").classList.contains("error")) {
    resetCodeFeedback(form);
  }
}

// o texto do campo é invisível: o cursor fica sempre no fim, no próximo quadradinho
function caretToEnd(input) {
  requestAnimationFrame(() => {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

async function submitCode(form) {
  const input = form.querySelector(".code-input");
  const button = form.querySelector(".room-join-button");
  const label = button.querySelector("span");
  normalizeCode(form);
  const code = input.value;
  if (code.length < CODE_LENGTH) {
    const missing = CODE_LENGTH - code.length;
    setCodeFeedback(form, code
      ? `Falta${missing > 1 ? "m" : ""} ${missing} caractere${missing > 1 ? "s" : ""} do código.`
      : `Digite os ${CODE_LENGTH} caracteres que vêm depois do tracinho.`, "error");
    shakeCodeField(form);
    input.focus();
    return;
  }

  const idleLabel = label.textContent;
  button.disabled = true;
  label.textContent = "Entrando...";
  form.querySelector(".code-field").classList.remove("is-error");
  setCodeFeedback(form, "Conferindo o código...");

  try {
    const response = await fetch(studentPage.dataset.joinRoomUrl, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ codigo: `${form.dataset.codePrefix}-${code}` }),
    });
    // 403 aqui é "fora da turma": a mensagem aparece no campo, sem sair do painel
    if (response.status === 401) {
      window.location.href = studentPage.dataset.loginUrl;
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível entrar com esse código");
    input.value = "";
    paintCode(form);
    if (result.redirect_url) {
      setCodeFeedback(form, result.message, "success");
      window.setTimeout(() => {
        window.location.href = result.redirect_url;
      }, 650);
      return;
    }
    // sala da turma: fica no painel e recarrega a trilha/arenas do professor
    await Promise.all([loadStudentJourney(), loadArenaShortcuts()]);
    if (result.sala) renderRoomState(result.sala);
    setCodeFeedback(form, result.message, "success");
  } catch (error) {
    setCodeFeedback(form, error.message, "error");
    shakeCodeField(form);
  } finally {
    button.disabled = false;
    label.textContent = idleLabel;
  }
}

codeForms.forEach((form) => {
  const input = form.querySelector(".code-input");
  form.dataset.defaultMessage = form.querySelector(".room-feedback").textContent;
  form.dataset.idleMessage = form.dataset.defaultMessage;

  input.addEventListener("input", (event) => {
    // no celular o teclado ainda pode estar "montando" a palavra: só desenha
    if (event.isComposing) paintCode(form);
    else handleCodeInput(form);
  });
  input.addEventListener("compositionend", () => handleCodeInput(form));
  input.addEventListener("focus", () => {
    caretToEnd(input);
    paintCode(form);
  });
  input.addEventListener("blur", () => normalizeCode(form));
  input.addEventListener("click", () => caretToEnd(input));
  input.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) event.preventDefault();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitCode(form);
  });
  normalizeCode(form);
});

document.querySelector("#student-logout")?.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await fetch(studentPage.dataset.logoutUrl, { method: "POST", headers: authHeaders() });
  } finally {
    localStorage.removeItem("robooteam-active-user");
    localStorage.removeItem("robooteam-token");
    sessionStorage.removeItem("robooteam-active-user");
    sessionStorage.removeItem("robooteam-token");
    window.location.href = studentPage.dataset.loginUrl;
  }
});

/* ---- SIDEBAR: gaveta no celular + item ativo conforme a rolagem ---- */
const sidebarToggle = document.querySelector("#sidebar-toggle");

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  sidebarToggle?.setAttribute("aria-expanded", String(open));
}

sidebarToggle?.addEventListener("click", () => setSidebarOpen(true));
document.querySelector("#sidebar-close")?.addEventListener("click", () => setSidebarOpen(false));
document.querySelector("#sidebar-overlay")?.addEventListener("click", () => setSidebarOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSidebarOpen(false);
});
document.querySelectorAll(".sidebar .nav-item, .sidebar .avatar-wrap").forEach((item) => {
  item.addEventListener("click", () => setSidebarOpen(false));
});

const spyLinks = [...document.querySelectorAll(".sidebar .nav-item[data-spy]")];
const spySections = spyLinks
  .map((link) => document.getElementById(link.dataset.spy))
  .filter((section) => section && section.id !== "inicio");

function setActiveNav(sectionId) {
  spyLinks.forEach((link) => link.classList.toggle("active", link.dataset.spy === sectionId));
}

function updateActiveNav() {
  const scrollTop = window.scrollY;
  if (scrollTop < 60) return setActiveNav("inicio");

  const ordered = [...spySections].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (window.innerHeight + scrollTop >= document.documentElement.scrollHeight - 4) {
    return setActiveNav(ordered[ordered.length - 1].id);
  }
  const current = ordered.filter((section) => section.getBoundingClientRect().top <= 140).pop();
  setActiveNav(current ? current.id : "inicio");
}

let navFrame = null;
window.addEventListener("scroll", () => {
  if (navFrame) return;
  navFrame = requestAnimationFrame(() => {
    navFrame = null;
    updateActiveNav();
  });
}, { passive: true });

function setupModal(modal) {
  if (!modal) return;
  const openButtons = document.querySelectorAll(`[data-open-modal="${modal.id}"]`);

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  };

  const openModal = () => {
    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".app-modal-close")?.focus();
  };

  openButtons.forEach((button) => button.addEventListener("click", openModal));
  modal.querySelectorAll("[data-modal-close]").forEach((element) => {
    element.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });
}

async function loadArenaShortcuts() {
  const box = document.querySelector("#arena-quick");
  if (!box || !studentPage.dataset.arenasUrl) return;
  try {
    const response = await fetch(studentPage.dataset.arenasUrl, { headers: authHeaders() });
    if (!response.ok) return;
    const { arenas } = await response.json();
    const active = arenas.filter((arena) => arena.status !== "finalizada");
    box.hidden = !active.length;
    document.querySelector("#arena-quick-list").innerHTML = active.map((arena) => `
      <a class="arena-quick-item${arena.status === "em_jogo" ? " live" : ""}" href="${escapeHtml(arena.url)}">
        <strong>${escapeHtml(arena.nome)}</strong>
        <span>${arena.status === "em_jogo" ? `${icon("play", "ico-fill")} Jogar agora` : `${icon("hourglass")} Aguardando a largada`} · ${escapeHtml(arena.codigo)}</span>
      </a>`).join("");
  } catch {
    // atalhos da Arena são opcionais
  }
}

setupModal(document.querySelector("#how-to-modal"));
setupModal(document.querySelector("#help-modal"));

loadStudentJourney();
loadArenaShortcuts();

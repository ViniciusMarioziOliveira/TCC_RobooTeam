const studentPage = document.body;
const timelineElement = document.querySelector("#ai-timeline");
const continueButton = document.querySelector("#continue-mission");
const roomJoinForm = document.querySelector("#join-room-form");
const roomCodeInput = document.querySelector("#room-code-input");
const roomJoinButton = document.querySelector("#join-room-button");
const roomFeedback = document.querySelector("#room-join-feedback");
const roomStatus = document.querySelector("#student-room-status");
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

const ICONES_MINIJOGO = {
  memory: "🃏",
  maze: "🤖",
  word_search: "🔤",
  snake: "🐍",
  drag_drop: "🧩",
  nenhum: "📖",
};

function minigameBadge(minijogo) {
  if (!minijogo || !minijogo.type) return "";
  const icone = ICONES_MINIJOGO[minijogo.type] || "🎮";
  return `<span class="ai-game-badge ${escapeHtml(minijogo.type)}"><span aria-hidden="true">${icone}</span>${escapeHtml(minijogo.label)}</span>`;
}

function renderTimeline(items) {
  timelineElement.innerHTML = items.map((item, index) => {
    const isLocked = item.estado === "bloqueada";
    const label = item.estado === "concluida" ? "Revisar etapa" : item.estado === "atual" ? "Iniciar etapa" : "Bloqueada";
    const marker = item.estado === "concluida" ? "✓" : (item.posicao ?? index + 1);

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

function setRoomFeedback(message, type = "") {
  roomFeedback.textContent = message;
  roomFeedback.className = `room-feedback${type ? ` ${type}` : ""}`;
}

function renderRoomState(room) {
  if (!room) {
    roomStatus.hidden = true;
    return;
  }
  roomStatus.hidden = false;
  roomStatus.textContent = room.turma;
  setRoomFeedback(`Sala conectada · Responsável: ${room.professor}`, "success");
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
    continueButton.textContent = "▶ Continuar Etapa";
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

roomCodeInput?.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/\s/g, "");
  if (roomFeedback.classList.contains("error")) {
    setRoomFeedback("O código fica disponível por 24 horas após ser gerado.");
  }
});

roomJoinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const codigo = roomCodeInput.value.trim().toUpperCase();
  if (!codigo) {
    setRoomFeedback("Digite o código enviado pelo professor.", "error");
    roomCodeInput.focus();
    return;
  }

  roomJoinButton.disabled = true;
  roomJoinButton.querySelector("span").textContent = "Entrando...";
  setRoomFeedback("Validando o código da sala...");

  try {
    const response = await fetch(studentPage.dataset.joinRoomUrl, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ codigo }),
    });
    if (response.status === 401 || response.status === 403) {
      window.location.href = studentPage.dataset.loginUrl;
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível entrar na sala");
    if (result.sala) renderRoomState(result.sala);
    setRoomFeedback(result.message, "success");
    roomCodeInput.value = "";
    if (result.redirect_url) {
      window.setTimeout(() => {
        window.location.href = result.redirect_url;
      }, 650);
    }
  } catch (error) {
    setRoomFeedback(error.message, "error");
  } finally {
    roomJoinButton.disabled = false;
    roomJoinButton.querySelector("span").textContent = "Entrar na sala";
  }
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
        <span>${arena.status === "em_jogo" ? "▶ Jogar agora" : "⏳ Aguardando a largada"} · ${escapeHtml(arena.codigo)}</span>
      </a>`).join("");
  } catch {
    // atalhos da Arena são opcionais
  }
}

setupModal(document.querySelector("#how-to-modal"));
setupModal(document.querySelector("#help-modal"));

loadStudentJourney();
loadArenaShortcuts();

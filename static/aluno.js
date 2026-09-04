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

function renderTimeline(items) {
  timelineElement.innerHTML = items.map((item, index) => {
    const isLocked = item.estado === "bloqueada";
    const label = item.estado === "concluida" ? "Revisar etapa" : item.estado === "atual" ? "Iniciar etapa" : "Bloqueada";
    const marker = item.estado === "concluida" ? "✓" : item.id;

    return `
      <article class="ai-timeline-card ${item.estado}" style="animation-delay:${index * 70}ms">
        <div class="ai-timeline-marker" aria-hidden="true">${marker}</div>
        <div>
          <div class="ai-timeline-period">${escapeHtml(item.period)}</div>
          <h3 class="ai-timeline-title">${escapeHtml(item.title)}</h3>
          <p class="ai-timeline-description">${escapeHtml(item.description)}</p>
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

function renderDashboard(data) {
  const { progress, usuario } = data;
  const firstName = usuario.nome.split(" ")[0];
  document.querySelector("#student-name").textContent = usuario.nome;
  document.querySelector("#greeting-name").textContent = firstName;
  document.querySelector("#student-points").textContent = progress.points;
  document.querySelector("#sidebar-points").textContent = progress.points;
  document.querySelector("#student-level").textContent = `Nível ${progress.level}`;
  document.querySelector("#sidebar-level").textContent = String(progress.level).padStart(2, "0");
  document.querySelector("#student-missions").textContent = `${progress.completed} / ${progress.total}`;
  document.querySelector("#sidebar-progress-text").textContent = `${progress.percent}%`;
  document.querySelector("#sidebar-progress-fill").style.width = `${progress.percent}%`;
  document.querySelector("#trail-progress-percent").textContent = `${progress.percent}%`;
  document.querySelector("#trail-progress-text").textContent = `${progress.completed} de ${progress.total} etapas concluídas`;
  document.querySelector("#trail-progress-fill").style.width = `${progress.percent}%`;
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
    renderRoomState(result.sala);
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

document.querySelectorAll(".sidebar .nav-item[href^='#']").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".sidebar .nav-item").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });
});

loadStudentJourney();

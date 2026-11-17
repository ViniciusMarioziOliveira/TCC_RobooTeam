/* =========================================================================
   PAINEL DO PROFESSOR - VISÃO GERAL, TURMAS E ALUNOS
   escapeHtml() e authHeaders() ficam globais: professor_atividades.js e
   professor_arena.js (carregados depois) usam os dois.
   ========================================================================= */
const professorPage = document.body;
const classesUrl = professorPage.dataset.classesUrl;
const studentsUrl = professorPage.dataset.studentsUrl;
let dashboardData = null;
let highlightClassId = null;

function getStoredToken() {
  return localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
}

function authHeaders(includeJson = false) {
  const headers = {};
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const qs = (selector, root = document) => root.querySelector(selector);
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function formatDate(value) {
  if (!value) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function plural(count, singular, pluralWord) {
  return `${count} ${count === 1 ? singular : pluralWord}`;
}

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function drawIcons() {
  if (window.lucide) lucide.createIcons();
}

// avisos rápidos no canto da tela (mesmo visual dos avisos da Arena)
function toast(message, tone = "good", iconName = "circle-check") {
  const container = qs("#arena-toasts");
  if (!container) return;
  const element = document.createElement("div");
  element.className = `arena-toast${tone ? ` ${tone}` : ""}`;
  element.innerHTML = `${iconName ? `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>` : ""}<span>${escapeHtml(message)}</span>`;
  container.append(element);
  drawIcons();
  setTimeout(() => element.remove(), 5000);
}

async function apiRequest(url, { method = "GET", body } = {}) {
  const response = await fetch(url, {
    method,
    headers: authHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (response.status === 401 || response.status === 403) {
    window.location.href = professorPage.dataset.loginUrl;
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a ação.");
  return data;
}

function statusClasses(status) {
  if (status === "Concluído") return "bg-emerald-100 text-emerald-800";
  if (status === "Em andamento") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

/* ------------------------------------------------------------ conta e números */
function renderAccount(data) {
  const { professor, metrics } = data;
  const avatar = initials(professor.nome);
  qs("#professor-sidebar-name").textContent = professor.nome;
  qs("#professor-avatar").textContent = avatar;
  qs("#header-avatar").textContent = avatar;
  qs("#header-professor-name").textContent = professor.nome;
  qs("#professor-greeting-name").textContent = professor.nome.split(" ")[0];

  qs("#sidebar-total-students").textContent = metrics.total_alunos;
  qs("#sidebar-active-classes").textContent = metrics.turmas;
  qs("#sidebar-active-students").textContent = metrics.alunos_iniciaram;
  qs("#sidebar-average").textContent = `${metrics.media_geral}%`;
  qs("#sidebar-average-fill").style.width = `${metrics.media_geral}%`;
  qs("#sidebar-average-bar").setAttribute("aria-valuenow", metrics.media_geral);
}

function renderMetrics(data) {
  const { metrics } = data;
  qs("#metric-total-students").textContent = metrics.total_alunos;
  qs("#metric-active-classes").textContent = metrics.turmas;
  qs("#metric-active-students").textContent = metrics.alunos_iniciaram;
  qs("#metric-activities").textContent = metrics.total_atividades;
  qs("#metric-average").textContent = `${metrics.media_geral}%`;

  qs("#sidebar-students-badge").textContent = metrics.total_alunos;
  qs("#sidebar-classes-badge").textContent = metrics.turmas;
  qs("#classes-count-badge").textContent = plural(metrics.turmas, "turma", "turmas");

  const codes = metrics.codigos_ativos;
  const codeBadge = qs("#sidebar-room-code");
  codeBadge.textContent = codes ? String(codes) : "—";
  codeBadge.title = codes ? `${plural(codes, "turma", "turmas")} com código válido agora` : "Nenhum código válido agora";
  codeBadge.classList.toggle("is-live", codes > 0);
}

function renderChart(students) {
  const chart = qs("#performance-chart");
  if (!students.length) {
    chart.innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <img class="dashboard-state-robot" src="${professorPage.dataset.emptyRobotUrl}" alt="Mascote RobooTeam preocupado">
        <p class="mt-2 text-sm font-semibold text-slate-600">Nenhum aluno nas suas turmas ainda.</p>
        <span class="mt-1 text-xs text-slate-400">Gere o código de uma turma e passe para os alunos.</span>
      </div>`;
    return;
  }

  chart.innerHTML = `<div class="space-y-6">${students.map((student) => `
    <div>
      <div class="flex justify-between gap-4 text-xs mb-2">
        <span class="font-semibold text-slate-700 min-w-0 truncate">${escapeHtml(student.nome)} <span class="font-normal text-slate-400">· ${escapeHtml(student.turma)}</span></span>
        <span class="font-mono font-bold text-brand-cyan">${student.percentual}%</span>
      </div>
      <div class="h-3 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-label="Progresso de ${escapeHtml(student.nome)}" aria-valuenow="${student.percentual}" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full bg-gradient-to-r from-brand-accent to-brand-cyan rounded-full transition-all" style="width:${student.percentual}%"></div>
      </div>
      <p class="text-[10px] text-slate-400 mt-1">Próxima: ${escapeHtml(student.proxima)}</p>
    </div>
  `).join("")}</div>`;
}

/* ---------------------------------------------------------------------- turmas */
function classCard(classroom) {
  const name = escapeHtml(classroom.nome);
  const state = !classroom.codigo ? "is-empty" : classroom.codigo_ativo ? "is-live" : "is-expired";
  const stateText = !classroom.codigo
    ? "Gere um código para os alunos entrarem"
    : classroom.codigo_ativo
      ? `Vale até ${shortDate.format(new Date(classroom.codigo_validade))}`
      : `Expirou em ${shortDate.format(new Date(classroom.codigo_validade))}`;

  return `
    <article class="class-card${classroom.id === highlightClassId ? " is-new" : ""}" data-class-id="${classroom.id}">
      <div class="class-card-head">
        <div class="class-card-icon" aria-hidden="true"><i data-lucide="school" class="w-5 h-5"></i></div>
        <div class="min-w-0 flex-1" data-class-title>
          <h4 class="class-card-name">${name}</h4>
          <p class="class-card-meta">
            <span><i data-lucide="users" class="w-3 h-3"></i>${plural(classroom.quantidade, "aluno", "alunos")}</span>
            <span><i data-lucide="trending-up" class="w-3 h-3"></i>${classroom.quantidade ? `média ${classroom.media}%` : "sem alunos ainda"}</span>
          </p>
        </div>
        <div class="class-card-tools">
          <button type="button" class="icon-button" data-class-rename title="Renomear turma" aria-label="Renomear a turma ${name}">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button type="button" class="icon-button danger" data-class-delete title="Excluir turma" aria-label="Excluir a turma ${name}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="class-progress" role="progressbar" aria-label="Média de conclusão da turma ${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${classroom.media}">
        <div style="width:${classroom.media}%"></div>
      </div>
      <div class="class-code-box ${state}">
        <div class="min-w-0">
          <span class="class-code-label">Código da turma</span>
          <span class="class-code-value">${classroom.codigo ? escapeHtml(classroom.codigo) : "Sem código"}</span>
          <span class="class-code-status"><i data-lucide="clock" class="w-3 h-3"></i>${stateText}</span>
        </div>
        <button type="button" class="class-code-copy" data-class-copy ${classroom.codigo_ativo ? "" : "disabled"} title="Copiar código" aria-label="Copiar o código da turma ${name}">
          <i data-lucide="copy" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="class-card-actions">
        <button type="button" class="class-action primary" data-class-code>
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>${classroom.codigo_ativo ? "Novo código" : "Gerar código"}
        </button>
        <button type="button" class="class-action ghost" data-class-students>
          <i data-lucide="users" class="w-3.5 h-3.5"></i>Ver alunos
        </button>
      </div>
    </article>`;
}

function renderClasses(classes) {
  const list = qs("#classes-list");
  list.innerHTML = classes.length
    ? classes.map(classCard).join("")
    : `
      <div class="classes-empty lg:col-span-2 2xl:col-span-3">
        <img class="dashboard-state-robot" src="${professorPage.dataset.emptyRobotUrl}" alt="" aria-hidden="true">
        <p class="text-sm font-bold text-slate-700">Você ainda não tem turmas</p>
        <p class="text-xs text-slate-500 max-w-sm">Crie a primeira turma, gere o código e passe para os alunos digitarem no painel deles.</p>
        <button type="button" class="class-action primary mt-2" data-class-create-first>
          <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>Criar a primeira turma
        </button>
      </div>`;

  if (highlightClassId !== null) {
    qs(`[data-class-id="${highlightClassId}"]`, list)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    highlightClassId = null;
  }
}

function findClass(id) {
  return dashboardData?.turmas.find((classroom) => classroom.id === id);
}

async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    toast(`Código ${code} copiado!`, "good", "copy");
  } catch {
    window.prompt("Copie o código da turma:", code);
  }
}

async function generateCode(classroom, button) {
  if (classroom.codigo_ativo && !window.confirm(
    `Gerar um novo código para "${classroom.nome}"?\n\nO código atual (${classroom.codigo}) deixa de valer.`,
  )) return;

  button.disabled = true;
  try {
    const result = await apiRequest(`${classesUrl}/${classroom.id}/codigo`, { method: "POST", body: {} });
    toast(`Novo código da turma ${result.turma}: ${result.codigo}`, "good", "key-round");
    await loadProfessorDashboard();
  } catch (error) {
    toast(error.message, "alert", "circle-alert");
  } finally {
    button.disabled = false;
  }
}

async function deleteClass(classroom) {
  let warning = "";
  if (classroom.quantidade === 1) warning = "\n\n1 aluno sai da turma e vai precisar de um novo código para voltar.";
  else if (classroom.quantidade > 1) warning = `\n\n${classroom.quantidade} alunos saem da turma e vão precisar de um novo código para voltar.`;
  if (warning) warning += " O progresso deles não é apagado.";
  if (!window.confirm(`Excluir a turma "${classroom.nome}"?${warning}`)) return;

  try {
    const result = await apiRequest(`${classesUrl}/${classroom.id}`, { method: "DELETE" });
    toast(result.message, "good", "trash-2");
    await loadProfessorDashboard();
  } catch (error) {
    toast(error.message, "alert", "circle-alert");
  }
}

// troca o nome da turma ali mesmo no card
function startRename(card, classroom) {
  if (card.classList.contains("is-renaming")) return;
  const form = document.createElement("form");
  form.className = "class-rename";
  form.innerHTML = `
    <input class="form-input" maxlength="60" value="${escapeHtml(classroom.nome)}" aria-label="Novo nome da turma">
    <button type="submit" class="icon-button" title="Salvar nome" aria-label="Salvar nome"><i data-lucide="check" class="w-4 h-4"></i></button>
    <button type="button" class="icon-button" data-rename-cancel title="Cancelar" aria-label="Cancelar"><i data-lucide="x" class="w-4 h-4"></i></button>`;
  card.classList.add("is-renaming");
  qs("[data-class-title]", card).after(form);
  drawIcons();

  const input = qs("input", form);
  input.focus();
  input.select();

  const cancel = () => {
    form.remove();
    card.classList.remove("is-renaming");
  };
  qs("[data-rename-cancel]", form).addEventListener("click", cancel);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    cancel();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (name === classroom.nome) return cancel();
    form.querySelectorAll("input, button").forEach((element) => { element.disabled = true; });
    try {
      const result = await apiRequest(`${classesUrl}/${classroom.id}`, { method: "PUT", body: { nome: name } });
      toast(result.message, "good", "pencil");
      await loadProfessorDashboard();
    } catch (error) {
      toast(error.message, "alert", "circle-alert");
      form.querySelectorAll("input, button").forEach((element) => { element.disabled = false; });
      input.focus();
    }
  });
}

function showClassStudents(classroom) {
  const filter = qs("#class-filter");
  filter.value = String(classroom.id);
  filterStudents();
  qs("#alunos").scrollIntoView({ behavior: "smooth" });
}

/* ------------------------------------------------------------ criar turma */
const newClassForm = qs("#new-class-form");
const newClassButton = qs("#new-class-button");
const newClassInput = qs("#new-class-name");
const newClassError = qs("#new-class-error");

function toggleNewClassForm(open) {
  newClassForm.classList.toggle("hidden", !open);
  newClassButton.setAttribute("aria-expanded", String(open));
  newClassError.textContent = "";
  if (open) {
    newClassInput.value = "";
    newClassInput.focus();
  }
}

newClassButton?.addEventListener("click", () => toggleNewClassForm(newClassForm.classList.contains("hidden")));
qs("#cancel-new-class")?.addEventListener("click", () => toggleNewClassForm(false));
newClassInput?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") toggleNewClassForm(false);
});

newClassForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = newClassInput.value.trim();
  if (name.length < 2) {
    newClassError.textContent = "Dê um nome com pelo menos 2 letras para a turma.";
    newClassInput.focus();
    return;
  }

  const button = qs("#create-class-button");
  button.disabled = true;
  newClassError.textContent = "";
  try {
    const result = await apiRequest(classesUrl, { method: "POST", body: { nome: name } });
    toggleNewClassForm(false);
    highlightClassId = result.turma.id;
    toast(result.message, "good", "school");
    await loadProfessorDashboard();
  } catch (error) {
    newClassError.textContent = error.message;
    newClassInput.focus();
  } finally {
    button.disabled = false;
  }
});

qs("#classes-list")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-class-create-first]")) {
    toggleNewClassForm(true);
    return;
  }
  const card = event.target.closest("[data-class-id]");
  const classroom = card && findClass(Number(card.dataset.classId));
  if (!classroom) return;

  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.matches("[data-class-copy]")) copyCode(classroom.codigo);
  else if (button.matches("[data-class-code]")) generateCode(classroom, button);
  else if (button.matches("[data-class-students]")) showClassStudents(classroom);
  else if (button.matches("[data-class-rename]")) startRename(card, classroom);
  else if (button.matches("[data-class-delete]")) deleteClass(classroom);
});

/* ---------------------------------------------------------------------- alunos */
function studentPreviewRow(student) {
  return `
    <div class="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3 min-w-0">
        <div class="student-avatar" aria-hidden="true">${escapeHtml(initials(student.nome))}</div>
        <div class="min-w-0">
          <p class="font-semibold text-slate-700 truncate">${escapeHtml(student.nome)}</p>
          <p class="text-[10px] text-slate-400 truncate">${escapeHtml(student.turma)}</p>
        </div>
      </div>
      <div class="text-right shrink-0">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClasses(student.status)}">${escapeHtml(student.status)}</span>
        <p class="text-[10px] text-slate-500 mt-1">${student.concluidas}/${student.total} etapas · ${student.percentual}%</p>
      </div>
    </div>`;
}

function studentManageRow(student) {
  const name = escapeHtml(student.nome);
  return `
    <div class="student-row" data-student-id="${student.id}">
      <div class="student-avatar" aria-hidden="true">${escapeHtml(initials(student.nome))}</div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-bold text-slate-700 truncate">${name}</p>
        <p class="text-[10.5px] text-slate-400 truncate">
          <span class="font-semibold ${student.turma_id ? "text-slate-500" : "text-amber-600"}">${escapeHtml(student.turma)}</span> · ${escapeHtml(student.email)}
        </p>
      </div>
      <div class="student-row-progress">
        <div class="flex items-center justify-end gap-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClasses(student.status)}">${escapeHtml(student.status)}</span>
          <span class="text-[10.5px] font-bold text-slate-600">${student.concluidas}/${student.total}</span>
        </div>
        <div class="student-row-bar"><div style="width:${student.percentual}%"></div></div>
      </div>
      <div class="student-row-actions">
        <button type="button" class="icon-button" data-student-open title="Ver e gerenciar" aria-label="Ver e gerenciar ${name}">
          <i data-lucide="sliders-horizontal" class="w-4 h-4"></i>
        </button>
        <button type="button" class="icon-button danger" data-student-remove title="Remover aluno" aria-label="Remover ${name}">
          <i data-lucide="user-x" class="w-4 h-4"></i>
        </button>
      </div>
    </div>`;
}

function renderStudents(data) {
  const recent = [...data.alunos].sort((a, b) => {
    if (a.atualizado_em && b.atualizado_em) return new Date(b.atualizado_em) - new Date(a.atualizado_em);
    if (a.atualizado_em || b.atualizado_em) return a.atualizado_em ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
  qs("#active-students-list").innerHTML = recent.length
    ? recent.slice(0, 3).map(studentPreviewRow).join("")
    : '<p class="text-xs text-slate-400 py-8 text-center">Nenhum aluno nas suas turmas ainda.</p>';

  const classFilter = qs("#class-filter");
  const selected = classFilter.value;
  const withoutClass = data.alunos.some((student) => !student.turma_id);
  classFilter.innerHTML = '<option value="">Todas as turmas</option>'
    + data.turmas.map((classroom) => `<option value="${classroom.id}">${escapeHtml(classroom.nome)} (${classroom.quantidade})</option>`).join("")
    + (withoutClass ? '<option value="sem-turma">Sem turma</option>' : "");
  if ([...classFilter.options].some((option) => option.value === selected)) classFilter.value = selected;
  filterStudents();
}

function renderActivities(students) {
  const activities = students
    .filter((student) => student.atualizado_em)
    .sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em));
  qs("#recent-activities-list").innerHTML = activities.length ? activities.map((student) => `
    <tr class="hover:bg-slate-50/50">
      <td class="p-3.5 font-sans font-semibold text-slate-700">${escapeHtml(student.nome)}</td>
      <td class="p-3.5 font-sans">${escapeHtml(student.turma)}</td>
      <td class="p-3.5 font-sans"><span class="px-2 py-1 rounded-md text-[10px] font-medium ${statusClasses(student.status)}">${escapeHtml(student.status)}</span></td>
      <td class="p-3.5">${student.concluidas}/${student.total}</td>
      <td class="p-3.5 font-sans text-slate-400">${formatDate(student.atualizado_em)}</td>
    </tr>
  `).join("") : '<tr><td colspan="5" class="p-8 text-center text-slate-400 font-sans">Nenhuma atividade concluída ainda.</td></tr>';
}

function renderSearchResults(students) {
  const results = qs("#student-search-results");
  const total = dashboardData ? dashboardData.alunos.length : 0;
  if (students.length) {
    results.innerHTML = students.map(studentManageRow).join("");
  } else {
    results.innerHTML = total
      ? '<p class="p-8 text-center text-xs text-slate-400">Nenhum aluno encontrado com esses filtros.</p>'
      : '<p class="p-8 text-center text-xs text-slate-400">Nenhum aluno nas suas turmas ainda. Gere o código de uma turma e passe para os alunos.</p>';
  }
  qs("#student-results-count").textContent = students.length === total
    ? plural(total, "aluno", "alunos")
    : `${students.length} de ${plural(total, "aluno", "alunos")}`;
  drawIcons();
}

function filterStudents() {
  if (!dashboardData) return;
  const query = qs("#student-search").value.trim().toLowerCase();
  const classroom = qs("#class-filter").value;
  const status = qs("#status-filter").value;
  const filtered = dashboardData.alunos.filter((student) => {
    const matchesText = !query || student.nome.toLowerCase().includes(query) || student.email.toLowerCase().includes(query);
    const matchesClass = !classroom
      || (classroom === "sem-turma" ? !student.turma_id : String(student.turma_id) === classroom);
    return matchesText && matchesClass && (!status || student.status === status);
  });
  renderSearchResults(filtered);
}

qs("#student-search-button")?.addEventListener("click", filterStudents);
qs("#student-search")?.addEventListener("input", filterStudents);
qs("#class-filter")?.addEventListener("change", filterStudents);
qs("#status-filter")?.addEventListener("change", filterStudents);
document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => qs(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth" }));
});

/* ------------------------------------------------- modal: gerenciar o aluno */
const studentModal = qs("#student-modal");
let modalStudent = null;
let focusBeforeModal = null;

function setModalBusy(busy) {
  studentModal.querySelectorAll("#student-move-button, #student-unlink-button, #student-delete-button, #student-modal-class")
    .forEach((element) => { element.disabled = busy || (element.id === "student-move-button" && !dashboardData.turmas.length); });
}

function openStudentModal(studentId, focusRemoval = false) {
  const student = dashboardData?.alunos.find((item) => item.id === studentId);
  if (!student) return;
  modalStudent = student;
  focusBeforeModal = document.activeElement;

  qs("#student-modal-avatar").textContent = initials(student.nome);
  qs("#student-modal-name").textContent = student.nome;
  qs("#student-modal-email").textContent = student.email;
  const status = qs("#student-modal-status");
  status.textContent = student.status;
  status.className = `px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusClasses(student.status)}`;
  qs("#student-modal-bar").style.width = `${student.percentual}%`;
  qs("#student-modal-progress-text").textContent =
    `${student.concluidas} de ${student.total} ${student.total === 1 ? "etapa concluída" : "etapas concluídas"} · ${student.percentual}%`;
  qs("#student-modal-next").textContent = student.proxima;
  qs("#student-modal-updated").textContent = student.atualizado_em ? formatDate(student.atualizado_em) : "Nenhuma etapa concluída";

  const select = qs("#student-modal-class");
  select.innerHTML = (student.turma_id ? "" : '<option value="" disabled>Sem turma</option>')
    + dashboardData.turmas.map((classroom) => `<option value="${classroom.id}">${escapeHtml(classroom.nome)}</option>`).join("");
  select.value = student.turma_id ? String(student.turma_id) : "";
  qs("#student-modal-error").textContent = "";
  setModalBusy(false);

  studentModal.classList.remove("hidden");
  studentModal.classList.add("aberto");
  if (focusRemoval) {
    qs("#student-danger").scrollIntoView({ block: "nearest" });
    qs("#student-unlink-button").focus();
  } else {
    qs("[data-student-close]", studentModal).focus();
  }
}

function closeStudentModal() {
  if (studentModal.classList.contains("hidden")) return;
  studentModal.classList.add("hidden");
  studentModal.classList.remove("aberto");
  modalStudent = null;
  focusBeforeModal?.focus?.({ preventScroll: true });
}

async function runStudentAction(request, iconName) {
  const errorBox = qs("#student-modal-error");
  errorBox.textContent = "";
  setModalBusy(true);
  try {
    const result = await request();
    closeStudentModal();
    toast(result.message, "good", iconName);
    await loadProfessorDashboard();
  } catch (error) {
    errorBox.textContent = error.message;
    setModalBusy(false);
  }
}

qs("#student-move-button")?.addEventListener("click", () => {
  if (!modalStudent) return;
  const classId = Number(qs("#student-modal-class").value);
  if (!classId || classId === modalStudent.turma_id) {
    qs("#student-modal-error").textContent = "Escolha outra turma para mover o aluno.";
    return;
  }
  const { id } = modalStudent;
  runStudentAction(() => apiRequest(`${studentsUrl}/${id}/turma`, { method: "PUT", body: { turma_id: classId } }), "arrow-right-left");
});

qs("#student-unlink-button")?.addEventListener("click", () => {
  if (!modalStudent) return;
  const { id, nome, turma } = modalStudent;
  if (!window.confirm(`Tirar ${nome} da turma "${turma}"?\n\nA conta e o progresso continuam. Para voltar, é só usar um novo código de turma.`)) return;
  runStudentAction(() => apiRequest(`${studentsUrl}/${id}/turma`, { method: "DELETE" }), "log-out");
});

qs("#student-delete-button")?.addEventListener("click", () => {
  if (!modalStudent) return;
  const { id, nome } = modalStudent;
  if (!window.confirm(`Excluir a conta de ${nome}?\n\nIsso apaga o cadastro e todo o progresso na trilha, no jogo de blocos e na Arena. Não dá para desfazer.`)) return;
  runStudentAction(() => apiRequest(`${studentsUrl}/${id}`, { method: "DELETE" }), "trash-2");
});

studentModal?.querySelectorAll("[data-student-close]").forEach((button) => button.addEventListener("click", closeStudentModal));
studentModal?.addEventListener("click", (event) => {
  if (event.target === studentModal) closeStudentModal();
});

qs("#student-search-results")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-student-open], [data-student-remove]");
  if (!button) return;
  const row = button.closest("[data-student-id]");
  openStudentModal(Number(row.dataset.studentId), button.matches("[data-student-remove]"));
});

/* ---------------------------------------------------------------- carregar */
async function loadProfessorDashboard() {
  try {
    const response = await fetch(professorPage.dataset.dashboardUrl, { headers: authHeaders() });
    if (response.status === 401 || response.status === 403) {
      window.location.href = professorPage.dataset.loginUrl;
      return;
    }
    if (!response.ok) throw new Error("Falha ao carregar o painel");
    dashboardData = await response.json();
    renderAccount(dashboardData);
    renderMetrics(dashboardData);
    renderChart(dashboardData.alunos);
    renderClasses(dashboardData.turmas);
    renderStudents(dashboardData);
    renderActivities(dashboardData.alunos);
    drawIcons();
  } catch {
    qs("#performance-chart").innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <img class="dashboard-state-robot" src="${professorPage.dataset.errorRobotUrl}" alt="Mascote RobooTeam indicando um erro">
        <p class="mt-2 text-sm font-semibold text-red-600">Não foi possível carregar os dados.</p>
        <span class="mt-1 text-xs text-slate-400">Atualize a página para tentar novamente.</span>
      </div>`;
    const classes = qs("#classes-list");
    if (!dashboardData) classes.innerHTML = '<p class="text-xs text-red-600 py-8 text-center lg:col-span-2">Não foi possível carregar as turmas. Atualize a página.</p>';
  }
}

qs("#professor-logout")?.addEventListener("click", async () => {
  try {
    await fetch(professorPage.dataset.logoutUrl, { method: "POST", headers: authHeaders() });
  } finally {
    localStorage.removeItem("robooteam-active-user");
    localStorage.removeItem("robooteam-token");
    sessionStorage.removeItem("robooteam-active-user");
    sessionStorage.removeItem("robooteam-token");
    window.location.href = professorPage.dataset.loginUrl;
  }
});

/* ---- SIDEBAR: gaveta no celular + item ativo conforme a rolagem ---- */
const sidebarToggle = qs("#sidebar-toggle");

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  sidebarToggle?.setAttribute("aria-expanded", String(open));
}

sidebarToggle?.addEventListener("click", () => setSidebarOpen(true));
qs("#sidebar-close")?.addEventListener("click", () => setSidebarOpen(false));
qs("#sidebar-overlay")?.addEventListener("click", () => setSidebarOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (studentModal && !studentModal.classList.contains("hidden")) closeStudentModal();
  else setSidebarOpen(false);
});

const professorMain = qs("#professor-main");
const spyLinks = [...document.querySelectorAll(".prof-nav-link[data-spy]")];
const spySections = spyLinks
  .map((link) => document.getElementById(link.dataset.spy))
  .filter((section) => section && section.id !== "dashboard");

function setActiveNav(sectionId) {
  spyLinks.forEach((link) => link.classList.toggle("is-active", link.dataset.spy === sectionId));
}

function updateActiveNav() {
  if (!professorMain) return;
  const { scrollTop, clientHeight, scrollHeight } = professorMain;
  if (scrollTop < 60) return setActiveNav("dashboard");

  const ordered = [...spySections].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  if (scrollTop + clientHeight >= scrollHeight - 4) return setActiveNav(ordered[ordered.length - 1].id);

  const limit = professorMain.getBoundingClientRect().top + 140;
  const current = ordered.filter((section) => section.getBoundingClientRect().top <= limit).pop();
  setActiveNav(current ? current.id : "dashboard");
}

let navFrame = null;
professorMain?.addEventListener("scroll", () => {
  if (navFrame) return;
  navFrame = requestAnimationFrame(() => {
    navFrame = null;
    updateActiveNav();
  });
});

document.querySelectorAll(".prof-nav-link").forEach((link) => {
  link.addEventListener("click", () => setSidebarOpen(false));
});

loadProfessorDashboard();

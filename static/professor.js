const professorPage = document.body;
let dashboardData = null;

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

function formatDate(value) {
  if (!value) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusClasses(status) {
  if (status === "Concluído") return "bg-emerald-100 text-emerald-800";
  if (status === "Em andamento") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

function studentRow(student, includeAction = false) {
  return `
    <div class="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center text-brand-cyan shrink-0">
          <i data-lucide="user" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-slate-700 truncate">${escapeHtml(student.nome)}</p>
          <p class="text-[10px] text-slate-400 truncate">${escapeHtml(student.turma)} · ${escapeHtml(student.email)}</p>
        </div>
      </div>
      <div class="text-right shrink-0">
        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusClasses(student.status)}">${escapeHtml(student.status)}</span>
        <p class="text-[10px] text-slate-500 mt-1">${student.concluidas}/${student.total} etapas · ${student.percentual}%</p>
        ${includeAction ? `<button type="button" class="view-student mt-1 text-brand-cyan font-semibold hover:underline" data-student-id="${student.id}">Ver detalhes</button>` : ""}
      </div>
    </div>
  `;
}

function renderMetrics(data) {
  document.querySelector("#professor-sidebar-name").textContent = data.professor.nome;
  document.querySelector("#professor-greeting-name").textContent = data.professor.nome.split(" ")[0];
  document.querySelector("#professor-discipline").textContent = data.professor.disciplina;
  document.querySelector("#metric-total-students").textContent = data.metrics.total_alunos;
  document.querySelector("#metric-active-classes").textContent = data.metrics.turmas_ativas;
  document.querySelector("#metric-active-students").textContent = data.metrics.alunos_iniciaram;
  document.querySelector("#metric-activities").textContent = data.metrics.total_atividades;
  document.querySelector("#metric-average").textContent = `${data.metrics.media_geral}%`;
}

function renderChart(students) {
  const chart = document.querySelector("#performance-chart");
  if (!students.length) {
    chart.innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <img class="dashboard-state-robot" src="${professorPage.dataset.emptyRobotUrl}" alt="Mascote RobooTeam preocupado">
        <p class="mt-2 text-sm font-semibold text-slate-600">Nenhum aluno cadastrado.</p>
        <span class="mt-1 text-xs text-slate-400">Compartilhe o código da sala para começar.</span>
      </div>`;
    return;
  }

  chart.innerHTML = `<div class="space-y-6">${students.map((student) => `
    <div>
      <div class="flex justify-between gap-4 text-xs mb-2">
        <span class="font-semibold text-slate-700">${escapeHtml(student.nome)}</span>
        <span class="font-mono font-bold text-brand-cyan">${student.percentual}%</span>
      </div>
      <div class="h-3 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-label="Progresso de ${escapeHtml(student.nome)}" aria-valuenow="${student.percentual}" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full bg-gradient-to-r from-brand-accent to-brand-cyan rounded-full transition-all" style="width:${student.percentual}%"></div>
      </div>
      <p class="text-[10px] text-slate-400 mt-1">Próxima: ${escapeHtml(student.proxima)}</p>
    </div>
  `).join("")}</div>`;
}

function renderStudents(data) {
  document.querySelector("#active-students-list").innerHTML = data.alunos.length
    ? data.alunos.slice(0, 3).map((student) => studentRow(student)).join("")
    : '<p class="text-xs text-slate-400 py-8 text-center">Nenhum aluno cadastrado.</p>';

  const classFilter = document.querySelector("#class-filter");
  classFilter.innerHTML = '<option value="">Todas as turmas</option>' + data.turmas
    .map((classroom) => `<option value="${escapeHtml(classroom.nome)}">${escapeHtml(classroom.nome)}</option>`)
    .join("");
  renderSearchResults(data.alunos);
}

function renderClasses(classes) {
  document.querySelector("#classes-list").innerHTML = classes.map((classroom) => `
    <div class="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-3 bg-white rounded-lg border border-slate-200 text-brand-blue"><i data-lucide="folder-git-2" class="w-5 h-5"></i></div>
        <div><h4 class="text-sm font-bold text-slate-700">${escapeHtml(classroom.nome)}</h4><p class="text-xs text-slate-500">${classroom.quantidade} alunos</p></div>
      </div>
      <span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">${escapeHtml(classroom.status)}</span>
    </div>
  `).join("");
}

function renderActivities(students) {
  const activities = students
    .filter((student) => student.atualizado_em)
    .sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em));
  const list = document.querySelector("#recent-activities-list");
  list.innerHTML = activities.length ? activities.map((student) => `
    <tr class="hover:bg-slate-50/50">
      <td class="p-3.5 font-sans font-semibold text-slate-700">${escapeHtml(student.nome)}</td>
      <td class="p-3.5 font-sans">${escapeHtml(student.turma)}</td>
      <td class="p-3.5 font-sans"><span class="px-2 py-1 rounded-md text-[10px] font-medium ${statusClasses(student.status)}">${escapeHtml(student.status)}</span></td>
      <td class="p-3.5">${student.concluidas}/${student.total}</td>
      <td class="p-3.5 font-sans text-slate-400">${formatDate(student.atualizado_em)}</td>
    </tr>
  `).join("") : '<tr><td colspan="5" class="p-8 text-center text-slate-400 font-sans">Nenhuma atividade concluída ainda.</td></tr>';
}

function renderRoomCode(code, expiration) {
  document.querySelector("#room-code").textContent = code || "Nenhum";
  document.querySelector("#room-code-expiration").textContent = expiration ? formatDate(expiration) : "gere um código";
}

function renderSearchResults(students) {
  const results = document.querySelector("#student-search-results");
  results.innerHTML = students.length
    ? students.map((student) => studentRow(student, true)).join("")
    : '<p class="p-8 text-center text-xs text-slate-400">Nenhum aluno encontrado.</p>';
  if (window.lucide) lucide.createIcons();
}

function filterStudents() {
  if (!dashboardData) return;
  const query = document.querySelector("#student-search").value.trim().toLowerCase();
  const classroom = document.querySelector("#class-filter").value;
  const status = document.querySelector("#status-filter").value;
  const filtered = dashboardData.alunos.filter((student) => {
    const matchesText = !query || student.nome.toLowerCase().includes(query) || student.email.toLowerCase().includes(query);
    return matchesText && (!classroom || student.turma === classroom) && (!status || student.status === status);
  });
  renderSearchResults(filtered);
}

async function loadProfessorDashboard() {
  try {
    const response = await fetch(professorPage.dataset.dashboardUrl, { headers: authHeaders() });
    if (response.status === 401 || response.status === 403) {
      window.location.href = professorPage.dataset.loginUrl;
      return;
    }
    if (!response.ok) throw new Error("Falha ao carregar o painel");
    dashboardData = await response.json();
    renderMetrics(dashboardData);
    renderChart(dashboardData.alunos);
    renderStudents(dashboardData);
    renderClasses(dashboardData.turmas);
    renderActivities(dashboardData.alunos);
    renderRoomCode(dashboardData.codigo_sala, dashboardData.codigo_validade);
    if (window.lucide) lucide.createIcons();
  } catch {
    document.querySelector("#performance-chart").innerHTML = `
      <div class="flex flex-col items-center justify-center py-10 text-center">
        <img class="dashboard-state-robot" src="${professorPage.dataset.errorRobotUrl}" alt="Mascote RobooTeam indicando um erro">
        <p class="mt-2 text-sm font-semibold text-red-600">Não foi possível carregar os dados.</p>
        <span class="mt-1 text-xs text-slate-400">Atualize a página para tentar novamente.</span>
      </div>`;
  }
}

document.querySelector("#student-search-button")?.addEventListener("click", filterStudents);
document.querySelector("#student-search")?.addEventListener("input", filterStudents);
document.querySelector("#class-filter")?.addEventListener("change", filterStudents);
document.querySelector("#status-filter")?.addEventListener("change", filterStudents);
document.querySelectorAll("[data-scroll-target]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(button.dataset.scrollTarget)?.scrollIntoView({ behavior: "smooth" }));
});

document.querySelector("#student-search-results")?.addEventListener("click", (event) => {
  const button = event.target.closest(".view-student");
  if (!button || !dashboardData) return;
  const student = dashboardData.alunos.find((item) => item.id === Number(button.dataset.studentId));
  if (student) window.alert(`${student.nome}\n${student.status}\n${student.concluidas} de ${student.total} etapas concluídas\nPróxima: ${student.proxima}`);
});

document.querySelector("#generate-room-code")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch(professorPage.dataset.codeUrl, { method: "POST", headers: authHeaders(true), body: "{}" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    renderRoomCode(result.codigo, result.validade);
  } catch {
    window.alert("Não foi possível gerar o código da sala.");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#copy-room-code")?.addEventListener("click", async () => {
  const code = document.querySelector("#room-code").textContent;
  if (!code || code === "Nenhum") return;
  try {
    await navigator.clipboard.writeText(code);
    window.alert("Código copiado!");
  } catch {
    window.prompt("Copie o código da sala:", code);
  }
});

document.querySelector("#professor-logout")?.addEventListener("click", async () => {
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

loadProfessorDashboard();

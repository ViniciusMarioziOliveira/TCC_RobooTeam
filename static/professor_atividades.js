/* =========================================================================
   PAINEL DO PROFESSOR - GERENCIADOR DAS ATIVIDADES DA TRILHA
   Criar, editar, reordenar e remover as etapas que o aluno percorre.
   Reaproveita escapeHtml() e authHeaders() de professor.js (carregado antes).
   ========================================================================= */

(() => {
  const pagina = document.body;
  const listaEl = document.querySelector("#activities-list");
  if (!listaEl) return;

  const feedbackEl = document.querySelector("#trail-feedback");
  const origemBadge = document.querySelector("#trail-origin-badge");
  const modal = document.querySelector("#activity-modal");
  const form = document.querySelector("#activity-form");
  const modalTitulo = document.querySelector("#activity-modal-title");
  const erroForm = document.querySelector("#activity-form-error");
  const botaoSalvar = document.querySelector("#save-activity-button");

  const seletorCor = document.querySelector("#activity-color");
  const seletorMinijogo = document.querySelector("#minigame-type");
  const containerSecoes = document.querySelector("#sections-container");
  const containerPerguntas = document.querySelector("#questions-container");
  const containerParesMemory = document.querySelector("#memory-pairs-container");
  const containerParesDragDrop = document.querySelector("#dragdrop-pairs-container");
  const containerCacaPalavras = document.querySelector("#wordsearch-container");

  const NOMES_CORES = {
    mint: "Verde menta",
    blue: "Azul",
    coral: "Coral",
    yellow: "Amarelo",
    purple: "Roxo",
  };

  const LIMITES = { secoes: 8, perguntas: 10, opcoes: 5, pares: 8, palavras: 8, variacoes: 5 };

  let estado = { atividades: [], opcoes: { cores: [], minijogos: [] }, personalizada: false };
  let editandoId = null;
  let contadorRadio = 0;
  let ocupado = false;

  // ---------------------------------------------------------------- helpers
  function criarElemento(html) {
    const molde = document.createElement("template");
    molde.innerHTML = html.trim();
    return molde.content.firstElementChild;
  }

  function renderizarIcones() {
    if (window.lucide) window.lucide.createIcons();
  }

  function mostrarFeedback(mensagem, tipo = "sucesso") {
    if (!feedbackEl) return;
    const estilos = {
      sucesso: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      erro: "bg-red-50 text-red-700 border border-red-200",
    };
    feedbackEl.textContent = mensagem;
    feedbackEl.className = `text-xs font-semibold rounded-xl px-4 py-3 ${estilos[tipo]}`;
    window.clearTimeout(mostrarFeedback.timer);
    mostrarFeedback.timer = window.setTimeout(() => feedbackEl.classList.add("hidden"), 6000);
  }

  function numerarCards(container, atributo, rotulo) {
    [...container.querySelectorAll(`[${atributo}]`)].forEach((card, idx) => {
      const titulo = card.querySelector(".repeater-card-title");
      if (titulo) titulo.textContent = `${rotulo} ${idx + 1}`;
    });
  }

  // ------------------------------------------------------ lista de atividades
  function cardDaAtividade(atividade, indice, total) {
    return `
      <article class="activity-card" data-activity-id="${atividade.id}">
        <div class="activity-order">${atividade.posicao}</div>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="text-sm font-bold text-slate-800 truncate">${escapeHtml(atividade.title)}</h4>
            <span class="activity-chip">${escapeHtml(atividade.period)}</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1 line-clamp-2">${escapeHtml(atividade.description)}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-2">
            <span class="activity-chip">${atividade.total_secoes} blocos de leitura</span>
            <span class="activity-chip">${atividade.total_perguntas} perguntas</span>
            <span class="activity-chip">🎮 ${escapeHtml(atividade.minijogo_label)}</span>
            <span class="activity-chip">${atividade.conclusoes} aluno(s) concluíram</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" class="icon-button" data-move="-1" ${indice === 0 ? "disabled" : ""} title="Subir" aria-label="Mover para cima">
            <i data-lucide="chevron-up" class="w-4 h-4"></i>
          </button>
          <button type="button" class="icon-button" data-move="1" ${indice === total - 1 ? "disabled" : ""} title="Descer" aria-label="Mover para baixo">
            <i data-lucide="chevron-down" class="w-4 h-4"></i>
          </button>
          <button type="button" class="icon-button" data-edit title="Editar" aria-label="Editar atividade">
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
          <button type="button" class="icon-button danger" data-delete ${total <= 1 ? "disabled" : ""} title="Excluir" aria-label="Excluir atividade">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </article>`;
  }

  function renderizarLista() {
    const { atividades } = estado;

    listaEl.innerHTML = atividades.length
      ? atividades.map((a, i) => cardDaAtividade(a, i, atividades.length)).join("")
      : '<p class="text-xs text-slate-400 py-8 text-center">Nenhuma atividade na trilha.</p>';

    if (origemBadge) {
      origemBadge.textContent = estado.personalizada ? "Trilha personalizada" : "Trilha padrão";
      origemBadge.className = estado.personalizada
        ? "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800"
        : "px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600";
    }

    renderizarIcones();
  }

  function preencherSelects() {
    if (seletorCor) {
      seletorCor.innerHTML = estado.opcoes.cores
        .map((cor) => `<option value="${cor}">${NOMES_CORES[cor] || cor}</option>`)
        .join("");
    }
    if (seletorMinijogo) {
      seletorMinijogo.innerHTML = estado.opcoes.minijogos
        .map((item) => `<option value="${item.valor}">${escapeHtml(item.rotulo)}</option>`)
        .join("");
    }
  }

  // --------------------------------------------------------------- repeaters
  function adicionarSecao(dados = {}) {
    if (containerSecoes.children.length >= LIMITES.secoes) return;

    const card = criarElemento(`
      <div class="repeater-card" data-section>
        <div class="repeater-card-head">
          <span class="repeater-card-title">Bloco</span>
          <button type="button" class="repeater-remove" data-remove>
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Remover
          </button>
        </div>
        <input class="form-input mb-2" data-field="title" maxlength="120" placeholder="Título do bloco de leitura">
        <textarea class="form-input" rows="3" data-field="text" maxlength="1200" placeholder="Explique o assunto com palavras simples para as crianças."></textarea>
      </div>`);

    card.querySelector('[data-field="title"]').value = dados.title || "";
    card.querySelector('[data-field="text"]').value = dados.text || "";
    card.querySelector("[data-remove]").addEventListener("click", () => {
      card.remove();
      numerarCards(containerSecoes, "data-section", "Bloco");
    });

    containerSecoes.appendChild(card);
    numerarCards(containerSecoes, "data-section", "Bloco");
    renderizarIcones();
  }

  function linhaDeOpcao(grupo, texto = "", correta = false) {
    const linha = criarElemento(`
      <div class="option-row" data-option>
        <input type="radio" name="${grupo}" title="Marcar como resposta correta">
        <input class="form-input" data-field="option" maxlength="220" placeholder="Texto da alternativa">
        <button type="button" class="repeater-remove" data-remove-option aria-label="Remover alternativa">
          <i data-lucide="x" class="w-3.5 h-3.5"></i>
        </button>
      </div>`);

    linha.querySelector('input[type="radio"]').checked = correta;
    linha.querySelector('[data-field="option"]').value = texto;
    linha.querySelector("[data-remove-option]").addEventListener("click", () => {
      const lista = linha.parentElement;
      if (lista.children.length <= 2) return;
      const eraCorreta = linha.querySelector('input[type="radio"]').checked;
      linha.remove();
      if (eraCorreta) lista.querySelector('input[type="radio"]').checked = true;
    });

    return linha;
  }

  function adicionarPergunta(dados = {}) {
    if (containerPerguntas.children.length >= LIMITES.perguntas) return;

    contadorRadio += 1;
    const grupo = `correct-${contadorRadio}`;

    const card = criarElemento(`
      <div class="repeater-card" data-question>
        <div class="repeater-card-head">
          <span class="repeater-card-title">Pergunta</span>
          <button type="button" class="repeater-remove" data-remove>
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Remover
          </button>
        </div>
        <input class="form-input mb-2" data-field="question" maxlength="320" placeholder="Enunciado da pergunta">
        <p class="form-label">Alternativas <span class="font-normal text-slate-400">(marque a bolinha da resposta certa)</span></p>
        <div class="space-y-2" data-options></div>
        <button type="button" class="repeater-add mt-2" data-add-option>
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Alternativa
        </button>
        <input class="form-input mt-3" data-field="justification" maxlength="400" placeholder="Explicação mostrada ao aluno (opcional)">
      </div>`);

    const listaOpcoes = card.querySelector("[data-options]");
    const opcoes = dados.options?.length ? dados.options : ["", ""];
    opcoes.forEach((texto, idx) => listaOpcoes.appendChild(linhaDeOpcao(grupo, texto, idx === (dados.answer ?? 0))));

    card.querySelector('[data-field="question"]').value = dados.question || "";
    card.querySelector('[data-field="justification"]').value = dados.justification || "";

    card.querySelector("[data-add-option]").addEventListener("click", () => {
      if (listaOpcoes.children.length >= LIMITES.opcoes) return;
      listaOpcoes.appendChild(linhaDeOpcao(grupo));
      renderizarIcones();
    });

    card.querySelector("[data-remove]").addEventListener("click", () => {
      card.remove();
      numerarCards(containerPerguntas, "data-question", "Pergunta");
    });

    containerPerguntas.appendChild(card);
    numerarCards(containerPerguntas, "data-question", "Pergunta");
    renderizarIcones();
  }

  function adicionarPar(container, rotulos, dados = {}) {
    if (container.children.length >= LIMITES.pares) return;

    const card = criarElemento(`
      <div class="repeater-card" data-pair>
        <div class="repeater-card-head">
          <span class="repeater-card-title">Par</span>
          <button type="button" class="repeater-remove" data-remove>
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Remover
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input class="form-input" data-field="a" maxlength="220" placeholder="${rotulos[0]}">
          <input class="form-input" data-field="b" maxlength="220" placeholder="${rotulos[1]}">
        </div>
      </div>`);

    card.querySelector('[data-field="a"]').value = dados.a || "";
    card.querySelector('[data-field="b"]').value = dados.b || "";
    card.querySelector("[data-remove]").addEventListener("click", () => {
      card.remove();
      numerarCards(container, "data-pair", "Par");
    });

    container.appendChild(card);
    numerarCards(container, "data-pair", "Par");
    renderizarIcones();
  }

  function adicionarVariacao(dados = {}) {
    if (containerCacaPalavras.children.length >= LIMITES.variacoes) return;

    const card = criarElemento(`
      <div class="repeater-card" data-variation>
        <div class="repeater-card-head">
          <span class="repeater-card-title">Grupo</span>
          <button type="button" class="repeater-remove" data-remove>
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Remover
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input class="form-input" data-field="theme" maxlength="80" placeholder="Tema do grupo (ex.: Aprendizado dos robôs)">
          <input class="form-input" data-field="words" placeholder="Palavras separadas por vírgula: DADOS, REDE, GPU">
        </div>
      </div>`);

    card.querySelector('[data-field="theme"]').value = dados.theme || "";
    card.querySelector('[data-field="words"]').value = (dados.words || []).join(", ");
    card.querySelector("[data-remove]").addEventListener("click", () => {
      card.remove();
      numerarCards(containerCacaPalavras, "data-variation", "Grupo");
    });

    containerCacaPalavras.appendChild(card);
    numerarCards(containerCacaPalavras, "data-variation", "Grupo");
    renderizarIcones();
  }

  // ------------------------------------------------------------------ modal
  function atualizarCamposDoMinijogo() {
    const tipo = seletorMinijogo.value;
    document.querySelectorAll("[data-minigame-config]").forEach((bloco) => {
      bloco.classList.toggle("hidden", bloco.dataset.minigameConfig !== tipo);
    });
    document.querySelectorAll("[data-minigame-field]").forEach((campo) => {
      campo.classList.toggle("hidden", tipo === "nenhum");
    });
  }

  function limparFormulario() {
    form.reset();
    erroForm.textContent = "";
    containerSecoes.innerHTML = "";
    containerPerguntas.innerHTML = "";
    containerParesMemory.innerHTML = "";
    containerParesDragDrop.innerHTML = "";
    containerCacaPalavras.innerHTML = "";
  }

  function preencherFormulario(atividade) {
    const minijogo = atividade.minigame || { type: "nenhum" };

    form.elements.title.value = atividade.title || "";
    form.elements.period.value = atividade.period || "";
    form.elements.description.value = atividade.description || "";
    form.elements.color.value = atividade.color || "blue";
    form.elements.eyebrow.value = atividade.eyebrow || "";
    form.elements.lesson_title.value = atividade.lesson_title || "";
    form.elements.intro.value = atividade.intro || "";

    (atividade.sections || []).forEach(adicionarSecao);
    (atividade.quiz || []).forEach(adicionarPergunta);

    seletorMinijogo.value = minijogo.type || "nenhum";
    form.elements.minigame_title.value = minijogo.title || "";
    form.elements.minigame_instruction.value = minijogo.instruction || "";
    form.elements.target_score.value = minijogo.target_score ?? 20;
    form.elements.total_levels.value = minijogo.total_levels ?? 3;

    if (minijogo.type === "memory") {
      (minijogo.pairs || []).forEach((p) =>
        adicionarPar(containerParesMemory, ["Termo", "Significado"], { a: p.term, b: p.match }),
      );
    } else if (minijogo.type === "drag_drop") {
      (minijogo.pairs || []).forEach((p) =>
        adicionarPar(containerParesDragDrop, ["Bloco", "Explicação"], { a: p.left, b: p.right }),
      );
    } else if (minijogo.type === "word_search") {
      (minijogo.variations || []).forEach(adicionarVariacao);
    }

    atualizarCamposDoMinijogo();
  }

  function abrirModal(atividade = null) {
    editandoId = atividade ? atividade.id : null;
    limparFormulario();
    modalTitulo.textContent = atividade ? `Editar: ${atividade.title}` : "Nova atividade";

    if (atividade) {
      preencherFormulario(atividade);
    } else {
      form.elements.color.value = "blue";
      seletorMinijogo.value = "memory";
      form.elements.target_score.value = 20;
      form.elements.total_levels.value = 3;
      adicionarSecao();
      adicionarPergunta();
      for (let i = 0; i < 3; i += 1) {
        adicionarPar(containerParesMemory, ["Termo", "Significado"]);
        adicionarPar(containerParesDragDrop, ["Bloco", "Explicação"]);
      }
      adicionarVariacao();
      atualizarCamposDoMinijogo();
    }

    modal.classList.add("aberto");
    document.body.style.overflow = "hidden";
    renderizarIcones();
    form.elements.title.focus();
  }

  function fecharModal() {
    modal.classList.remove("aberto");
    document.body.style.overflow = "";
    editandoId = null;
  }

  // ------------------------------------------------------- coleta do formulário
  function coletarMinijogo() {
    const tipo = seletorMinijogo.value;
    if (tipo === "nenhum") return { type: "nenhum" };

    const minijogo = {
      type: tipo,
      title: form.elements.minigame_title.value,
      instruction: form.elements.minigame_instruction.value,
    };

    if (tipo === "snake") {
      minijogo.target_score = Number(form.elements.target_score.value) || 20;
    } else if (tipo === "maze") {
      minijogo.total_levels = Number(form.elements.total_levels.value) || 3;
    } else if (tipo === "memory" || tipo === "drag_drop") {
      const container = tipo === "memory" ? containerParesMemory : containerParesDragDrop;
      const chaves = tipo === "memory" ? ["term", "match"] : ["left", "right"];
      minijogo.pairs = [...container.querySelectorAll("[data-pair]")].map((card, idx) => ({
        id: `p${idx + 1}`,
        [chaves[0]]: card.querySelector('[data-field="a"]').value,
        [chaves[1]]: card.querySelector('[data-field="b"]').value,
      }));
    } else if (tipo === "word_search") {
      minijogo.variations = [...containerCacaPalavras.querySelectorAll("[data-variation]")].map((card) => ({
        theme: card.querySelector('[data-field="theme"]').value,
        words: card
          .querySelector('[data-field="words"]')
          .value.split(/[,;\n]+/)
          .map((palavra) => palavra.trim())
          .filter(Boolean),
      }));
    }

    return minijogo;
  }

  function coletarFormulario() {
    return {
      title: form.elements.title.value,
      period: form.elements.period.value,
      description: form.elements.description.value,
      color: form.elements.color.value,
      eyebrow: form.elements.eyebrow.value,
      lesson_title: form.elements.lesson_title.value,
      intro: form.elements.intro.value,
      sections: [...containerSecoes.querySelectorAll("[data-section]")].map((card) => ({
        title: card.querySelector('[data-field="title"]').value,
        text: card.querySelector('[data-field="text"]').value,
      })),
      quiz: [...containerPerguntas.querySelectorAll("[data-question]")].map((card) => {
        const linhas = [...card.querySelectorAll("[data-option]")];
        return {
          question: card.querySelector('[data-field="question"]').value,
          options: linhas.map((linha) => linha.querySelector('[data-field="option"]').value),
          answer: Math.max(0, linhas.findIndex((linha) => linha.querySelector('input[type="radio"]').checked)),
          justification: card.querySelector('[data-field="justification"]').value,
        };
      }),
      minigame: coletarMinijogo(),
    };
  }

  // --------------------------------------------------------------- requisições
  async function requisitar(url, opcoes = {}) {
    const resposta = await fetch(url, {
      ...opcoes,
      headers: authHeaders(Boolean(opcoes.body)),
    });

    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = pagina.dataset.loginUrl;
      throw new Error("Sessão expirada");
    }

    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error || "Não foi possível concluir a operação.");
    return dados;
  }

  function aplicarResposta(dados) {
    estado = {
      atividades: dados.atividades || [],
      opcoes: dados.opcoes || estado.opcoes,
      personalizada: Boolean(dados.personalizada),
    };
    preencherSelects();
    renderizarLista();
    if (dados.message) mostrarFeedback(dados.message);
  }

  async function carregarAtividades() {
    try {
      aplicarResposta(await requisitar(pagina.dataset.activitiesUrl));
    } catch (erro) {
      listaEl.innerHTML = `<p class="text-xs text-red-600 py-8 text-center">${escapeHtml(erro.message)}</p>`;
    }
  }

  async function salvarAtividade(evento) {
    evento.preventDefault();
    if (ocupado) return;

    ocupado = true;
    erroForm.textContent = "";
    botaoSalvar.disabled = true;

    const url = editandoId
      ? `${pagina.dataset.activitiesUrl}/${editandoId}`
      : pagina.dataset.activitiesUrl;

    try {
      aplicarResposta(await requisitar(url, {
        method: editandoId ? "PUT" : "POST",
        body: JSON.stringify(coletarFormulario()),
      }));
      fecharModal();
    } catch (erro) {
      erroForm.textContent = erro.message;
    } finally {
      ocupado = false;
      botaoSalvar.disabled = false;
    }
  }

  async function removerAtividade(id) {
    const atividade = estado.atividades.find((item) => item.id === id);
    const aviso = atividade?.conclusoes
      ? `\n\nAtenção: ${atividade.conclusoes} aluno(s) já concluíram esta etapa e perderão esse registro.`
      : "";

    if (!window.confirm(`Remover "${atividade?.title}" da trilha?${aviso}`)) return;

    try {
      aplicarResposta(await requisitar(`${pagina.dataset.activitiesUrl}/${id}`, { method: "DELETE" }));
    } catch (erro) {
      mostrarFeedback(erro.message, "erro");
    }
  }

  async function moverAtividade(id, direcao) {
    const ids = estado.atividades.map((item) => item.id);
    const posicao = ids.indexOf(id);
    const destino = posicao + direcao;
    if (posicao < 0 || destino < 0 || destino >= ids.length) return;

    [ids[posicao], ids[destino]] = [ids[destino], ids[posicao]];

    try {
      aplicarResposta(await requisitar(pagina.dataset.activitiesReorderUrl, {
        method: "POST",
        body: JSON.stringify({ ids }),
      }));
    } catch (erro) {
      mostrarFeedback(erro.message, "erro");
    }
  }

  async function restaurarTrilha() {
    const confirmado = window.confirm(
      "Restaurar a trilha original do RobooTeam?\n\nTodas as atividades que você criou ou editou serão descartadas.",
    );
    if (!confirmado) return;

    try {
      aplicarResposta(await requisitar(pagina.dataset.activitiesRestoreUrl, { method: "POST", body: "{}" }));
    } catch (erro) {
      mostrarFeedback(erro.message, "erro");
    }
  }

  // ------------------------------------------------------------------ eventos
  listaEl.addEventListener("click", (evento) => {
    const card = evento.target.closest("[data-activity-id]");
    if (!card) return;
    const id = Number(card.dataset.activityId);

    if (evento.target.closest("[data-edit]")) {
      const atividade = estado.atividades.find((item) => item.id === id);
      if (atividade) abrirModal(atividade);
      return;
    }
    if (evento.target.closest("[data-delete]")) {
      removerAtividade(id);
      return;
    }
    const mover = evento.target.closest("[data-move]");
    if (mover && !mover.disabled) moverAtividade(id, Number(mover.dataset.move));
  });

  document.querySelector("#new-activity-button")?.addEventListener("click", () => abrirModal());
  document.querySelector("#restore-trail-button")?.addEventListener("click", restaurarTrilha);
  document.querySelector("#close-activity-modal")?.addEventListener("click", fecharModal);
  document.querySelector("#cancel-activity-button")?.addEventListener("click", fecharModal);
  document.querySelector("#add-section-button")?.addEventListener("click", () => adicionarSecao());
  document.querySelector("#add-question-button")?.addEventListener("click", () => adicionarPergunta());

  document.querySelectorAll("[data-add-pair]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const memoria = botao.dataset.addPair === "memory";
      adicionarPar(
        memoria ? containerParesMemory : containerParesDragDrop,
        memoria ? ["Termo", "Significado"] : ["Bloco", "Explicação"],
      );
    });
  });

  document.querySelector("[data-add-variation]")?.addEventListener("click", () => adicionarVariacao());
  seletorMinijogo?.addEventListener("change", atualizarCamposDoMinijogo);
  form?.addEventListener("submit", salvarAtividade);

  modal?.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModal();
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && modal.classList.contains("aberto")) fecharModal();
  });

  carregarAtividades();
})();

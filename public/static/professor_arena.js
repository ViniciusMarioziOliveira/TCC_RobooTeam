/* =========================================================================
   PAINEL DO PROFESSOR - ARENA ROBOOTEAM
   Criar mapas, gerar o código da partida, acompanhar as equipes ao vivo e
   atender os pedidos de ajuda dos alunos.
   Reaproveita escapeHtml() e authHeaders() de professor.js (carregado antes).
   ========================================================================= */

(() => {
  const pagina = document.body;
  const listaEl = document.querySelector("#arena-list");
  if (!listaEl) return;

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
  const urlLista = pagina.dataset.arenasUrl;
  const urlSorteio = pagina.dataset.arenaRandomUrl;

  const DIRECOES = ["N", "E", "S", "W"];
  const DESLOCAMENTOS = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
  const ROTULO_STATUS = { aguardando: "Aguardando alunos", em_jogo: "Em jogo", finalizada: "Encerrada" };
  const CORES_EQUIPE = { cyan: "#2DD4E8", purple: "#A78BFA", pink: "#FF7AB6", orange: "#FF9F43", green: "#34D399", yellow: "#F6B93B" };
  const MOTIVO_EQUIPE_TODA = "equipe_toda";

  let arenas = [];
  let pedidosConhecidos = null;
  let monitorId = null;
  let monitorDados = null;
  let monitorTimer = null;
  // diferença entre o relógio do servidor e o do navegador (para os cronômetros)
  let deslocamento = 0;
  let segundosAjuda = 30;
  const atrasosAvisados = new Set();
  const editor = { id: null, tamanho: 8, direcao: "E", mapa: [], ferramenta: "O", pintando: false };

  /* ------------------------------------------------------------ utilidades */
  async function api(url, opcoes = {}) {
    const resposta = await fetch(url, { ...opcoes, headers: authHeaders(Boolean(opcoes.body)) });
    if (resposta.status === 401 || resposta.status === 403) {
      window.location.href = pagina.dataset.loginUrl;
      throw new Error("Faça login novamente");
    }
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.error || "Não foi possível concluir a ação");
    return dados;
  }

  function icone(nome, classes = "w-3.5 h-3.5") {
    return `<i data-lucide="${nome}" class="${classes}"></i>`;
  }

  function desenharIcones() {
    if (window.lucide) lucide.createIcons();
  }

  function aviso(texto, tom = "", nomeIcone = "") {
    const el = document.createElement("div");
    el.className = `arena-toast${tom ? ` ${tom}` : ""}`;
    el.innerHTML = `${nomeIcone ? icone(nomeIcone, "w-4 h-4 shrink-0") : ""}<span>${escapeHtml(texto)}</span>`;
    $("#arena-toasts").append(el);
    if (nomeIcone) desenharIcones();
    setTimeout(() => el.remove(), 5000);
  }

  function som() {
    try {
      const contexto = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1175].forEach((frequencia, i) => {
        const inicio = contexto.currentTime + i * 0.14;
        const oscilador = contexto.createOscillator();
        const ganho = contexto.createGain();
        oscilador.frequency.setValueAtTime(frequencia, inicio);
        ganho.gain.setValueAtTime(0.06, inicio);
        ganho.gain.exponentialRampToValueAtTime(0.001, inicio + 0.18);
        oscilador.connect(ganho).connect(contexto.destination);
        oscilador.start(inicio);
        oscilador.stop(inicio + 0.18);
      });
    } catch {
      // navegador sem áudio: o aviso visual já basta
    }
  }

  function formatarTempo(segundos) {
    if (segundos === null || segundos === undefined) return "--:--";
    const total = Math.max(0, Math.round(segundos));
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  function sincronizarRelogio(agoraIso) {
    if (agoraIso) deslocamento = Date.parse(agoraIso) - Date.now();
  }

  function segundosDesde(iso) {
    return Math.max(0, (Date.now() + deslocamento - Date.parse(iso)) / 1000);
  }

  function medalha(indice, posicao) {
    return indice < 3
      ? `<span class="rank-medal m${indice + 1}" title="${indice + 1}º lugar">${icone("medal", "w-4 h-4")}</span>`
      : `<span class="rank-medal">${posicao}</span>`;
  }

  function copiar(codigo) {
    navigator.clipboard?.writeText(codigo)
      .then(() => aviso(`Código ${codigo} copiado!`, "good", "copy"))
      .catch(() => window.prompt("Copie o código da arena:", codigo));
  }

  function miniMapa(tamanho, mapa, classe = "") {
    return `<div class="mini-map ${classe}" style="--size:${tamanho}" aria-hidden="true">${[...mapa].map((c) => `<i class="${c}"></i>`).join("")}</div>`;
  }

  function abrirModal(modal) {
    modal.classList.remove("hidden");
    modal.classList.add("aberto");
  }

  function fecharModal(modal) {
    modal.classList.add("hidden");
    modal.classList.remove("aberto");
    if (modal.id === "arena-monitor") {
      clearInterval(monitorTimer);
      monitorId = null;
    }
  }

  /* menor sequência de comandos (mesma regra do servidor) */
  function solucao(tamanho, mapa, direcao) {
    const inicio = mapa.indexOf("I");
    const fim = mapa.indexOf("F");
    if (inicio < 0 || fim < 0) return null;
    const chave = (l, c, d) => `${l},${c},${d}`;
    const origem = [Math.floor(inicio / tamanho), inicio % tamanho, direcao];
    const anteriores = new Map([[chave(...origem), null]]);
    const fila = [origem];
    while (fila.length) {
      const atual = fila.shift();
      const [l, c, d] = atual;
      if (l * tamanho + c === fim) {
        const casas = [];
        let passo = chave(...atual);
        let comandos = 0;
        while (anteriores.get(passo)) {
          const [anterior, casa] = anteriores.get(passo);
          if (casa !== null) casas.push(casa);
          comandos += 1;
          passo = anterior;
        }
        return { comandos, casas };
      }
      const i = DIRECOES.indexOf(d);
      const vizinhos = [[l, c, DIRECOES[(i + 3) % 4], null], [l, c, DIRECOES[(i + 1) % 4], null]];
      const [dl, dc] = DESLOCAMENTOS[d];
      const nl = l + dl;
      const nc = c + dc;
      if (nl >= 0 && nl < tamanho && nc >= 0 && nc < tamanho && mapa[nl * tamanho + nc] !== "O") {
        vizinhos.push([nl, nc, d, nl * tamanho + nc]);
      }
      vizinhos.forEach(([vl, vc, vd, casa]) => {
        const k = chave(vl, vc, vd);
        if (!anteriores.has(k)) {
          anteriores.set(k, [chave(l, c, d), casa]);
          fila.push([vl, vc, vd]);
        }
      });
    }
    return null;
  }

  /* ------------------------------------------------------------ lista */
  function renderLista() {
    if (!arenas.length) {
      listaEl.innerHTML = `
        <div class="md:col-span-2 2xl:col-span-3 flex flex-col items-center gap-2 py-8 text-center">
          <img class="dashboard-state-robot" src="${pagina.dataset.emptyRobotUrl}" alt="">
          <p class="text-sm font-semibold text-slate-600">Nenhuma arena criada ainda.</p>
          <p class="text-xs text-slate-400">Clique em <strong>Nova arena</strong> para desenhar o primeiro mapa.</p>
        </div>`;
    } else {
      listaEl.innerHTML = arenas.map((arena) => `
        <article class="arena-card${arena.pedidos ? " has-help" : ""}">
          ${miniMapa(arena.tamanho, arena.mapa)}
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="arena-status ${arena.status}">${ROTULO_STATUS[arena.status]}</span>
              ${arena.pedidos ? `<span class="arena-status aguardando inline-flex items-center gap-1">${icone("hand", "w-3 h-3")} ${arena.pedidos} ${arena.pedidos === 1 ? "pedido" : "pedidos"}</span>` : ""}
            </div>
            <h4 class="text-sm font-bold text-slate-800 truncate" title="${escapeHtml(arena.nome)}">${escapeHtml(arena.nome)}</h4>
            <div class="flex items-center gap-2">
              <span class="arena-code">${escapeHtml(arena.codigo)}</span>
              <button type="button" class="icon-button" data-copiar="${escapeHtml(arena.codigo)}" title="Copiar código">${icone("copy")}</button>
            </div>
            <p class="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span class="inline-flex items-center gap-1">${icone("users", "w-3 h-3")} ${arena.jogadores} ${arena.jogadores === 1 ? "aluno" : "alunos"}</span> ·
              <span>${arena.equipes} ${arena.equipes === 1 ? "equipe" : "equipes"}</span> ·
              <span class="inline-flex items-center gap-1">${icone("flag", "w-3 h-3")} ${arena.concluiram} na bandeira</span>
            </p>
            <div class="flex flex-wrap gap-2 pt-1">
              <button type="button" data-acompanhar="${arena.id}" class="px-3 py-1.5 bg-brand-navy hover:bg-brand-dark text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5">
                ${icone("radio")} Acompanhar
              </button>
              ${arena.status !== "em_jogo" ? `<button type="button" class="icon-button" data-editar="${arena.id}" title="Editar mapa">${icone("pencil", "w-4 h-4")}</button>` : ""}
              <button type="button" class="icon-button danger" data-excluir="${arena.id}" title="Excluir arena">${icone("trash-2", "w-4 h-4")}</button>
            </div>
          </div>
        </article>`).join("");
    }
    renderFilaDeAjuda();
    desenharIcones();
  }

  /* fila com todos os pedidos para o professor, de todas as arenas.
     A ajuda é presencial: o professor vai até o aluno e marca como resolvido aqui. */
  function renderFilaDeAjuda() {
    const pedidos = arenas.flatMap((arena) => arena.pedidos_detalhe.map((pedido) => ({ ...pedido, arena })));
    const badge = $("#sidebar-arena-help");
    badge.classList.toggle("hidden", !pedidos.length);
    badge.classList.toggle("is-alert", pedidos.length > 0);
    badge.textContent = pedidos.length;

    const alerta = $("#arena-help-alert");
    alerta.classList.toggle("hidden", !pedidos.length);
    $("#arena-help-alert-title").textContent = pedidos.length === 1
      ? "1 aluno pedindo ajuda na Arena"
      : `${pedidos.length} alunos pedindo ajuda na Arena`;
    $("#arena-help-queue").innerHTML = pedidos.map((pedido) => {
      const vindo = pedido.status === "a_caminho";
      const equipeToda = pedido.motivo === MOTIVO_EQUIPE_TODA;
      return `
        <li class="help-queue-item${vindo ? " is-coming" : ""}" data-pedido="${pedido.arena.id}:${pedido.aluno_id}" data-nome="${escapeHtml(pedido.nome)}" data-since="${escapeHtml(pedido.pedida_em)}" data-status="${pedido.status}">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(pedido.nome)}
              <span class="font-medium text-slate-500">· ${escapeHtml(pedido.equipe)} · ${escapeHtml(pedido.arena.nome)}</span></p>
            <p class="text-[11px] font-semibold text-amber-900 mt-0.5 flex flex-wrap items-center gap-1.5">
              “${escapeHtml(pedido.motivo_texto || "Pediu ajuda")}”
              ${equipeToda ? `<span class="help-badge">${icone("users", "w-3 h-3")} equipe toda</span>` : ""}
            </p>
          </div>
          <span class="help-wait" title="Tempo de espera">${icone(vindo ? "footprints" : "clock", "w-3 h-3")}<span data-relogio>00:00</span></span>
          <div class="help-queue-actions">
            ${vindo
              ? `<span class="help-action ghost">${icone("footprints")} Você está indo</span>`
              : `<button type="button" class="help-action go" data-rapido="a_caminho" data-arena="${pedido.arena.id}" data-aluno="${pedido.aluno_id}">${icone("footprints")} Estou indo</button>`}
            <button type="button" class="help-action done" data-rapido="resolvido" data-arena="${pedido.arena.id}" data-aluno="${pedido.aluno_id}">${icone("circle-check")} Resolvido</button>
            <button type="button" class="help-action ghost" data-acompanhar="${pedido.arena.id}" title="Abrir a partida">${icone("radio")}<span class="sr-only">Abrir a partida</span></button>
          </div>
        </li>`;
    }).join("");
    atualizarRelogios();

    const chaves = new Set(pedidos.map((pedido) => `${pedido.arena.id}:${pedido.aluno_id}:${pedido.pedida_em}`));
    if (pedidosConhecidos) {
      const novos = pedidos.filter((pedido) => !pedidosConhecidos.has(`${pedido.arena.id}:${pedido.aluno_id}:${pedido.pedida_em}`));
      if (novos.length) {
        som();
        novos.forEach((pedido) => aviso(
          pedido.motivo === MOTIVO_EQUIPE_TODA
            ? `${pedido.nome} e a equipe ${pedido.equipe} estão com dúvida`
            : `${pedido.nome} pediu ajuda em "${pedido.arena.nome}"`,
          "alert", "hand"));
      }
    }
    pedidosConhecidos = chaves;
  }

  /* roda a cada segundo: cronômetro de cada pedido e destaque dos que passaram do tempo */
  function atualizarRelogios() {
    let algumAtrasado = false;
    $$("[data-since]").forEach((item) => {
      const segundos = segundosDesde(item.dataset.since);
      const relogio = item.querySelector("[data-relogio]");
      if (relogio) relogio.textContent = formatarTempo(segundos);
      const atrasado = item.dataset.status === "aberta" && segundos >= segundosAjuda;
      item.classList.toggle("is-late", atrasado);
      if (!atrasado || !item.dataset.pedido) return;
      algumAtrasado = true;
      const chave = `${item.dataset.pedido}:${item.dataset.since}`;
      if (!atrasosAvisados.has(chave)) {
        atrasosAvisados.add(chave);
        som();
        aviso(`${item.dataset.nome} está esperando ajuda há mais de ${segundosAjuda} segundos`, "alert", "timer");
      }
    });
    $("#arena-help-alert").classList.toggle("has-late", algumAtrasado);
  }

  async function responderPedido(arenaId, alunoId, acao) {
    try {
      const dados = await api(`${urlLista}/${arenaId}/ajuda/${alunoId}`, {
        method: "POST",
        body: JSON.stringify({ acao }),
      });
      if (monitorId === Number(arenaId)) renderMonitor(dados);
      aviso(acao === "resolvido" ? "Ajuda marcada como resolvida!" : "O aluno vai ver que você está a caminho.", "good",
        acao === "resolvido" ? "circle-check" : "footprints");
      await carregarLista();
    } catch (erro) {
      aviso(erro.message, "alert");
      carregarLista();
    }
  }

  async function carregarLista() {
    try {
      const dados = await api(urlLista);
      sincronizarRelogio(dados.agora);
      segundosAjuda = dados.segundos_ajuda || segundosAjuda;
      arenas = dados.arenas;
      renderLista();
    } catch (erro) {
      listaEl.innerHTML = `<p class="text-xs text-red-600 py-8 text-center md:col-span-2">${escapeHtml(erro.message)}</p>`;
    }
  }

  listaEl.addEventListener("click", async (evento) => {
    const botao = evento.target.closest("button");
    if (!botao) return;
    if (botao.dataset.copiar) copiar(botao.dataset.copiar);
    if (botao.dataset.acompanhar) abrirMonitor(Number(botao.dataset.acompanhar));
    if (botao.dataset.editar) {
      const arena = arenas.find((item) => item.id === Number(botao.dataset.editar));
      if (arena) abrirEditor(arena);
    }
    if (botao.dataset.excluir) {
      const arena = arenas.find((item) => item.id === Number(botao.dataset.excluir));
      if (!arena || !window.confirm(`Excluir a arena "${arena.nome}"? Os resultados das equipes serão perdidos.`)) return;
      try {
        await api(`${urlLista}/${arena.id}`, { method: "DELETE" });
        aviso("Arena excluída.", "", "trash-2");
        carregarLista();
      } catch (erro) {
        aviso(erro.message, "alert");
      }
    }
  });

  $("#arena-help-alert").addEventListener("click", (evento) => {
    const botao = evento.target.closest("button");
    if (!botao) return;
    if (botao.dataset.acompanhar) {
      abrirMonitor(Number(botao.dataset.acompanhar));
    } else if (botao.dataset.rapido) {
      botao.disabled = true;
      responderPedido(botao.dataset.arena, botao.dataset.aluno, botao.dataset.rapido);
    }
  });

  /* ------------------------------------------------------------ editor de mapa */
  const tabuleiroEditor = $("#editor-board");

  function mapaPadrao(tamanho) {
    const mapa = Array(tamanho * tamanho).fill("L");
    const meio = Math.floor(tamanho / 2);
    mapa[meio * tamanho] = "I";
    mapa[meio * tamanho + tamanho - 1] = "F";
    return mapa;
  }

  function abrirEditor(arena = null) {
    editor.id = arena ? arena.id : null;
    editor.tamanho = arena ? arena.tamanho : 8;
    editor.direcao = arena ? arena.direcao : "E";
    editor.mapa = arena ? [...arena.mapa] : mapaPadrao(8);
    editor.ferramenta = "O";
    $("#arena-name-input").value = arena ? arena.nome : "";
    $("#arena-limit-input").value = arena && arena.limite_blocos ? arena.limite_blocos : "";
    $("#arena-show-path").checked = false;
    $("#arena-editor-title").textContent = arena ? `Editar "${arena.nome}"` : "Nova arena";
    $("#arena-save-label").textContent = arena ? "Salvar mapa" : "Criar arena e gerar código";
    $("#arena-editor-error").textContent = "";
    renderEditor();
    abrirModal($("#arena-editor"));
    $("#arena-name-input").focus();
  }

  // o robô (início) e a bandeira são desenhados pelo CSS das classes I e F
  function renderEditor() {
    tabuleiroEditor.style.setProperty("--size", editor.tamanho);
    tabuleiroEditor.innerHTML = editor.mapa
      .map((celula, i) => `<div class="editor-cell ${celula}" data-i="${i}"></div>`)
      .join("");
    $$("#editor-tools [data-tool]").forEach((botao) => botao.setAttribute("aria-pressed", String(botao.dataset.tool === editor.ferramenta)));
    $$("#arena-size [data-size]").forEach((botao) => botao.setAttribute("aria-pressed", String(Number(botao.dataset.size) === editor.tamanho)));
    $$("#arena-direction [data-dir]").forEach((botao) => botao.setAttribute("aria-pressed", String(botao.dataset.dir === editor.direcao)));
    validarEditor();
  }

  function atualizarCelula(i) {
    const el = tabuleiroEditor.querySelector(`[data-i="${i}"]`);
    if (!el) return;
    el.className = `editor-cell ${editor.mapa[i]} painted`;
  }

  function validarEditor() {
    const caixa = $("#editor-validation");
    const mapa = editor.mapa.join("");
    let resultado = null;
    if (!mapa.includes("I")) {
      caixa.className = "editor-validation bad";
      caixa.dataset.icon = "bot";
      caixa.textContent = "Coloque o ponto de início do robô (ferramenta Início).";
    } else if (!mapa.includes("F")) {
      caixa.className = "editor-validation bad";
      caixa.dataset.icon = "flag";
      caixa.textContent = "Coloque a bandeira de chegada (ferramenta Bandeira).";
    } else {
      resultado = solucao(editor.tamanho, mapa, editor.direcao);
      if (!resultado) {
        caixa.className = "editor-validation bad";
        caixa.dataset.icon = "wall";
        caixa.textContent = "Não existe caminho até a bandeira. Abra passagem nas paredes!";
      } else {
        const nivel = resultado.comandos <= 8 ? "fácil" : resultado.comandos <= 16 ? "médio" : "desafiador";
        caixa.className = "editor-validation ok";
        caixa.dataset.icon = "ok";
        caixa.textContent = `Caminho possível! O robô precisa de pelo menos ${resultado.comandos} comandos (nível ${nivel}).`;
      }
    }
    $$(".editor-cell.path", tabuleiroEditor).forEach((el) => el.classList.remove("path"));
    if (resultado && $("#arena-show-path").checked) {
      resultado.casas.forEach((i) => tabuleiroEditor.querySelector(`[data-i="${i}"]`)?.classList.add("path"));
    }
    return resultado;
  }

  function pintar(i, clique) {
    const ferramenta = editor.ferramenta;
    const atual = editor.mapa[i];
    // início e bandeira nunca são apagados pelo pincel; só mudam de lugar com a própria ferramenta
    if (atual === ferramenta || atual === "I" || atual === "F") return;
    if (ferramenta === "I" || ferramenta === "F") {
      if (!clique) return;
      const anterior = editor.mapa.indexOf(ferramenta);
      if (anterior >= 0) {
        editor.mapa[anterior] = "L";
        atualizarCelula(anterior);
      }
    }
    editor.mapa[i] = ferramenta;
    atualizarCelula(i);
    validarEditor();
  }

  tabuleiroEditor.addEventListener("pointerdown", (evento) => {
    const celula = evento.target.closest("[data-i]");
    if (!celula) return;
    evento.preventDefault();
    editor.pintando = true;
    pintar(Number(celula.dataset.i), true);
  });
  tabuleiroEditor.addEventListener("pointerover", (evento) => {
    if (!editor.pintando) return;
    const celula = evento.target.closest("[data-i]");
    if (celula) pintar(Number(celula.dataset.i), false);
  });
  window.addEventListener("pointerup", () => { editor.pintando = false; });

  $("#editor-tools").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-tool]");
    if (!botao) return;
    editor.ferramenta = botao.dataset.tool;
    $$("#editor-tools [data-tool]").forEach((item) => item.setAttribute("aria-pressed", String(item === botao)));
  });

  $("#arena-size").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-size]");
    if (!botao || Number(botao.dataset.size) === editor.tamanho) return;
    const temParedes = editor.mapa.includes("O");
    if (temParedes && !window.confirm("Trocar o tamanho apaga o mapa atual. Continuar?")) return;
    editor.tamanho = Number(botao.dataset.size);
    editor.mapa = mapaPadrao(editor.tamanho);
    renderEditor();
  });

  $("#arena-direction").addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-dir]");
    if (!botao) return;
    editor.direcao = botao.dataset.dir;
    $$("#arena-direction [data-dir]").forEach((item) => item.setAttribute("aria-pressed", String(item === botao)));
    validarEditor();
  });

  $("#arena-random").addEventListener("click", async () => {
    try {
      const sorteio = await api(`${urlSorteio}?tamanho=${editor.tamanho}`);
      editor.tamanho = sorteio.tamanho;
      editor.mapa = [...sorteio.mapa];
      editor.direcao = sorteio.direcao;
      renderEditor();
    } catch (erro) {
      $("#arena-editor-error").textContent = erro.message;
    }
  });

  $("#arena-clear").addEventListener("click", () => {
    editor.mapa = mapaPadrao(editor.tamanho);
    renderEditor();
  });

  $("#arena-show-path").addEventListener("change", validarEditor);

  $("#arena-save").addEventListener("click", async () => {
    const erroEl = $("#arena-editor-error");
    const nome = $("#arena-name-input").value.trim();
    if (nome.length < 2) {
      erroEl.textContent = "Dê um nome para a arena.";
      $("#arena-name-input").focus();
      return;
    }
    if (!validarEditor()) {
      erroEl.textContent = "Arrume o mapa antes de salvar.";
      return;
    }
    erroEl.textContent = "";
    const corpo = {
      nome,
      tamanho: editor.tamanho,
      mapa: editor.mapa.join(""),
      direcao: editor.direcao,
      limite_blocos: $("#arena-limit-input").value ? Number($("#arena-limit-input").value) : 0,
    };
    const botao = $("#arena-save");
    botao.disabled = true;
    try {
      const arena = await api(editor.id ? `${urlLista}/${editor.id}` : urlLista, {
        method: editor.id ? "PUT" : "POST",
        body: JSON.stringify(corpo),
      });
      fecharModal($("#arena-editor"));
      await carregarLista();
      if (editor.id) {
        aviso("Mapa salvo!", "good", "save");
      } else {
        aviso(`Arena criada! Código ${arena.codigo}`, "good", "circle-check");
        abrirMonitor(arena.id);
      }
    } catch (erro) {
      erroEl.textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  });

  $("#new-arena-button").addEventListener("click", () => abrirEditor());

  /* ------------------------------------------------------------ acompanhar ao vivo */
  async function abrirMonitor(id) {
    monitorId = id;
    monitorDados = null;
    $("#monitor-title").textContent = "Carregando arena...";
    abrirModal($("#arena-monitor"));
    await carregarMonitor();
    clearInterval(monitorTimer);
    monitorTimer = setInterval(() => {
      if (!document.hidden) carregarMonitor();
    }, 3000);
  }

  async function carregarMonitor() {
    if (!monitorId) return;
    try {
      renderMonitor(await api(`${urlLista}/${monitorId}`));
    } catch (erro) {
      aviso(erro.message, "alert");
      fecharModal($("#arena-monitor"));
    }
  }

  function botaoAcao(acao, rotulo, nomeIcone, classes) {
    return `<button type="button" data-acao="${acao}" class="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${classes}">${icone(nomeIcone, "w-4 h-4")} ${rotulo}</button>`;
  }

  function renderMonitor(dados) {
    monitorDados = dados;
    sincronizarRelogio(dados.agora);
    segundosAjuda = dados.segundos_ajuda || segundosAjuda;
    const { estatisticas: est } = dados;
    $("#monitor-title").textContent = dados.nome;
    const minimo = dados.mapa_info.minimo_comandos;
    $("#monitor-subtitle").textContent = `${ROTULO_STATUS[dados.status]} · mapa ${dados.tamanho}×${dados.tamanho}${minimo ? ` · mínimo de ${minimo} comandos` : ""}${dados.limite_blocos ? ` · até ${dados.limite_blocos} blocos` : ""}`;
    $("#monitor-live").classList.toggle("off", dados.status !== "em_jogo");
    $("#monitor-code").textContent = dados.codigo;
    $$("#arena-monitor [data-help-seconds]").forEach((el) => { el.textContent = segundosAjuda; });

    const acoes = {
      aguardando: botaoAcao("iniciar", "Iniciar partida", "play", "bg-emerald-500 hover:bg-emerald-400 text-white shadow-md shadow-emerald-500/30"),
      em_jogo: botaoAcao("encerrar", "Encerrar partida", "square", "bg-red-500 hover:bg-red-400 text-white"),
      finalizada: botaoAcao("iniciar", "Reabrir", "play", "bg-white/10 hover:bg-white/20 text-white border border-white/20")
        + botaoAcao("reiniciar", "Nova rodada", "rotate-ccw", "bg-brand-cyan hover:bg-cyan-400 text-brand-navy"),
    };
    $("#monitor-actions").innerHTML = acoes[dados.status];

    $("#monitor-stats").innerHTML = [
      ["Alunos", est.jogadores],
      ["Online agora", est.online],
      ["Equipes", est.equipes],
      ["Na bandeira", `${est.concluiram}/${est.jogadores}`],
    ].map(([rotulo, valor]) => `<div class="monitor-stat"><strong>${valor}</strong><span>${rotulo}</span></div>`).join("");

    const equipes = Object.fromEntries(dados.equipes.map((equipe) => [equipe.chave, equipe]));
    const nomeEquipe = (chave) => (equipes[chave] ? equipes[chave].nome : "");
    const iconeEquipe = (chave) => (equipes[chave] ? icone(equipes[chave].icone, "w-3 h-3") : "");

    $("#monitor-help-count").textContent = dados.pedidos_professor.length;
    const pedidosProfessor = dados.pedidos_professor.map((aluno, posicao) => {
      const ajuda = aluno.ajuda;
      const vindo = ajuda.status === "a_caminho";
      const equipeToda = ajuda.motivo === MOTIVO_EQUIPE_TODA;
      return `
        <div class="help-card${vindo ? " coming" : ""}" data-since="${escapeHtml(ajuda.pedida_em)}" data-status="${ajuda.status}">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-xs font-bold text-slate-800 truncate">${posicao + 1}º · ${escapeHtml(aluno.nome)}</p>
              <p class="text-[10.5px] text-slate-500 truncate flex items-center gap-1">${iconeEquipe(aluno.equipe)} ${escapeHtml(nomeEquipe(aluno.equipe))}</p>
            </div>
            <span class="help-wait">${icone(vindo ? "footprints" : "clock", "w-3 h-3")}<span data-relogio>00:00</span></span>
          </div>
          <p class="text-[11.5px] font-semibold text-amber-900 mt-1.5 flex flex-wrap items-center gap-1.5">“${escapeHtml(ajuda.motivo_texto)}”
            ${equipeToda ? `<span class="help-badge">${icone("users", "w-3 h-3")} equipe toda</span>` : ""}</p>
          <p class="text-[10.5px] text-slate-500 mt-0.5">${aluno.tentativas} tentativas · ${aluno.dicas} dicas usadas${aluno.ultimo_erro === "parede" ? " · bateu na parede" : ""}${aluno.online ? " · online" : ""}</p>
          <div class="flex flex-wrap gap-2 mt-2">
            ${vindo
              ? `<span class="text-[11px] font-bold text-emerald-700 flex items-center gap-1">${icone("footprints")} Você está a caminho</span>`
              : `<button type="button" data-ajuda="a_caminho" data-aluno="${aluno.id}" class="help-action go">${icone("footprints")} Estou indo</button>`}
            <button type="button" data-ajuda="resolvido" data-aluno="${aluno.id}" class="help-action done">${icone("circle-check")} Resolvido</button>
          </div>
        </div>`;
    });
    const pedidosEquipe = dados.pedidos_equipe.map((aluno) => `
      <div class="help-card team">
        <p class="text-xs font-bold text-slate-800">${escapeHtml(aluno.nome)} <span class="font-medium text-slate-500">pediu ajuda à equipe</span></p>
        <p class="text-[10.5px] text-slate-500 flex flex-wrap items-center gap-1">${iconeEquipe(aluno.equipe)} ${escapeHtml(nomeEquipe(aluno.equipe))} ·
          ${aluno.ajuda.ajudante ? `${icone("handshake", "w-3 h-3")} ${escapeHtml(aluno.ajuda.ajudante)} está ajudando` : "aguardando um colega"}</p>
      </div>`);
    $("#monitor-help").innerHTML = pedidosProfessor.length || pedidosEquipe.length
      ? [...pedidosProfessor, ...pedidosEquipe].join("")
      : `<div class="flex flex-col items-center text-center gap-1 py-6">
           <img class="dashboard-state-robot" src="${pagina.dataset.calmRobotUrl}" alt="">
           <p class="text-xs font-semibold text-slate-600">Nenhum pedido agora.</p>
           <p class="text-[11px] text-slate-400">Tudo tranquilo por aqui.</p>
         </div>`;

    $("#monitor-teams").innerHTML = dados.equipes.length
      ? dados.equipes.map((equipe) => `
        <div class="team-box" style="border-color:${CORES_EQUIPE[equipe.cor]}66">
          <div class="team-box-head">
            <span class="team-box-emoji" style="background:${CORES_EQUIPE[equipe.cor]}">${icone(equipe.icone, "w-4 h-4")}</span>
            <strong class="text-xs text-slate-800 flex-1 truncate">${escapeHtml(equipe.nome)}</strong>
            <span class="text-[10px] font-semibold text-slate-400 flex items-center gap-1">${equipe.membros.filter((m) => m.concluiu).length}/${equipe.membros.length} ${icone("flag", "w-3 h-3")}</span>
          </div>
          ${equipe.membros.map((membro) => `
            <div class="member-row">
              <span class="member-dot${membro.online ? " on" : ""}"></span>
              <span class="flex-1 truncate text-slate-700 font-semibold">${escapeHtml(membro.nome)}</span>
              <span class="text-[10.5px] flex items-center gap-1 ${membro.concluiu ? "text-emerald-700 font-bold" : membro.ajuda ? "text-amber-700 font-bold" : "text-slate-400"}">
                ${membro.concluiu
                  ? `${icone("circle-check", "w-3 h-3")} ${formatarTempo(membro.tempo)} <span class="inline-flex text-amber-400">${icone("star", "w-3 h-3 fill-current").repeat(membro.estrelas || 1)}</span>`
                  : membro.ajuda ? `${icone("hand", "w-3 h-3")} ajuda` : `${icone("bot", "w-3 h-3")} ${membro.tentativas} tent. · ${membro.dicas} dicas`}
              </span>
            </div>`).join("")}
        </div>`).join("")
      : '<p class="text-xs text-slate-400 text-center py-6">Nenhuma equipe ainda. Mostre o código para a turma!</p>';

    $("#monitor-rank").innerHTML = dados.ranking.length
      ? dados.ranking.map((item, i) => `
        <li class="flex items-center gap-2 text-xs p-2 rounded-xl bg-slate-50">
          ${medalha(i, item.posicao)}
          <span class="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0" style="background:${CORES_EQUIPE[item.cor]}">${icone(item.icone, "w-3.5 h-3.5")}</span>
          <span class="flex-1 truncate font-semibold text-slate-700">${escapeHtml(item.nome)}</span>
          <span class="text-[10.5px] text-slate-400">${item.concluidos}/${item.jogadores}</span>
          <span class="font-mono font-bold text-slate-700">${item.concluidos ? formatarTempo(item.tempo_total) : "--:--"}</span>
        </li>`).join("")
      : '<li class="text-xs text-slate-400 text-center py-4">O ranking aparece quando as equipes entrarem.</li>';

    $("#monitor-map").outerHTML = miniMapa(dados.tamanho, dados.mapa, "mini-map-lg").replace('class="mini-map', 'id="monitor-map" class="mini-map');
    atualizarRelogios();
    desenharIcones();
  }

  $("#arena-monitor").addEventListener("click", async (evento) => {
    const acao = evento.target.closest("[data-acao]");
    if (acao && monitorId) {
      const confirmacoes = {
        encerrar: "Encerrar a partida? Os alunos verão o ranking final.",
        reiniciar: "Começar uma nova rodada? Os tempos e resultados desta partida serão zerados.",
      };
      if (confirmacoes[acao.dataset.acao] && !window.confirm(confirmacoes[acao.dataset.acao])) return;
      try {
        renderMonitor(await api(`${urlLista}/${monitorId}/status`, {
          method: "POST",
          body: JSON.stringify({ acao: acao.dataset.acao }),
        }));
        aviso(acao.dataset.acao === "iniciar" ? "Partida iniciada! Valendo!" : "Status da partida atualizado.", "good", "flag");
        carregarLista();
      } catch (erro) {
        aviso(erro.message, "alert");
      }
      return;
    }
    const ajuda = evento.target.closest("[data-ajuda]");
    if (ajuda && monitorId) {
      ajuda.disabled = true;
      responderPedido(monitorId, ajuda.dataset.aluno, ajuda.dataset.ajuda);
    }
  });

  $("#monitor-copy").addEventListener("click", () => {
    if (monitorDados) copiar(monitorDados.codigo);
  });

  /* ------------------------------------------------------------ fechar modais */
  $$(".arena-modal").forEach((modal) => {
    modal.addEventListener("click", (evento) => {
      if (evento.target === modal || evento.target.closest("[data-arena-close]")) fecharModal(modal);
    });
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") $$(".arena-modal.aberto").forEach(fecharModal);
  });

  carregarLista();
  setInterval(() => {
    if (!document.hidden) carregarLista();
  }, 6000);
  setInterval(atualizarRelogios, 1000);
})();

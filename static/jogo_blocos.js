(function () {
  "use strict";

  const scriptUrl = document.currentScript?.src || "";

  function startGame() {
    const page = document.body;
    if (!page) return;

    const elements = {
      grid: document.querySelector("#game-grid"),
      phaseList: document.querySelector("#phase-list"),
      palette: document.querySelector("#block-palette") || document.querySelector(".block-palette"),
      program:
        document.querySelector("#program-blocks") ||
        document.querySelector("#program-list") ||
        document.querySelector("#program-dropzone"),
      programDropzone: document.querySelector("#program-dropzone"),
      programEmpty: document.querySelector("#program-empty-state"),
      run: document.querySelector("#run-program"),
      pause: document.querySelector("#pause-program"),
      clear: document.querySelector("#clear-program"),
      reset: document.querySelector("#reset-level"),
      feedback:
        document.querySelector("#program-feedback") ||
        document.querySelector("#game-feedback"),
      title: document.querySelector("#current-phase-title"),
      description: document.querySelector("#current-phase-description"),
      hint: document.querySelector("#phase-hint"),
      phaseNumber: document.querySelector("#current-phase-number"),
      phaseDifficulty: document.querySelector("#phase-difficulty"),
      phaseTotal: document.querySelector(".phase-total"),
      blockCount: document.querySelector("#block-count") || document.querySelector("#program-count"),
      blockLimits: document.querySelectorAll("#block-limit, #program-limit"),
      progressFill:
        document.querySelector("#game-progress-fill") || document.querySelector("#game-progress-bar"),
      progressText: document.querySelector("#game-progress-text"),
      mascot: document.querySelector("#game-mascot"),
      loading: document.querySelector("#game-loading"),
      success:
        document.querySelector("#success-dialog") ||
        document.querySelector("#success-modal"),
      successTitle: document.querySelector("#success-title"),
      successMessage: document.querySelector("#success-message"),
      successStats: document.querySelector("#success-stats"),
      successBlocks: document.querySelector("#success-blocks"),
      successStars: document.querySelector("#success-stars"),
      successMascot: document.querySelector("#success-mascot"),
      nextLevel: document.querySelector("#next-level"),
      replayLevel: document.querySelector("#replay-level"),
    };

    elements.title ||= document.querySelector("#phase-title");
    elements.description ||= document.querySelector("#phase-objective");
    elements.hint ||= document.querySelector("#mascot-message");

    const commandDetails = {
      avancar: { label: "Avançar", symbol: "↑" },
      virar_esquerda: { label: "Virar à esquerda", symbol: "↶" },
      virar_direita: { label: "Virar à direita", symbol: "↷" },
    };

    const commandAliases = new Map([
      ["avancar", "avancar"],
      ["avançar", "avancar"],
      ["forward", "avancar"],
      ["move-forward", "avancar"],
      ["move_forward", "avancar"],
      ["virar_esquerda", "virar_esquerda"],
      ["virar-esquerda", "virar_esquerda"],
      ["turn-left", "virar_esquerda"],
      ["turn_left", "virar_esquerda"],
      ["left", "virar_esquerda"],
      ["virar_direita", "virar_direita"],
      ["virar-direita", "virar_direita"],
      ["turn-right", "virar_direita"],
      ["turn_right", "virar_direita"],
      ["right", "virar_direita"],
    ]);

    const directions = ["norte", "leste", "sul", "oeste"];
    const directionLabels = {
      norte: "norte",
      leste: "leste",
      sul: "sul",
      oeste: "oeste",
    };
    const directionSymbols = {
      norte: "▲",
      leste: "▶",
      sul: "▼",
      oeste: "◀",
    };
    const directionDelta = {
      norte: [-1, 0],
      leste: [0, 1],
      sul: [1, 0],
      oeste: [0, -1],
    };

    const initialRunLabel = elements.run?.textContent?.trim() || "Executar";
    const initialPauseLabel = elements.pause?.textContent?.trim() || "Pausar";
    const mascotImages = readMascotImages(page, scriptUrl);

    let phases = [];
    let progress = { completed: 0, total: 0, percent: 0 };
    let currentPhase = null;
    let program = [];
    let nextBlockId = 1;
    let robot = { row: 0, col: 0, direction: "leste" };
    let running = false;
    let paused = false;
    let runVersion = 0;
    let pauseWaiters = [];
    let draggedBlock = null;
    let nextPhaseId = null;
    let focusBeforeModal = null;

    function normalizeText(value) {
      return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    }

    function toInteger(value, fallback = 0) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.trunc(number) : fallback;
    }

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function normalizeCommand(value) {
      const original = String(value ?? "").trim().toLowerCase();
      return commandAliases.get(original) || commandAliases.get(normalizeText(original)) || null;
    }

    function normalizeDirection(value) {
      const direction = normalizeText(value).replaceAll("_", "-");
      const aliases = {
        n: "norte",
        north: "norte",
        norte: "norte",
        cima: "norte",
        up: "norte",
        e: "leste",
        east: "leste",
        leste: "leste",
        direita: "leste",
        right: "leste",
        s: "sul",
        south: "sul",
        sul: "sul",
        baixo: "sul",
        down: "sul",
        w: "oeste",
        west: "oeste",
        oeste: "oeste",
        o: "oeste",
        esquerda: "oeste",
        left: "oeste",
      };
      return aliases[direction] || "leste";
    }

    function normalizeCoordinate(value) {
      if (Array.isArray(value)) {
        return { row: toInteger(value[0]), col: toInteger(value[1]) };
      }
      if (value && typeof value === "object") {
        return {
          row: toInteger(value.linha ?? value.row ?? value.y),
          col: toInteger(value.coluna ?? value.col ?? value.column ?? value.x),
        };
      }
      return { row: 0, col: 0 };
    }

    function getGridDimensions(raw) {
      const size = raw.tamanho ?? raw.grid_size ?? raw.gridSize ?? 6;
      if (Array.isArray(size)) {
        return {
          rows: clamp(toInteger(size[0], 6), 1, 30),
          cols: clamp(toInteger(size[1], size[0] || 6), 1, 30),
        };
      }
      if (size && typeof size === "object") {
        return {
          rows: clamp(toInteger(size.linhas ?? size.rows ?? size.height, 6), 1, 30),
          cols: clamp(toInteger(size.colunas ?? size.cols ?? size.columns ?? size.width, 6), 1, 30),
        };
      }
      const squareSize = clamp(toInteger(size, 6), 1, 30);
      return { rows: squareSize, cols: squareSize };
    }

    function getCoordinateBase(raw, coordinates, dimensions) {
      const declared = raw.base_coordenadas ?? raw.coordinate_base ?? raw.coordinateBase;
      if (declared === 1 || String(declared) === "1") return 1;
      if (declared === 0 || String(declared) === "0") return 0;
      if (coordinates.some((coordinate) => coordinate.row === 0 || coordinate.col === 0)) return 0;
      if (
        coordinates.some(
          (coordinate) => coordinate.row === dimensions.rows || coordinate.col === dimensions.cols,
        )
      ) {
        return 1;
      }
      return 0;
    }

    function normalizeState(value) {
      const state = normalizeText(value).replaceAll("_", "-");
      if (["bloqueada", "bloqueado", "locked"].includes(state)) return "bloqueada";
      if (["concluida", "concluido", "completed", "complete", "done"].includes(state)) {
        return "concluida";
      }
      if (["atual", "current", "active", "disponivel", "available", "unlocked"].includes(state)) {
        return "atual";
      }
      return "disponivel";
    }

    function normalizePhase(raw, index) {
      const dimensions = getGridDimensions(raw);
      const rawSpawn = raw.spawn ?? raw.inicio ?? [0, 0];
      const rawWalls = Array.isArray(raw.paredes ?? raw.walls) ? raw.paredes ?? raw.walls : [];
      const rawFlag = raw.bandeira ?? raw.flag ?? raw.objetivo ?? [dimensions.rows - 1, dimensions.cols - 1];
      const unbasedSpawn = normalizeCoordinate(rawSpawn);
      const unbasedWalls = rawWalls.map(normalizeCoordinate);
      const unbasedFlag = normalizeCoordinate(rawFlag);
      const base = getCoordinateBase(raw, [unbasedSpawn, unbasedFlag, ...unbasedWalls], dimensions);
      const adjust = (coordinate) => ({
        row: coordinate.row - base,
        col: coordinate.col - base,
      });
      const spawn = adjust(unbasedSpawn);
      const flag = adjust(unbasedFlag);
      const walls = unbasedWalls
        .map(adjust)
        .filter(
          (wall) =>
            wall.row >= 0 &&
            wall.row < dimensions.rows &&
            wall.col >= 0 &&
            wall.col < dimensions.cols,
        );
      const rawDirection =
        (rawSpawn && typeof rawSpawn === "object" && !Array.isArray(rawSpawn)
          ? rawSpawn.orientacao ?? rawSpawn.direcao ?? rawSpawn.direction
          : null) ??
        raw.direcao ??
        raw.orientacao ??
        raw.direction;

      return {
        id: raw.id ?? raw.fase_id ?? index + 1,
        index,
        title: String(raw.titulo ?? raw.title ?? raw.nome ?? `Fase ${index + 1}`),
        description: String(raw.descricao ?? raw.description ?? "Leve o robô até a bandeira."),
        hint: String(raw.dica ?? raw.hint ?? "Monte os blocos na ordem em que o robô deve agir."),
        rows: dimensions.rows,
        cols: dimensions.cols,
        spawn: {
          row: clamp(spawn.row, 0, dimensions.rows - 1),
          col: clamp(spawn.col, 0, dimensions.cols - 1),
        },
        direction: normalizeDirection(rawDirection),
        walls,
        wallSet: new Set(walls.map((wall) => `${wall.row}:${wall.col}`)),
        flag: {
          row: clamp(flag.row, 0, dimensions.rows - 1),
          col: clamp(flag.col, 0, dimensions.cols - 1),
        },
        limit: Math.max(1, toInteger(raw.limite_blocos ?? raw.block_limit ?? raw.blockLimit, 12)),
        state: normalizeState(raw.estado ?? raw.state),
        completionUrl: raw.url_concluir ?? raw.concluir_url ?? raw.completion_url ?? raw.completionUrl ?? "",
        raw,
      };
    }

    function normalizeProgress(value, totalFallback) {
      const source = value && typeof value === "object" ? value : {};
      const completedSource =
        source.completed ??
        source.quantidade_concluida ??
        source.concluido ??
        source.concluidos ??
        (Array.isArray(source.concluidas) ? source.concluidas.length : source.concluidas);
      const completed = Math.max(0, toInteger(completedSource, 0));
      const total = Math.max(0, toInteger(source.total, totalFallback));
      const calculated = total ? Math.round((completed / total) * 100) : 0;
      const percent = clamp(toInteger(source.percent ?? source.porcentagem ?? source.percentual, calculated), 0, 100);
      return { completed, total, percent };
    }

    function getStoredToken() {
      return localStorage.getItem("robooteam-token") || sessionStorage.getItem("robooteam-token");
    }

    function authHeaders(includeJson = false) {
      const token = getStoredToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (includeJson) headers["Content-Type"] = "application/json";
      return headers;
    }

    async function parseResponse(response) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          return await response.json();
        } catch {
          return {};
        }
      }
      const text = await response.text();
      return text ? { message: text } : {};
    }

    async function apiRequest(url, options = {}) {
      const headers = { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) };
      const response = await fetch(url, { ...options, headers });
      const result = await parseResponse(response);
      if (response.status === 401 || response.status === 403) {
        const redirectUrl = result.redirect_url || result.redirectUrl;
        if (redirectUrl) window.location.href = redirectUrl;
        else redirectToLogin();
        const error = new Error("Sua sessão expirou. Entre novamente para continuar.");
        error.isAuthError = true;
        error.status = response.status;
        throw error;
      }
      if (!response.ok) {
        const error = new Error(result.error || result.erro || result.message || "Não foi possível concluir a operação.");
        error.status = response.status;
        error.payload = result;
        throw error;
      }
      return result;
    }

    function redirectToLogin() {
      if (page.dataset.loginUrl) window.location.href = page.dataset.loginUrl;
    }

    function setFeedback(message, type = "info") {
      if (!elements.feedback) return;
      const copy = elements.feedback.querySelector(":scope > span:last-child:not(.status-icon)");
      if (copy) copy.textContent = message;
      else elements.feedback.textContent = message;
      elements.feedback.dataset.type = type;
      elements.feedback.classList.remove("is-info", "is-success", "is-error", "is-warning", "is-running");
      elements.feedback.classList.add(`is-${type}`);
      elements.feedback.setAttribute("role", type === "error" ? "alert" : "status");
    }

    function setText(element, value) {
      if (element) element.textContent = String(value);
    }

    function readCurrentPhaseId(payload) {
      const current = payload.fase_atual ?? payload.current_phase ?? payload.currentPhase;
      if (current && typeof current === "object") return current.id ?? current.fase_id;
      return current;
    }

    async function loadGame(options = {}) {
      if (!page.dataset.gameUrl) {
        setFeedback("O endereço do jogo não foi configurado. Volte ao painel e tente novamente.", "error");
        setLoading(false);
        disableGame();
        return;
      }

      if (!options.quiet) setFeedback("Preparando as fases...", "info");
      setLoading(true);
      try {
        const payload = await apiRequest(page.dataset.gameUrl);
        const rawPhases = Array.isArray(payload.fases ?? payload.phases) ? payload.fases ?? payload.phases : [];
        phases = rawPhases.map(normalizePhase);
        progress = normalizeProgress(payload.progresso ?? payload.progress, phases.length);

        if (!phases.length) {
          currentPhase = null;
          renderAll();
          setFeedback("Ainda não há fases disponíveis para esta turma.", "warning");
          disableGame();
          return;
        }

        const requestedId = options.phaseId ?? readCurrentPhaseId(payload);
        currentPhase =
          phases.find((phase) => String(phase.id) === String(requestedId) && phase.state !== "bloqueada") ||
          phases.find((phase) => phase.state === "atual") ||
          phases.find((phase) => phase.state !== "bloqueada") ||
          phases[0];
        selectPhase(currentPhase.id, { keepFeedback: true, force: true });
        renderProgress();
        if (!options.quiet) setFeedback("Monte o programa e leve o robô até a bandeira!", "info");
      } catch (error) {
        if (error.isAuthError) return;
        currentPhase = null;
        renderAll();
        setFeedback(`${error.message} Atualize a página para tentar novamente.`, "error");
        disableGame();
      } finally {
        setLoading(false);
      }
    }

    function setLoading(value) {
      if (!elements.loading) return;
      elements.loading.hidden = !value;
      elements.loading.style.display = value ? "" : "none";
      elements.loading.classList.toggle("is-hidden", !value);
      elements.loading.setAttribute("aria-hidden", String(!value));
    }

    function disableGame() {
      [elements.run, elements.pause, elements.clear, elements.reset].forEach((button) => {
        if (button) button.disabled = true;
      });
    }

    function renderAll() {
      renderPhaseList();
      renderPhaseDetails();
      renderGrid();
      renderProgram();
      renderProgress();
    }

    function renderPhaseList() {
      if (!elements.phaseList) return;
      elements.phaseList.replaceChildren();
      elements.phaseList.setAttribute("role", "navigation");
      elements.phaseList.setAttribute("aria-label", "Fases do jogo");

      phases.forEach((phase, index) => {
        const button = document.createElement("button");
        const isCurrent = currentPhase && String(currentPhase.id) === String(phase.id);
        button.type = "button";
        button.className = `phase-button phase-item ${phase.state}`;
        button.dataset.phaseId = String(phase.id);
        button.disabled = phase.state === "bloqueada";
        button.setAttribute("aria-current", isCurrent ? "step" : "false");
        button.classList.toggle("is-active", Boolean(isCurrent));
        button.classList.toggle("is-current", Boolean(isCurrent));
        button.classList.toggle("is-locked", phase.state === "bloqueada");
        button.classList.toggle("is-completed", phase.state === "concluida");
        button.classList.toggle("is-complete", phase.state === "concluida");

        const number = document.createElement("span");
        number.className = "phase-status";
        const numberValue = document.createElement("span");
        numberValue.textContent = phase.state === "concluida" ? "✓" : String(index + 1);
        number.append(numberValue);

        const copy = document.createElement("span");
        copy.className = "phase-copy phase-info";
        const title = document.createElement("strong");
        title.textContent = phase.title;
        const state = document.createElement("small");
        state.className = "phase-state";
        state.textContent =
          phase.state === "bloqueada"
            ? "Bloqueada"
            : phase.state === "concluida"
              ? "Concluída"
              : isCurrent
                ? "Jogando agora"
                : "Disponível";
        copy.append(title, state);
        button.append(number, copy);
        elements.phaseList.append(button);
      });
      setText(elements.phaseTotal, phases.length);
    }

    function renderPhaseDetails() {
      if (!currentPhase) {
        setText(elements.title, "Nenhuma fase disponível");
        setText(elements.description, "Aguarde o professor liberar uma atividade.");
        setText(elements.hint, "");
        elements.blockLimits.forEach((element) => setText(element, 0));
        return;
      }
      setText(elements.title, currentPhase.title);
      setText(elements.description, currentPhase.description);
      setText(elements.hint, currentPhase.hint);
      setText(elements.phaseNumber, currentPhase.index + 1);
      setText(
        elements.phaseDifficulty,
        currentPhase.index < 1 ? "Primeiros passos" : currentPhase.index < 3 ? "Em evolução" : "Novo desafio",
      );
      elements.blockLimits.forEach((element) => setText(element, currentPhase.limit));
    }

    function renderGrid() {
      if (!elements.grid) return;
      elements.grid.replaceChildren();
      if (!currentPhase) return;

      elements.grid.style.setProperty("--grid-columns", String(currentPhase.cols));
      elements.grid.style.setProperty("--grid-rows", String(currentPhase.rows));
      elements.grid.dataset.rows = String(currentPhase.rows);
      elements.grid.dataset.cols = String(currentPhase.cols);
      elements.grid.setAttribute("role", "grid");
      elements.grid.setAttribute(
        "aria-label",
        `Mapa da ${currentPhase.title}, com ${currentPhase.rows} linhas e ${currentPhase.cols} colunas`,
      );

      for (let row = 0; row < currentPhase.rows; row += 1) {
        for (let col = 0; col < currentPhase.cols; col += 1) {
          const cell = document.createElement("div");
          const key = `${row}:${col}`;
          const isWall = currentPhase.wallSet.has(key);
          const isFlag = row === currentPhase.flag.row && col === currentPhase.flag.col;
          const isSpawn = row === currentPhase.spawn.row && col === currentPhase.spawn.col;
          cell.className = "grid-cell game-cell";
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.setAttribute("role", "gridcell");
          cell.classList.toggle("is-wall", isWall);
          cell.classList.toggle("wall-cell", isWall);
          cell.classList.toggle("is-goal", isFlag);
          cell.classList.toggle("is-spawn", isSpawn);

          const labels = [`linha ${row + 1}, coluna ${col + 1}`];
          if (isWall) labels.push("parede");
          if (isFlag) labels.push("bandeira de chegada");
          if (isSpawn) labels.push("ponto de partida");
          cell.setAttribute("aria-label", labels.join(", "));

          if (isWall) {
            const wall = document.createElement("span");
            wall.className = "wall-block";
            wall.setAttribute("aria-hidden", "true");
            for (let brick = 0; brick < 6; brick += 1) wall.append(document.createElement("i"));
            cell.append(wall);
          }
          if (isSpawn) {
            const spawn = document.createElement("span");
            spawn.className = "spawn-marker";
            spawn.textContent = "INÍCIO";
            spawn.setAttribute("aria-hidden", "true");
            cell.append(spawn);
          }
          if (isFlag) {
            const flag = document.createElement("span");
            flag.className = "goal-flag";
            flag.innerHTML =
              '<svg viewBox="0 0 48 58" fill="none"><path d="M11 52V5" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path><path d="M14 7h26L33 18l7 11H14V7Z" fill="currentColor"></path><path d="M5 53h18" stroke="currentColor" stroke-width="5" stroke-linecap="round"></path></svg>';
            flag.setAttribute("aria-hidden", "true");
            cell.append(flag);
          }
          elements.grid.append(cell);
        }
      }
      placeRobot();
    }

    function mascotImageAt(frame = 0) {
      if (!mascotImages.length) return "";
      const phaseOffset = currentPhase?.index ?? 0;
      return mascotImages[(phaseOffset + frame) % mascotImages.length];
    }

    function updateMascot(frame = 0) {
      const source = mascotImageAt(frame);
      if (!elements.mascot || !source) return;
      const image = elements.mascot.matches("img") ? elements.mascot : elements.mascot.querySelector("img");
      if (image) image.src = source;
    }

    function placeRobot(frame = 0) {
      if (!elements.grid || !currentPhase) return;
      elements.grid.querySelectorAll(".game-robot, .robot-token").forEach((element) => element.remove());
      elements.grid.querySelectorAll(".grid-cell.is-current").forEach((element) => element.classList.remove("is-current"));
      const cell = elements.grid.querySelector(
        `.grid-cell[data-row="${robot.row}"][data-col="${robot.col}"]`,
      );
      if (!cell) return;
      cell.classList.add("is-current", "is-visited");

      const source = mascotImageAt(frame);
      const token = document.createElement("span");
      token.className = "game-robot robot-token";
      token.dataset.direction = robot.direction;
      token.setAttribute("role", "img");
      token.setAttribute(
        "aria-label",
        `Robô na linha ${robot.row + 1}, coluna ${robot.col + 1}, olhando para ${directionLabels[robot.direction]}`,
      );
      if (source) {
        const image = document.createElement("img");
        image.src = source;
        image.alt = "";
        image.draggable = false;
        image.className = "robot-image robot-piece";
        if (frame > 0) image.classList.add("is-moving");
        token.append(image);
      } else {
        const fallback = document.createElement("span");
        fallback.className = "robot-fallback";
        fallback.textContent = "🤖";
        fallback.setAttribute("aria-hidden", "true");
        token.append(fallback);
      }
      const pointer = document.createElement("span");
      pointer.className = "robot-direction";
      pointer.textContent = directionSymbols[robot.direction];
      pointer.setAttribute("aria-hidden", "true");
      token.append(pointer);
      cell.append(token);
      updateMascot(frame);
    }

    function createProgramBlock(item, index) {
      const detail = commandDetails[item.command];
      const uiCommand = {
        avancar: "forward",
        virar_esquerda: "turn-left",
        virar_direita: "turn-right",
      }[item.command];
      const block = document.createElement("li");
      block.className = `program-block program-item block-${uiCommand}`;
      block.dataset.blockId = String(item.id);
      block.dataset.command = uiCommand;
      block.dataset.backendCommand = item.command;
      block.dataset.programIndex = String(index);
      block.draggable = !running;
      block.tabIndex = 0;
      block.setAttribute("aria-label", `Bloco ${index + 1}: ${detail.label}`);

      const dragDots = document.createElement("span");
      dragDots.className = "drag-dots";
      dragDots.setAttribute("aria-hidden", "true");
      for (let dot = 0; dot < 6; dot += 1) dragDots.append(document.createElement("i"));

      const symbol = document.createElement("span");
      symbol.className = "program-block-symbol block-icon";
      symbol.textContent = detail.symbol;
      symbol.setAttribute("aria-hidden", "true");

      const copy = document.createElement("span");
      copy.className = "program-block-label block-copy";
      const label = document.createElement("strong");
      label.textContent = detail.label;
      const explanation = document.createElement("small");
      explanation.textContent = item.command === "avancar" ? "1 casa" : "90 graus";
      copy.append(label, explanation);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-program-block remove-block block-remove";
      remove.dataset.removeBlock = String(item.id);
      remove.disabled = running;
      remove.setAttribute("aria-label", `Remover bloco ${index + 1}: ${detail.label}`);
      remove.textContent = "×";

      block.append(dragDots, symbol, copy, remove);
      return block;
    }

    function renderProgram() {
      if (elements.program) {
        elements.program.replaceChildren();
        elements.program.setAttribute("role", "list");
        elements.program.setAttribute("aria-label", "Programa do robô");
        if (!program.length && !elements.programEmpty) {
          const empty = document.createElement("p");
          empty.className = "program-empty";
          empty.dataset.programEmpty = "";
          empty.textContent = "Clique ou arraste os blocos para montar o programa.";
          elements.program.append(empty);
        } else {
          program.forEach((item, index) => elements.program.append(createProgramBlock(item, index)));
        }
      }
      if (elements.programEmpty) elements.programEmpty.hidden = program.length > 0;
      elements.programDropzone?.classList.toggle("has-blocks", program.length > 0);
      setText(elements.blockCount, program.length);
      updateControls();
    }

    function updateControls() {
      const hasPhase = Boolean(currentPhase);
      const locked = !hasPhase || currentPhase.state === "bloqueada";
      if (elements.run) elements.run.disabled = running || locked || program.length === 0;
      if (elements.clear) elements.clear.disabled = running || program.length === 0;
      if (elements.reset) elements.reset.disabled = !hasPhase;
      if (elements.pause) {
        elements.pause.disabled = !running;
        setButtonLabel(elements.pause, paused ? "Continuar" : initialPauseLabel);
        elements.pause.setAttribute("aria-pressed", String(paused));
      }
      if (elements.palette) {
        elements.palette.querySelectorAll("[data-command]").forEach((block) => {
          if ("disabled" in block) block.disabled = running || locked;
          block.setAttribute("aria-disabled", String(running || locked));
          block.draggable = !running && !locked;
        });
      }
      if (elements.run) setButtonLabel(elements.run, running ? "Executando..." : initialRunLabel);
    }

    function setButtonLabel(button, label) {
      if (!button) return;
      const copy = button.querySelector("span:not([aria-hidden='true'])");
      if (copy) copy.textContent = label;
      else button.textContent = label;
    }

    function renderProgress() {
      if (elements.progressFill) {
        elements.progressFill.style.width = `${progress.percent}%`;
        elements.progressFill.setAttribute("aria-valuemin", "0");
        elements.progressFill.setAttribute("aria-valuemax", "100");
        elements.progressFill.setAttribute("aria-valuenow", String(progress.percent));
      }
      setText(elements.progressText, `${progress.completed} de ${progress.total} fases · ${progress.percent}%`);
    }

    function selectPhase(id, options = {}) {
      const phase = phases.find((candidate) => String(candidate.id) === String(id));
      if (!phase) return;
      if (phase.state === "bloqueada" && !options.force) {
        setFeedback("Essa fase ainda está bloqueada. Conclua a fase anterior primeiro.", "warning");
        return;
      }
      stopExecution();
      currentPhase = phase;
      program = [];
      robot = { row: phase.spawn.row, col: phase.spawn.col, direction: phase.direction };
      nextPhaseId = null;
      closeSuccess();
      renderAll();
      updateMascot();
      if (!options.keepFeedback) {
        setFeedback(
          phase.state === "concluida"
            ? "Você já concluiu esta fase, mas pode jogar novamente."
            : "Fase pronta. Monte seu programa!",
          phase.state === "concluida" ? "success" : "info",
        );
      }
    }

    function addCommand(value, insertionIndex = program.length) {
      const command = normalizeCommand(value);
      if (!command || !currentPhase || running) return false;
      if (currentPhase.state === "bloqueada") {
        setFeedback("Conclua a fase anterior para usar os blocos aqui.", "warning");
        return false;
      }
      if (program.length >= currentPhase.limit) {
        setFeedback(`O limite desta fase é de ${currentPhase.limit} blocos.`, "warning");
        return false;
      }
      const index = clamp(toInteger(insertionIndex, program.length), 0, program.length);
      program.splice(index, 0, { id: nextBlockId, command });
      nextBlockId += 1;
      renderProgram();
      setFeedback(`${commandDetails[command].label} adicionado na posição ${index + 1}.`, "info");
      return true;
    }

    function removeBlock(id) {
      if (running) return;
      const index = program.findIndex((item) => String(item.id) === String(id));
      if (index < 0) return;
      const [removed] = program.splice(index, 1);
      renderProgram();
      setFeedback(`${commandDetails[removed.command].label} removido.`, "info");
      const next = elements.program?.querySelector(`[data-program-index="${Math.min(index, program.length - 1)}"]`);
      next?.focus();
    }

    function moveBlock(fromIndex, toIndex) {
      if (running || fromIndex < 0 || fromIndex >= program.length) return;
      let destination = clamp(toInteger(toIndex), 0, program.length);
      const [item] = program.splice(fromIndex, 1);
      if (destination > fromIndex) destination -= 1;
      program.splice(destination, 0, item);
      renderProgram();
      const moved = elements.program?.querySelector(`[data-block-id="${item.id}"]`);
      moved?.focus();
      setFeedback(`Bloco movido para a posição ${destination + 1}.`, "info");
    }

    function getDropIndex(event) {
      if (!elements.program) return program.length;
      const blocks = [...elements.program.querySelectorAll(".program-block")];
      for (let index = 0; index < blocks.length; index += 1) {
        const rect = blocks[index].getBoundingClientRect();
        if (event.clientY < rect.top + rect.height / 2) return index;
      }
      return blocks.length;
    }

    function resetRobot(message = "Robô de volta ao ponto de partida.") {
      if (!currentPhase) return;
      stopExecution();
      robot = {
        row: currentPhase.spawn.row,
        col: currentPhase.spawn.col,
        direction: currentPhase.direction,
      };
      renderGrid();
      elements.program?.querySelectorAll(".is-running, .is-active, .has-error").forEach((block) => {
        block.classList.remove("is-running", "is-active", "has-error");
      });
      setFeedback(message, "info");
    }

    function stopExecution() {
      runVersion += 1;
      running = false;
      paused = false;
      pauseWaiters.splice(0).forEach((resolve) => resolve());
      elements.grid?.classList.remove("is-running", "is-success", "has-error");
      elements.program?.querySelectorAll(".is-running, .is-active").forEach((block) => {
        block.classList.remove("is-running", "is-active");
      });
      elements.program?.removeAttribute("aria-busy");
      elements.grid?.removeAttribute("aria-busy");
      updateControls();
    }

    function setRunning(value) {
      running = value;
      if (value) {
        elements.grid?.classList.add("is-running");
        elements.program?.setAttribute("aria-busy", "true");
        elements.grid?.setAttribute("aria-busy", "true");
      } else {
        elements.grid?.classList.remove("is-running");
        elements.program?.removeAttribute("aria-busy");
        elements.grid?.removeAttribute("aria-busy");
      }
      updateControls();
    }

    function sleep(milliseconds, version) {
      return new Promise((resolve) => {
        window.setTimeout(() => resolve(version === runVersion), milliseconds);
      });
    }

    async function waitWhilePaused(version) {
      while (paused && version === runVersion) {
        await new Promise((resolve) => pauseWaiters.push(resolve));
      }
      return version === runVersion;
    }

    function turn(direction, amount) {
      const index = directions.indexOf(direction);
      return directions[(index + amount + directions.length) % directions.length];
    }

    function atGoal() {
      return robot.row === currentPhase.flag.row && robot.col === currentPhase.flag.col;
    }

    function executeCommand(command) {
      if (command === "virar_esquerda") {
        robot.direction = turn(robot.direction, -1);
        return { ok: true };
      }
      if (command === "virar_direita") {
        robot.direction = turn(robot.direction, 1);
        return { ok: true };
      }

      const [rowDelta, colDelta] = directionDelta[robot.direction];
      const next = { row: robot.row + rowDelta, col: robot.col + colDelta };
      const outside =
        next.row < 0 ||
        next.row >= currentPhase.rows ||
        next.col < 0 ||
        next.col >= currentPhase.cols;
      if (outside) return { ok: false, reason: "O robô tentou sair do mapa." };
      if (currentPhase.wallSet.has(`${next.row}:${next.col}`)) {
        return { ok: false, reason: "O robô bateu em uma parede." };
      }
      robot.row = next.row;
      robot.col = next.col;
      return { ok: true };
    }

    async function runProgram() {
      if (running || !currentPhase) return;
      if (!program.length) {
        setFeedback("Adicione pelo menos um bloco antes de executar.", "warning");
        return;
      }
      if (program.length > currentPhase.limit) {
        setFeedback(`Use no máximo ${currentPhase.limit} blocos nesta fase.`, "error");
        return;
      }

      stopExecution();
      const version = runVersion;
      setRunning(true);
      robot = {
        row: currentPhase.spawn.row,
        col: currentPhase.spawn.col,
        direction: currentPhase.direction,
      };
      elements.grid?.classList.remove("is-success", "has-error");
      elements.grid?.querySelectorAll(".grid-cell").forEach((cell) => {
        cell.classList.remove("is-current", "is-visited", "is-crash", "is-success");
      });
      elements.program?.querySelectorAll(".is-running, .is-active, .has-error").forEach((block) => {
        block.classList.remove("is-running", "is-active", "has-error");
      });
      placeRobot();
      setFeedback("Executando o programa...", "running");
      if (!(await sleep(280, version)) || !(await waitWhilePaused(version))) return;

      for (let index = 0; index < program.length; index += 1) {
        if (version !== runVersion || !(await waitWhilePaused(version))) return;
        const block = elements.program?.querySelector(`[data-program-index="${index}"]`);
        const previousBlock = elements.program?.querySelector(".is-running, .is-active");
        previousBlock?.classList.remove("is-running", "is-active");
        block?.classList.add("is-running", "is-active");
        block?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

        const result = executeCommand(program[index].command);
        placeRobot(index + 1);
        if (!result.ok) {
          block?.classList.add("has-error");
          elements.grid?.classList.add("has-error");
          elements.grid?.querySelector(".grid-cell.is-current")?.classList.add("is-crash");
          elements.grid?.querySelector(".game-robot")?.classList.add("is-crashed");
          elements.grid?.querySelector(".game-robot .robot-image")?.classList.add("is-crashed");
          setFeedback(`${result.reason} Ajuste os blocos e tente novamente.`, "error");
          setRunning(false);
          return;
        }
        if (atGoal()) {
          if (!(await sleep(420, version))) return;
          elements.program?.querySelector(".is-running, .is-active")?.classList.remove("is-running", "is-active");
          await completePhase(version);
          return;
        }
        if (!(await sleep(520, version))) return;
      }

      elements.program?.querySelector(".is-running, .is-active")?.classList.remove("is-running", "is-active");
      if (!atGoal()) {
        setFeedback("O robô ainda não chegou à bandeira. Revise a sequência de blocos.", "warning");
        setRunning(false);
        return;
      }

      await completePhase(version);
    }

    async function completePhase(version) {
      if (version !== runVersion) return;
      setFeedback("Objetivo alcançado! Salvando seu progresso...", "success");
      elements.grid?.classList.add("is-success");
      elements.grid?.querySelector(".grid-cell.is-current")?.classList.add("is-success");
      try {
        if (!currentPhase.completionUrl) {
          throw new Error("A fase não possui um endereço para salvar o progresso");
        }
        const result = await apiRequest(currentPhase.completionUrl, {
          method: "POST",
          body: JSON.stringify({ comandos: program.map((item) => item.command) }),
        });
        if (version !== runVersion) return;
        const simulation = result.resultado ?? result.result ?? result;
        const success =
          result.sucesso ??
          result.success ??
          result.concluida ??
          result.completed ??
          simulation.sucesso ??
          simulation.success ??
          true;
        if (!success) {
          applyServerRobotState(result.resultado ?? result.result ?? result);
          setFeedback(result.error || result.erro || result.message || "Essa sequência ainda não conclui a fase.", "warning");
          elements.grid?.classList.remove("is-success");
          setRunning(false);
          return;
        }
        applyCompletion(result);
        setRunning(false);
        setFeedback(result.message || result.mensagem || "Fase concluída! Excelente trabalho!", "success");
        openSuccess(result);
      } catch (error) {
        if (error.isAuthError) return;
        elements.grid?.classList.remove("is-success");
        const message =
          error.status === 409
            ? `${error.message}. A lista de fases será atualizada.`
            : error.payload?.limite_blocos
              ? `${error.message}. Use no máximo ${error.payload.limite_blocos} blocos.`
              : `${error.message}. Seu programa continua aqui para você tentar novamente.`;
        setFeedback(message, error.status === 409 ? "warning" : "error");
        setRunning(false);
        if (error.status === 409) loadGame({ quiet: true, phaseId: currentPhase?.id });
      }
    }

    function applyServerRobotState(result) {
      const position =
        result.posicao_final ?? result.posição_final ?? result.final_position ?? result.posicao ?? result.position;
      if (position) {
        const coordinate = normalizeCoordinate(position);
        robot.row = clamp(coordinate.row, 0, currentPhase.rows - 1);
        robot.col = clamp(coordinate.col, 0, currentPhase.cols - 1);
        const serverDirection =
          (typeof position === "object" && !Array.isArray(position)
            ? position.orientacao ?? position.direcao ?? position.direction
            : null) ??
          result.orientacao_final ??
          result.direcao_final ??
          result.final_direction;
        if (serverDirection) robot.direction = normalizeDirection(serverDirection);
        placeRobot();
      }
    }

    function applyCompletion(result) {
      applyServerRobotState(result.resultado ?? result.result ?? result);
      const finishedId = currentPhase.id;
      const returnedPhases = result.fases ?? result.phases;
      if (Array.isArray(returnedPhases)) {
        phases = returnedPhases.map(normalizePhase);
        currentPhase = phases.find((phase) => String(phase.id) === String(finishedId)) || currentPhase;
      } else {
        currentPhase.state = "concluida";
        const index = phases.findIndex((phase) => String(phase.id) === String(finishedId));
        const following = phases[index + 1];
        if (following?.state === "bloqueada") following.state = "atual";
      }

      const returnedProgress = result.progresso ?? result.progress;
      if (returnedProgress) {
        progress = normalizeProgress(returnedProgress, phases.length);
      } else {
        const completed = phases.filter((phase) => phase.state === "concluida").length;
        progress = normalizeProgress({ completed, total: phases.length }, phases.length);
      }

      const explicitNext =
        result.proxima_fase ??
        result.next_phase ??
        result.nextPhase ??
        result.fase_desbloqueada ??
        result.fase_atual;
      const explicitNextId = explicitNext && typeof explicitNext === "object" ? explicitNext.id : explicitNext;
      const currentIndex = phases.findIndex((phase) => String(phase.id) === String(finishedId));
      const next =
        phases.find((phase) => String(phase.id) === String(explicitNextId) && phase.state !== "bloqueada") ||
        phases.slice(currentIndex + 1).find((phase) => phase.state !== "bloqueada");
      nextPhaseId = next?.id ?? null;
      renderPhaseList();
      renderProgress();
    }

    function openSuccess(result) {
      if (!elements.success) return;
      setText(elements.successTitle, result.titulo ?? "Fase concluída!");
      setText(
        elements.successMessage,
        result.message ?? result.mensagem ?? "Você guiou o robô até a bandeira.",
      );
      const simulation = result.resultado ?? result.result ?? result;
      const movements =
        simulation.blocos_executados ??
        (Array.isArray(simulation.movimentos) ? simulation.movimentos.length : simulation.movimentos) ??
        simulation.moves ??
        program.length;
      setText(elements.successBlocks, movements);
      if (!elements.successBlocks && elements.successStats) {
        elements.successStats.setAttribute(
          "aria-label",
          `${movements} ${Number(movements) === 1 ? "movimento" : "movimentos"}`,
        );
      }
      const efficiency = currentPhase ? Number(movements) / currentPhase.limit : 1;
      setText(elements.successStars, efficiency <= 0.6 ? "★★★" : efficiency <= 0.85 ? "★★☆" : "★☆☆");
      if (elements.successMascot && mascotImageAt(2)) elements.successMascot.src = mascotImageAt(2);
      if (elements.nextLevel) {
        elements.nextLevel.hidden = nextPhaseId === null;
        elements.nextLevel.disabled = nextPhaseId === null;
        setButtonLabel(
          elements.nextLevel,
          nextPhaseId === null ? "Todas as fases concluídas" : "Próxima fase",
        );
      }
      focusBeforeModal = document.activeElement;
      elements.success.hidden = false;
      elements.success.classList.add("is-open");
      elements.success.setAttribute("aria-hidden", "false");
      if (typeof elements.success.showModal === "function" && !elements.success.open) {
        elements.success.showModal();
      }
      const focusTarget = elements.success.querySelector("button:not([disabled]):not([hidden]), a[href]");
      focusTarget?.focus();
    }

    function closeSuccess() {
      if (!elements.success) return;
      if (typeof elements.success.close === "function" && elements.success.open) elements.success.close();
      elements.success.hidden = true;
      elements.success.classList.remove("is-open");
      elements.success.setAttribute("aria-hidden", "true");
      if (focusBeforeModal instanceof HTMLElement && focusBeforeModal.isConnected) focusBeforeModal.focus();
      focusBeforeModal = null;
    }

    function clearProgram() {
      if (running || !program.length) return;
      program = [];
      renderProgram();
      resetRobot("Programa limpo. Escolha novos blocos para tentar outra estratégia.");
    }

    function togglePause() {
      if (!running) return;
      paused = !paused;
      if (!paused) pauseWaiters.splice(0).forEach((resolve) => resolve());
      updateControls();
      setFeedback(paused ? "Execução pausada." : "Execução retomada.", "info");
    }

    function handlePaletteClick(event) {
      const block = event.target.closest("[data-command]");
      if (!block || !elements.palette?.contains(block)) return;
      addCommand(block.dataset.command);
    }

    function handlePaletteKeydown(event) {
      const block = event.target.closest("[data-command]");
      if (!block || !elements.palette?.contains(block) || block.tagName === "BUTTON") return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        addCommand(block.dataset.command);
      }
    }

    function handleProgramClick(event) {
      const remove = event.target.closest("[data-remove-block]");
      if (remove) removeBlock(remove.dataset.removeBlock);
    }

    function handleProgramKeydown(event) {
      const block = event.target.closest(".program-block");
      if (!block || event.target.closest("button")) return;
      const index = toInteger(block.dataset.programIndex, -1);
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeBlock(block.dataset.blockId);
      } else if ((event.altKey || event.ctrlKey) && event.key === "ArrowUp") {
        event.preventDefault();
        moveBlock(index, Math.max(0, index - 1));
      } else if ((event.altKey || event.ctrlKey) && event.key === "ArrowDown") {
        event.preventDefault();
        moveBlock(index, Math.min(program.length, index + 2));
      }
    }

    function handleDragStart(event) {
      const paletteBlock = event.target.closest("[data-command]");
      const programBlock = event.target.closest(".program-block");
      if (running) {
        event.preventDefault();
        return;
      }
      if (paletteBlock && elements.palette?.contains(paletteBlock)) {
        const command = normalizeCommand(paletteBlock.dataset.command);
        if (!command) return;
        draggedBlock = { type: "palette", command };
        event.dataTransfer?.setData("text/plain", `palette:${command}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
        paletteBlock.classList.add("is-dragging");
      } else if (programBlock) {
        const index = toInteger(programBlock.dataset.programIndex, -1);
        draggedBlock = { type: "program", index };
        event.dataTransfer?.setData("text/plain", `program:${index}`);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        programBlock.classList.add("is-dragging");
      }
    }

    function handleDragOver(event) {
      if (running || !currentPhase) return;
      event.preventDefault();
      const zone = elements.programDropzone || elements.program;
      zone?.classList.add("is-drag-over");
      if (event.dataTransfer) event.dataTransfer.dropEffect = draggedBlock?.type === "program" ? "move" : "copy";
    }

    function handleDrop(event) {
      if (running || !currentPhase) return;
      event.preventDefault();
      const zone = elements.programDropzone || elements.program;
      zone?.classList.remove("is-drag-over");
      const text = event.dataTransfer?.getData("text/plain") || "";
      let payload = draggedBlock;
      if (!payload && text.startsWith("palette:")) payload = { type: "palette", command: text.slice(8) };
      if (!payload && text.startsWith("program:")) payload = { type: "program", index: toInteger(text.slice(8), -1) };
      const index = getDropIndex(event);
      if (payload?.type === "palette") addCommand(payload.command, index);
      if (payload?.type === "program") moveBlock(payload.index, index);
      draggedBlock = null;
    }

    function handleDragEnd() {
      draggedBlock = null;
      document.querySelectorAll(".is-dragging").forEach((block) => block.classList.remove("is-dragging"));
      (elements.programDropzone || elements.program)?.classList.remove("is-drag-over");
    }

    function bindEvents() {
      elements.phaseList?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-phase-id]");
        if (button && !button.disabled) selectPhase(button.dataset.phaseId);
      });
      elements.palette?.addEventListener("click", handlePaletteClick);
      elements.palette?.addEventListener("keydown", handlePaletteKeydown);
      elements.program?.addEventListener("click", handleProgramClick);
      elements.program?.addEventListener("keydown", handleProgramKeydown);
      elements.run?.addEventListener("click", runProgram);
      elements.pause?.addEventListener("click", togglePause);
      elements.clear?.addEventListener("click", clearProgram);
      elements.reset?.addEventListener("click", () => resetRobot());

      document.addEventListener("dragstart", handleDragStart);
      document.addEventListener("dragend", handleDragEnd);
      const dropzone = elements.programDropzone || elements.program;
      dropzone?.addEventListener("dragover", handleDragOver);
      dropzone?.addEventListener("dragleave", (event) => {
        if (!dropzone.contains(event.relatedTarget)) dropzone.classList.remove("is-drag-over");
      });
      dropzone?.addEventListener("drop", handleDrop);

      elements.nextLevel?.addEventListener("click", () => {
        const target = nextPhaseId;
        closeSuccess();
        if (target !== null) selectPhase(target);
      });
      elements.replayLevel?.addEventListener("click", () => {
        closeSuccess();
        resetRobot("Fase reiniciada. Seu programa foi mantido para você testar novamente.");
      });
      elements.success
        ?.querySelectorAll("[data-close-success], [data-close-modal], #close-success")
        .forEach((button) => {
        button.addEventListener("click", closeSuccess);
      });
      elements.success?.addEventListener("click", (event) => {
        if (event.target === elements.success && !elements.success.matches("dialog")) closeSuccess();
      });
      elements.success?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeSuccess();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = [
          ...elements.success.querySelectorAll(
            'button:not([disabled]):not([hidden]), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => !element.closest("[hidden]"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });

      document.querySelectorAll("#student-logout, #game-logout, [data-game-logout]").forEach((logout) => {
        logout.addEventListener("click", async (event) => {
          event.preventDefault();
          try {
            if (page.dataset.logoutUrl) {
              await fetch(page.dataset.logoutUrl, { method: "POST", headers: authHeaders() });
            }
          } finally {
            localStorage.removeItem("robooteam-active-user");
            localStorage.removeItem("robooteam-token");
            sessionStorage.removeItem("robooteam-active-user");
            sessionStorage.removeItem("robooteam-token");
            redirectToLogin();
          }
        });
      });
    }

    bindEvents();
    updateControls();
    loadGame();
  }

  function readMascotImages(page, scriptUrl) {
    const images = [];
    for (let index = 1; index <= 12; index += 1) {
      const source = page.getAttribute(`data-mascot-${index}`) || page.getAttribute(`data-robot-${index}`);
      if (source) images.push(source);
    }

    const packed = page.dataset.mascotImages || page.dataset.robotImages;
    if (packed) {
      try {
        const parsed = JSON.parse(packed);
        if (Array.isArray(parsed)) parsed.filter(Boolean).forEach((source) => images.push(String(source)));
      } catch {
        packed
          .split(",")
          .map((source) => source.trim())
          .filter(Boolean)
          .forEach((source) => images.push(source));
      }
    }

    if (!images.length && scriptUrl) {
      for (let index = 1; index <= 6; index += 1) {
        images.push(new URL(`img/${index}.png`, scriptUrl).href);
      }
    }
    return [...new Set(images)];
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startGame, { once: true });
  } else {
    startGame();
  }
})();

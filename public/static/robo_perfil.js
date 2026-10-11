/* Robô personalizado do aluno (Oficina do Robô): dados e desenho, compartilhados
   entre o painel do aluno e a Arena. A escolha fica salva neste navegador. */
(() => {
  const POSES = [
    { id: 1, label: "Oi!", mood: "Acenando para você!" },
    { id: 3, label: "Feliz", mood: "Super feliz em te ver!" },
    { id: 4, label: "Aventura", mood: "Pronto para a aventura!" },
    { id: 5, label: "Zen", mood: "Calmo e concentrado..." },
    { id: 2, label: "Pensativo", mood: "Hmm... pensando numa ideia!" },
    { id: 6, label: "Focado", mood: "Focado na missão!" },
  ];
  const COLORS = [
    { id: "galaxia", label: "Galáxia", hue: 0, sat: 1, swatch: "#6D5DFC", glow: "rgba(109,93,252,0.6)" },
    { id: "chiclete", label: "Chiclete", hue: 75, sat: 1.1, swatch: "#E056C9", glow: "rgba(224,86,201,0.55)" },
    { id: "foguete", label: "Foguete", hue: 120, sat: 1.15, swatch: "#FF5A6E", glow: "rgba(255,90,110,0.55)" },
    { id: "sol", label: "Sol", hue: 160, sat: 1.2, swatch: "#FFA940", glow: "rgba(255,169,64,0.55)" },
    { id: "floresta", label: "Floresta", hue: 240, sat: 1.05, swatch: "#33D17A", glow: "rgba(51,209,122,0.5)" },
    { id: "oceano", label: "Oceano", hue: 310, sat: 1.05, swatch: "#22C3E6", glow: "rgba(34,195,230,0.55)" },
  ];
  // icon: desenho do sprite (templates/_icones.html) usado nos botões da Oficina.
  // file: o robô já vestindo o acessório, em img/<pose>_variantes/<pose>_<file>.webp.
  // layer: tem também <pose>_<file>_cor.webp, só com as partes douradas/rosa, que vão
  // por cima sem o filtro de cor (assim a coroa continua dourada num robô verde).
  const ACCESSORIES = [
    { id: "nenhum", label: "Nenhum", icon: "" },
    { id: "coroa", label: "Coroa", icon: "acc-coroa", file: "coroa", layer: true },
    { id: "cartola", label: "Cartola", icon: "acc-cartola", file: "cartola" },
    { id: "laco", label: "Laço", icon: "acc-laco", file: "laco", layer: true },
    { id: "capelo", label: "Capelo", icon: "acc-capelo", file: "chapeu", layer: true },
    { id: "bone", label: "Boné", icon: "acc-bone", file: "bone" },
  ];
  const DEFAULT_ROBOT = { name: "Robo-01", pose: 1, color: "galaxia", acc: "nenhum" };

  const findPose = (id) => POSES.find((pose) => pose.id === Number(id)) || POSES[0];
  const findColor = (id) => COLORS.find((color) => color.id === id) || COLORS[0];
  const findAcc = (id) => ACCESSORIES.find((acc) => acc.id === id) || ACCESSORIES[0];
  const storageKey = (studentId) => `robooteam-robot-${studentId || "aluno"}`;

  function sanitize(robot) {
    return {
      name: String(robot.name || "").trim().slice(0, 16) || DEFAULT_ROBOT.name,
      pose: findPose(robot.pose).id,
      color: findColor(robot.color).id,
      acc: findAcc(robot.acc).id,
    };
  }

  function load(studentId) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey(studentId)) || "null");
      if (saved && typeof saved === "object") return sanitize(saved);
    } catch {
      // armazenamento indisponível: segue com o robô padrão
    }
    return { ...DEFAULT_ROBOT };
  }

  function store(studentId, robot) {
    try {
      localStorage.setItem(storageKey(studentId), JSON.stringify(robot));
    } catch {
      // sem armazenamento, a escolha vale só até recarregar a página
    }
  }

  function accessoryHtml(acc) {
    return acc.icon ? `<svg aria-hidden="true" focusable="false"><use href="#i-${acc.icon}"></use></svg>` : "";
  }

  function replayClass(element, className, duration) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
  }

  // imagem do robô na pose: a normal ou a variante já com o acessório
  function imageSrc(poseId, acc, imgBase) {
    return acc.file ? `${imgBase}${poseId}_variantes/${poseId}_${acc.file}.webp` : `${imgBase}${poseId}.png`;
  }

  function layerSrc(poseId, acc, imgBase) {
    return acc.layer ? `${imgBase}${poseId}_variantes/${poseId}_${acc.file}_cor.webp` : "";
  }

  // baixa antes as variantes de uma pose (trocar de acessório na Oficina fica imediato)
  function preloadPose(poseId, imgBase) {
    ACCESSORIES.forEach((acc) => {
      [imageSrc(poseId, acc, imgBase), layerSrc(poseId, acc, imgBase)].filter(Boolean).forEach((src) => {
        new Image().src = src;
      });
    });
  }

  /* Pinta um elemento .robot-figure (img + .robot-acc). `imageId` troca só a pose
     (ex.: comemorando na Arena) mantendo cor e acessório do aluno. */
  function paintFigure(figure, robot, imgBase, { animateAcc = false, imageId = null } = {}) {
    if (!figure) return;
    const pose = findPose(imageId || robot.pose);
    const color = findColor(robot.color);
    const acc = findAcc(robot.acc);
    const img = figure.querySelector("img");
    const src = imageSrc(pose.id, acc, imgBase);
    if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);

    figure.style.setProperty("--robot-hue", `${color.hue}deg`);
    figure.style.setProperty("--robot-sat", color.sat);

    const accElement = figure.querySelector(".robot-acc");
    const layer = layerSrc(pose.id, acc, imgBase);
    if (accElement && accElement.dataset.layer !== layer) {
      accElement.dataset.layer = layer;
      accElement.innerHTML = layer ? `<img src="${layer}" alt="">` : "";
    }
    if (figure.dataset.acc !== acc.id) {
      const changed = Boolean(figure.dataset.acc);
      figure.dataset.acc = acc.id;
      if (animateAcc && changed && acc.file) replayClass(figure, "acc-pop", 450);
    }
  }

  window.RobooRobo = {
    POSES,
    COLORS,
    ACCESSORIES,
    DEFAULT_ROBOT,
    findPose,
    findColor,
    findAcc,
    storageKey,
    sanitize,
    load,
    store,
    accessoryHtml,
    replayClass,
    imageSrc,
    preloadPose,
    paintFigure,
  };
})();

/* Robô personalizado do aluno (Oficina do Robô): dados e desenho, compartilhados
   entre o painel do aluno e a Arena. A escolha fica salva neste navegador. */
(() => {
  // acc: ponto (em % da imagem) do topo da cabeça em cada pose, onde o acessório é encaixado
  const POSES = [
    { id: 1, label: "Oi!", mood: "Acenando para você!", acc: { x: 47, y: 19, rot: 3 } },
    { id: 3, label: "Feliz", mood: "Super feliz em te ver!", acc: { x: 51, y: 17.5, rot: -10 } },
    { id: 4, label: "Aventura", mood: "Pronto para a aventura!", acc: { x: 57, y: 18.5, rot: -6 } },
    { id: 5, label: "Zen", mood: "Calmo e concentrado...", acc: { x: 49, y: 23, rot: 0 } },
    { id: 2, label: "Pensativo", mood: "Hmm... pensando numa ideia!", acc: { x: 49, y: 19.5, rot: -8 } },
    { id: 6, label: "Focado", mood: "Focado na missão!", acc: { x: 55, y: 17, rot: 10 } },
  ];
  const COLORS = [
    { id: "galaxia", label: "Galáxia", hue: 0, sat: 1, swatch: "#6D5DFC", glow: "rgba(109,93,252,0.6)" },
    { id: "chiclete", label: "Chiclete", hue: 75, sat: 1.1, swatch: "#E056C9", glow: "rgba(224,86,201,0.55)" },
    { id: "foguete", label: "Foguete", hue: 120, sat: 1.15, swatch: "#FF5A6E", glow: "rgba(255,90,110,0.55)" },
    { id: "sol", label: "Sol", hue: 160, sat: 1.2, swatch: "#FFA940", glow: "rgba(255,169,64,0.55)" },
    { id: "floresta", label: "Floresta", hue: 240, sat: 1.05, swatch: "#33D17A", glow: "rgba(51,209,122,0.5)" },
    { id: "oceano", label: "Oceano", hue: 310, sat: 1.05, swatch: "#22C3E6", glow: "rgba(34,195,230,0.55)" },
  ];
  // icon: desenho colorido do sprite (templates/_icones.html)
  const ACCESSORIES = [
    { id: "nenhum", label: "Nenhum", icon: "" },
    { id: "coroa", label: "Coroa", icon: "acc-coroa" },
    { id: "cartola", label: "Cartola", icon: "acc-cartola" },
    { id: "laco", label: "Laço", icon: "acc-laco" },
    { id: "capelo", label: "Capelo", icon: "acc-capelo" },
    { id: "bone", label: "Boné", icon: "acc-bone" },
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

  /* Pinta um elemento .robot-figure (img + .robot-acc). `imageId` troca só a imagem
     (ex.: comemorando na Arena) mantendo cor e acessório do aluno. */
  function paintFigure(figure, robot, imgBase, { animateAcc = false, imageId = null } = {}) {
    if (!figure) return;
    const pose = findPose(imageId || robot.pose);
    const color = findColor(robot.color);
    const acc = findAcc(robot.acc);
    const img = figure.querySelector("img");
    const src = `${imgBase}${pose.id}.png`;
    if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);

    figure.style.setProperty("--robot-hue", `${color.hue}deg`);
    figure.style.setProperty("--robot-sat", color.sat);
    figure.style.setProperty("--acc-x", `${pose.acc.x}%`);
    figure.style.setProperty("--acc-y", `${pose.acc.y}%`);
    figure.style.setProperty("--acc-rot", `${pose.acc.rot}deg`);

    const accElement = figure.querySelector(".robot-acc");
    if (accElement && accElement.dataset.acc !== acc.id) {
      accElement.dataset.acc = acc.id;
      accElement.innerHTML = accessoryHtml(acc);
      if (animateAcc && acc.icon) replayClass(accElement, "pop", 450);
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
    paintFigure,
  };
})();

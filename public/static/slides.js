/* =========================================================================
   SLIDES DOS BLOCOS DE LEITURA (página da aula)
   Passar com os botões, com as bolinhas, com as setas do teclado ou deslizando
   o dedo; e ver em tela cheia. Cada slide só é baixado quando chega a vez dele
   (e o seguinte já vai carregando), para não pesar a internet da escola.
   ========================================================================= */
(() => {
  document.querySelectorAll("[data-slides]").forEach((carrossel) => {
    const slides = [...carrossel.querySelectorAll("[data-slide]")];
    const pontos = [...carrossel.querySelectorAll("[data-slide-dot]")];
    const contador = carrossel.querySelector("[data-slides-counter]");
    const anterior = carrossel.querySelector("[data-slides-prev]");
    const proximo = carrossel.querySelector("[data-slides-next]");
    const telaCheia = carrossel.querySelector("[data-slides-full]");
    const palco = carrossel.querySelector(".slides-stage");
    if (!slides.length) return;
    let atual = 0;

    function carregar(indice) {
      const slide = slides[indice];
      if (slide && !slide.getAttribute("src") && slide.dataset.src) slide.setAttribute("src", slide.dataset.src);
    }

    function mostrar(indice) {
      atual = Math.max(0, Math.min(indice, slides.length - 1));
      slides.forEach((slide, i) => slide.classList.toggle("is-active", i === atual));
      pontos.forEach((ponto, i) => {
        ponto.classList.toggle("is-active", i === atual);
        ponto.setAttribute("aria-current", i === atual ? "true" : "false");
      });
      contador.textContent = `${atual + 1} / ${slides.length}`;
      anterior.disabled = atual === 0;
      proximo.disabled = atual === slides.length - 1;
      carregar(atual);
      carregar(atual + 1);
    }

    anterior.addEventListener("click", () => mostrar(atual - 1));
    proximo.addEventListener("click", () => mostrar(atual + 1));
    pontos.forEach((ponto, i) => ponto.addEventListener("click", () => mostrar(i)));

    // as setas também mexem nos minijogos da página: aqui elas só passam os slides
    carrossel.addEventListener("keydown", (evento) => {
      const passo = { ArrowLeft: -1, ArrowRight: 1 }[evento.key];
      if (!passo) return;
      evento.preventDefault();
      evento.stopPropagation();
      mostrar(atual + passo);
    });

    let inicioX = null;
    palco.addEventListener("pointerdown", (evento) => {
      if (evento.pointerType !== "mouse") inicioX = evento.clientX;
    });
    palco.addEventListener("pointerup", (evento) => {
      if (inicioX === null) return;
      const distancia = evento.clientX - inicioX;
      inicioX = null;
      if (Math.abs(distancia) > 40) mostrar(atual + (distancia < 0 ? 1 : -1));
    });
    palco.addEventListener("pointercancel", () => {
      inicioX = null;
    });

    if (!carrossel.requestFullscreen) {
      telaCheia.hidden = true;
    } else {
      telaCheia.addEventListener("click", () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else carrossel.requestFullscreen().catch(() => {});
      });
      document.addEventListener("fullscreenchange", () => {
        const ativo = document.fullscreenElement === carrossel;
        telaCheia.setAttribute("aria-label", ativo ? "Sair da tela cheia" : "Ver os slides em tela cheia");
        if (ativo) proximo.focus();
      });
    }

    mostrar(0);
  });
})();

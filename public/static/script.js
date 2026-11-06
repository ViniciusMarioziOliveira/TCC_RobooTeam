const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.main-navigation');

function closeMenu() {
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Abrir menu');
    navigation?.classList.remove('open');
    document.body.classList.remove('menu-open');
}

menuButton?.addEventListener('click', () => {
    const willOpen = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(willOpen));
    menuButton.setAttribute('aria-label', willOpen ? 'Fechar menu' : 'Abrir menu');
    navigation?.classList.toggle('open', willOpen);
    document.body.classList.toggle('menu-open', willOpen);
});

navigation?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMenu();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');
const journeySection = document.querySelector('.journey-section');
const flightStage = document.querySelector('.flight-stage');
const journeySteps = document.querySelectorAll('.journey-step');
const altitudeMarks = document.querySelectorAll('.altitude[data-altitude]');
const flightAltitude = document.querySelector('#flight-altitude');
const scrollHint = document.querySelector('#scroll-hint');
let journeyFrame;

const HINT_MESSAGES = [
    { until: 0.04, text: 'ROLE PARA LANÇAR' },
    { until: 0.35, text: 'IGNIÇÃO' },
    { until: 0.68, text: 'SUBINDO' },
    { until: 0.97, text: 'APROXIMANDO DA ÓRBITA' },
    { until: 1.01, text: 'EM ÓRBITA' },
];

function updateJourney() {
    journeyFrame = null;
    if (!journeySection || !flightStage) return;

    const sectionRect = journeySection.getBoundingClientRect();
    const scrollRange = Math.max(journeySection.offsetHeight - window.innerHeight, 1);
    const rawProgress = Math.min(Math.max(-sectionRect.top / scrollRange, 0), 1);
    const progress = prefersReducedMotion ? 0.55 : rawProgress;

    // O foguete sobe quase reto e só depois arqueia para a direita, como num
    // lançamento real: o eixo Y avança quase linear e o X acelera no fim.
    const curvaX = Math.pow(progress, 1.7);
    const curvaY = Math.pow(progress, 0.94);
    const travelX = Math.min(flightStage.clientWidth * 0.3, 160);
    const travelY = Math.max(flightStage.clientHeight - 300, 210);

    journeySection.style.setProperty('--rocket-x-offset', `${curvaX * travelX}px`);
    journeySection.style.setProperty('--rocket-y-offset', `${curvaY * -travelY}px`);
    journeySection.style.setProperty('--rocket-tilt', `${-3 + curvaX * 27}deg`);
    journeySection.style.setProperty('--rocket-trail', `${70 + progress * 240}px`);
    journeySection.style.setProperty('--rocket-progress', progress.toFixed(3));

    journeySection.classList.toggle('launched', progress > 0.04);
    journeySection.classList.toggle('landed', progress > 0.97);

    altitudeMarks.forEach((mark) => {
        mark.classList.toggle('reached', progress >= Number(mark.dataset.altitude));
    });

    if (flightAltitude) flightAltitude.textContent = `${Math.round(progress * 100)}%`;
    if (scrollHint) scrollHint.textContent = HINT_MESSAGES.find((item) => progress < item.until).text;

    const activeStep = Math.min(2, Math.floor(progress * 3));
    journeySteps.forEach((step, index) => step.classList.toggle('active', index === activeStep));
}

function requestJourneyUpdate() {
    if (journeyFrame) return;
    journeyFrame = requestAnimationFrame(updateJourney);
}

if (journeySection) {
    updateJourney();
    if (!prefersReducedMotion) {
        window.addEventListener('scroll', requestJourneyUpdate, { passive: true });
        window.addEventListener('resize', requestJourneyUpdate);
    }
}

const signalBoard = document.querySelector('[data-signal-board]');
const signalTraces = signalBoard ? [...signalBoard.querySelectorAll('[data-trace]')] : [];
const signalLinks = signalBoard ? [...signalBoard.querySelectorAll('[data-link]')] : [];
const signalLines = signalBoard ? [...signalBoard.querySelectorAll('[data-signal-step]')] : [];
const signalState = document.querySelector('#signal-state');
const signalPercent = document.querySelector('#signal-percent');
const signalModules = document.querySelector('#signal-modules');
let signalFrame;

// O sinal percorre primeiro a entrada (código → processador) e depois
// acende um módulo por vez; a última linha do código fecha a missão.
const SIGNAL_INPUT_END = 0.12;
const SIGNAL_MODULE_SPAN = 0.18;
const SIGNAL_COMPLETE = 0.95;

function clamp01(value) {
    return Math.min(Math.max(value, 0), 1);
}

function signalWindow(link) {
    return link < 0
        ? { from: 0, span: SIGNAL_INPUT_END }
        : { from: SIGNAL_INPUT_END + link * SIGNAL_MODULE_SPAN, span: SIGNAL_MODULE_SPAN };
}

function updateSignalBoard() {
    signalFrame = null;

    const rect = signalBoard.getBoundingClientRect();
    const viewport = window.innerHeight;
    // --view vai de 0 (placa entrando por baixo) a 1 (saindo por cima).
    const view = clamp01((viewport - rect.top) / (viewport + rect.height));
    // O sinal completa quando o centro da placa chega a ~40% da altura da tela.
    const start = viewport * 0.92;
    const end = viewport * 0.4 - rect.height / 2;
    const signal = prefersReducedMotion ? 1 : clamp01((start - rect.top) / Math.max(start - end, 1));

    signalBoard.style.setProperty('--view', (prefersReducedMotion ? 0.5 : view).toFixed(3));
    signalBoard.style.setProperty('--signal', signal.toFixed(3));

    signalTraces.forEach((trace) => {
        const { from, span } = signalWindow(Number(trace.dataset.trace));
        trace.style.strokeDashoffset = String(100 - clamp01((signal - from) / span) * 100);
    });

    let activeModules = 0;
    signalLinks.forEach((link) => {
        const index = Number(link.dataset.link);
        const { from, span } = signalWindow(index);
        const isOn = signal >= from + span;
        link.classList.toggle('on', isOn);
        if (isOn && index >= 0) activeModules += 1;
    });

    signalLines.forEach((line) => {
        const step = Number(line.dataset.signalStep);
        const { from, span } = step < 4 ? signalWindow(step) : { from: SIGNAL_COMPLETE - 0.08, span: 0.08 };
        line.classList.toggle('active', signal > from && signal < from + span);
        line.classList.toggle('done', signal >= from + span);
    });

    signalBoard.classList.toggle('is-powered', signal >= SIGNAL_INPUT_END);
    signalBoard.classList.toggle('is-complete', signal >= SIGNAL_COMPLETE);

    if (signalPercent) signalPercent.textContent = `${Math.round(signal * 100)}%`;
    if (signalModules) signalModules.textContent = `${activeModules}/4`;
    if (signalState) {
        signalState.textContent = signal <= 0.02 ? 'AGUARDANDO SINAL'
            : signal < SIGNAL_INPUT_END ? 'COMPILANDO'
            : signal < SIGNAL_COMPLETE ? 'TRANSMITINDO'
            : 'ROBÔ ONLINE';
    }
}

function requestSignalUpdate() {
    if (signalFrame) return;
    signalFrame = requestAnimationFrame(updateSignalBoard);
}

if (signalBoard) {
    updateSignalBoard();
    if (!prefersReducedMotion) {
        window.addEventListener('scroll', requestSignalUpdate, { passive: true });
        window.addEventListener('resize', requestSignalUpdate);
    }
}

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('visible', 'reveal-done'));
} else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;

            // data-reveal-delay escalona a entrada dos itens de uma mesma fileira.
            const atraso = Number(entry.target.dataset.revealDelay) || 0;
            if (atraso) entry.target.style.transitionDelay = `${atraso}ms`;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);

            // Terminada a entrada, devolve o elemento às transições próprias
            // (hover, por exemplo) sem herdar o atraso do escalonamento.
            window.setTimeout(() => {
                entry.target.style.transitionDelay = '';
                entry.target.classList.add('reveal-done');
            }, atraso + 760);
        });
    }, { threshold: 0.14 });

    revealItems.forEach((item) => revealObserver.observe(item));
}

const counters = document.querySelectorAll('[data-counter]');

function animateCounter(counter) {
    const target = Number(counter.dataset.counter);
    if (prefersReducedMotion) {
        counter.textContent = target;
        return;
    }

    const duration = 1300;
    const start = performance.now();

    function updateCounter(now) {
        const elapsed = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        counter.textContent = Math.round(target * eased);
        if (elapsed < 1) requestAnimationFrame(updateCounter);
    }

    requestAnimationFrame(updateCounter);
}

if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.55 });

    counters.forEach((counter) => counterObserver.observe(counter));
} else {
    counters.forEach(animateCounter);
}

const currentYear = document.querySelector('#current-year');
if (currentYear) currentYear.textContent = new Date().getFullYear();

// Tela de acesso: login e cadastro na mesma página, com o Zion reagindo ao formulário
const authShell = document.querySelector('[data-auth-shell]');

if (authShell) {
    const authStage = authShell.querySelector('.auth-form-stage');
    const authTabs = [...authShell.querySelectorAll('[role="tab"]')];
    const authPanels = [...authShell.querySelectorAll('[data-auth-panel]')];
    const authSwitches = [...authShell.querySelectorAll('[data-auth-target]')];
    const loginForm = authShell.querySelector('#login-form');
    const registerForm = authShell.querySelector('#register-form');
    const registerName = authShell.querySelector('#register-name');
    const registerPassword = authShell.querySelector('#register-password');
    const passwordConfirmation = authShell.querySelector('#register-password-confirm');
    const confirmationBox = passwordConfirmation.closest('.auth-input');
    const feedbackTimers = new WeakMap();
    const authTransitionDuration = prefersReducedMotion ? 220 : 680;
    let panelTransitionTimer;

    // ---------- Zion ----------
    // Acena no login, faz joinha no cadastro, fecha os olhos enquanto a senha é
    // digitada e fica triste quando algo dá errado.
    const mascot = authShell.querySelector('[data-mascot]');
    const mascotPoses = mascot ? [...mascot.querySelectorAll('img[data-mood]')] : [];
    // Decodifica todas as poses já no carregamento, para a troca não piscar
    mascotPoses.forEach((pose) => pose.decode().catch(() => {}));
    const mascotSpeech = authShell.querySelector('[data-mascot-speech]');
    const mascotBubble = mascotSpeech?.closest('.auth-bubble');
    const MASCOT_IDLE = {
        login: { mood: 'acenando', text: 'Que bom te ver de novo!' },
        register: { mood: 'joinha', text: 'Bora montar sua equipe?' }
    };
    const MASCOT_SHY = { mood: 'olhos-fechados', text: 'Pode digitar, não estou olhando.' };
    let mascotMood = 'acenando';
    let mascotReacting = false;
    let mascotTimer;
    let warpTimer;
    let greetingTimer;

    function showMascot(mood, text) {
        mascotMood = mood;
        mascotPoses.forEach((pose) => pose.classList.toggle('is-active', pose.dataset.mood === mood));
        if (!mascotSpeech || mascotSpeech.textContent === text) return;

        mascotSpeech.textContent = text;
        mascotBubble.classList.remove('is-popping');
        void mascotBubble.offsetWidth; // reinicia a animação do balão
        mascotBubble.classList.add('is-popping');
    }

    function isTypingPassword() {
        const field = document.activeElement;
        return Boolean(field && authShell.contains(field) && field.matches('[data-password]'));
    }

    function mascotGreeting() {
        if (authShell.dataset.authMode !== 'register') return '';
        const firstName = registerName.value.trim().split(/\s+/)[0].slice(0, 16);
        if (firstName.length < 2) return '';
        return `Prazer, ${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}!`;
    }

    // Volta à pose do momento. Uma reação em andamento (erro, sucesso) só é
    // interrompida com force = true.
    function settleMascot(force = false) {
        if (mascotReacting && !force) return;
        clearTimeout(mascotTimer);
        mascotReacting = false;

        if (isTypingPassword()) {
            showMascot(MASCOT_SHY.mood, MASCOT_SHY.text);
            return;
        }

        const idle = MASCOT_IDLE[authShell.dataset.authMode] || MASCOT_IDLE.login;
        showMascot(idle.mood, mascotGreeting() || idle.text);
    }

    // Reação passageira; sem duration, fica até a próxima troca (ex.: redirecionamento).
    function reactMascot(mood, text, duration = 0) {
        clearTimeout(mascotTimer);
        mascotReacting = true;
        showMascot(mood, text);
        if (duration) mascotTimer = setTimeout(() => settleMascot(true), duration);
    }

    // Efeito de teletransporte usado na troca entre Entrar e Criar conta
    function warpMascot() {
        if (!mascot || prefersReducedMotion) return;
        clearTimeout(warpTimer);
        mascot.classList.remove('is-warping');
        void mascot.offsetWidth;
        mascot.classList.add('is-warping');
        warpTimer = setTimeout(() => mascot.classList.remove('is-warping'), 950);
    }

    // ---------- Troca entre Entrar e Criar conta ----------
    function getModeFromHash() {
        return window.location.hash === '#cadastro' ? 'register' : 'login';
    }

    function syncAuthStage(panel) {
        if (!panel || panel.hidden) return;
        authStage.style.height = `${panel.scrollHeight}px`;
        authStage.scrollLeft = 0; // o palco não rola; isso desfaz rolagens causadas por foco
    }

    function setAuthMode(mode, options = {}) {
        const { focusTab = false, updateHash = true, animate = true } = options;
        const nextPanel = authPanels.find((panel) => panel.dataset.authPanel === mode);
        const currentPanel = authPanels.find((panel) => panel.classList.contains('active'));
        if (!nextPanel) return;
        const modeChanged = authShell.dataset.authMode !== mode;

        clearTimeout(panelTransitionTimer);
        nextPanel.hidden = false;
        authShell.dataset.authMode = mode;

        authTabs.forEach((tab) => {
            const isActive = tab.dataset.authTarget === mode;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive && focusTab) tab.focus();
        });

        if (!animate) {
            authPanels.forEach((panel) => {
                const isActive = panel === nextPanel;
                panel.classList.toggle('active', isActive);
                panel.hidden = !isActive;
                panel.setAttribute('aria-hidden', String(!isActive));
            });
            syncAuthStage(nextPanel);
        } else if (currentPanel !== nextPanel) {
            currentPanel?.classList.remove('active');
            currentPanel?.setAttribute('aria-hidden', 'true');
            // Ler a altura força o navegador a desenhar o painel novo ainda escondido;
            // assim os campos dele conseguem animar a entrada em sequência.
            syncAuthStage(nextPanel);
            requestAnimationFrame(() => nextPanel.classList.add('active'));
            nextPanel.setAttribute('aria-hidden', 'false');

            panelTransitionTimer = setTimeout(() => {
                authPanels.forEach((panel) => {
                    if (panel !== nextPanel) panel.hidden = true;
                });
            }, authTransitionDuration);
        }

        if (modeChanged) {
            if (animate) warpMascot();
            settleMascot(true);
        }

        if (updateHash) {
            const hash = mode === 'register' ? '#cadastro' : '#entrar';
            window.history.replaceState(null, '', hash);
        }
    }

    function showAuthFeedback(form, message, type = 'info') {
        const feedback = form.querySelector('.auth-feedback');
        if (!feedback) return;

        clearTimeout(feedbackTimers.get(feedback));
        feedback.querySelector('.auth-feedback-text').textContent = message;
        feedback.querySelector('use')?.setAttribute('href', type === 'error' ? '#i-circle-alert' : '#i-circle-check');
        feedback.classList.toggle('error', type === 'error');
        feedback.classList.add('visible');
        syncAuthStage(form.closest('.auth-panel'));

        const timer = setTimeout(() => {
            feedback.classList.remove('visible', 'error');
            syncAuthStage(form.closest('.auth-panel'));
        }, 5200);
        feedbackTimers.set(feedback, timer);
    }

    function setSubmitting(button, busy, busyLabel = '') {
        const label = button.querySelector('.auth-submit-label');
        if (busy) {
            button.dataset.label = label.textContent;
            label.textContent = busyLabel;
        } else if (button.dataset.label) {
            label.textContent = button.dataset.label;
        }
        button.disabled = busy;
        button.classList.toggle('is-loading', busy);
        button.form?.setAttribute('aria-busy', String(busy));
    }

    setAuthMode(getModeFromHash(), { animate: false, updateHash: false });
    settleMascot(true);

    authSwitches.forEach((control) => {
        control.addEventListener('click', () => setAuthMode(control.dataset.authTarget, { focusTab: true }));
    });

    authTabs.forEach((tab, index) => {
        tab.addEventListener('keydown', (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();

            let nextIndex = index;
            if (event.key === 'ArrowRight') nextIndex = (index + 1) % authTabs.length;
            if (event.key === 'ArrowLeft') nextIndex = (index - 1 + authTabs.length) % authTabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = authTabs.length - 1;
            setAuthMode(authTabs[nextIndex].dataset.authTarget, { focusTab: true });
        });
    });

    // ---------- Campos de senha: mostrar/ocultar e aviso de Caps Lock ----------
    function setPasswordVisible(button, visible) {
        const input = document.getElementById(button.getAttribute('aria-controls'));
        if (!input) return;
        input.type = visible ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
    }

    authShell.querySelectorAll('[data-password-toggle]').forEach((button) => {
        // Com o mouse, o foco continua no campo (e o Zion segue de olhos fechados)
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => setPasswordVisible(button, button.getAttribute('aria-pressed') !== 'true'));
    });

    authShell.querySelectorAll('[data-password]').forEach((input) => {
        const warning = input.closest('.auth-field')?.querySelector('[data-caps-warning]');
        if (!warning) return;

        const updateCapsWarning = (event) => {
            if (typeof event.getModifierState === 'function') warning.hidden = !event.getModifierState('CapsLock');
        };
        input.addEventListener('keydown', updateCapsWarning);
        input.addEventListener('keyup', updateCapsWarning);
        input.addEventListener('blur', () => { warning.hidden = true; });
    });

    // ---------- Cadastro: energia da senha e confirmação ----------
    const energyMeter = authShell.querySelector('[data-energy]');
    const energyText = authShell.querySelector('[data-energy-text]');
    const ENERGY_NAMES = ['', 'Energia baixa', 'Energia média', 'Energia alta', 'Energia máxima'];
    const ENERGY_TIPS = [
        [(password) => /[a-z]/i.test(password) && /\d/.test(password), 'misture letras e números'],
        [(password) => /[a-z]/.test(password) && /[A-Z]/.test(password), 'use maiúsculas e minúsculas'],
        [(password) => /[^a-z0-9]/i.test(password) || password.length >= 12, 'um símbolo deixa ainda mais forte']
    ];

    // Só orienta: a regra que vale é a do servidor (de 8 a 20 caracteres).
    function updatePasswordEnergy() {
        if (!energyMeter) return;
        const password = registerPassword.value;
        let level = 0;
        let text = 'Use de 8 a 20 caracteres.';

        if (password && password.length < 8) {
            const missing = 8 - password.length;
            text = missing === 1 ? 'Falta 1 caractere.' : `Faltam ${missing} caracteres.`;
        } else if (password) {
            const tips = ENERGY_TIPS.filter(([passes]) => !passes(password)).map(([, tip]) => tip);
            level = ENERGY_NAMES.length - 1 - tips.length;
            text = tips.length ? `${ENERGY_NAMES[level]}: ${tips[0]}.` : `${ENERGY_NAMES[level]}!`;
        }

        energyMeter.dataset.energy = String(level);
        energyText.textContent = text;
    }

    function validatePasswordMatch() {
        const matches = registerPassword.value === passwordConfirmation.value;
        passwordConfirmation.setCustomValidity(matches ? '' : 'As senhas não coincidem.');
        passwordConfirmation.setAttribute('aria-invalid', String(!matches && passwordConfirmation.value.length > 0));
        // O "check" só aparece quando as senhas batem e já têm o tamanho mínimo
        confirmationBox.toggleAttribute('data-match', matches && registerPassword.value.length >= 8);
        return matches;
    }

    function resetRegisterExtras() {
        registerForm.querySelectorAll('[data-password-toggle]').forEach((button) => setPasswordVisible(button, false));
        confirmationBox.removeAttribute('data-match');
        updatePasswordEnergy();
    }

    passwordConfirmation.addEventListener('input', validatePasswordMatch);
    registerPassword.addEventListener('input', () => {
        updatePasswordEnergy();
        if (passwordConfirmation.value) validatePasswordMatch();
    });

    // ---------- Reações do Zion aos campos ----------
    authShell.addEventListener('focusin', (event) => {
        if (event.target.matches('[data-password]')) settleMascot(true);
    });

    authShell.addEventListener('focusout', (event) => {
        if (event.target.matches('[data-password]')) setTimeout(() => settleMascot(), 120);
    });

    authShell.addEventListener('input', (event) => {
        const field = event.target;
        if (field !== passwordConfirmation && field.getAttribute('aria-invalid') === 'true') {
            field.removeAttribute('aria-invalid');
        }
        // A pessoa já está corrigindo: o Zion para de ficar triste
        if (mascotReacting && mascotMood === 'triste') settleMascot(true);

        if (field === registerName) {
            clearTimeout(greetingTimer);
            greetingTimer = setTimeout(() => settleMascot(), 250);
        }
    });

    // ---------- Envio ----------
    function validateForm(form) {
        form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));

        if (!form.checkValidity()) {
            form.querySelectorAll(':invalid').forEach((field) => field.setAttribute('aria-invalid', 'true'));
            form.reportValidity();
            showAuthFeedback(form, 'Revise os campos destacados.', 'error');
            reactMascot('triste', 'Opa! Confere os campos em destaque.', 4200);
            return false;
        }

        return true;
    }

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        validatePasswordMatch();
        if (!validateForm(registerForm)) return;

        const formData = new FormData(registerForm);
        const email = String(formData.get('email')).trim().toLowerCase();
        const submitButton = registerForm.querySelector('[type="submit"]');
        setSubmitting(submitButton, true, 'Criando sua conta...');

        try {
            const response = await fetch(authShell.dataset.registerUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nome: String(formData.get('name')).trim(),
                    email,
                    senha: String(formData.get('password'))
                })
            });
            const result = await response.json();

            if (!response.ok) {
                showAuthFeedback(registerForm, result.error || 'Não foi possível realizar o cadastro.', 'error');
                reactMascot('triste', 'Hmm, não deu certo dessa vez.', 4200);
                return;
            }

            registerForm.reset();
            resetRegisterExtras();
            showAuthFeedback(registerForm, 'Cadastro realizado! Agora é só entrar.');
            reactMascot('joinha', 'Conta criada! Agora é só entrar.');

            setTimeout(() => {
                setAuthMode('login');
                authShell.querySelector('#login-email').value = email;
                authShell.querySelector('#login-password').focus({ preventScroll: true });
                showAuthFeedback(loginForm, 'Conta criada! Digite sua senha.');
            }, 1500);
        } catch {
            showAuthFeedback(registerForm, 'Não foi possível conectar ao servidor.', 'error');
            reactMascot('triste', 'Perdi o sinal com o servidor...', 4200);
        } finally {
            setSubmitting(submitButton, false);
        }
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateForm(loginForm)) return;

        const formData = new FormData(loginForm);
        const email = String(formData.get('email')).trim().toLowerCase();
        const password = String(formData.get('password'));
        const rememberUser = formData.get('remember') === 'on';
        const submitButton = loginForm.querySelector('[type="submit"]');
        let redirecting = false;
        setSubmitting(submitButton, true, 'Conectando...');

        try {
            const response = await fetch(authShell.dataset.loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha: password, lembrar: rememberUser })
            });
            const result = await response.json();

            if (!response.ok) {
                showAuthFeedback(loginForm, result.error || 'E-mail ou senha incorretos.', 'error');
                reactMascot('triste', 'Hmm... esses dados não bateram.', 4200);
                return;
            }

            const profile = String(result.perfil).toLowerCase();
            const activeUser = JSON.stringify({
                name: result.nome,
                email: result.email,
                profile
            });
            const storage = rememberUser ? localStorage : sessionStorage;

            localStorage.removeItem('robooteam-active-user');
            localStorage.removeItem('robooteam-token');
            sessionStorage.removeItem('robooteam-active-user');
            sessionStorage.removeItem('robooteam-token');
            storage.setItem('robooteam-active-user', activeUser);
            storage.setItem('robooteam-token', result.token);

            redirecting = true;
            showAuthFeedback(loginForm, 'Login realizado! Redirecionando...');
            reactMascot('joinha', 'Tudo certo! Preparando a decolagem...');

            setTimeout(() => {
                window.location.href = profile === 'aluno'
                    ? authShell.dataset.studentUrl
                    : authShell.dataset.teacherUrl;
            }, 700);
        } catch {
            showAuthFeedback(loginForm, 'Não foi possível conectar ao servidor.', 'error');
            reactMascot('triste', 'Perdi o sinal com o servidor...', 4200);
        } finally {
            // No sucesso o botão continua "carregando" até a página trocar
            if (!redirecting) setSubmitting(submitButton, false);
        }
    });

    window.addEventListener('hashchange', () => setAuthMode(getModeFromHash(), { updateHash: false }));
    window.addEventListener('resize', () => {
        const activePanel = authPanels.find((panel) => panel.classList.contains('active'));
        syncAuthStage(activePanel);
    });

    if ('ResizeObserver' in window) {
        const authResizeObserver = new ResizeObserver((entries) => {
            const activeEntry = entries.find((entry) => entry.target.classList.contains('active'));
            if (activeEntry) syncAuthStage(activeEntry.target);
        });
        authPanels.forEach((panel) => authResizeObserver.observe(panel));
    }
}

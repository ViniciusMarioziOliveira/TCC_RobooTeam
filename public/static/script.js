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

const authCard = document.querySelector('.auth-card');

if (authCard) {
    const authStage = authCard.querySelector('.auth-form-stage');
    const authTabs = [...authCard.querySelectorAll('[role="tab"]')];
    const authPanels = [...authCard.querySelectorAll('[data-auth-panel]')];
    const authSwitches = [...authCard.querySelectorAll('[data-auth-target]')];
    const feedbackTimers = new WeakMap();
    const authTransitionDuration = prefersReducedMotion ? 220 : 680;
    let panelTransitionTimer;

    function getModeFromHash() {
        return window.location.hash === '#cadastro' ? 'register' : 'login';
    }

    function syncAuthStage(panel) {
        if (!panel || panel.hidden) return;
        authStage.style.height = `${panel.scrollHeight}px`;
    }

    function setAuthMode(mode, options = {}) {
        const { focusTab = false, updateHash = true, animate = true } = options;
        const nextPanel = authPanels.find((panel) => panel.dataset.authPanel === mode);
        const currentPanel = authPanels.find((panel) => panel.classList.contains('active'));
        if (!nextPanel) return;

        clearTimeout(panelTransitionTimer);
        nextPanel.hidden = false;
        authCard.setAttribute('data-auth-mode', mode);

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
            syncAuthStage(nextPanel);
            requestAnimationFrame(() => nextPanel.classList.add('active'));
            nextPanel.setAttribute('aria-hidden', 'false');

            panelTransitionTimer = setTimeout(() => {
                authPanels.forEach((panel) => {
                    if (panel !== nextPanel) panel.hidden = true;
                });
            }, authTransitionDuration);
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
        feedback.textContent = message;
        feedback.classList.toggle('error', type === 'error');
        feedback.classList.add('visible');
        syncAuthStage(form.closest('.auth-panel'));

        const timer = setTimeout(() => {
            feedback.classList.remove('visible', 'error');
            syncAuthStage(form.closest('.auth-panel'));
        }, 5200);
        feedbackTimers.set(feedback, timer);
    }

    setAuthMode(getModeFromHash(), { animate: false, updateHash: false });

    authSwitches.forEach((control) => {
        control.addEventListener('click', () => {
            setAuthMode(control.dataset.authTarget, { focusTab: control.getAttribute('role') === 'tab' });
        });
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

    authCard.querySelectorAll('[data-auth-notice]').forEach((button) => {
        button.addEventListener('click', () => {
            showAuthFeedback(button.closest('.auth-panel').querySelector('form'), button.dataset.authNotice);
        });
    });

    const registerForm = authCard.querySelector('#register-form');
    const registerPassword = authCard.querySelector('#register-password');
    const passwordConfirmation = authCard.querySelector('#register-password-confirm');

    function validatePasswordMatch() {
        const matches = registerPassword.value === passwordConfirmation.value;
        passwordConfirmation.setCustomValidity(matches ? '' : 'As senhas não coincidem.');
        passwordConfirmation.setAttribute('aria-invalid', String(!matches && passwordConfirmation.value.length > 0));
        return matches;
    }

    passwordConfirmation.addEventListener('input', validatePasswordMatch);
    registerPassword.addEventListener('input', () => {
        if (passwordConfirmation.value) validatePasswordMatch();
    });

    const loginForm = authCard.querySelector('#login-form');

    function validateForm(form) {
        form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));

        if (!form.checkValidity()) {
            form.querySelectorAll(':invalid').forEach((field) => field.setAttribute('aria-invalid', 'true'));
            form.reportValidity();
            showAuthFeedback(form, 'Revise os campos destacados antes de continuar.', 'error');
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
        submitButton.disabled = true;

        try {
            const response = await fetch(authCard.dataset.registerUrl, {
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
                return;
            }

            registerForm.reset();
            showAuthFeedback(registerForm, 'Cadastro realizado! Agora entre com seu e-mail e senha.');

            setTimeout(() => {
                setAuthMode('login');
                authCard.querySelector('#login-email').value = email;
                authCard.querySelector('#login-password').focus();
            }, 900);
        } catch {
            showAuthFeedback(registerForm, 'Não foi possível conectar ao servidor.', 'error');
        } finally {
            submitButton.disabled = false;
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
        submitButton.disabled = true;

        try {
            const response = await fetch(authCard.dataset.loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, senha: password, lembrar: rememberUser })
            });
            const result = await response.json();

            if (!response.ok) {
                showAuthFeedback(loginForm, result.error || 'E-mail ou senha incorretos.', 'error');
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

            showAuthFeedback(loginForm, 'Login realizado! Redirecionando...');

            setTimeout(() => {
                window.location.href = profile === 'aluno'
                    ? authCard.dataset.studentUrl
                    : authCard.dataset.teacherUrl;
            }, 500);
        } catch {
            showAuthFeedback(loginForm, 'Não foi possível conectar ao servidor.', 'error');
        } finally {
            submitButton.disabled = false;
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

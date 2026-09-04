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

const simulator = document.querySelector('.simulator-window');
const simulatorTabs = document.querySelectorAll('.simulator-tab');
const missionName = document.querySelector('#mission-name');
const missionStatus = document.querySelector('#mission-status');
const missionProgress = document.querySelector('#mission-progress');
const teamLoadBar = document.querySelector('#team-load-bar');
const runButton = document.querySelector('.run-button');
let executionTimer;

simulatorTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        simulatorTabs.forEach((item) => {
            const isSelected = item === tab;
            item.classList.toggle('active', isSelected);
            item.setAttribute('aria-pressed', String(isSelected));
        });

        const progress = tab.dataset.progress || '0%';
        simulator.dataset.view = tab.dataset.view;
        missionName.textContent = tab.dataset.name;
        missionStatus.textContent = tab.dataset.status;
        missionProgress.textContent = progress;
        teamLoadBar.style.width = progress;
    });
});

runButton?.addEventListener('click', () => {
    clearTimeout(executionTimer);
    simulator.classList.remove('is-running');
    void simulator.offsetWidth;
    simulator.classList.add('is-running');
    missionStatus.textContent = 'EXECUTANDO TRAJETÓRIA';
    missionProgress.textContent = '0%';
    teamLoadBar.style.width = '0%';
    runButton.disabled = true;

    requestAnimationFrame(() => {
        teamLoadBar.style.width = '100%';
    });

    executionTimer = setTimeout(() => {
        simulator.classList.remove('is-running');
        missionStatus.textContent = 'AMOSTRA ALCANÇADA';
        missionProgress.textContent = '100%';
        runButton.disabled = false;
    }, 2500);
});

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');
const journeySection = document.querySelector('.journey-section');
const flightStage = document.querySelector('.flight-stage');
const journeySteps = document.querySelectorAll('.journey-step');
let journeyFrame;

function updateJourney() {
    journeyFrame = null;
    if (!journeySection || !flightStage) return;

    const sectionRect = journeySection.getBoundingClientRect();
    const scrollRange = Math.max(journeySection.offsetHeight - window.innerHeight, 1);
    const rawProgress = Math.min(Math.max(-sectionRect.top / scrollRange, 0), 1);
    const progress = prefersReducedMotion ? 0.55 : rawProgress;
    const travelX = Math.min(flightStage.clientWidth * 0.28, 145);
    const travelY = Math.max(flightStage.clientHeight - 300, 210);

    journeySection.style.setProperty('--rocket-x-offset', `${progress * travelX}px`);
    journeySection.style.setProperty('--rocket-y-offset', `${progress * -travelY}px`);
    journeySection.style.setProperty('--rocket-tilt', `${-9 + progress * 9}deg`);
    journeySection.style.setProperty('--rocket-trail', `${90 + progress * 210}px`);
    journeySection.style.setProperty('--rocket-progress', progress.toFixed(3));

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

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('visible'));
} else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
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
                    senha: String(formData.get('password')),
                    perfil: String(formData.get('profile'))
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

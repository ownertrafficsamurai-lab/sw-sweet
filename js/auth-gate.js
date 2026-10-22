import { signUp, signIn, signOutUser, requestPasswordReset, updatePassword } from './auth.js';
import { supabase } from './supabase-client.js';
import { showLoadError } from './loading-overlay.js';

const FORMS = ['login', 'register', 'forgot', 'reset'];
let onAuthenticatedCallback = null;

// Snapshotted before supabase-js's internal init can consume the URL's
// recovery fragment (ES module top-level code runs before any async
// continuation gets a turn) — this is what lets the INITIAL_SESSION branch
// below correctly defer to the reset form no matter which event fires first.
const hashParams = new URLSearchParams(window.location.hash.slice(1));
const isRecovery = hashParams.get('type') === 'recovery';
// A recovery/magic link can land back here with an error instead of a
// session — most commonly `otp_expired`, because the one-time link was
// already consumed (some email providers, notably Gmail, prefetch links
// for safety scanning before the user ever clicks them) or the user
// waited too long. Surface this instead of silently showing a blank
// login form with no explanation.
const urlErrorCode = hashParams.get('error_code');
let started = false;

function startOnce() {
    if (started) return;
    started = true;
    // Запуск — вне обработчика onAuthStateChange: запрос к Supabase изнутри него вешает
    // supabase-js (supabase.com/docs/guides/troubleshooting/why-is-my-supabase-api-call-not-returning-PGzXw0)
    setTimeout(() => onAuthenticatedCallback(), 0);
}

function showForm(name) {
    FORMS.forEach(f => {
        document.getElementById(`auth-form-${f}`).classList.toggle('hidden', f !== name);
    });
}

function showFieldError(formName, message) {
    const el = document.getElementById(`auth-${formName}-error`);
    el.textContent = message;
    el.classList.remove('hidden');
}

function clearFieldError(formName) {
    const el = document.getElementById(`auth-${formName}-error`);
    el.classList.add('hidden');
    el.textContent = '';
}

function translateAuthError(error) {
    const msg = error?.message || '';
    if (msg.includes('Invalid login credentials')) return 'Неверный email или пароль.';
    if (msg.includes('User already registered')) return 'Этот email уже зарегистрирован.';
    if (msg.includes('Database error saving new user')) return 'Это имя уже занято, выберите другое.';
    if (msg.includes('Password should be at least')) return 'Пароль слишком короткий (минимум 6 символов).';
    if (msg.includes('rate limit') || msg.includes('security purposes')) return 'Слишком много попыток. Подождите немного и повторите.';
    if (msg.includes('Unable to validate email address')) return 'Некорректный email.';
    return `Ошибка: ${msg || 'неизвестная ошибка'}`;
}

function showGate() {
    document.getElementById('auth-gate').classList.remove('hidden');
}

function hideGate() {
    document.getElementById('auth-gate').classList.add('hidden');
}

function wireNavLinks() {
    document.getElementById('auth-goto-register').onclick = () => showForm('register');
    document.getElementById('auth-goto-forgot').onclick = () => showForm('forgot');
    document.getElementById('auth-goto-login-from-register').onclick = () => showForm('login');
    document.getElementById('auth-goto-login-from-forgot').onclick = () => showForm('login');
}

function wirePasswordToggle(inputId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(`${inputId}-toggle`);
    btn.addEventListener('click', () => {
        const shown = input.type === 'text';
        input.type = shown ? 'password' : 'text';
        btn.textContent = shown ? '👁' : '🙈';
    });
}

function wirePasswordMatch(passwordId, confirmId, matchId) {
    const passwordInput = document.getElementById(passwordId);
    const confirmInput = document.getElementById(confirmId);
    const matchEl = document.getElementById(matchId);
    const update = () => {
        if (!confirmInput.value) {
            matchEl.classList.add('hidden');
            return;
        }
        const matches = passwordInput.value === confirmInput.value;
        matchEl.textContent = matches ? '✓ Пароли совпадают' : '✕ Пароли не совпадают';
        matchEl.className = `fs-small ${matches ? 'text-green-400' : 'text-red-400'}`;
    };
    passwordInput.addEventListener('input', update);
    confirmInput.addEventListener('input', update);
}

function wireLoginForm() {
    document.getElementById('auth-form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldError('login');
        const email = document.getElementById('auth-login-email').value;
        const password = document.getElementById('auth-login-password').value;
        try {
            await signIn(email, password);
            hideGate();
            startOnce();
        } catch (error) {
            showFieldError('login', translateAuthError(error));
        }
    });
}

function wireRegisterForm() {
    document.getElementById('auth-form-register').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldError('register');
        const username = document.getElementById('auth-register-username').value;
        const email = document.getElementById('auth-register-email').value;
        const password = document.getElementById('auth-register-password').value;
        const confirm = document.getElementById('auth-register-confirm').value;
        if (password !== confirm) {
            showFieldError('register', 'Пароли не совпадают.');
            return;
        }
        try {
            const data = await signUp(email, password, username);
            if (!data.session) {
                showFieldError('register', 'Регистрация прошла, но автоматический вход не удался — попробуйте войти вручную.');
                return;
            }
            hideGate();
            startOnce();
        } catch (error) {
            showFieldError('register', translateAuthError(error));
        }
    });
}

function wireForgotForm() {
    document.getElementById('auth-form-forgot').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldError('forgot');
        document.getElementById('auth-forgot-success').classList.add('hidden');
        const email = document.getElementById('auth-forgot-email').value;
        try {
            await requestPasswordReset(email);
            const successEl = document.getElementById('auth-forgot-success');
            successEl.textContent = 'Письмо отправлено, проверьте почту.';
            successEl.classList.remove('hidden');
        } catch (error) {
            showFieldError('forgot', translateAuthError(error));
        }
    });
}

function wireResetForm() {
    document.getElementById('auth-form-reset').addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldError('reset');
        const password = document.getElementById('auth-reset-password').value;
        const confirm = document.getElementById('auth-reset-confirm').value;
        if (password !== confirm) {
            showFieldError('reset', 'Пароли не совпадают.');
            return;
        }
        try {
            await updatePassword(password);
            hideGate();
            startOnce();
        } catch (error) {
            showFieldError('reset', translateAuthError(error));
        }
    });
}

export async function initAuth(onAuthenticated) {
    onAuthenticatedCallback = onAuthenticated;
    wireNavLinks();
    wireLoginForm();
    wireRegisterForm();
    wireForgotForm();
    wireResetForm();
    wirePasswordToggle('auth-login-password');
    wirePasswordToggle('auth-register-password');
    wirePasswordToggle('auth-register-confirm');
    wirePasswordToggle('auth-reset-password');
    wirePasswordToggle('auth-reset-confirm');
    wirePasswordMatch('auth-register-password', 'auth-register-confirm', 'auth-register-match');
    wirePasswordMatch('auth-reset-password', 'auth-reset-confirm', 'auth-reset-match');

    if (urlErrorCode === 'otp_expired') {
        showFieldError('login', 'Ссылка для восстановления пароля истекла или уже использована. Запросите новое письмо через «Забыли пароль?».');
    } else if (urlErrorCode) {
        showFieldError('login', 'Ссылка недействительна. Запросите новое письмо через «Забыли пароль?».');
    }

    // Запуск без сети (релиз v2): с сессией старше часа supabase-js до ~30 с повторяет обновление токена,
    // прежде чем прислать INITIAL_SESSION, — всё это время была бы видна форма входа. Сразу «Нет сети»;
    // пришедшая потом сессия запускает приложение как обычно (без сети оно снова покажет этот экран).
    if (!navigator.onLine && !isRecovery) {
        hideGate();
        showLoadError('offline', { onRetry: () => location.reload(), onLogout: () => {} });
    }

    // Both PASSWORD_RECOVERY and INITIAL_SESSION can fire for the same page
    // load when a recovery link is opened (INITIAL_SESSION always carries
    // the recovery session too), in a non-deterministic order. `isRecovery`
    // (captured above, before supabase-js can consume the URL fragment) is
    // what makes INITIAL_SESSION defer to the reset form regardless of which
    // event arrives first — do not remove it in favor of only checking
    // PASSWORD_RECOVERY, the ordering is genuinely not guaranteed.
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            showGate();
            showForm('reset');
        } else if (event === 'INITIAL_SESSION') {
            if (isRecovery) {
                showGate();
                showForm('reset');
            } else if (session) {
                hideGate();
                startOnce();
            } else if (!navigator.onLine) {
                // Запуск без сети и без сессии (релиз v2): не форма входа, а «Нет сети»; с сетью — заново
                hideGate();
                showLoadError('offline', { onRetry: () => location.reload(), onLogout: () => {} });
            } else {
                showGate();
                showForm('login');
            }
        } else if (event === 'SIGNED_OUT') {
            // Another tab (or this one) signed out — reload so this tab's
            // gate reappears instead of continuing to show a dead session.
            location.reload();
        }
    });
}

export async function logout() {
    try {
        await signOutUser();
    } finally {
        location.reload();
    }
}

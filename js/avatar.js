import { state } from './state.js';
import { showConfirm } from './ui-utils.js';
import { saveSession } from './persistence.js';
import { renderHudCard } from './hud-card.js';
import { safeAvatar } from './save-check.js';

// Аватар
export function handleAvatarClick(e) { e.stopPropagation(); const m = document.getElementById('avatar-menu'); if (!state.charAvatar) { document.getElementById('avatar-input').click(); m.classList.add('hidden'); } else m.classList.toggle('hidden'); }

export function actionReplace() { document.getElementById('avatar-menu').classList.add('hidden'); document.getElementById('avatar-input').click(); }

export function actionDelete() { document.getElementById('avatar-menu').classList.add('hidden'); showConfirm("Удалить аватар персонажа?", () => { state.charAvatar = ""; document.getElementById('avatar-input').value = ""; updateAvatarUI(); saveSession(); }); }

export function uploadAvatar(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                const maxSize = 150;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } }
                else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                state.charAvatar = canvas.toDataURL('image/jpeg', 0.7);
                updateAvatarUI(); saveSession();
                document.getElementById('avatar-menu').classList.add('hidden'); input.value = '';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

export function updateAvatarUI() {
    const el = document.getElementById('avatar-display'); const placeholder = document.getElementById('avatar-placeholder');
    // В background-image — только встроенная картинка допустимого формата (save-check.js)
    const src = safeAvatar(state.charAvatar);
    el.style.backgroundImage = src ? `url(${src})` : '';
    if (placeholder) placeholder.classList.toggle('hidden', !!src);
    // Аватар в мини-блоке (hud-card.js)
    renderHudCard();
}

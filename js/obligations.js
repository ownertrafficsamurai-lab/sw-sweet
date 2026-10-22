import { state } from './state.js';
import { saveSession } from './persistence.js';
import { showAlert } from './ui-utils.js';
import { LIMITS } from './save-check.js';

export function addObligation() {
    if (state.obligations.length >= LIMITS.obligations) { showAlert(`Достигнут предел — ${LIMITS.obligations} обязательств`); return; }
    state.obligations.push({ id: Date.now(), type: 'obligation', value: 10, desc: '' });
    renderObligations();
    saveSession();
}

export function renderObligations() {
    const list = document.getElementById('obligation-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.obligations.length === 0) {
        list.innerHTML = '<p class="fs-small text-slate-400 italic">Нет записей. Нажмите «+», чтобы добавить.</p>';
        return;
    }
    state.obligations.forEach((ob, i) => {
        const TYPE_LABELS = { obligation: 'Обязательство', duty: 'Долг', other: 'Другое' };
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 flex-wrap sm:flex-nowrap';

        const sel = document.createElement('select');
        sel.className = 'compact-select w-36 flex-shrink-0';
        Object.entries(TYPE_LABELS).forEach(([v, l]) => {
            const opt = new Option(l, v);
            if (ob.type === v) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.onchange = () => { state.obligations[i].type = sel.value; saveSession(); };

        const btnMinus = document.createElement('button');
        btnMinus.className = 'mini-btn flex-shrink-0';
        btnMinus.textContent = '-';
        btnMinus.onclick = () => { state.obligations[i].value = Math.max(0, ob.value - 5); renderObligations(); saveSession(); };

        const valSpan = document.createElement('span');
        valSpan.className = 'text-base font-black text-white w-8 text-center flex-shrink-0 leading-none';
        valSpan.textContent = ob.value;

        const btnPlus = document.createElement('button');
        btnPlus.className = 'mini-btn flex-shrink-0';
        btnPlus.textContent = '+';
        btnPlus.onclick = () => { state.obligations[i].value += 5; renderObligations(); saveSession(); };

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.value = ob.desc;
        descInput.placeholder = 'Описание, источник...';
        descInput.maxLength = LIMITS.obligationDesc;
        descInput.className = 'flex-grow bg-transparent border-b border-slate-700 fs-body text-slate-300 outline-none focus:border-yellow-500 px-1 py-0.5 min-w-0 transition-colors';
        descInput.oninput = () => { state.obligations[i].desc = descInput.value; saveSession(); };

        const delBtn = document.createElement('button');
        delBtn.className = 'text-slate-600 hover:text-red-500 transition text-base leading-none flex-shrink-0 ml-auto';
        delBtn.textContent = '×';
        delBtn.onclick = () => { state.obligations.splice(i, 1); renderObligations(); saveSession(); };

        row.append(sel, btnMinus, valSpan, btnPlus, descInput, delBtn);
        list.appendChild(row);
    });
}

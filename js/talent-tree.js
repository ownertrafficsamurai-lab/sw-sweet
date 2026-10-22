import { state } from './state.js';
import { TALENTS_DB, FORCE_DB, FORCE_LIST } from './reference-data.js';
import { buildTalentGraph, isAvailable as isNodeAvailable, canRefund, unlockCosts } from './talent-graph.js';
import { formatDesc, showAlert, showConfirm } from './ui-utils.js';
import { applyXP } from './xp.js';
import { saveSession } from './persistence.js';

// ЛОГИКА ДЕРЕВА ТАЛАНТОВ
export function initTalentTree() {
    const container = document.getElementById('talent-tree-container');
    const title = document.getElementById('talent-tree-title');
    let currentData = []; let headerText = "";

    if (state.currentTreeMode === 'spec') {
        const specId = document.getElementById('gen-spec').value;
        if(specId && TALENTS_DB[specId]) {
            currentData = TALENTS_DB[specId];
            const cId = document.getElementById('gen-career').value;
            const career = state.db.careers.find(c => c.id === cId);
            const spec = career ? career.specializations.find(s => s.id === specId) : null;
            headerText = spec ? `${career.name}: ${spec.name}` : "Специализация";
        }
    } else if (state.currentTreeMode === 'spec2') {
        const specId = document.getElementById('gen-spec2').value;
        if(specId && specId !== 'none' && TALENTS_DB[specId]) {
            currentData = TALENTS_DB[specId];
            let specName = specId;
            state.db.careers.forEach(c => { const s = c.specializations.find(sp => sp.id === specId); if(s) specName = `${c.name}: ${s.name}`; });
            headerText = `[2-я спец] ${specName}`;
        }
    } else if (state.currentTreeMode === 'force1' || state.currentTreeMode === 'force2') {
        const fId = document.getElementById(state.currentTreeMode === 'force1' ? 'force-p1' : 'force-p2').value;
        if(fId && fId !== 'none' && FORCE_DB[fId]) {
            currentData = FORCE_DB[fId];
            const fName = FORCE_LIST.find(f => f.id === fId).name;
            headerText = `Сила: ${fName}`;
        }
    }

    if(title) title.innerHTML = headerText || "<span class='text-slate-400'>Выберите дерево</span>";
    container.innerHTML = '';

    if (!currentData || currentData.length === 0) {
        container.innerHTML = `<div class="col-span-4 text-center text-slate-400 py-10 opacity-50">Дерево не найдено или не выбрано</div>`;
        updateTalentStats([]); return;
    }

    // Связи, доступность и стоимость открытия — по взаимным связям (talent-graph.js)
    const purchased = new Set(state.purchasedTalents);
    const graph = buildTalentGraph(currentData);
    const costs = unlockCosts(graph, purchased);

    currentData.forEach(t => {
        if(t.invisible) return;
        const isBought = purchased.has(t.id);
        const isAvailable = isNodeAvailable(graph, t.id, purchased);

        let opacityClass = isAvailable ? "opacity-100" : "opacity-40 grayscale cursor-not-allowed";
        let borderClass = isBought ? "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)] bg-green-950/40" : "border-slate-800 bg-slate-900";
        if(isAvailable && !isBought) borderClass += " hover:border-slate-500 hover:bg-slate-800";
        let nameColor = isBought ? "text-white" : (t.passive ? "text-slate-300" : "text-red-400");
        let costColor = isBought ? "text-green-400 font-bold" : "text-slate-400";

        // Линии — только для взаимных связей: горизонтальные у обоих узлов пары,
        // вертикальные у верхнего. У широкого узла — отдельная линия к каждому
        // связанному узлу ниже (по центру общих столбцов), без планки на всю ширину:
        // планка показывала бы связь со столбцами, которой нет.
        let linksHtml = '';
        const linkColor = isBought ? "bg-slate-600" : "bg-slate-800";
        const w = t.width || 1;
        if (graph.right.has(t.id)) linksHtml += `<div class="absolute top-1/2 -right-6 w-8 h-1 ${linkColor} -z-10 transform -translate-y-1/2 border-t border-b border-slate-900"></div>`;
        if (graph.left.has(t.id)) linksHtml += `<div class="absolute top-1/2 -left-6 w-8 h-1 ${linkColor} -z-10 transform -translate-y-1/2 border-t border-b border-slate-900"></div>`;
        graph.lower.get(t.id).forEach(lowerId => {
            if (w === 1) {
                linksHtml += `<div class="absolute -bottom-6 left-1/2 w-1 h-8 ${linkColor} -z-10 transform -translate-x-1/2 border-l border-r border-slate-900"></div>`;
                return;
            }
            const lowerNode = graph.byId.get(lowerId);
            const from = Math.max(t.col, lowerNode.col);
            const to = Math.min(t.col + w - 1, lowerNode.col + (lowerNode.width || 1) - 1);
            const centerPct = (((from + to) / 2 - t.col + 0.5) / w) * 100;
            linksHtml += `<div class="absolute -bottom-6 w-1 h-8 ${linkColor} -z-10 border-l border-r border-slate-900" style="left: ${centerPct}%; transform: translateX(-50%);"></div>`;
        });

        const div = document.createElement('div');
        div.style.gridRow = t.row; div.style.gridColumn = `${t.col} / span ${t.width || 1}`;
        div.className = `relative p-2 rounded border transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[8rem] select-none ${borderClass} ${opacityClass}`;
        div.onclick = () => toggleTalent(t.id, currentData, isAvailable);
        // Шкала А3: название и описание переносятся (с переносом слов по-русски — в узкой колонке
        // не помещается даже «стрессоустойчивости»), описание — уровень «мелкий»
        div.innerHTML = `${linksHtml}<div class="flex justify-between items-start mb-1 gap-2"><span class="min-w-0 fs-cap uppercase font-black leading-tight hyphens-auto break-words ${nameColor}">${t.name}</span><span class="fs-cap font-mono whitespace-nowrap ${costColor}">${t.cost} XP</span></div><div class="fs-small leading-snug text-slate-400 flex-grow hyphens-auto break-words">${formatDesc(t.desc)}</div><div class="mt-1 pt-1 border-t border-slate-800/50 fs-cap uppercase tracking-[0.04em] font-bold text-slate-400 flex flex-wrap justify-between items-center gap-x-1"><span>${t.passive ? 'Пассивный' : 'Действие'}</span>${isBought ? '<span class="text-green-500">✓</span>' : (isAvailable ? '<span class="text-slate-400 normal-case font-normal">' + t.cost + ' XP</span>' : '<span class="text-amber-500 normal-case font-normal">🔒 ' + (costs.get(t.id) ?? t.cost) + ' XP</span>')}</div>`;
        container.appendChild(div);
    });
    updateTalentStats(currentData);
}

export function toggleTalent(id, dataArray, isAvailable) {
    const talent = dataArray.find(t => t.id === id); if (!talent) return;
    const race = state.db.races.find(r => r.id === document.getElementById('gen-race').value);
    const totalXP = (race ? race.startXP : 0) + state.xpData.earned;
    const availXP = totalXP - state.xpData.spent;

    if (state.purchasedTalents.includes(id)) {
        // Остальные купленные узлы этого дерева должны сохранить путь доступа. Узлы других
        // деревьев не учитываются (в MVP они по ошибке блокировали любой возврат).
        if (!canRefund(buildTalentGraph(dataArray), id, new Set(state.purchasedTalents))) { showAlert("Нельзя вернуть: другие купленные таланты потеряют путь доступа!"); return; }
        showConfirm(`Вернуть «${talent.name}» и получить ${talent.cost} XP?`, () => {
            applyXP('refund_talent', talent.cost, "", () => { state.purchasedTalents = state.purchasedTalents.filter(tid => tid !== id); });
            initTalentTree(); saveSession();
        });
    } else {
        // Покупка
        if (!isAvailable) return;
        if (availXP >= talent.cost) {
            showConfirm(`Купить «${talent.name}» за ${talent.cost} XP?`, () => {
                applyXP('buy_talent', talent.cost, "", () => { state.purchasedTalents.push(id); });
                initTalentTree(); saveSession();
            });
        } else {
            showAlert(`Недостаточно XP! Нужно ${talent.cost}, у вас ${availXP}.`);
        }
    }
}

export function updateTalentStats(currentData) {
    if (!currentData) return;
    const totalSpent = currentData.filter(t => state.purchasedTalents.includes(t.id)).reduce((sum, t) => sum + t.cost, 0);
    const el = document.getElementById('talent-xp-spent'); if (el) el.textContent = totalSpent;
}

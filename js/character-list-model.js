// Чистая часть окна «Персонажи» (подпроект 4б): строки списка из строк таблицы characters и
// справочников. Без document, сети и хранилища — тестируется в Node.
// row — { id, name, race_id, career_id, spec_id, updated_at, campaign_characters } (character-store.js:
// listCharacters);
// db — state.db: { races, careers } (у карьеры — specializations).

// Не больше персонажей на аккаунт; ту же границу держит база (триггер characters_limit)
export const CHARACTER_LIMIT = 20;
export const NO_NAME = 'Без имени';

export function displayName(name) {
    return typeof name === 'string' && name.trim() ? name.trim() : NO_NAME;
}

// Кружок строки: первые буквы первых двух слов имени; у персонажа без имени — «?»
export function initials(name) {
    if (displayName(name) === NO_NAME) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(word => [...word][0].toUpperCase()).join('');
}

// «Раса · Карьера: Специализация»; чего нет в справочнике — пропускается
export function subtitle(row, db) {
    const race = db.races.find(r => r.id === row.race_id)?.name;
    const career = db.careers.find(c => c.id === row.career_id);
    const spec = career?.specializations.find(s => s.id === row.spec_id)?.name;
    const path = career ? (spec ? `${career.name}: ${spec}` : career.name) : null;
    return [race, path].filter(Boolean).join(' · ');
}

// Кампания в корзине старше 30 дней — как несуществующая (её стирает ежедневная очистка в базе)
const TRASH_MS = 30 * 24 * 60 * 60 * 1000;

// Кампания персонажа (4.1) из вложенной выборки campaign_characters(campaign_id, campaigns(name,
// deleted_at)). PostgREST отдаёт связь объектом (character_id уникален — один к одному) или
// списком — подходят оба. → { id, name, active } | null
export function campaignOf(row, now = Date.now()) {
    const nested = row?.campaign_characters;
    const link = Array.isArray(nested) ? nested[0] : nested;
    const campaign = link?.campaigns;
    if (!campaign) return null;
    if (campaign.deleted_at && Date.parse(campaign.deleted_at) + TRASH_MS <= now) return null;
    return { id: link.campaign_id, name: campaign.name, active: !campaign.deleted_at };
}

// Изменённый последним — сверху; при равном времени — по имени
export function sortRows(rows) {
    return [...rows].sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? ''))
        || displayName(a.name).localeCompare(displayName(b.name), 'ru'));
}

// Вид окна: строки в порядке показа, признаки «пусто» и «достигнут предел». campaign — название
// активной кампании персонажа (метка в строке) или null
export function listView(rows, db, currentId, now = Date.now()) {
    return {
        rows: sortRows(rows).map((row) => {
            const campaign = campaignOf(row, now);
            return {
                id: row.id, name: displayName(row.name), initials: initials(row.name), subtitle: subtitle(row, db), current: row.id === currentId,
                campaign: campaign?.active ? campaign.name : null,
            };
        }),
        empty: rows.length === 0,
        atLimit: rows.length >= CHARACTER_LIMIT,
    };
}

// Подсказка переноса из браузера на пределе (мелочи 4б, п. 3, макет — вариант B): count — сколько
// персонажей в аккаунте, name — имя переносимого (displayName). → { counter, text, canTransfer }
export function transferHint(count, name) {
    const full = count >= CHARACTER_LIMIT;
    return {
        counter: `${count} из ${CHARACTER_LIMIT}`,
        text: full
            ? `Места нет. Удалите персонажа (⋯ → Удалить), чтобы перенести «${name}» из браузера.`
            : `Место есть — можно перенести «${name}» из браузера.`,
        canTransfer: !full,
    };
}

// Кого открыть при запуске: последнего открытого; если его не запоминали (новое устройство) —
// изменённого последним; если запомненного уже нет или персонажей нет — null (показать список)
export function startTarget(rows, rememberedId) {
    if (rememberedId) return rows.some(r => r.id === rememberedId) ? rememberedId : null;
    return sortRows(rows)[0]?.id ?? null;
}

// Листы дашборда мастера без повторной загрузки портрета (этап 5, спека
// 2026-10-20-live-party-dashboard.md, «Ограничения»). Функция базы party_sheets отдаёт лист без
// charAvatar и отпечаток портрета avatar_key (md5 его текста, null — портрета нет); сам портрет
// (до ~300 КБ) берётся отдельным запросом, только когда отпечаток не совпал с запомненным.
// Чистый модуль: без document, сети и хранилища — тестируется в Node.

// Листы карточек кампании: известные (Map id → { id, data, version }) и пришедшие — по каждому id лист
// с большей версией (при равной — пришедший): ответ, ушедший раньше, не откатит карточку назад. keep —
// состав группы после полной загрузки (остальные выбывают); без keep — ответ на сообщение, остальные
// остаются. Новая Map, known не меняется
export function newerSheets(known, rows, keep = null) {
    const next = new Map(keep ? [...known].filter(([id]) => keep.includes(id)) : known);
    for (const row of rows) {
        if (keep && !keep.includes(row.id)) continue;
        if ((next.get(row.id)?.version ?? -Infinity) <= row.version) next.set(row.id, row);
    }
    return next;
}

// Память портретов: id персонажа → { key, avatar }. Живёт, пока открыта страница
export function makePortraits() {
    const known = new Map();
    return {
        // id строк, чей портрет нужно скачать
        missing(rows) {
            return rows.filter(r => r.avatar_key !== null && known.get(r.id)?.key !== r.avatar_key).map(r => r.id);
        },
        // Запомнить скачанные портреты (fetched — [{ id, avatar }]) под отпечатками строк; строка без
        // портрета забывает прежний. Не скачанный (запрос не удался) спросится в следующий раз
        store(rows, fetched) {
            const got = new Map(fetched.filter(f => typeof f.avatar === 'string').map(f => [f.id, f.avatar]));
            for (const row of rows) {
                if (row.avatar_key === null) known.delete(row.id);
                else if (got.has(row.id)) known.set(row.id, { key: row.avatar_key, avatar: got.get(row.id) });
            }
        },
        // Листы для partyCards: data с портретом из памяти (в том числе прежним, пока новый не скачан)
        sheets(rows) {
            return rows.map((row) => {
                const avatar = row.avatar_key === null ? undefined : known.get(row.id)?.avatar;
                const data = avatar !== undefined && row.data && typeof row.data === 'object' && !Array.isArray(row.data)
                    ? { ...row.data, charAvatar: avatar } : row.data;
                return { id: row.id, data, version: row.version };
            });
        },
    };
}

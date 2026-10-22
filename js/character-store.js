import { supabase } from './supabase-client.js';
import { campaignOf } from './character-list-model.js';

// Персонажи в Supabase (таблица characters, подпроект 4б, спека
// 2026-10-02-character-in-database.md). Персонаж целиком лежит в data; имя, расу, карьеру,
// специализации, раны, усталость и номер версии база ведёт сама (триггер characters_derive).
// Каждая функция возвращает объект-исход и не бросает: { ok: true, … } либо { error: вид }, где
// вид — 'limit' (20 персонажей), 'too_big' (больше 512 КБ), 'exists' (вставка: такой id уже есть)
// или 'network' (всё остальное: нет сети, таймаут, отказ базы). Здесь нет проверки сохранения: что пришло из базы, вызывающий
// обязан провести через checkSave (save-check.js).
const TIMEOUT_MS = 20000;
// Кампания персонажа (4.1) — вложенной выборкой: связь видна владельцу, кампания — участнику
const CAMPAIGN_COLUMNS = 'campaign_characters(campaign_id, campaigns(name, deleted_at))';
const LIST_COLUMNS = `id, name, race_id, career_id, spec_id, updated_at, ${CAMPAIGN_COLUMNS}`;
let userId = null;

function errorKind(error) {
    // Нарушение уникальности — у characters это только первичный ключ
    if (error?.code === '23505') return 'exists';
    const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
    if (text.includes('characters_limit')) return 'limit';
    if (text.includes('characters_data_size')) return 'too_big';
    return 'network';
}

// У запросов supabase-js нет своего таймаута (как в reference-data.js)
async function request(build) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const { data, error } = await build(supabase.from('characters')).abortSignal(controller.signal);
        return error ? { error: errorKind(error) } : { ok: true, data };
    } catch {
        return { error: 'network' };
    } finally {
        clearTimeout(timer);
    }
}

// id вошедшего пользователя (null — сессии нет); запоминается для запросов ниже
export async function currentUserId() {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user.id ?? null;
    return userId;
}

// Свои персонажи для окна списка — без data (в нём портрет). Условие по владельцу нужно и при
// RLS: мастер кампании видит чужих персонажей своей кампании, в его список они не входят
export async function listCharacters() {
    const result = await request(table => table.select(LIST_COLUMNS).eq('owner_id', userId).order('updated_at', { ascending: false }));
    return result.ok ? { ok: true, rows: result.data } : result;
}

// → { ok, data, version, campaign } | { missing: true } — персонажа нет (удалён или чужой) | { error }.
// campaign — { id, name, active } или null (character-list-model.js campaignOf): подпись в «Заметках» (4.2)
export async function loadCharacter(id) {
    const result = await request(table => table.select(`data, version, ${CAMPAIGN_COLUMNS}`).eq('id', id).eq('owner_id', userId).maybeSingle());
    if (!result.ok) return result;
    return result.data ? { ok: true, data: result.data.data, version: result.data.version, campaign: campaignOf(result.data) } : { missing: true };
}

// id выбирает браузер (create-retry.js): повтор после потерянного ответа идёт с тем же id, и копии
// не будет. Владельца, версию и даты ставит база
export async function createCharacter(id, save) {
    const result = await request(table => table.insert({ id, data: save }).select('id, version').single());
    return result.ok ? { ok: true, id: result.data.id, version: result.data.version } : result;
}

// Запись с проверкой версии: строка обновляется, только если в базе та же версия. Ноль строк —
// расхождение (персонаж изменён на другом устройстве или удалён). Условие по владельцу — вторая
// защита рядом с RLS (как в loadCharacter и deleteCharacter): мастер кампании не пишет чужой лист
export async function updateCharacter(id, version, save) {
    const result = await request(table => table.update({ data: save }).eq('id', id).eq('owner_id', userId).eq('version', version).select('version'));
    if (!result.ok) return result;
    return result.data.length ? { ok: true, version: result.data[0].version } : { conflict: true };
}

export async function deleteCharacter(id) {
    const result = await request(table => table.delete().eq('id', id).eq('owner_id', userId));
    return result.ok ? { ok: true } : result;
}

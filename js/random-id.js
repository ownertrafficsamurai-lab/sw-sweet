// Случайный id (UUID версии 4): строка нового персонажа, вкладка и вопрос при выходе («Надёжная
// запись»). crypto.randomUUID есть только в защищённом контексте (https, localhost): приложение,
// открытое по http с адреса в локальной сети, без запасного пути не запустилось бы вовсе.
// getRandomValues есть везде. Модуль чистый — его импортируют тесты в Node
export function randomId(source = globalThis.crypto) {
    if (typeof source.randomUUID === 'function') return source.randomUUID();
    const bytes = source.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;   // версия 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;   // вариант RFC 4122
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

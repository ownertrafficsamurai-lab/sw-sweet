// Цвета Tailwind, которые переключает тема (подпроект А3, часть 3): классы slate-*, yellow-*
// (= акцент темы), игровые шкалы, game-yellow-* (игровой жёлтый), white и on-accent (текст на
// акцентной кнопке) берут цвет из переменных css/themes.css. Классический скрипт сразу после CDN
// Tailwind в index.html: CDN читает tailwind.config при построении стилей.
(() => {
    // CDN не загрузился (нет сети, блокировщик) — страница без Tailwind, но без ошибки в консоли
    if (typeof tailwind === 'undefined') return;
    const STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    const scale = name => Object.fromEntries(STOPS.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]));
    tailwind.config = {
        theme: {
            extend: {
                colors: {
                    slate: scale('slate'),
                    yellow: scale('accent'),
                    red: scale('red'),
                    green: scale('green'),
                    blue: scale('blue'),
                    purple: scale('purple'),
                    orange: scale('orange'),
                    amber: scale('amber'),
                    'game-yellow': scale('game-yellow'),
                    white: 'rgb(var(--sw-white) / <alpha-value>)',
                    'on-accent': 'rgb(var(--sw-on-accent) / <alpha-value>)',
                    'on-accent-bright': 'rgb(var(--sw-on-accent-bright) / <alpha-value>)',
                },
            },
        },
    };
})();

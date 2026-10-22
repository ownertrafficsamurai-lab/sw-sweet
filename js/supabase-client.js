// createClient — из vendor/supabase-js-2.118.0.js: index.html подключает его обычным <script> до модулей,
// и UMD-сборка кладёт библиотеку в globalThis.supabase (версия зафиксирована, без CDN)
const { createClient } = globalThis.supabase;

export const supabase = createClient(
    'https://owtvbvyscopoejavinmj.supabase.co',
    'sb_publishable_OL3JDDAfKycES03VvRLPHg_jTjEQPSb'
);

// Иконки предметов «Снаряжения» (спека 2026-10-01-item-icons.md): id предмета каталога → разметка
// внутренностей SVG (viewBox 0 0 24 24). Контур — цветом текста темы, клинок светового меча
// (class="blade") — акцентом; цвет и толщину задаёт css/style.css (.item-ico), в рисунке их нет.
// Правила рисунка, проверка и контрольный лист — скилл .claude/skills/sw-item-icons корня проекта.
// Модуль чистый при импорте (тесты Node); document нужен только iconElement.
export const ITEM_ICONS = {
    // ---- Оружие ----
    // Световые мечи
    basic_lightsaber: '<line class="blade" x1="9.6" y1="14.4" x2="20" y2="4"/><line class="hilt" x1="4" y1="20" x2="8.6" y2="15.4"/><line x1="7.2" y1="14.2" x2="9.8" y2="16.8"/>',
    double_bladed_lightsaber: '<line class="blade" x1="3" y1="21" x2="8.4" y2="15.6"/><line class="blade" x1="15.6" y1="8.4" x2="21" y2="3"/><line class="hilt" x1="9.4" y1="14.6" x2="14.6" y2="9.4"/><line x1="8.1" y1="13.3" x2="10.7" y2="15.9"/><line x1="13.3" y1="8.1" x2="15.9" y2="10.7"/>',
    shoto: '<line class="blade" x1="10.6" y1="13.4" x2="16.5" y2="7.5"/><line class="hilt" x1="5.5" y1="18.5" x2="9.6" y2="14.4"/><line x1="8.2" y1="13.2" x2="10.8" y2="15.8"/>',
    training_lightsaber: '<line class="blade" x1="9.6" y1="14.4" x2="20" y2="4"/><line class="hilt" x1="4" y1="20" x2="8.6" y2="15.4"/><line x1="7.2" y1="14.2" x2="9.8" y2="16.8"/><line x1="3.5" y1="16.3" x2="7.7" y2="20.5"/>',
    lightsaber_pike: '<line class="blade" x1="15" y1="9" x2="20.5" y2="3.5"/><line x1="3" y1="21" x2="10.5" y2="13.5"/><line class="hilt" x1="10.5" y1="13.5" x2="14" y2="10"/><line x1="12.6" y1="8.8" x2="15.2" y2="11.4"/>',
    // Клинки
    combat_knife: '<line class="hilt" x1="5" y1="19" x2="8.6" y2="15.4"/><line x1="7.2" y1="14" x2="10" y2="16.8"/><path d="M9.9 14.1 17.5 6.5l-1 4.6-4.8 4.8z"/>',
    vibroknife: '<line class="hilt" x1="5" y1="19" x2="8.6" y2="15.4"/><line x1="7.2" y1="14" x2="10" y2="16.8"/><path d="M9.9 14.1 17.5 6.5l-1 4.6-4.8 4.8z"/><path d="M19.5 11.5c.8.8.8 2 0 2.8M17.5 13.5c.5.5.5 1.2 0 1.7"/>',
    ancient_sword: '<circle cx="3.6" cy="20.4" r="1.4"/><line class="hilt" x1="4.8" y1="19.2" x2="7.6" y2="16.4"/><line x1="5.5" y1="13.5" x2="10.5" y2="18.5"/><path d="M7.4 14.4 17.4 4.4l3.1-.9-.9 3.1-10 10z"/>',
    cortosis_sword: '<line class="hilt" x1="4" y1="20" x2="7.8" y2="16.2"/><line x1="6.2" y1="13.2" x2="10.8" y2="17.8"/><path d="M7 14 16 5l4.5-1.5L19 8l-9 9z"/><line x1="10.5" y1="13.5" x2="16.5" y2="7.5"/>',
    vibrosword: '<line class="hilt" x1="4" y1="20" x2="7.8" y2="16.2"/><line x1="6.4" y1="14" x2="10" y2="17.6"/><path d="M7.9 14.3 17.4 4.4l3.1-.9-.9 3.1-9.5 9.9z"/><path d="M20.5 11.5c.8.8.8 2 0 2.8M18.5 13.5c.5.5.5 1.2 0 1.7"/>',
    // Древковое
    vibro_ax: '<line class="hilt" x1="4" y1="20" x2="7" y2="17"/><line x1="7" y1="17" x2="18.5" y2="5.5"/><path d="M14.7 9.3Q11.5 9.5 9 8.6 9.8 3.3 15.6 2.9q-.1 2.6.7 4.8"/><path d="M20 10.5c.8.8.8 2 0 2.8"/>',
    truncheon: '<path d="M4.2 18.2 15.5 4.9a2.6 2.6 0 0 1 3.6 3.6L5.8 19.8z"/><line x1="6.6" y1="14.8" x2="9.2" y2="17.4"/>',
    cortosis_staff_refined: '<line x1="3.5" y1="20.5" x2="20.5" y2="3.5"/><line class="hilt" x1="8" y1="16" x2="10.5" y2="13.5"/><line class="hilt" x1="13.5" y1="10.5" x2="16" y2="8"/>',
    electrostaff: '<line x1="7.5" y1="16.5" x2="16.5" y2="7.5"/><line class="hilt" x1="5" y1="19" x2="7.5" y2="16.5"/><line class="hilt" x1="16.5" y1="7.5" x2="19" y2="5"/><path d="M20.5 8.5l-1.2 2h2L20 12.7M4 11.3l-1.3 2.2h2l-1.2 2"/>',
    force_pike: '<line x1="3.5" y1="20.5" x2="16.2" y2="7.8"/><path d="M15.2 6.8 20.5 3.5 17.2 8.8z"/><path d="M19.5 10.5l-1.5 2h2.5L19 15"/>',
    cortosis_shield: '<path d="M12 3l7.5 2.5V12c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V5.5z"/><path d="M12 7v10"/>',
    // Кулачное
    brass_knuckles: '<circle cx="5" cy="9" r="2.1"/><circle cx="9.7" cy="9" r="2.1"/><circle cx="14.3" cy="9" r="2.1"/><circle cx="19" cy="9" r="2.1"/><path d="M3 11.5V14a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-2.5"/>',
    shock_gloves: '<path d="M7 21v-4.5l-1.5-3V8a5 5 0 0 1 5-5h.5a5 5 0 0 1 5 5v3l2.2-1.8a1.6 1.6 0 0 1 2.2 2.3L16 16.5V21z"/><path d="M11.5 6.5l-2 3.5h2.6l-1.8 3.5M7 18h9"/>',
    cortosis_gauntlets_refined: '<path d="M6 21l1.2-7-1.7-2.5v-4a4.5 4.5 0 0 1 9 0V10l2-1.6a1.5 1.5 0 0 1 2 2.2L15.3 14l1.2 7z"/><path d="M7.2 14h8.1M6.6 17.5h9.3"/>',
    // Пистолеты
    blaster_pistol: '<path d="M3 8h14v2.2h3.5v2H17V14h-6.5L9 19.5H5.8L7.3 14H3z"/><path d="M10.5 14l.6 2.3"/>',
    heavy_blaster_pistol: '<path d="M3 9h14v2.2h3.5v2H17V15h-6.5L9 20.5H5.8L7.3 15H3z"/><path d="M5.5 5.5h7M8 5.5V9M10.5 15l.6 2.3"/>',
    light_blaster_pistol: '<path d="M4 9h8.5v1.5H19v2h-6.5V14H11l-1.5 5h-3L8 14H4z"/><path d="M11 14l.5 2"/>',
    holdout_blaster: '<path d="M6.5 9.5h9v1.2h2v1.8h-2V14h-4.2l-.8 2.5a1.5 1.5 0 0 1-1.4 1h-.7a1 1 0 0 1-1-1.3L8 14H6.5z"/>',
    slugthrower_pistol: '<circle cx="10.5" cy="11.5" r="3"/><path d="M13.2 10h7.3v2.6h-7.2"/><path d="M7.6 10.5H4l-.5 1.5 2 2-1.3 5.5h3.4l1.6-5.2"/><path d="M11.5 14.5l.6 2.3"/>',
    // Длинноствольное
    blaster_carbine: '<path d="M7 9.5h8.5v1H19v2h-3.5v1H13L12 17H9.5l1-3.5H7z"/><path d="M7 10.5H3V15h2l2-2.5"/>',
    blaster_rifle: '<path d="M2 9.5h12.5v1H22v2h-7.5v1H11L10 17H7.5l1-3.5h-2l-2 2.5H2z"/><path d="M6.5 6.5h6M8 6.5v3M11 6.5v3"/>',
    slugthrower_rifle: '<path d="M2 10h14v3H9.5L5 16.5H2z"/><path d="M16 11.5h6M11.5 13v3.5h3V13"/>',
    // Взрывчатка и артиллерия
    frag_grenade: '<circle cx="11.5" cy="14.5" r="6"/><path d="M9.5 8.6V6.2h4v2.4M13.5 6.8l3.8-2.3"/>',
    stun_grenade: '<circle cx="11.5" cy="14.5" r="6"/><path d="M9.5 8.6V6.2h4v2.4M13.5 6.8l3.8-2.3"/><path d="M12.4 11.2l-2 3.3h2.4l-1.8 3.2"/>',
    thermal_detonator: '<circle cx="12" cy="12" r="7.5"/><path d="M4.9 10h14.2M4.9 14h14.2M11 12h2"/>',
    missile_tube: '<rect x="2.5" y="8" width="14.5" height="4.5" rx="0.5"/><path d="M17 8.8h1.5l3 1.5-3 1.4H17M8 12.5l-1 4.5h2.5l1-4.5M13.5 12.5v3"/>',

    // ---- Броня ----
    padded_armor: '<path d="M8 3.5 12 6l4-2.5 3.5 2V20h-15V5.5z"/><path d="M12 6v14M7.5 10.5h2.5M14 10.5h2.5"/>',
    armored_clothing: '<path d="M9 3.5h6l4.5 3V20h-15V6.5z"/><path d="M9 3.5l3 4.5 3-4.5M12 8v12M6.5 13h3M14.5 13h3"/>',
    heavy_clothing: '<path d="M9 5.5 4.5 7.5V20h15V7.5L15 5.5"/><path d="M9 3v3l3 2 3-2V3zM12 8v12"/>',
    armored_robes: '<path d="M12 2.5c-2.5 0-4 1.8-4 4.5L4.5 21h15L16 7c0-2.7-1.5-4.5-4-4.5z"/><path d="M9.8 9V7.5a2.2 2.2 0 0 1 4.4 0V9z"/><rect x="9" y="12" width="6" height="4.5" rx="0.5"/>',
    concealing_robes: '<path d="M12 2.5c-2.5 0-4 1.8-4 4.5L4.5 21h15L16 7c0-2.7-1.5-4.5-4-4.5z"/><path d="M9.2 10V7.3a2.8 2.8 0 0 1 5.6 0V10zM12 13v8"/>',
    adverse_environment_gear: '<path d="M7.5 8.5 4.5 10v10h15V10l-3-1.5"/><path d="M7.5 9V6.5a4.5 4.5 0 0 1 9 0V9zM9.5 5.5h5v1.6h-5zM12 9v11"/>',

    // ---- Снаряжение ----
    // Связь
    comlink_handheld: '<rect x="9" y="8" width="6" height="13" rx="1.5"/><path d="M13 8V3M11 12h2M11 15h2"/>',
    comlink_long_range: '<rect x="4.5" y="12" width="15" height="8.5" rx="1.5"/><path d="M12 12V5M14.5 3.5a3.5 3.5 0 0 1 0 5M9.5 3.5a3.5 3.5 0 0 0 0 5M17.5 2a6.5 6.5 0 0 1 0 8M6.5 2a6.5 6.5 0 0 0 0 8M8 16.2h8"/>',
    holo_messenger: '<ellipse cx="12" cy="18.5" rx="7.5" ry="2.5"/><path d="M9.5 16 6 4.5M14.5 16 18 4.5M12 10.5V14"/><circle cx="12" cy="7.5" r="1.7"/>',
    // Сканеры и оптика
    electrobinoculars: '<rect x="3" y="7" width="6" height="12" rx="1.5"/><rect x="15" y="7" width="6" height="12" rx="1.5"/><path d="M9 9.5h6v6H9M11 12.5h2"/>',
    macrobinoculars: '<rect x="4" y="5.5" width="6" height="13" rx="3"/><rect x="14" y="5.5" width="6" height="13" rx="3"/><path d="M10 10.5h4"/>',
    general_purpose_scanner: '<rect x="6" y="9.5" width="12" height="11.5" rx="1.5"/><rect x="8.5" y="12" width="7" height="4"/><path d="M9.2 6.5a4.5 4.5 0 0 1 5.6 0M6.5 4a8.5 8.5 0 0 1 11 0"/>',
    hand_scanner: '<rect x="6.5" y="8" width="11" height="7.5" rx="1.5"/><path d="M10.5 15.5V21h3v-5.5M9.5 11.7h5M8.5 5a5.5 5.5 0 0 1 7 0"/>',
    scanner_goggles: '<path d="M4 10.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3.5l-1.5-2h-2l-1.5 2H6a2 2 0 0 1-2-2z"/><path d="M4 11H1.5M20 11h2.5"/>',
    // Медицина
    stimpack: '<path d="M15 3.5l5.5 5.5M17.8 6.2l-8.6 8.6-3.6 1 1-3.6 8.6-8.6M4 20l2.4-2.4M11.2 8.6l4.2 4.2"/>',
    emergency_medpac: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    physicians_kit: '<rect x="3.5" y="9" width="17" height="11.5" rx="2"/><path d="M9 9V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V9M12 12v5.5M9.2 14.7h5.6"/>',
    bacta_liter: '<rect x="6" y="8" width="12" height="13" rx="2"/><path d="M9.5 8V4h5v4M12 11c1.5 2 2.2 3 2.2 4.2a2.2 2.2 0 0 1-4.4 0C9.8 14 10.5 13 12 11z"/>',
    bacta_tank: '<rect x="6.5" y="5" width="11" height="14" rx="1"/><path d="M5 3h14M5 21h14M12 11v5M10 12.8h4"/><circle cx="12" cy="8.8" r="1.3"/>',
    synthskin_synthflesh: '<path d="M4.5 14.5 14.5 4.5l5 5-10 10z"/><path d="M12 9.8v4.4M9.8 12h4.4"/>',
    // Кибернетика
    cybernetic_arms: '<circle cx="5.5" cy="6.5" r="2.2"/><circle cx="10.5" cy="16" r="2.2"/><path d="M6.6 8.5l2.8 5.5M12.5 15 17 11.5l3.5-.5M17 11.5l1-3.5"/>',
    cybernetic_legs: '<circle cx="9" cy="5" r="2.2"/><circle cx="11" cy="12.5" r="2.2"/><path d="M9.6 7.2l.8 3.2M11 14.7V20h6"/>',
    cybernetic_eyes: '<path d="M2.5 12c2.5-4 5.7-6 9.5-6s7 2 9.5 6c-2.5 4-5.7 6-9.5 6s-7-2-9.5-6z"/><circle cx="12" cy="12" r="2.6"/><path d="M12 7.5v2M12 14.5v2M7.5 12h2M14.5 12h2"/>',
    cybernetic_brain_implant: '<path d="M8 21v-3.5C6 16.2 4.5 13.8 4.5 11a7.5 7.5 0 0 1 15 0c0 1 .2 1.5 1.5 3.5h-1.5V17a1.5 1.5 0 0 1-1.5 1.5h-1.5V21"/><rect x="9" y="8" width="5" height="5" rx="0.5"/>',
    cyberscanner_limb: '<circle cx="5.5" cy="18.5" r="2.2"/><path d="M7.1 16.9 12.5 11.5l3-.5M12.5 11.5l.5-3M15.5 5a4.5 4.5 0 0 1 3.5 3.5M16 2a7.5 7.5 0 0 1 6 6"/>',
    prosthetic_replacement_limb: '<circle cx="12" cy="12" r="2.2"/><path d="M5 19l5.4-5.4M13.6 10.4 18 6M16 4l4 4M3.4 17.4l3.2 3.2"/>',
    prosthetic_replacement_organ: '<path d="M12 20.5c-5.5-4-8.5-7-8.5-11a4.2 4.2 0 0 1 8.5-1 4.2 4.2 0 0 1 8.5 1c0 4-3 7-8.5 11z"/><path d="M9.5 12.5h5M10.5 12.5v-2M13.5 12.5v-2M12 12.5V16"/>',
    // Препараты
    synthetic_anesthetic: '<path d="M11 2.5h2V5l3 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l3-3z"/><path d="M10.3 11.5h3.4l-3.4 5h3.4"/>',
    synthetic_neuroparalytic: '<path d="M11 2.5h2V5l3 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l3-3z"/><path d="M13 10.5 10.5 14h3L11 17.5"/>',
    synthetic_neurotoxin: '<path d="M11 2.5h2V5l3 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l3-3z"/><path d="M10.2 11.5l3.6 5M13.8 11.5l-3.6 5"/>',
    // Безопасность
    binders: '<circle cx="7.5" cy="15.5" r="3.8"/><circle cx="16.5" cy="15.5" r="3.8"/><path d="M9.6 12.3 12 8.8l2.4 3.5"/>',
    electronic_lock_breaker: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.2v2.2"/>',
    disguise_kit: '<path d="M4 6.5c5-2 11-2 16 0v5c0 4.5-3.5 8-8 9.5-4.5-1.5-8-5-8-9.5z"/><path d="M7.5 11h3M13.5 11h3M10 15.5c1.3.8 2.7.8 4 0"/>',
    restraining_bolt: '<rect x="6" y="8.5" width="12" height="7.5" rx="1.5"/><path d="M9.5 16v4.5M14.5 16v4.5M10 8.5v-3h4v3"/>',
    // Выживание
    breath_mask_respirator: '<path d="M8 6.5h8l1.5 6.5c0 3.5-2.4 6-5.5 6s-5.5-2.5-5.5-6z"/><circle cx="4.5" cy="15" r="2.5"/><circle cx="19.5" cy="15" r="2.5"/><path d="M10.5 11h3M10.5 14h3"/>',
    field_ration_pack: '<path d="M5 6l1.8-2 1.7 2 1.8-2L12 6l1.7-2 1.8 2 1.7-2L19 6v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M9 12h6M9 15.5h3.5"/>',
    spacesuit: '<circle cx="12" cy="7" r="4.5"/><path d="M7.8 10.8 4.5 13v8h15v-8l-3.3-2.2"/><rect x="10" y="14.5" width="4" height="3.5"/>',
    tent: '<path d="M12 4.5 2.5 20h19zM12 11l-3.5 9M12 11l3.5 9M10.8 2.5 12 4.5l1.2-2"/>',
    thermal_cloak: '<path d="M9.5 3.5 4.5 20h15l-5-16.5L12 6z"/><path d="M8.5 12.5c1.2-1 2.3 1 3.5 0s2.3-1 3.5 0M8 16.5c1.3-1 2.7 1 4 0s2.7-1 4 0"/>',
    wilderness_survival_kit: '<circle cx="12" cy="13.5" r="7.5"/><path d="M10.5 6V3.5h3V6"/><path d="M12 9l2 4.5-2 4.5-2-4.5z"/>',
    climbing_gear: '<path d="M7.5 9.5V14a4.5 4.5 0 0 0 4.5 4.5h.5A4.5 4.5 0 0 0 17 14V8a4.5 4.5 0 0 0-4.5-4.5H9"/><path d="M7.5 9.5 9.5 6M17 13c1.5 2 1 4 3 5.5s1 3-1 3.5"/>',
    // Инструменты и прочее
    backpack: '<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0V20h-11z"/><path d="M9.5 14h5v3.5h-5zM10 4.3V3h4v1.3"/>',
    tool_kit: '<path d="M14.5 4a4.5 4.5 0 0 0-4 6.3L4 16.8 7.2 20l6.5-6.5A4.5 4.5 0 0 0 20 9.5l-2.8 2.8-3-3L17 6.5A4.5 4.5 0 0 0 14.5 4z"/>',
    datapad: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7.5h8M8 11h8M8 14.5h5"/>',
    extra_reload: '<rect x="7.5" y="6" width="9" height="15" rx="1.5"/><path d="M10 6V3.5M14 6V3.5M7.5 10h9M7.5 17h9"/>',
    fusion_lantern: '<path d="M8.5 9h7l1.5 9.5H7z"/><path d="M9.5 9V6.5a2.5 2.5 0 0 1 5 0V9M6.5 21h11M2 11l2.5 1M22 11l-2.5 1M2 16h2.5M22 16h-2.5"/>',
    glow_rod: '<line class="hilt" x1="4" y1="20" x2="8" y2="16"/><line x1="8" y1="16" x2="14.5" y2="9.5"/><path d="M15.5 5.5V3M18.5 8.5H21M17.6 6.4l1.9-1.9"/>',
    utility_belt: '<rect x="2" y="9.5" width="20" height="3.5" rx="1"/><rect x="10" y="8" width="4" height="6.5" rx="0.8"/><rect x="3.5" y="13" width="4.5" height="6" rx="1"/><rect x="16" y="13" width="4.5" height="6" rx="1"/>',

    // ---- Запасные: свой предмет и предмет каталога без рисунка (iconKey) ----
    _lightsaber: '<line class="blade" x1="9.6" y1="14.4" x2="20" y2="4"/><line class="hilt" x1="4" y1="20" x2="8.6" y2="15.4"/><line x1="7.2" y1="14.2" x2="9.8" y2="16.8"/>',
    _brawl: '<path d="M6 11V8.5a1.5 1.5 0 0 1 3 0V8a1.5 1.5 0 0 1 3 0v.5a1.5 1.5 0 0 1 3 0V9a1.5 1.5 0 0 1 3 0v5.5a5.5 5.5 0 0 1-5.5 5.5H11a5 5 0 0 1-5-5z"/><path d="M6 13h6.5"/>',
    _melee: '<line class="hilt" x1="5" y1="19" x2="8.6" y2="15.4"/><line x1="7.2" y1="14" x2="10" y2="16.8"/><path d="M9.9 14.1 17.5 6.5l-1 4.6-4.8 4.8z"/>',
    _gunnery: '<circle cx="8" cy="17" r="3.5"/><path d="M6 12.5 19 6l1.5 3-11 5.5"/>',
    _ranged_light: '<path d="M3 8h14v2.2h3.5v2H17V14h-6.5L9 19.5H5.8L7.3 14H3z"/><path d="M10.5 14l.6 2.3"/>',
    _ranged_heavy: '<path d="M2 10h13V8.5h7v2h-4V13h-5.5L11 17H8.5l1-4H6l-2 3H2z"/>',
    _weapon: '<circle cx="12" cy="12" r="6"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    _armor: '<path d="M8 3.5 12 6l4-2.5 3.5 2V20h-15V5.5z"/><path d="M12 6v14M7.5 10.5h2.5M14 10.5h2.5"/>',
    _box: '<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
};

// Запасной рисунок оружия — по навыку (названия навыков — COMBAT_SKILLS_LIST в skills.js)
const FALLBACK_BY_SKILL = {
    'Световой меч': '_lightsaber', 'Драка': '_brawl', 'Ближний бой': '_melee', 'Артиллерия': '_gunnery',
    'Стрельба (Лёгкое)': '_ranged_light', 'Стрельба (Тяжёлое)': '_ranged_heavy',
};
export const FALLBACK_ICONS = [...Object.values(FALLBACK_BY_SKILL), '_weapon', '_armor', '_box'];

// Рисунок предмета каталога: собственный ключ ITEM_ICONS, не запасной. Значение приходит из
// сохранения (custom.icon) и из базы (id строки каталога) — члены Object и запасные ключи не годятся
export function isCatalogIcon(key) {
    return typeof key === 'string' && !key.startsWith('_') && Object.hasOwn(ITEM_ICONS, key);
}

// Ключ рисунка: вид предмета (resolveItem) или строка окна «+ Добавить» ({ type, icon: row.id, skill }).
// Свой рисунок, иначе запасной: нет в каталоге — ящик, оружие — по навыку, броня — торс, снаряжение — ящик
export function iconKey({ type, icon, skill, missing }) {
    if (isCatalogIcon(icon)) return icon;
    if (missing) return '_box';
    if (type === 'weapon') return Object.hasOwn(FALLBACK_BY_SKILL, skill) ? FALLBACK_BY_SKILL[skill] : '_weapon';
    return type === 'armor' ? '_armor' : '_box';
}

// <svg class="item-ico" …> с рисунком. Разметка — только строки этого модуля: key служит ключом
// поиска и в разметку не попадает; неизвестный ключ — ящик
export function iconElement(key) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'item-ico');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = Object.hasOwn(ITEM_ICONS, key) ? ITEM_ICONS[key] : ITEM_ICONS._box;
    return svg;
}

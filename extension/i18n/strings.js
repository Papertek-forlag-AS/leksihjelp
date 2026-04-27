/**
 * Leksihjelp — Internationalization (i18n)
 *
 * Flat key-value translations for NB (Bokmål), NN (Nynorsk), EN (English).
 * Shared across popup, content scripts, and service worker via self.__lexiI18n.
 *
 * Usage:
 *   const { t, initI18n, setUiLanguage, getUiLanguage } = self.__lexiI18n;
 *   await initI18n();
 *   t('search_placeholder')           // => "Søk etter ord..."
 *   t('auth_usage_chars', { count: 8500 })  // => "8 500 tegn"
 */

const _STRINGS = {
  // ──────────────────────────────────────────────────────────
  // NORSK BOKMÅL (default / fallback)
  // ──────────────────────────────────────────────────────────
  nb: {
    // ── Header ──
    pin_label: 'Fest',
    pin_title: 'Hold Leksihjelp åpen i eget vindu',
    skriv_btn_title: 'Åpne skriveokt',
    settings_title: 'Innstillinger',

    // ── Pin overlay ──
    pin_overlay_title: 'Fest Leksihjelp til verktøylinjen',
    pin_step_1: 'Klikk på puslespill-ikonet <strong>🧩</strong> i verktøylinjen',
    pin_step_2: 'Finn <strong>Leksihjelp</strong> i listen over utvidelser',
    pin_step_3: 'Klikk på pin-ikonet <strong>📌</strong> ved siden av Leksihjelp',
    pin_dismiss: 'Skjønte!',

    // ── First-run language picker ──
    picker_title: 'Hvilket fremmedspråk lærer du?',
    picker_note: 'Ordboken lastes ned for bruk offline',
    picker_skip: 'Velg senere i innstillinger',
    picker_downloading: 'Laster ned...',
    picker_failed: 'Nedlasting feilet. Prøv igjen.',
    picker_failed_offline: 'Ingen internettilkobling. Koble til nettet og prøv igjen.',
    hydration_error_offline: 'Ingen internettilkobling — ordlister lastes ned når du er på nett',
    hydration_error_generic: 'Ordlister utilgjengelig — prøv igjen senere',

    // ── Language names ──
    lang_de: 'Tysk',
    lang_es: 'Spansk',
    lang_fr: 'Fransk',
    lang_en: 'Engelsk',
    lang_nn: 'Nynorsk',
    lang_nb: 'Bokmål',
    lang_no: 'Norsk',

    // ── Search ──
    search_placeholder: 'Søk etter ord...',
    search_aria: 'Søk i ordboken',
    search_clear: 'Tøm søk',
    search_no_results: 'Ingen treff',
    search_fallback_hint: 'Viste du resultater fra den andre retningen:',
    search_placeholder_text: 'Skriv et ord for å søke i ordboken',
    skriv_link: 'Trenger du et sted å skrive?',
    skriv_note: 'Lagres kun lokalt i nettleseren',
    search_dir_no_target: 'Norsk → Målspråk',
    search_dir_target_no: 'Målspråk → Norsk',
    search_monolingual: 'ordbok',

    // ── Results ──
    result_explore: 'Utforsk mer ▾',
    result_collapse: 'Skjul ▴',
    result_synonyms: 'Synonymer',
    result_examples: 'Eksempler',
    result_grammar: 'Grammatikk',
    result_conjugation: 'Bøyning',
    result_cases: 'Bøyning (kasus)',
    result_inflection_conjugation: '«{query}» → bøyning av «{word}»',
    result_inflection_plural: '«{query}» → flertall av «{word}»',
    result_inflection_typo: '«{query}» → mente du «{word}»?',
    result_false_friend_heading: 'Falsk venn',

    // ── Declension table headers ──
    decl_def_sg: 'Bestemt ent.',
    decl_indef_sg: 'Ubestemt ent.',
    decl_def_pl: 'Bestemt fl.',
    decl_indef_pl: 'Ubestemt fl.',
    decl_singular: 'Entall',
    decl_plural: 'Flertall',
    decl_indefinite: 'Ubestemt',
    decl_definite: 'Bestemt',

    // ── Part of speech ──
    pos_verb: 'verb',
    pos_noun: 'substantiv',
    pos_adjective: 'adjektiv',
    pos_article: 'artikkel',
    pos_general: 'ord',
    pos_number: 'tall',
    pos_phrase: 'frase',
    pos_pronoun: 'pronomen',
    pos_language: 'språk',           // Phase 05.1 Gap B
    pos_nationality: 'nasjonalitet', // Phase 05.1 Gap B
    pos_verb_short: 'verb',
    pos_noun_short: 'subst.',
    pos_adjective_short: 'adj.',
    pos_article_short: 'art.',
    pos_general_short: 'ord',
    pos_number_short: 'tall',
    pos_phrase_short: 'frase',
    pos_pronoun_short: 'pron.',

    // ── Gender ──
    gender_m: 'maskulin',
    gender_f: 'feminin',
    gender_n: 'nøytrum',
    gender_pl: 'flertall',

    // ── Gender class labels (used by nb-gender rule's three-beat explain, Phase 05.1 Gap C) ──
    gender_label_m: 'hankjønn',
    gender_label_f: 'hunkjønn',
    gender_label_n: 'intetkjønn',

    // ── Spell-check register badge (Phase 05.1-05 inline UX gap-closure) ──
    // Displayed as a small pill in the popover header so the student can tell
    // which Norwegian standard the rule pipeline is running in. Resolved via
    // __lexiSpellCore.getString('register_label_' + lang, lang) — per-target
    // locale, matching the nb-gender three-beat pattern.
    register_label_nb: 'Bokmål',
    register_label_nn: 'Nynorsk',

    // ── Verb tense names ──
    tense_presens: 'Presens',
    tense_preteritum: 'Preteritum',
    tense_perfektum: 'Perfektum',
    tense_infinitive: 'Infinitiv',
    tense_imperative: 'Imperativ',
    tense_past_participle: 'Perfektum partisipp',
    tense_comparative: 'Komparativ',
    tense_superlative: 'Superlativ',

    // ── Settings ──
    settings_back: '← Tilbake',
    settings_language_title: 'Språk',
    settings_language_note: 'Velg språk for ordbok og ordforslag',
    settings_delete_title: 'Slett nedlastet språk',
    settings_delete_confirm: 'Vil du slette {lang}? Ordbok og lydfiler fjernes. Du kan laste ned igjen senere.',
    settings_download_confirm: '{lang} er ikke lastet ned ennå.\n\nDette laster ned ordbok og uttale (~30–50 MB).\n\nVil du fortsette?',
    settings_downloading: 'Laster ned...',
    settings_needs_download: 'last ned',
    settings_download_audio: '🔊↓',
    settings_download_audio_title: 'Last ned uttale',
    settings_download_audio_confirm: 'Last ned uttale for {lang}? (~45 MB)',

    settings_account_title: 'Konto',
    settings_account_note: 'Logg inn med Vipps for ElevenLabs-uttale og abonnement',
    settings_legacy_code: 'Har du en tilgangskode?',
    settings_code_placeholder: 'Skriv inn kode...',
    settings_code_verify: 'Bekreft',
    settings_code_valid: '✓ Kode godkjent! ElevenLabs-uttale er aktivert.',
    settings_code_invalid: '✗ Ugyldig kode.',
    settings_code_rate_limited: '✗ For mange forsøk. Vent litt og prøv igjen.',
    settings_code_offline: '✗ Kunne ikke koble til serveren.',
    settings_code_offline_hint: 'Brannmur eller proxy kan blokkere tilkoblingen. Kontakt IT for å godkjenne leksihjelp.vercel.app',

    settings_prediction_title: 'Ordforslag',
    settings_prediction_toggle: 'Aktiver ordforslag ved skriving',
    settings_spellcheck_alternates_title: 'Skriveforslag',
    settings_spellcheck_alternates_toggle: 'Vis alternative skriveforslag',
    settings_spellcheck_alternates_note: 'Viser opptil 3 forslag om gangen i stedet for bare ett',
    settings_grammar_title: 'Grammatikk i ordboken',
    settings_grammar_note: 'Hvor mye grammatikk vil du se?',
    settings_grammar_customize: 'Tilpass selv',
    settings_darkmode_title: 'Mørk modus',
    settings_darkmode_toggle: 'Bruk mørkt tema',
    settings_darkmode_note: 'Følger systeminnstilling hvis ikke valgt manuelt',
    settings_shortcuts_title: 'Hurtigtaster',
    shortcut_lookup: 'Slå opp markert tekst',
    shortcut_read: 'Les opp markert tekst',
    shortcut_pause: 'Pause/gjenoppta Leksihjelp',

    // ── UI language setting ──
    settings_ui_language_title: 'Visningsspråk',
    settings_ui_language_note: 'Språk for knapper og menyer i Leksihjelp',

    // ── Auth ──
    auth_login_vipps: 'Logg inn med Vipps',
    auth_opening_vipps: 'Åpner Vipps...',
    auth_login_cancelled: 'Innlogging avbrutt',
    auth_login_failed: 'Innlogging feilet. Prøv igjen.',
    auth_logout: 'Logg ut',
    auth_sub_active: 'Aktivt abonnement',
    auth_sub_pending: 'Abonnement venter',
    auth_sub_none: 'Ikke abonnert',
    auth_usage_label: 'Gjenstående uttale',
    auth_usage_chars: '{count} tegn',
    auth_usage_rollover: 'Ubrukte tegn samles opp til sommerferien',
    auth_subscribe_monthly: 'Abonner — 49 kr/mnd (Vipps)',
    auth_subscribe_yearly: 'Betal 490 kr/år (Vipps)',
    auth_subscribe_creating: 'Oppretter abonnement...',
    auth_subscribe_note: 'Inkl. 50 000 tegn naturlig uttale per måned (ubrukte tegn samles opp til sommerferien)',
    auth_topup: 'Kjøp 50 000 tegn — 49 kr (Vipps)',
    auth_topup_opening: 'Åpner Vipps...',

    // ── Nav ──
    nav_dictionary: 'Ordbok',
    nav_pause: 'Pause',
    nav_start: 'Start',
    nav_settings: 'Innstillinger',
    nav_pause_title: 'Skru av ordforslag og uttale midlertidig',

    // ── Widget (floating-widget.js) ──
    widget_title: 'Leksihjelp — Uttale',
    widget_close: 'Lukk',
    widget_target_lang: 'Målspråk',
    widget_norwegian: 'Norsk',
    widget_read_target: 'Les på målspråket',
    widget_read_norwegian: 'Les på norsk',
    widget_play: 'Spill av',
    widget_speed: 'Hastighet',
    widget_font_auto: 'Auto skriftstørrelse',
    widget_font_fixed: 'Fast skriftstørrelse',
    widget_font_smaller: 'Mindre skrift',
    widget_font_larger: 'Større skrift',
    widget_font_auto_tooltip: 'Automatisk skriftstørrelse (klikk for fast)',
    widget_font_fixed_tooltip: 'Fast skriftstørrelse (klikk for auto)',
    widget_selected_text: 'Valgt tekst',
    widget_badge_elevenlabs: 'ElevenLabs — Naturlig uttale',
    widget_badge_browser: 'Nettleser-uttale (gratis)',
    widget_badge_quota: 'Kvoten brukt opp — nettleser-uttale',
    widget_default_voice: 'Standard stemme',
    widget_lookup_header: 'Leksihjelp — Oppslag',
    widget_lookup_grammar: 'Grammatikk:',
    widget_lookup_not_found: 'Fant ikke ordet i ordboken',

    // ── Word prediction ──
    pred_typo_hint: 'mente du?',
    pred_compound_hint: 'sammensatt',
    compound_label: 'Sammensatt ord',
    pred_tab_hint: 'Tab for å velge',
    pred_switch_lang: 'Bytt språk',
    pred_pause: 'Pause ordforslag',
    pred_resume: 'Fortsett ordforslag',
    pred_paused: 'Ordforslag pauset',
    pred_resume_short: 'Fortsett',
    pred_vis_flere: 'Vis flere',
    pred_vis_faerre: 'Vis færre',

    // ── Spell-check manual button + toast (Phase 18 Plan 02) ──
    spell_check_btn_title: 'Sjekk rettskriving med Leksihjelp',
    spell_toast_errors: '{count} feil funnet',
    spell_toast_clean: 'Ser bra ut!',

    // ── Context menus (service worker) ──
    ctx_lookup: 'Slå opp "%s" i Leksihjelp',
    ctx_read: 'Les opp "%s" med Leksihjelp',
    ctx_pause_predictions: 'Pause ordforslag',
    ctx_resume_predictions: 'Fortsett ordforslag',

    // ── First-run UI language picker ──
    ui_picker_title: 'Velg språk / Choose language',
    ui_picker_note: 'Du kan endre dette senere i innstillinger',
  },

  // ──────────────────────────────────────────────────────────
  // NYNORSK
  // ──────────────────────────────────────────────────────────
  nn: {
    pin_label: 'Fest',
    pin_title: 'Hald Leksihjelp ope i eige vindauge',
    skriv_btn_title: 'Opne skriveøkt',
    settings_title: 'Innstillingar',

    pin_overlay_title: 'Fest Leksihjelp til verktøylinjen',
    pin_step_1: 'Klikk på puslespel-ikonet <strong>🧩</strong> i verktøylinjen',
    pin_step_2: 'Finn <strong>Leksihjelp</strong> i lista over utvidingar',
    pin_step_3: 'Klikk på pin-ikonet <strong>📌</strong> ved sida av Leksihjelp',
    pin_dismiss: 'Skjøna!',

    picker_title: 'Kva framandspråk lærer du?',
    picker_note: 'Ordboka vert lasta ned for bruk utan nett',
    picker_skip: 'Vel seinare i innstillingar',
    picker_downloading: 'Lastar ned...',
    picker_failed: 'Nedlasting feila. Prøv igjen.',
    picker_failed_offline: 'Inga internettilkopling. Kopla til nettet og prøv igjen.',
    hydration_error_offline: 'Inga internettilkopling — ordlister vert lasta ned når du er på nett',
    hydration_error_generic: 'Ordlister utilgjengelege — prøv igjen seinare',

    lang_de: 'Tysk',
    lang_es: 'Spansk',
    lang_fr: 'Fransk',
    lang_en: 'Engelsk',
    lang_nn: 'Nynorsk',
    lang_nb: 'Bokmål',
    lang_no: 'Norsk',

    search_placeholder: 'Søk etter ord...',
    search_aria: 'Søk i ordboka',
    search_clear: 'Tøm søk',
    search_no_results: 'Ingen treff',
    search_fallback_hint: 'Viser resultat frå den andre retninga:',
    search_placeholder_text: 'Skriv eit ord for å søkje i ordboka',
    skriv_link: 'Treng du ein stad å skrive?',
    skriv_note: 'Vert berre lagra lokalt i nettlesaren',
    search_dir_no_target: 'Norsk → Målspråk',
    search_dir_target_no: 'Målspråk → Norsk',
    search_monolingual: 'ordbok',

    result_explore: 'Utforsk meir ▾',
    result_collapse: 'Gøym ▴',
    result_synonyms: 'Synonym',
    result_examples: 'Døme',
    result_grammar: 'Grammatikk',
    result_conjugation: 'Bøying',
    result_cases: 'Bøying (kasus)',
    result_inflection_conjugation: '«{query}» → bøying av «{word}»',
    result_inflection_plural: '«{query}» → fleirtal av «{word}»',
    result_false_friend_heading: 'Falsk ven',
    result_inflection_typo: '«{query}» → meinte du «{word}»?',

    decl_def_sg: 'Bestemt ent.',
    decl_indef_sg: 'Ubestemt ent.',
    decl_def_pl: 'Bestemt fl.',
    decl_indef_pl: 'Ubestemt fl.',
    decl_singular: 'Eintal',
    decl_plural: 'Fleirtal',
    decl_indefinite: 'Ubestemt',
    decl_definite: 'Bestemt',

    pos_verb: 'verb',
    pos_noun: 'substantiv',
    pos_adjective: 'adjektiv',
    pos_article: 'artikkel',
    pos_general: 'ord',
    pos_number: 'tal',
    pos_phrase: 'frase',
    pos_pronoun: 'pronomen',
    pos_language: 'språk',           // Phase 05.1 Gap B
    pos_nationality: 'nasjonalitet', // Phase 05.1 Gap B
    pos_verb_short: 'verb',
    pos_noun_short: 'subst.',
    pos_adjective_short: 'adj.',
    pos_article_short: 'art.',
    pos_general_short: 'ord',
    pos_number_short: 'tal',
    pos_phrase_short: 'frase',
    pos_pronoun_short: 'pron.',

    gender_m: 'maskulin',
    gender_f: 'feminin',
    gender_n: 'nøytrum',
    gender_pl: 'fleirtal',

    // ── Gender class labels (used by nb-gender rule's three-beat explain, Phase 05.1 Gap C) ──
    gender_label_m: 'hankjønn',
    gender_label_f: 'hokjønn',
    gender_label_n: 'inkjekjønn',

    // ── Spell-check register badge (Phase 05.1-05 inline UX gap-closure) — see NB block. ──
    register_label_nb: 'Bokmål',
    register_label_nn: 'Nynorsk',

    tense_presens: 'Presens',
    tense_preteritum: 'Preteritum',
    tense_perfektum: 'Perfektum',
    tense_infinitive: 'Infinitiv',
    tense_imperative: 'Imperativ',
    tense_past_participle: 'Perfektum partisipp',
    tense_comparative: 'Komparativ',
    tense_superlative: 'Superlativ',

    settings_back: '← Tilbake',
    settings_language_title: 'Språk',
    settings_language_note: 'Vel språk for ordbok og ordforslag',
    settings_delete_title: 'Slett nedlasta språk',
    settings_delete_confirm: 'Vil du sletta {lang}? Ordbok og lydfiler vert fjerna. Du kan laste ned igjen seinare.',
    settings_download_confirm: '{lang} er ikkje lasta ned enno.\n\nDette lastar ned ordbok og uttale (~30–50 MB).\n\nVil du halde fram?',
    settings_downloading: 'Lastar ned...',
    settings_needs_download: 'last ned',
    settings_download_audio: '🔊↓',
    settings_download_audio_title: 'Last ned uttale',
    settings_download_audio_confirm: 'Last ned uttale for {lang}? (~45 MB)',

    settings_account_title: 'Konto',
    settings_account_note: 'Logg inn med Vipps for ElevenLabs-uttale og abonnement',
    settings_legacy_code: 'Har du ein tilgangskode?',
    settings_code_placeholder: 'Skriv inn kode...',
    settings_code_verify: 'Stadfest',
    settings_code_valid: '✓ Kode godkjend! ElevenLabs-uttale er aktivert.',
    settings_code_invalid: '✗ Ugyldig kode.',
    settings_code_rate_limited: '✗ For mange forsøk. Vent litt og prøv igjen.',
    settings_code_offline: '✗ Kunne ikkje kople til serveren.',
    settings_code_offline_hint: 'Brannmur eller proxy kan blokkere tilkoplinga. Kontakt IT for å godkjenne leksihjelp.vercel.app',

    settings_prediction_title: 'Ordforslag',
    settings_prediction_toggle: 'Aktiver ordforslag ved skriving',
    settings_spellcheck_alternates_title: 'Skriveforslag',
    settings_spellcheck_alternates_toggle: 'Vis alternative skriveforslag',
    settings_spellcheck_alternates_note: 'Viser opptil 3 forslag om gongen i staden for berre eitt',
    settings_grammar_title: 'Grammatikk i ordboka',
    settings_grammar_note: 'Kor mykje grammatikk vil du sjå?',
    settings_grammar_customize: 'Tilpass sjølv',
    settings_darkmode_title: 'Mørk modus',
    settings_darkmode_toggle: 'Bruk mørkt tema',
    settings_darkmode_note: 'Følgjer systeminnstillinga viss ikkje vald manuelt',
    settings_shortcuts_title: 'Hurtigtastar',
    shortcut_lookup: 'Slå opp markert tekst',
    shortcut_read: 'Les opp markert tekst',
    shortcut_pause: 'Pause/gjenoppta Leksihjelp',

    settings_ui_language_title: 'Visningsspråk',
    settings_ui_language_note: 'Språk for knappar og menyar i Leksihjelp',

    auth_login_vipps: 'Logg inn med Vipps',
    auth_opening_vipps: 'Opnar Vipps...',
    auth_login_cancelled: 'Innlogging avbroten',
    auth_login_failed: 'Innlogging feila. Prøv igjen.',
    auth_logout: 'Logg ut',
    auth_sub_active: 'Aktivt abonnement',
    auth_sub_pending: 'Abonnement ventar',
    auth_sub_none: 'Ikkje abonnert',
    auth_usage_label: 'Attståande uttale',
    auth_usage_chars: '{count} teikn',
    auth_usage_rollover: 'Ubrukte teikn vert samla opp til sommarferien',
    auth_subscribe_monthly: 'Abonner — 49 kr/mnd (Vipps)',
    auth_subscribe_yearly: 'Betal 490 kr/år (Vipps)',
    auth_subscribe_creating: 'Opprettar abonnement...',
    auth_subscribe_note: 'Inkl. 50 000 teikn naturleg uttale per månad (ubrukte teikn vert samla opp til sommarferien)',
    auth_topup: 'Kjøp 50 000 teikn — 49 kr (Vipps)',
    auth_topup_opening: 'Opnar Vipps...',

    nav_dictionary: 'Ordbok',
    nav_pause: 'Pause',
    nav_start: 'Start',
    nav_settings: 'Innstillingar',
    nav_pause_title: 'Skru av ordforslag og uttale mellombels',

    widget_title: 'Leksihjelp — Uttale',
    widget_close: 'Lukk',
    widget_target_lang: 'Målspråk',
    widget_norwegian: 'Norsk',
    widget_read_target: 'Les på målspråket',
    widget_read_norwegian: 'Les på norsk',
    widget_play: 'Spel av',
    widget_speed: 'Fart',
    widget_font_auto: 'Auto skriftstorleik',
    widget_font_fixed: 'Fast skriftstorleik',
    widget_font_smaller: 'Mindre skrift',
    widget_font_larger: 'Større skrift',
    widget_font_auto_tooltip: 'Automatisk skriftstorleik (klikk for fast)',
    widget_font_fixed_tooltip: 'Fast skriftstorleik (klikk for auto)',
    widget_selected_text: 'Vald tekst',
    widget_badge_elevenlabs: 'ElevenLabs — Naturleg uttale',
    widget_badge_browser: 'Nettlesar-uttale (gratis)',
    widget_badge_quota: 'Kvoten brukt opp — nettlesar-uttale',
    widget_default_voice: 'Standard stemme',
    widget_lookup_header: 'Leksihjelp — Oppslag',
    widget_lookup_grammar: 'Grammatikk:',
    widget_lookup_not_found: 'Fann ikkje ordet i ordboka',

    pred_typo_hint: 'meinte du?',
    pred_compound_hint: 'samansett',
    compound_label: 'Samansett ord',
    pred_tab_hint: 'Tab for å velje',
    pred_switch_lang: 'Byt språk',
    pred_pause: 'Pause ordforslag',
    pred_resume: 'Hald fram ordforslag',
    pred_paused: 'Ordforslag pausa',
    pred_resume_short: 'Hald fram',
    pred_vis_flere: 'Vis fleire',
    pred_vis_faerre: 'Vis færre',

    // ── Spell-check manual button + toast (Phase 18 Plan 02) ──
    spell_check_btn_title: 'Sjekk rettskriving med Leksihjelp',
    spell_toast_errors: '{count} feil funne',
    spell_toast_clean: 'Ser bra ut!',

    ctx_lookup: 'Slå opp "%s" i Leksihjelp',
    ctx_read: 'Les opp "%s" med Leksihjelp',
    ctx_pause_predictions: 'Pause ordforslag',
    ctx_resume_predictions: 'Hald fram ordforslag',

    ui_picker_title: 'Vel språk / Choose language',
    ui_picker_note: 'Du kan endre dette seinare i innstillingar',
  },

  // ──────────────────────────────────────────────────────────
  // ENGLISH
  // ──────────────────────────────────────────────────────────
  en: {
    pin_label: 'Pin',
    pin_title: 'Keep Leksihjelp open in a separate window',
    skriv_btn_title: 'Open writing space',
    settings_title: 'Settings',

    pin_overlay_title: 'Pin Leksihjelp to the toolbar',
    pin_step_1: 'Click the puzzle icon <strong>🧩</strong> in the toolbar',
    pin_step_2: 'Find <strong>Leksihjelp</strong> in the extensions list',
    pin_step_3: 'Click the pin icon <strong>📌</strong> next to Leksihjelp',
    pin_dismiss: 'Got it!',

    picker_title: 'Which foreign language are you learning?',
    picker_note: 'The dictionary is downloaded for offline use',
    picker_skip: 'Choose later in settings',
    picker_downloading: 'Downloading...',
    picker_failed: 'Download failed. Try again.',
    picker_failed_offline: 'No internet connection. Connect to the internet and try again.',
    hydration_error_offline: 'No internet connection — dictionaries will download when you are online',
    hydration_error_generic: 'Dictionaries unavailable — try again later',

    lang_de: 'German',
    lang_es: 'Spanish',
    lang_fr: 'French',
    lang_en: 'English',
    lang_nn: 'Nynorsk',
    lang_nb: 'Bokmål',
    lang_no: 'Norwegian',

    search_placeholder: 'Search for a word...',
    search_aria: 'Search the dictionary',
    search_clear: 'Clear search',
    search_no_results: 'No results',
    search_fallback_hint: 'Showing results from the other direction:',
    search_placeholder_text: 'Type a word to search the dictionary',
    skriv_link: 'Need a place to write?',
    skriv_note: 'Only saved locally in your browser',
    search_dir_no_target: 'Norwegian → Target language',
    search_dir_target_no: 'Target language → Norwegian',
    search_monolingual: 'dictionary',

    result_explore: 'Explore more ▾',
    result_collapse: 'Hide ▴',
    result_synonyms: 'Synonyms',
    result_examples: 'Examples',
    result_grammar: 'Grammar',
    result_conjugation: 'Conjugation',
    result_cases: 'Declension (cases)',
    result_inflection_conjugation: '"{query}" → conjugation of "{word}"',
    result_inflection_plural: '"{query}" → plural of "{word}"',
    result_inflection_typo: 'Did you mean "{word}"?',
    result_false_friend_heading: 'False friend',

    decl_def_sg: 'Definite sg.',
    decl_indef_sg: 'Indefinite sg.',
    decl_def_pl: 'Definite pl.',
    decl_indef_pl: 'Indefinite pl.',
    decl_singular: 'Singular',
    decl_plural: 'Plural',
    decl_indefinite: 'Indefinite',
    decl_definite: 'Definite',

    pos_verb: 'verb',
    pos_noun: 'noun',
    pos_adjective: 'adjective',
    pos_article: 'article',
    pos_general: 'word',
    pos_number: 'number',
    pos_phrase: 'phrase',
    pos_pronoun: 'pronoun',
    pos_language: 'language',        // Phase 05.1 Gap B
    pos_nationality: 'nationality',  // Phase 05.1 Gap B
    pos_verb_short: 'verb',
    pos_noun_short: 'noun',
    pos_adjective_short: 'adj.',
    pos_article_short: 'art.',
    pos_general_short: 'word',
    pos_number_short: 'num.',
    pos_phrase_short: 'phrase',
    pos_pronoun_short: 'pron.',

    gender_m: 'masculine',
    gender_f: 'feminine',
    gender_n: 'neuter',
    gender_pl: 'plural',

    // ── Gender class labels (used by nb-gender rule's three-beat explain, Phase 05.1 Gap C) ──
    gender_label_m: 'masculine',
    gender_label_f: 'feminine',
    gender_label_n: 'neuter',

    // ── Spell-check register badge (Phase 05.1-05 inline UX gap-closure) — see NB block. ──
    // Proper names of the two Norwegian written standards — kept as-is in EN. ──
    register_label_nb: 'Bokmål',
    register_label_nn: 'Nynorsk',

    tense_presens: 'Present',
    tense_preteritum: 'Past',
    tense_perfektum: 'Perfect',
    tense_infinitive: 'Infinitive',
    tense_imperative: 'Imperative',
    tense_past_participle: 'Past participle',
    tense_comparative: 'Comparative',
    tense_superlative: 'Superlative',

    settings_back: '← Back',
    settings_language_title: 'Language',
    settings_language_note: 'Choose language for dictionary and word predictions',
    settings_delete_title: 'Delete downloaded language',
    settings_delete_confirm: 'Delete {lang}? Dictionary and audio files will be removed. You can re-download later.',
    settings_download_confirm: '{lang} has not been downloaded yet.\n\nThis downloads dictionary and pronunciation (~30–50 MB).\n\nContinue?',
    settings_downloading: 'Downloading...',
    settings_needs_download: 'download',
    settings_download_audio: '🔊↓',
    settings_download_audio_title: 'Download pronunciation',
    settings_download_audio_confirm: 'Download pronunciation for {lang}? (~45 MB)',

    settings_account_title: 'Account',
    settings_account_note: 'Log in with Vipps for ElevenLabs pronunciation and subscription',
    settings_legacy_code: 'Do you have an access code?',
    settings_code_placeholder: 'Enter code...',
    settings_code_verify: 'Verify',
    settings_code_valid: '✓ Code accepted! ElevenLabs pronunciation is activated.',
    settings_code_invalid: '✗ Invalid code.',
    settings_code_rate_limited: '✗ Too many attempts. Wait a moment and try again.',
    settings_code_offline: '✗ Could not connect to the server.',
    settings_code_offline_hint: 'A firewall or proxy may be blocking the connection. Contact IT to allow leksihjelp.vercel.app',

    settings_prediction_title: 'Word predictions',
    settings_prediction_toggle: 'Enable word predictions while typing',
    settings_grammar_title: 'Grammar in dictionary',
    settings_grammar_note: 'How much grammar do you want to see?',
    settings_grammar_customize: 'Customize',
    settings_darkmode_title: 'Dark mode',
    settings_darkmode_toggle: 'Use dark theme',
    settings_darkmode_note: 'Follows system setting if not set manually',
    settings_shortcuts_title: 'Keyboard shortcuts',
    shortcut_lookup: 'Look up selected text',
    shortcut_read: 'Read selected text aloud',
    shortcut_pause: 'Pause/resume Leksihjelp',

    settings_ui_language_title: 'Display language',
    settings_ui_language_note: 'Language for buttons and menus in Leksihjelp',

    auth_login_vipps: 'Log in with Vipps',
    auth_opening_vipps: 'Opening Vipps...',
    auth_login_cancelled: 'Login cancelled',
    auth_login_failed: 'Login failed. Try again.',
    auth_logout: 'Log out',
    auth_sub_active: 'Active subscription',
    auth_sub_pending: 'Subscription pending',
    auth_sub_none: 'Not subscribed',
    auth_usage_label: 'Remaining pronunciation',
    auth_usage_chars: '{count} characters',
    auth_usage_rollover: 'Unused characters roll over until summer holiday',
    auth_subscribe_monthly: 'Subscribe — 49 NOK/mo (Vipps)',
    auth_subscribe_yearly: 'Pay 490 NOK/year (Vipps)',
    auth_subscribe_creating: 'Creating subscription...',
    auth_subscribe_note: 'Incl. 50,000 characters natural pronunciation per month (unused characters roll over until summer)',
    auth_topup: 'Buy 50,000 characters — 49 NOK (Vipps)',
    auth_topup_opening: 'Opening Vipps...',

    nav_dictionary: 'Dictionary',
    nav_pause: 'Pause',
    nav_start: 'Start',
    nav_settings: 'Settings',
    nav_pause_title: 'Temporarily disable word suggestions and pronunciation',

    widget_title: 'Leksihjelp — Pronunciation',
    widget_close: 'Close',
    widget_target_lang: 'Target language',
    widget_norwegian: 'Norwegian',
    widget_read_target: 'Read in target language',
    widget_read_norwegian: 'Read in Norwegian',
    widget_play: 'Play',
    widget_speed: 'Speed',
    widget_font_auto: 'Auto font size',
    widget_font_fixed: 'Fixed font size',
    widget_font_smaller: 'Smaller text',
    widget_font_larger: 'Larger text',
    widget_font_auto_tooltip: 'Auto font size (click for fixed)',
    widget_font_fixed_tooltip: 'Fixed font size (click for auto)',
    widget_selected_text: 'Selected text',
    widget_badge_elevenlabs: 'ElevenLabs — Natural pronunciation',
    widget_badge_browser: 'Browser speech (free)',
    widget_badge_quota: 'Quota used up — browser speech',
    widget_default_voice: 'Default voice',
    widget_lookup_header: 'Leksihjelp — Lookup',
    widget_lookup_grammar: 'Grammar:',
    widget_lookup_not_found: 'Word not found in dictionary',

    pred_typo_hint: 'did you mean?',
    pred_compound_hint: 'compound',
    compound_label: 'Compound word',
    pred_tab_hint: 'Tab to select',
    pred_switch_lang: 'Switch language',
    pred_pause: 'Pause predictions',
    pred_resume: 'Resume predictions',
    pred_paused: 'Predictions paused',
    pred_resume_short: 'Resume',

    // ── Spell-check manual button + toast (Phase 18 Plan 02) ──
    spell_check_btn_title: 'Check spelling with Leksihjelp',
    spell_toast_errors: '{count} errors found',
    spell_toast_clean: 'Looks good!',

    ctx_lookup: 'Look up "%s" in Leksihjelp',
    ctx_read: 'Read "%s" with Leksihjelp',
    ctx_pause_predictions: 'Pause predictions',
    ctx_resume_predictions: 'Resume predictions',

    ui_picker_title: 'Velg språk / Choose language',
    ui_picker_note: 'You can change this later in settings',
  }
};

// ── Runtime state ──
let _uiLang = 'nb';

/**
 * Translate a key, optionally interpolating {param} placeholders.
 * Fallback chain: requested language → nb → raw key.
 */
function _t(key, params) {
  const str = _STRINGS[_uiLang]?.[key] ?? _STRINGS.nb[key] ?? key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
}

/**
 * Set the UI language (call before rendering).
 */
function _setUiLanguage(lang) {
  _uiLang = _STRINGS[lang] ? lang : 'nb';
}

/**
 * Initialize from chrome.storage.local (async).
 */
async function _initI18n() {
  try {
    const result = await new Promise(resolve => {
      chrome.storage.local.get('uiLanguage', resolve);
    });
    _uiLang = result.uiLanguage && _STRINGS[result.uiLanguage] ? result.uiLanguage : 'nb';
  } catch {
    _uiLang = 'nb';
  }
}

/**
 * Get the current UI language code.
 */
function _getUiLanguage() {
  return _uiLang;
}

/**
 * Get the language name for a language code in the current UI language.
 */
function _langName(code) {
  return _t('lang_' + code) || code.toUpperCase();
}

// Export to global scope (works in popup, content scripts, and service worker)
self.__lexiI18n = {
  t: _t,
  setUiLanguage: _setUiLanguage,
  initI18n: _initI18n,
  getUiLanguage: _getUiLanguage,
  langName: _langName,
  STRINGS: _STRINGS
};

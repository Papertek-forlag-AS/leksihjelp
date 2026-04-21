/**
 * Spell-check rule: NB↔NN dialect-mix detection (priority 35).
 *
 * Phase 05.1 / Gap D / UX-01 close gate.
 *
 * User memory (2026-04-21, project_nb_nn_no_mixing.md): NB and NN are two
 * distinct official written standards of Norwegian and may not be mixed
 * in a single document. Analogy: "it is like you shouldn't accept German
 * words when writing bokmål or nynorsk." Reverses Phase 4's SC-03
 * `sisterValidWords` early-exit tolerance.
 *
 * Guard: fires ONLY when token is in vocab.sisterValidWords (valid in
 * the OTHER dialect) AND NOT in vocab.validWords (invalid in the current
 * dialect). Words valid in both dialects (hus, er, og, many common
 * morphologically-shared lemmas that live in both dialects via the
 * translation-seam — see SUMMARY) naturally pass through. Words valid in
 * neither (typos) fall to typo-curated/fuzzy.
 *
 * Priority 35 slots ABOVE sarskriving (30) and BELOW typo-curated (40) /
 * typo-fuzzy (50). On overlap, dedupeOverlapping keeps dialect-mix over
 * typo rules, teaching the student the cross-dialect reason rather than
 * the weaker "unknown word" reason. Does NOT tie with sarskriving.
 *
 * Research note (RESEARCH.md Pitfall 1): CONTEXT.md stated priority 30,
 * but nb-sarskriving.js is already 30. Moved to 35 for disambiguation.
 * See 05.1-CONTEXT.md "Research Amendments (2026-04-21)".
 *
 * Rule ID: 'dialect-mix'. Deliberately new (not reusing 'typo') so
 * renderExplain in spell-check.js routes via the dedicated three-way
 * lookup (rule_id, priority, lang) to this rule's explain callable.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  // Two directional Maps (research-recommended shape over single bidirectional
  // Map; see RESEARCH.md Pitfall 9). NN→NB used in NB document sessions
  // (student typed NN, we suggest NB). NB→NN used in NN document sessions.
  // Curated high-confidence pairs per direction. Papertek-vocabulary
  // promotion of this data is deferred per CONTEXT.md.
  const NN_TO_NB = new Map([
    // Pronouns
    ['eg', 'jeg'], ['ho', 'hun'], ['dei', 'de'], ['dykk', 'dere'],
    // Negation / particles
    ['ikkje', 'ikke'],
    // Quantifiers / function words
    ['berre', 'bare'], ['nokon', 'noen'], ['noko', 'noe'],
    ['mykje', 'mye'],
    // Question words
    ['kva', 'hva'], ['kvar', 'hvor'], ['korleis', 'hvordan'],
    ['kven', 'hvem'], ['kvifor', 'hvorfor'], ['kor', 'hvor'],
    // Common irregular verbs
    ['vere', 'være'], ['vore', 'vært'],
    ['vert', 'blir'], ['blei', 'ble'], ['vart', 'ble'],
    // High-frequency NN-only verb forms
    ['meinte', 'mente'], ['meiner', 'mener'], ['meine', 'mene'],
    ['høyre', 'høre'], ['høyrer', 'hører'], ['høyrt', 'hørt'],
    ['såg', 'så'], ['seier', 'sier'],
    ['byt', 'bytt'],
    // Common nouns / adverbs / adjectives
    ['heim', 'hjem'], ['heime', 'hjemme'], ['no', 'nå'],
    ['saman', 'sammen'],
    ['gjer', 'gjør'], ['gjere', 'gjøre'],
    ['fekk', 'fikk'],
  ]);

  const NB_TO_NN = new Map([
    // Pronouns
    ['jeg', 'eg'], ['hun', 'ho'], ['de', 'dei'], ['dere', 'dykk'],
    // Negation / particles
    ['ikke', 'ikkje'],
    // Quantifiers / function words
    ['bare', 'berre'], ['noen', 'nokon'], ['noe', 'noko'],
    ['mye', 'mykje'],
    // Question words
    ['hva', 'kva'], ['hvor', 'kvar'], ['hvordan', 'korleis'],
    ['hvem', 'kven'], ['hvorfor', 'kvifor'],
    // Common irregular verbs
    ['være', 'vere'], ['vært', 'vore'],
    ['ble', 'vart'],
    // High-frequency NB-only verb forms
    ['mente', 'meinte'], ['mener', 'meiner'], ['mene', 'meine'],
    ['høre', 'høyre'], ['hører', 'høyrer'], ['hørt', 'høyrt'],
    ['sier', 'seier'],
    ['bytt', 'byt'],
    // Common nouns / adverbs / adjectives
    ['hjem', 'heim'], ['hjemme', 'heime'], ['nå', 'no'],
    ['sammen', 'saman'],
    ['gjør', 'gjer'], ['gjøre', 'gjere'],
    ['fikk', 'fekk'],
  ]);

  function fixFor(word, lang) {
    const map = lang === 'nb' ? NN_TO_NB : NB_TO_NN;
    return map.get(word.toLowerCase());
  }

  const rule = {
    id: 'dialect-mix',
    languages: ['nb', 'nn'],
    priority: 35,
    explain: (finding) => {
      const other = finding.lang === 'nn' ? 'bokmål' : 'nynorsk';
      const docDialect = finding.lang === 'nn' ? 'nynorsk' : 'bokmål';
      const hasFix = !!finding.fix;
      const base = `<em>${escapeHtml(finding.original)}</em> er ${other}`;
      if (hasFix) {
        const tail = ` — prøv <em>${escapeHtml(finding.fix)}</em>.`;
        // Same template renders identically in both NB and NN popovers —
        // the copy describes the student's document and their typed word,
        // not the popover's register. Both keys returned for contract shape.
        return { nb: base + tail, nn: base + tail };
      }
      // No-fix fallback — hedged question invites the student to confirm register
      const fallback = `${base}. Skriv du ${docDialect}?`;
      return { nb: fallback, nn: fallback };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed, lang } = ctx;
      // Dialect-mix is NB/NN only — silent no-op for other languages.
      if (lang !== 'nb' && lang !== 'nn') return [];
      const validWords = vocab.validWords || new Set();
      const sisterValidWords = vocab.sisterValidWords || new Set();
      const out = [];
      const crossMap = lang === 'nb' ? NN_TO_NB : NB_TO_NN;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (suppressed && suppressed.has(i)) continue;
        // Guard: fires ONLY when sister-valid AND NOT current-valid
        if (validWords.has(t.word)) continue;
        if (!sisterValidWords.has(t.word)) continue;
        // Phase 05.1 Gap D executor refinement (Rule 4 discovery at fixture
        // run): `sisterValidWords \ validWords` is a 6.6K-word superset that
        // includes many words genuinely shared between the two dialects but
        // missing from one dialect's data (e.g. 'liker' in NN, 'klokka' in
        // NB, 'jorda', 'havet', 'tavla' — noun-form definiteness, verb
        // inflections, etc.). Firing on the full superset produces a storm
        // of false positives on valid Norwegian text. Restrict to the
        // CROSS_DIALECT_MAP (curated high-confidence dialect markers) —
        // losing the no-fix fallback path in exchange for zero false
        // positives. Documented in 05.1-04-SUMMARY.md as the authoritative
        // rule-fire gate until the data layer (papertek-vocabulary) gains
        // true cross-dialect equivalence metadata.
        const rawFix = crossMap.get(t.word);
        if (!rawFix) continue;
        const fix = matchCase(t.display, rawFix);
        out.push({
          rule_id: 'dialect-mix',
          priority: rule.priority,
          start: t.start,
          end: t.end,
          original: t.display,
          lang,                                 // carries document lang to explain()
          fix,                                  // undefined → no-fix fallback copy
          message: `Dialektblanding: "${t.display}" er ${lang === 'nb' ? 'nynorsk' : 'bokmål'}${fix ? ` → "${fix}"` : ''}`,
        });
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

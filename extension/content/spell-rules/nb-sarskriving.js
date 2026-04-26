/**
 * Spell-check rule: særskriving compound noun (priority 30).
 *
 * Flags two adjacent words whose concatenation is a known compound noun:
 * "skole sekk" → "skolesekk". A blocklist of common short words (i, på,
 * av, til, …) prevents false positives where the concatenation happens to
 * match a compound but the surface form is a normal preposition phrase.
 *
 * Rule ID: 'sarskriving' — preserved verbatim from pre-INFRA-03 inline rule.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { escapeHtml } = host.__lexiSpellCore || {};

  // Words that should never trigger særskriving even when the concatenation
  // happens to exist as a compound. Tuned conservatively to avoid false
  // positives.
  //
  // Two classes of entries:
  //   1. Function words (prepositions, articles, pronouns, conjunctions) —
  //      grammar should never glue these to the next noun.
  //   2. Common adjectives whose concatenation with a following noun ALSO
  //      happens to exist in compoundNouns (e.g., `stor` + `by` = `storby`
  //      which IS a real Norwegian compound, but "Hun bor i en stor by"
  //      means "She lives in a big city" — adjective phrase, not compound).
  //      Surfaced by Plan 04-03 fixture expansion as a real false-positive
  //      class on adjective+noun acceptance cases.
  const SARSKRIVING_BLOCKLIST = new Set([
    // Function words
    'i', 'på', 'av', 'til', 'med', 'for', 'om', 'er', 'og', 'å', 'at',
    'som', 'en', 'ei', 'et', 'ein', 'eit', 'det', 'den', 'de', 'dei',
    'du', 'jeg', 'eg', 'han', 'hun', 'ho', 'vi', 'dere', 'dykk', 'meg',
    'deg', 'oss', 'dem', 'seg', 'min', 'din', 'sin', 'vår', 'ikke',
    'ikkje', 'nei', 'ja',
    // Common adjectives that can collide with compoundNouns as the left half
    'stor', 'liten', 'god', 'dårlig', 'ny', 'gammel', 'gamal', 'lang',
    'kort', 'varm', 'kald', 'fin', 'snill', 'tom', 'full', 'ren', 'rein',
    'skitten', 'rød', 'blå', 'hvit', 'kvit', 'svart', 'grønn', 'gul',
    'syk', 'frisk', 'rask', 'sen', 'sein', 'hard', 'myk', 'våt', 'tørr',
    'tynn', 'tykk', 'tjukk', 'bred', 'brei', 'smal', 'høy', 'høg', 'lav',
    'låg', 'tung', 'lett', 'mye', 'litt', 'noen', 'noire', 'alle', 'hver',
    'kvar', 'begge', 'selv', 'sjølv'
  ]);

  const rule = {
    id: 'sarskriving',
    languages: ['nb', 'nn'],
    priority: 30,
    severity: 'error',
    explain: (finding) => {
      if (!finding.original || !finding.fix) {
        return {
          nb: 'To ord som kanskje hører sammen.',
          nn: 'To ord som kanskje høyrer saman.',
        };
      }
      return {
        nb: `<em>${escapeHtml(finding.original)}</em> kan være to ord som hører sammen som <em>${escapeHtml(finding.fix)}</em>.`,
        nn: `<em>${escapeHtml(finding.original)}</em> kan vere to ord som høyrer saman som <em>${escapeHtml(finding.fix)}</em>.`,
      };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed } = ctx;
      const compoundNouns = vocab.compoundNouns || new Set();
      const decompose = vocab.decomposeCompound; // Phase 17 COMP-07
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = tokens[i - 1];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        // Phase 4 / SC-02 + SC-04: skip if EITHER current or previous token
        // is suppressed — the finding spans both so both must be eligible.
        if (suppressed && (suppressed.has(i) || (i > 0 && suppressed.has(i - 1)))) continue;
        if (
          prev &&
          prev.word.length >= 2 && t.word.length >= 2 &&
          !SARSKRIVING_BLOCKLIST.has(prev.word) &&
          !SARSKRIVING_BLOCKLIST.has(t.word)
        ) {
          const concat = prev.word + t.word;
          const isKnownCompound = compoundNouns.has(concat);
          // Phase 17 COMP-07: decomposition fallback — only when stored lookup
          // misses and only for high-confidence decompositions (both parts known nouns).
          const isDecomposable = !isKnownCompound && decompose &&
            (() => { const d = decompose(concat); return d && d.confidence === 'high'; })();

          if (isKnownCompound || isDecomposable) {
            out.push({
              rule_id: 'sarskriving',
              priority: rule.priority,
              start: prev.start,
              end: t.end,
              original: `${prev.display} ${t.display}`,
              fix: prev.display + t.display.toLowerCase(),
              message: `Særskriving: "${prev.display} ${t.display}" skrives som ett ord`,
            });
          }
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

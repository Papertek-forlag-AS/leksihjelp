/**
 * Spell-check rule: gender article mismatch (priority 10).
 *
 * Flags article-noun pairs where the article's grammatical gender does not
 * match the noun's gender. Checks both immediately previous word and 2-back
 * (catches "en stor hus" where an adjective sits between).
 *
 * In Bokmål, feminine nouns accept the common-gender article "en" too:
 * "en bok" and "ei bok" are both correct. Only flags strict mismatches.
 *
 * Rule ID: 'gender' — preserved verbatim from pre-INFRA-03 inline rule.
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml, getString } = host.__lexiSpellCore || {};

  const ARTICLE_GENUS = {
    nb: { 'en': 'm', 'ei': 'f', 'et': 'n' },
    nn: { 'ein': 'm', 'ei': 'f', 'eit': 'n' },
  };
  const GENUS_ARTICLE = {
    nb: { 'm': 'en', 'f': 'ei', 'n': 'et' },
    nn: { 'm': 'ein', 'f': 'ei', 'n': 'eit' },
  };

  // Phase 05.1 Gap C: maps the genus code carried on each finding
  // (actualGenus field) to the i18n key for that gender class's canonical
  // label. The label resolves per-target-register via __lexiSpellCore.getString
  // — NB: hankjønn / hunkjønn / intetkjønn; NN: hankjønn / hokjønn / inkjekjønn.
  const GENUS_TO_LABEL_KEY = { m: 'gender_label_m', f: 'gender_label_f', n: 'gender_label_n' };

  const rule = {
    id: 'gender',
    languages: ['nb', 'nn'],
    priority: 10,
    // Phase 05.1 Gap C: three-beat copy — names the target gender class
    // ("<em>by</em> er hankjønn") so the student learns the classification,
    // not just the fix. Falls back to the Phase 5 two-beat copy when the new
    // fields (noun_display, actualGenus) are missing — defensive against
    // external finding-shape mutation, older findings flowing through, and
    // the check-explain-contract fake-finding path (which omits both fields).
    explain: (finding) => {
      const labelKey = GENUS_TO_LABEL_KEY[finding.actualGenus];
      const nounDisplay = finding.noun_display;
      if (!labelKey || !nounDisplay || typeof getString !== 'function') {
        return {
          nb: `<em>${escapeHtml(finding.original)}</em> kan være feil kjønn — prøv <em>${escapeHtml(finding.fix)}</em>.`,
          nn: `<em>${escapeHtml(finding.original)}</em> kan vere feil kjønn — prøv <em>${escapeHtml(finding.fix)}</em>.`,
        };
      }
      const labelNb = getString(labelKey, 'nb');
      const labelNn = getString(labelKey, 'nn');
      return {
        nb: `<em>${escapeHtml(finding.original)}</em> kan være feil kjønn — <em>${escapeHtml(nounDisplay)}</em> er ${escapeHtml(labelNb)}. Prøv <em>${escapeHtml(finding.fix)}</em>.`,
        nn: `<em>${escapeHtml(finding.original)}</em> kan vere feil kjønn — <em>${escapeHtml(nounDisplay)}</em> er ${escapeHtml(labelNn)}. Prøv <em>${escapeHtml(finding.fix)}</em>.`,
      };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos, lang } = ctx;
      const nounGenus = vocab.nounGenus || new Map();
      const articles = ARTICLE_GENUS[lang];
      const genusArticle = GENUS_ARTICLE[lang];
      const out = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = tokens[i - 1];
        const prevPrev = tokens[i - 2];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        let articleTok = null;
        if (prev && articles[prev.word]) articleTok = prev;
        else if (prevPrev && articles[prevPrev.word]) articleTok = prevPrev;
        if (articleTok && nounGenus.has(t.word)) {
          const expected = articles[articleTok.word];
          const actual = nounGenus.get(t.word);
          const acceptable = (
            actual === expected ||
            (lang === 'nb' && actual === 'f' && articleTok.word === 'en')
          );
          if (actual && !acceptable) {
            const correctArticle = genusArticle[actual];
            if (correctArticle) {
              out.push({
                rule_id: 'gender',
                priority: rule.priority,
                start: articleTok.start,
                end: articleTok.end,
                original: articleTok.display,
                noun_display: t.display,   // Phase 05.1 Gap C — cased noun form for three-beat copy
                actualGenus: actual,       // Phase 05.1 Gap C — m/f/n so explain resolves label via i18n
                fix: matchCase(articleTok.display, correctArticle),
                message: `Kjønn: "${articleTok.display} ${t.display}" skulle vært "${correctArticle} ${t.display}"`,
              });
            }
          }
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

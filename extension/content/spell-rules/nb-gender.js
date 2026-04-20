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
  const { matchCase, escapeHtml } = host.__lexiSpellCore || {};

  const ARTICLE_GENUS = {
    nb: { 'en': 'm', 'ei': 'f', 'et': 'n' },
    nn: { 'ein': 'm', 'ei': 'f', 'eit': 'n' },
  };
  const GENUS_ARTICLE = {
    nb: { 'm': 'en', 'f': 'ei', 'n': 'et' },
    nn: { 'm': 'ein', 'f': 'ei', 'n': 'eit' },
  };

  const rule = {
    id: 'gender',
    languages: ['nb', 'nn'],
    priority: 10,
    explain: (finding) => ({
      nb: `<em>${escapeHtml(finding.original)}</em> kan være feil kjønn — prøv <em>${escapeHtml(finding.fix)}</em>.`,
      nn: `<em>${escapeHtml(finding.original)}</em> kan vere feil kjønn — prøv <em>${escapeHtml(finding.fix)}</em>.`,
    }),
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

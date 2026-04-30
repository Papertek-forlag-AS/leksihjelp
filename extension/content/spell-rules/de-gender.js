/**
 * Spell-check rule: German gender article mismatch (priority 15).
 *
 * Flags Nominative article-noun pairs where the article's grammatical gender 
 * does not match the noun's gender.
 * 
 * Target articles: der (m), die (f), das (n), eine (f).
 *
 * Rule ID: 'gender'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const { matchCase, escapeHtml, getString } = host.__lexiSpellCore || {};

  const ARTICLE_GENUS = {
    'der': 'm',
    'die': 'f',
    'das': 'n',
    'eine': 'f',
  };
  const GENUS_ARTICLE = {
    'm': 'der',
    'f': 'die',
    'n': 'das',
  };

  const GENUS_TO_LABEL_KEY = { m: 'gender_label_m', f: 'gender_label_f', n: 'gender_label_n' };

  const DATIVE_PREPS = new Set(['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu', 'an', 'auf', 'hinter', 'in', 'neben', 'über', 'unter', 'vor', 'zwischen']);

  const rule = {
    id: 'gender',
    languages: ['de'],
    priority: 15,
    exam: {
      safe: true,
      reason: "Lookup-shaped grammar rule (de-gender) — Chrome native parity confirmed in 33-03 audit: DE gender lookup against noun gender map; single-token article suggestion",
      category: "grammar-lookup",
    },
    severity: 'error',
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
      const { tokens, vocab, cursorPos } = ctx;
      const nounGenus = vocab.nounGenus || new Map();
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const prev = tokens[i - 1];
        const prevPrev = tokens[i - 2];
        const prevPrevPrev = tokens[i - 3];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        let articleTok = null;
        let artIdx = -1;
        if (prev && ARTICLE_GENUS[prev.word]) {
          articleTok = prev;
          artIdx = i - 1;
        } else if (prevPrev && ARTICLE_GENUS[prevPrev.word]) {
          articleTok = prevPrev;
          artIdx = i - 2;
        }

        if (articleTok && nounGenus.has(t.word)) {
          const expected = ARTICLE_GENUS[articleTok.word];
          const actual = nounGenus.get(t.word);

          if (actual && actual !== expected) {
            // Check for Dative Feminine: Prep + der + [adj] + noun(f)
            const preArt = tokens[artIdx - 1];
            const isDativeFem = actual === 'f' && articleTok.word === 'der' && preArt && DATIVE_PREPS.has(preArt.word);
            
            if (!isDativeFem) {
              const correctArticle = GENUS_ARTICLE[actual];
              if (correctArticle) {
                out.push({
                  rule_id: 'gender',
                  priority: rule.priority,
                  start: articleTok.start,
                  end: articleTok.end,
                  original: articleTok.display,
                  noun_display: t.display,
                  actualGenus: actual,
                  fix: matchCase(articleTok.display, correctArticle),
                  message: `Kjønn: "${articleTok.display} ${t.display}" skulle vært "${correctArticle} ${t.display}"`,
                });
              }
            }
          }
        }
        
        // Manual check for 'ein' vs feminine nouns
        if (prev && prev.word === 'ein' && nounGenus.get(t.word) === 'f') {
           out.push({
            rule_id: 'gender',
            priority: rule.priority,
            start: prev.start,
            end: prev.end,
            original: prev.display,
            noun_display: t.display,
            actualGenus: 'f',
            fix: matchCase(prev.display, 'eine'),
            message: `Kjønn: "${prev.display} ${t.display}" skulle vært "eine ${t.display}"`,
          });
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

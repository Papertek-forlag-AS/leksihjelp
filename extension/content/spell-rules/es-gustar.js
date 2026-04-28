/**
 * Spell-check rule: ES gustar-class syntax flagger (PRON-02, priority 60).
 *
 * Phase 12. Flags gustar-class verbs used without a preceding dative clitic.
 * Norwegian students transfer SVO structure ("El gusta ayudar") instead of
 * the required dative experiencer pattern ("Le gusta ayudar").
 *
 *   Wrong:   "El no gusta ayudar."  (missing dative clitic "le")
 *   Fix:     "A él no le gusta ayudar."
 *
 * Gustar-class verbs (gustar, encantar, interesar, importar, molestar, etc.)
 * require an indirect-object (dative) clitic: me, te, le, nos, os, les.
 *
 * Detection: find conjugated forms of gustar-class verbs, walk backward up to
 * 3 tokens looking for a dative clitic. If none found, flag.
 *
 * Severity: warning (P2 amber dot).
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const core = host.__lexiSpellCore || {};
  const { tokensInSentence } = core;

  function escapeHtml(s) {
    const fn = core.escapeHtml;
    if (fn) return fn(s);
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function stripAccents(s) {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Dative clitics that must precede gustar-class verbs.
  const DATIVE_CLITICS = new Set(['me', 'te', 'le', 'nos', 'os', 'les']);

  // Tokens allowed between dative clitic and verb (negation).
  const NEGATION_WORDS = new Set(['no', 'nunca', 'tampoco', 'ya']);

  // Subject pronouns that precede gustar-class verbs in wrong SVO pattern.
  // Map from pronoun (lowercase accent-stripped) to the appropriate dative clitic.
  const PRONOUN_TO_CLITIC = {
    yo: 'me',
    tu: 'te',
    el: 'le',
    ella: 'le',
    nosotros: 'nos',
    nosotras: 'nos',
    vosotros: 'os',
    vosotras: 'os',
    ellos: 'les',
    ellas: 'les',
    usted: 'le',
    ustedes: 'les',
  };

  // Lazy-init grammar tables
  let _gustarVerbs = null;
  function getGustarVerbs() {
    if (_gustarVerbs) return _gustarVerbs;
    const gt = host.__lexiGrammarTables || {};
    _gustarVerbs = gt.ES_GUSTAR_CLASS_VERBS || new Set();
    return _gustarVerbs;
  }

  const rule = {
    id: 'es-gustar',
    languages: ['es'],
    priority: 60,
    exam: {
      safe: false,
      reason: "Lookup-shaped grammar rule (es-gustar); pending browser-baseline research per CONTEXT.md",
      category: "grammar-lookup",
    },
    severity: 'warning',
    explain: function (finding) {
      const original = finding.original || '';
      const fix = finding.fix || '';
      return {
        nb: 'Verbet <em>' + escapeHtml(original) + '</em> brukes med indirekte objekt (dativ) paa spansk: <em>' + escapeHtml(fix) + '</em>. Norsk bruker subjekt + verb, men spansk bruker dativ-klitikon (me/te/le/nos/os/les) + verb.',
        nn: 'Verbet <em>' + escapeHtml(original) + '</em> blir brukt med indirekte objekt (dativ) paa spansk: <em>' + escapeHtml(fix) + '</em>. Norsk brukar subjekt + verb, men spansk brukar dativ-klitikon (me/te/le/nos/os/les) + verb.',
        severity: 'warning',
      };
    },
    check(ctx) {
      if (ctx.lang !== 'es') return [];
      if (!ctx.sentences || !tokensInSentence) return [];

      const gustarVerbs = getGustarVerbs();
      if (!gustarVerbs.size) return [];

      const presensToVerb = ctx.vocab && ctx.vocab.esPresensToVerb;
      const preteritumToVerb = ctx.vocab && ctx.vocab.esPreteritumToVerb;
      if ((!presensToVerb || !presensToVerb.size) &&
          (!preteritumToVerb || !preteritumToVerb.size)) return [];

      const findings = [];

      for (const sentence of ctx.sentences) {
        const range = tokensInSentence(ctx, sentence);
        if (range.end - range.start < 2) continue;

        for (let i = range.start; i < range.end; i++) {
          const tokenWord = ctx.tokens[i].word; // lowercase
          const stripped = stripAccents(tokenWord);

          // Check if this token is a conjugated form of a gustar-class verb
          let verbInfo = null;
          if (presensToVerb) {
            verbInfo = presensToVerb.get(tokenWord) || presensToVerb.get(stripped);
          }
          if (!verbInfo && preteritumToVerb) {
            verbInfo = preteritumToVerb.get(tokenWord) || preteritumToVerb.get(stripped);
          }
          if (!verbInfo) continue;
          if (!gustarVerbs.has(verbInfo.inf)) continue;

          // Found a gustar-class verb. Walk backward up to 3 tokens looking
          // for a dative clitic.
          let hasDative = false;
          const scanBack = Math.max(range.start, i - 3);
          for (let j = i - 1; j >= scanBack; j--) {
            const prevWord = ctx.tokens[j].word;
            const prevStripped = stripAccents(prevWord);
            if (DATIVE_CLITICS.has(prevWord) || DATIVE_CLITICS.has(prevStripped)) {
              hasDative = true;
              break;
            }
            // Allow negation words between clitic and verb
            if (NEGATION_WORDS.has(prevWord) || NEGATION_WORDS.has(prevStripped)) {
              continue;
            }
            // If we hit a non-negation, non-clitic word, keep looking back
            // (could be subject pronoun or article before the verb).
          }

          if (hasDative) continue;

          // No dative clitic found. Determine the appropriate clitic from
          // the preceding subject pronoun (if any).
          let clitic = 'le'; // default suggestion
          for (let j = i - 1; j >= scanBack; j--) {
            const prevWord = ctx.tokens[j].word;
            const prevStripped = stripAccents(prevWord);
            const mappedClitic = PRONOUN_TO_CLITIC[prevStripped];
            if (mappedClitic) {
              clitic = mappedClitic;
              break;
            }
          }

          const verbDisplay = ctx.tokens[i].display;
          const suggestion = clitic + ' ' + verbDisplay.toLowerCase();

          findings.push({
            rule_id: 'es-gustar',
            start: ctx.tokens[i].start,
            end: ctx.tokens[i].end,
            original: verbDisplay,
            fix: suggestion,
            message: verbDisplay + ' requires dative clitic: ' + suggestion,
            severity: 'warning',
          });
        }
      }

      return findings;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

/**
 * Spell-check rule: collocation error detection (REG-02, priority 65).
 *
 * Phase 6. Data-driven rule that flags wrong-verb bigrams and other
 * collocation errors in English. Sources data from vocab-seam collocationbank;
 * falls back to inline SEED_COLLOCATIONS when the bank is absent.
 *
 * Severity: warning (P2 amber dot).
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // TEMPORARY: remove after papertek-vocabulary collocationbank PR lands.
  const SEED_COLLOCATIONS = [
    { trigger: 'make a photo', fix: 'take a photo' },
    { trigger: 'make a picture', fix: 'take a picture' },
    { trigger: 'big rain', fix: 'heavy rain' },
    { trigger: 'strong knowledge', fix: 'deep knowledge' },
    { trigger: 'do a mistake', fix: 'make a mistake' },
    { trigger: 'say a lie', fix: 'tell a lie' },
    { trigger: 'say the truth', fix: 'tell the truth' },
    { trigger: 'make a party', fix: 'throw a party' },
    { trigger: 'open the light', fix: 'turn on the light' },
    { trigger: 'close the light', fix: 'turn off the light' },
    { trigger: 'big mistake', fix: 'huge mistake' },
    { trigger: 'strong rain', fix: 'heavy rain' },
    { trigger: 'win money', fix: 'earn money' },
    { trigger: 'make homework', fix: 'do homework' },
    { trigger: 'say a joke', fix: 'tell a joke' },
    { trigger: 'lose the bus', fix: 'miss the bus' },
    { trigger: 'make an exam', fix: 'take an exam' },
    { trigger: 'make sport', fix: 'do sport' },
    { trigger: 'rise a question', fix: 'raise a question' },
  ];

  const rule = {
    id: 'collocation',
    languages: ['en'],
    priority: 65,
    severity: 'warning',
    explain: function (finding) {
      return {
        nb: 'Usikker — <em>' + escapeHtml(finding.original) + '</em> er feil kollokasjon. Bruk <em>' + escapeHtml(finding.fix) + '</em>.',
        nn: 'Usikker — <em>' + escapeHtml(finding.original) + '</em> er feil kollokasjon. Bruk <em>' + escapeHtml(finding.fix) + '</em>.',
      };
    },
    check(ctx) {
      // Resolve collocations: prefer vocab-seam data, fall back to seed.
      let collocations = ctx.vocab.collocations;
      if (!collocations || collocations.length === 0) {
        collocations = SEED_COLLOCATIONS;
      }
      if (!collocations || collocations.length === 0) return [];
      if (!ctx.sentences) return [];

      const findings = [];

      for (const sentence of ctx.sentences) {
        const sentLower = sentence.text.toLowerCase();

        for (const entry of collocations) {
          if (!entry.trigger || !entry.fix) continue;
          const triggerLower = entry.trigger.toLowerCase();
          let searchStart = 0;

          while (searchStart < sentLower.length) {
            const idx = sentLower.indexOf(triggerLower, searchStart);
            if (idx === -1) break;

            const absStart = sentence.start + idx;
            const absEnd = absStart + entry.trigger.length;

            // Check structural suppression for any token in the match span.
            let suppressed = false;
            if (ctx.suppressedFor && ctx.suppressedFor.structural) {
              for (let ti = 0; ti < ctx.tokens.length; ti++) {
                const tok = ctx.tokens[ti];
                if (tok.end > absStart && tok.start < absEnd && ctx.suppressedFor.structural.has(ti)) {
                  suppressed = true;
                  break;
                }
              }
            }

            if (!suppressed) {
              findings.push({
                rule_id: 'collocation',
                start: absStart,
                end: absEnd,
                original: ctx.text.slice(absStart, absEnd),
                fix: entry.fix,
                message: entry.trigger + ' → ' + entry.fix,
                severity: 'warning',
              });
            }

            searchStart = idx + 1;
          }
        }
      }

      return findings;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

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
  const SEED_COLLOCATIONS = {
    en: [
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
    ],
    nb: [
      { trigger: 'flink i', fix: 'flink til' },
      { trigger: 'glad på', fix: 'glad i' },
      { trigger: 'redd av', fix: 'redd for' },
      { trigger: 'interessert av', fix: 'interessert i' },
      { trigger: 'stolt av', fix: 'stolt over' },
      { trigger: 'lei for', fix: 'lei av' },
      { trigger: 'sint over', fix: 'sint på' },
      { trigger: 'fornøyd av', fix: 'fornøyd med' },
      { trigger: 'vant med', fix: 'vant til' },
      { trigger: 'ferdig av', fix: 'ferdig med' },
      { trigger: 'gift i', fix: 'gift med' },
      { trigger: 'enig over', fix: 'enig i' },
      { trigger: 'skuffet av', fix: 'skuffet over' },
    ],
    nn: null, // Resolved as nb fallback below
    de: [
      { trigger: 'angst von', fix: 'Angst vor' },
      { trigger: 'warten für', fix: 'warten auf' },
      { trigger: 'warte für', fix: 'warten auf' },
      { trigger: 'wartest für', fix: 'warten auf' },
      { trigger: 'wartet für', fix: 'warten auf' },
      { trigger: 'stolz von', fix: 'stolz auf' },
      { trigger: 'interessieren in', fix: 'interessieren für' },
      { trigger: 'interessiere in', fix: 'interessieren für' },
      { trigger: 'denken über', fix: 'denken an' },
      { trigger: 'denke über', fix: 'denken an' },
      { trigger: 'denkst über', fix: 'denken an' },
      { trigger: 'träumen über', fix: 'träumen von' },
      { trigger: 'träume über', fix: 'träumen von' },
      { trigger: 'bitten für', fix: 'bitten um' },
      { trigger: 'bitte für', fix: 'bitten um' },
      { trigger: 'suchen für', fix: 'suchen nach' },
      { trigger: 'suche für', fix: 'suchen nach' },
      { trigger: 'suchst für', fix: 'suchen nach' },
      { trigger: 'lust für', fix: 'Lust auf' },
      { trigger: 'teilnehmen in', fix: 'teilnehmen an' },
      { trigger: 'gewöhnen mit', fix: 'gewöhnen an' },
      { trigger: 'zufrieden von', fix: 'zufrieden mit' },
    ],
    fr: [
      { trigger: 'penser de', fix: 'penser à' },
      { trigger: 'pense de', fix: 'penser à' },
      { trigger: 'penses de', fix: 'penser à' },
      { trigger: 'pensons de', fix: 'penser à' },
      { trigger: 'pensez de', fix: 'penser à' },
      { trigger: 'pensent de', fix: 'penser à' },
      { trigger: 'jouer le piano', fix: 'jouer du piano' },
      { trigger: 'joue le piano', fix: 'jouer du piano' },
      { trigger: 'jouer le football', fix: 'jouer au football' },
      { trigger: 'joue le football', fix: 'jouer au football' },
      { trigger: 'rêver sur', fix: 'rêver de' },
      { trigger: 'rêve sur', fix: 'rêver de' },
      { trigger: 'dépendre sur', fix: 'dépendre de' },
      { trigger: 'dépend sur', fix: 'dépendre de' },
      { trigger: 'dépends sur', fix: 'dépendre de' },
      { trigger: 'chercher pour', fix: 'chercher' },
      { trigger: 'cherche pour', fix: 'chercher' },
      { trigger: 'cherches pour', fix: 'chercher' },
      { trigger: 'cherchons pour', fix: 'chercher' },
      { trigger: 'cherchent pour', fix: 'chercher' },
      { trigger: 'regarder à', fix: 'regarder' },
      { trigger: 'regarde à', fix: 'regarder' },
      { trigger: 'écouter à', fix: 'écouter' },
      { trigger: 'écoute à', fix: 'écouter' },
      { trigger: 'demander pour', fix: 'demander' },
      { trigger: 'demande pour', fix: 'demander' },
      { trigger: 'attendre pour', fix: 'attendre' },
      { trigger: 'attends pour', fix: 'attendre' },
      { trigger: 'attend pour', fix: 'attendre' },
      { trigger: 'habiter dans paris', fix: 'habiter à Paris' },
      { trigger: 'habite dans paris', fix: 'habiter à Paris' },
      { trigger: 'se souvenir sur', fix: 'se souvenir de' },
      { trigger: 'se souvient sur', fix: 'se souvenir de' },
    ],
    es: [
      { trigger: 'soñar de', fix: 'soñar con' },
      { trigger: 'sueño de', fix: 'soñar con' },
      { trigger: 'sueñas de', fix: 'soñar con' },
      { trigger: 'sueña de', fix: 'soñar con' },
      { trigger: 'soñamos de', fix: 'soñar con' },
      { trigger: 'pensar sobre', fix: 'pensar en' },
      { trigger: 'pienso sobre', fix: 'pensar en' },
      { trigger: 'piensas sobre', fix: 'pensar en' },
      { trigger: 'piensa sobre', fix: 'pensar en' },
      { trigger: 'pensamos sobre', fix: 'pensar en' },
      { trigger: 'depender en', fix: 'depender de' },
      { trigger: 'dependo en', fix: 'depender de' },
      { trigger: 'dependes en', fix: 'depender de' },
      { trigger: 'depende en', fix: 'depender de' },
      { trigger: 'casarse a', fix: 'casarse con' },
      { trigger: 'consistir de', fix: 'consistir en' },
      { trigger: 'consiste de', fix: 'consistir en' },
      { trigger: 'insistir sobre', fix: 'insistir en' },
      { trigger: 'insiste sobre', fix: 'insistir en' },
      { trigger: 'insisto sobre', fix: 'insistir en' },
      { trigger: 'confiar sobre', fix: 'confiar en' },
      { trigger: 'confío sobre', fix: 'confiar en' },
      { trigger: 'acordarse sobre', fix: 'acordarse de' },
      { trigger: 'tratar sobre', fix: 'tratar de' },
      { trigger: 'trato sobre', fix: 'tratar de' },
      { trigger: 'fijarse sobre', fix: 'fijarse en' },
      { trigger: 'preocuparse sobre', fix: 'preocuparse por' },
      { trigger: 'contar sobre', fix: 'contar con' },
      { trigger: 'cuento sobre', fix: 'contar con' },
    ],
  };

  const rule = {
    id: 'collocation',
    languages: ['en', 'nb', 'nn', 'de', 'es', 'fr'],
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
        const lang = ctx.lang === 'nn' ? 'nb' : ctx.lang;
        collocations = SEED_COLLOCATIONS[lang] || [];
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

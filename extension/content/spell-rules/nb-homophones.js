/**
 * Spell-check rule: Norwegian Homophones and Confused Words (priority 40).
 * 
 * Heuristic checks for classic dyslexic and learner errors:
 * - og vs å
 * - da vs når
 * - gjerne vs hjerne
 * - vær vs hver
 * 
 * Rule ID: 'homophone'
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];
  const core = host.__lexiSpellCore || {};
  const { matchCase, escapeHtml } = core;

  const INFINITIVE_TRIGGERS = new Set([
    'liker', 'likte', 'pleier', 'pleide', 'begynner', 'begynte',
    'prøver', 'prøvde', 'ønsker', 'ønsket', 'elsker', 'elsket',
    'hater', 'hatet', 'slutter', 'sluttet', 'fortsetter', 'fortsatte',
    'kommer', 'kom', 'lærer', 'lærte', 'trenger', 'trengte',
    'hjelper', 'hjalp', 'klarer', 'klarte', 'husker', 'husket',
    'nekter', 'nektet', 'nekta', 'håper', 'håpet', 'håpa',
    'godt', 'fint', 'viktig', 'vanskelig', 'lett', 'moro', 'gøy',
    'kjedelig', 'umulig', 'klart', 'farlig', 'trygt'
  ]);

  const PRONOUNS = new Set(['jeg', 'eg', 'du', 'han', 'hun', 'ho', 'vi', 'dere', 'de', 'dei', 'man']);
  const ARTICLES_POSSESSIVES = new Set(['en', 'ei', 'et', 'eit', 'den', 'det', 'de', 'dei', 'min', 'mi', 'mitt', 'mine', 'din', 'di', 'ditt', 'dine', 'vår', 'vårt', 'våre', 'hans', 'hennes', 'hennar', 'deres', 'deira']);
  
  const MODALS_INTENTIONS = new Set(['vil', 'ville', 'skal', 'skulle', 'kan', 'kunne', 'må', 'måtte', 'bør', 'burde', 'veldig', 'så', 'for', 'altfor']);
  
  const TIME_NOUNS = new Set(['gang', 'gong', 'dag', 'uke', 'veke', 'måned', 'månad', 'år', 'kveld', 'morgen', 'morgon', 'natt', 'time', 'minutt', 'sekund', 'andre']);
  const WEATHER_ADJ = new Set(['fint', 'dårlig', 'dårleg', 'pent', 'stygt', 'kaldt', 'varmt', 'godt']);

  const rule = {
    id: 'homophone',
    languages: ['nb', 'nn'],
    priority: 40,
    explain: (finding) => {
      if (finding.subType === 'og-aa') {
        return {
          nb: `<strong>Å</strong> er et infinitivsmerke som står foran verb. <strong>Og</strong> er et bindeord som binder sammen setninger eller like ord.`,
          nn: `<strong>Å</strong> er eit infinitivsmerke som står føre verb. <strong>Og</strong> er eit bindeord som bind saman setningar eller like ord.`,
        };
      }
      if (finding.subType === 'da-naar') {
        return {
          nb: `Huskeregel: "Den gang <strong>da</strong>, hver gang <strong>når</strong>". Bruk <em>da</em> om en enkelt hendelse i fortiden.`,
          nn: `Hugseregel: "Den gong <strong>då</strong>, kvar gong <strong>når</strong>". Bruk <em>då</em> om ei einskild hending i fortida.`,
        };
      }
      if (finding.subType === 'gjerne-hjerne') {
        return {
          nb: `<strong>Hjerne</strong> er organet inne i hodet. <strong>Gjerne</strong> betyr "med glede" eller "frivillig".`,
          nn: `<strong>Hjerne</strong> er organet inne i hovudet. <strong>Gjerne</strong> tyder "med glede" eller "frivillig".`,
        };
      }
      if (finding.subType === 'hver-vaer') {
        return {
          nb: `<strong>Vær</strong> handler om meteorologi (regn, sol). <strong>Hver</strong> betyr "alle enkeltvis" (hver dag).`,
          nn: `<strong>Vêr</strong> handlar om meteorologi (regn, sol). <strong>Kvar</strong> tyder "alle einskildvis" (kvar dag).`,
        };
      }
      return { nb: finding.message, nn: finding.message };
    },
    check(ctx) {
      const { tokens, vocab, cursorPos, suppressed } = ctx;
      const verbForms = vocab.verbForms || new Map();
      const knownPresens = vocab.knownPresens || new Set();
      const knownPreteritum = vocab.knownPreteritum || new Set();
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;
        if (suppressed && suppressed.has(i)) continue;

        const word = t.word.toLowerCase();
        const prev = i > 0 ? tokens[i - 1].word.toLowerCase() : null;
        const next = i < tokens.length - 1 ? tokens[i + 1].word.toLowerCase() : null;
        const nextNext = i < tokens.length - 2 ? tokens[i + 2].word.toLowerCase() : null;

        // 1. å vs og
        if (word === 'å' && next) {
          // If 'å' is followed by a common article, pronoun, or preposition, it's likely 'og'
          // We avoid checking nounGenus because many words are both (e.g. "sykle" is infinitive, "sykkel" is noun, but "en sykle" is wrong).
          if (ARTICLES_POSSESSIVES.has(next) || PRONOUNS.has(next) || next === 'i' || next === 'på' || next === 'med' || next === 'til') {
            out.push({
              rule_id: 'homophone',
              subType: 'og-aa',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'og'),
              suggestions: [matchCase(t.display, 'og')],
              message: `Forveksling: "å" foran ikke-verb. Prøv "og".`
            });
            if (suppressed) suppressed.add(i);
          }
        }
        else if (word === 'og' && next && prev) {
          // 'og' followed by infinitive AND preceded by a trigger verb -> should be 'å'
          // E.g. "liker og bade" -> "liker å bade"
          // Exclude if preceded by another infinitive: "hoppe og bade" is correct!
          if (verbForms.has(next) && !verbForms.has(prev) && INFINITIVE_TRIGGERS.has(prev)) {
            out.push({
              rule_id: 'homophone',
              subType: 'og-aa',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'å'),
              suggestions: [matchCase(t.display, 'å')],
              message: `Forveksling: "og" etter bøyd verb/adjektiv. Prøv "å".`
            });
            if (suppressed) suppressed.add(i);
          }
        }

        // 2. da vs når
        else if (word === 'da' && next && nextNext) {
          // da jeg går -> når jeg går
          if (PRONOUNS.has(next) && knownPresens.has(nextNext)) {
            out.push({
              rule_id: 'homophone',
              subType: 'da-naar',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'når'),
              suggestions: [matchCase(t.display, 'når')],
              message: `Forveksling: "da" brukt med nåtid. Prøv "når".`
            });
            if (suppressed) suppressed.add(i);
          }
        }
        else if (word === 'når' && next && nextNext) {
          // når jeg var liten -> da jeg var liten
          if (PRONOUNS.has(next) && (nextNext === 'var' || nextNext === 'ble' || nextNext === 'blei') && 
             (i + 3 < tokens.length && (tokens[i+3].word.toLowerCase() === 'liten' || tokens[i+3].word.toLowerCase() === 'ung' || tokens[i+3].word.toLowerCase() === 'barn'))) {
            out.push({
              rule_id: 'homophone',
              subType: 'da-naar',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'da'), // Note: 'då' in NN, handled by matchCase/localization if needed, but 'da' is base. Actually NN should suggest 'då'.
              suggestions: [matchCase(t.display, ctx.lang === 'nn' ? 'då' : 'da')],
              message: `Forveksling: "når" om en enkelt hendelse i fortiden. Prøv "${ctx.lang === 'nn' ? 'då' : 'da'}".`
            });
            if (suppressed) suppressed.add(i);
          }
        }

        // 3. gjerne vs hjerne
        else if (word === 'hjerne' && prev) {
          if (MODALS_INTENTIONS.has(prev)) {
            out.push({
              rule_id: 'homophone',
              subType: 'gjerne-hjerne',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'gjerne'),
              suggestions: [matchCase(t.display, 'gjerne')],
              message: `Forveksling: "hjerne" brukt som adverb. Prøv "gjerne".`
            });
            if (suppressed) suppressed.add(i);
          }
        }
        else if (word === 'gjerne' && prev) {
          const prevPrev = i > 1 ? tokens[i - 2].word.toLowerCase() : null;
          if (ARTICLES_POSSESSIVES.has(prev) || (prevPrev && ARTICLES_POSSESSIVES.has(prevPrev))) {
            out.push({
              rule_id: 'homophone',
              subType: 'gjerne-hjerne',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, 'hjerne'),
              suggestions: [matchCase(t.display, 'hjerne')],
              message: `Forveksling: "gjerne" brukt som substantiv. Prøv "hjerne".`
            });
            if (suppressed) suppressed.add(i);
          }
        }

        // 4. vær vs hver (og vêr/kvar i NN)
        else if ((word === 'vær' || word === 'vêr') && next) {
          if (TIME_NOUNS.has(next)) {
            const fix = ctx.lang === 'nn' ? 'kvar' : 'hver';
            out.push({
              rule_id: 'homophone',
              subType: 'hver-vaer',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, fix),
              suggestions: [matchCase(t.display, fix)],
              message: `Forveksling: "${t.display}" brukt foran tidsangivelse. Prøv "${fix}".`
            });
            if (suppressed) suppressed.add(i);
          }
        }
        else if ((word === 'hver' || word === 'kvar') && prev) {
          if (WEATHER_ADJ.has(prev)) {
            const fix = ctx.lang === 'nn' ? 'vêr' : 'vær';
            out.push({
              rule_id: 'homophone',
              subType: 'hver-vaer',
              priority: rule.priority,
              start: t.start,
              end: t.end,
              original: t.display,
              fix: matchCase(t.display, fix),
              suggestions: [matchCase(t.display, fix)],
              message: `Forveksling: "${t.display}" brukt om meteorologi. Prøv "${fix}".`
            });
            if (suppressed) suppressed.add(i);
          }
        }
      }
      return out;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

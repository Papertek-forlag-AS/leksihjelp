/**
 * Spell-check rule: Spanish por/para preposition confusion (ES-02, priority 50).
 *
 * Phase 9. Flags common por/para misuse patterns typical of Norwegian students:
 *   - por + infinitive (purpose) -> para
 *   - por + possessive + human noun (beneficiary) -> para
 *   - por + deadline marker -> para
 *   - para + number + time unit (duration) -> por
 *
 * Safe phrases (por favor, por ejemplo, etc.) are excluded.
 * Trigger data consumed from grammar-tables.js (ES_POR_PARA_TRIGGERS, ES_HUMAN_NOUNS).
 *
 * Severity: warning (P2 amber dot).
 */
(function () {
  'use strict';
  const host = typeof self !== 'undefined' ? self : globalThis;
  host.__lexiSpellRules = host.__lexiSpellRules || [];

  // ── Safe phrases: never flag por in these ──
  const SAFE_POR_PHRASES = new Set([
    'favor', 'ejemplo', 'eso', 'supuesto', 'fin', 'cierto',
  ]);
  // Multi-word safe phrases starting with "por lo"
  const SAFE_POR_LO = new Set(['menos', 'tanto']);

  // ── Possessive determiners (trigger beneficiary pattern) ──
  const POSSESSIVES = new Set([
    'mi', 'tu', 'su', 'nuestro', 'vuestro',
    'mis', 'tus', 'sus', 'nuestros', 'vuestros',
    'nuestra', 'vuestras', 'nuestras', 'vuestra',
  ]);

  // ── Extended human/family nouns (includes collective "familia") ──
  const FAMILY_COLLECTIVE = new Set(['familia', 'familias']);

  // ── Goal nouns: "estudio por mi trabajo" -> "para mi trabajo" ──
  const GOAL_NOUNS = new Set([
    'trabajo', 'examen', 'futuro', 'carrera', 'salud', 'bienestar',
  ]);

  // ── Deadline markers ──
  const DEADLINE_DAYS = new Set([
    'manana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes',
    'sabado', 'domingo',
  ]);
  const DEADLINE_MONTHS = new Set([
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]);
  const DEADLINE_RELATIVE = new Set(['proximo', 'siguiente', 'proxima', 'siguiente']);

  // ── Duration numbers ──
  const DURATION_NUMBERS = new Set([
    'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho',
    'nueve', 'diez', 'once', 'doce', 'veinte', 'treinta',
    'muchas', 'muchos', 'varias', 'varios', 'algunas', 'algunos',
  ]);
  const TIME_UNITS = new Set([
    'horas', 'dias', 'semanas', 'meses', 'anos', 'minutos',
    'hora', 'dia', 'semana', 'mes', 'ano', 'minuto',
  ]);

  // ── Lazy-init grammar tables ──
  let _tables = null;
  function getTables() {
    if (_tables) return _tables;
    const gt = host.__lexiGrammarTables || {};
    _tables = {
      HUMAN_NOUNS: gt.ES_HUMAN_NOUNS || new Set(),
      POR_PARA_TRIGGERS: gt.ES_POR_PARA_TRIGGERS || [],
    };
    return _tables;
  }

  function isInfinitive(word, vocab) {
    if (!word) return false;
    // Must end in -ar, -er, or -ir
    if (!/(?:ar|er|ir)$/.test(word)) return false;
    // Must be a known verb (in validWords from vocab data)
    if (vocab.validWords && vocab.validWords.has(word)) return true;
    // Also check if it's a value in verbInfinitive (the infinitive form itself)
    if (vocab.verbInfinitive) {
      for (const inf of vocab.verbInfinitive.values()) {
        if (inf === word) return true;
      }
    }
    return false;
  }

  const rule = {
    id: 'es-por-para',
    languages: ['es'],
    priority: 50,
    exam: {
      safe: false,
      reason: "Lookup-shaped grammar rule (es-por-para); pending browser-baseline research per CONTEXT.md",
      category: "grammar-lookup",
    },
    severity: 'warning',
    explain: function (finding) {
      const wrong = finding.original || '';
      const fix = finding.fix || '';
      if (finding.patternType === 'beneficiary') {
        return {
          nb: 'Bruk <em>para</em> foran person som mottar noe. Prov <em>' + fix + '</em> i stedet for <em>' + wrong + '</em>.',
          nn: 'Bruk <em>para</em> framfor person som tek imot noko. Prov <em>' + fix + '</em> i staden for <em>' + wrong + '</em>.',
        };
      }
      if (finding.patternType === 'purpose') {
        return {
          nb: 'Bruk <em>para</em> for a uttrykke formal. Prov <em>' + fix + '</em> i stedet for <em>' + wrong + '</em>.',
          nn: 'Bruk <em>para</em> for a uttrykkje formal. Prov <em>' + fix + '</em> i staden for <em>' + wrong + '</em>.',
        };
      }
      if (finding.patternType === 'deadline') {
        return {
          nb: 'Bruk <em>para</em> for a angi en frist. Prov <em>' + fix + '</em> i stedet for <em>' + wrong + '</em>.',
          nn: 'Bruk <em>para</em> for a gje ei frist. Prov <em>' + fix + '</em> i staden for <em>' + wrong + '</em>.',
        };
      }
      if (finding.patternType === 'duration') {
        return {
          nb: 'Bruk <em>por</em> for a uttrykke varighet. Prov <em>' + fix + '</em> i stedet for <em>' + wrong + '</em>.',
          nn: 'Bruk <em>por</em> for a uttrykkje varigheit. Prov <em>' + fix + '</em> i staden for <em>' + wrong + '</em>.',
        };
      }
      return {
        nb: 'Prov <em>' + fix + '</em> i stedet for <em>' + wrong + '</em>.',
        nn: 'Prov <em>' + fix + '</em> i staden for <em>' + wrong + '</em>.',
      };
    },
    check(ctx) {
      if (ctx.lang !== 'es') return [];
      const { tokens, vocab, cursorPos } = ctx;
      const { HUMAN_NOUNS } = getTables();
      const findings = [];

      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (cursorPos != null && cursorPos >= t.start && cursorPos <= t.end + 1) continue;

        const w = t.word;
        const next = tokens[i + 1];
        const next2 = tokens[i + 2];

        if (w === 'por') {
          // ── Skip safe phrases ──
          if (next && SAFE_POR_PHRASES.has(next.word)) continue;
          // "por lo menos", "por lo tanto"
          if (next && next.word === 'lo' && next2 && SAFE_POR_LO.has(next2.word)) continue;
          // "por la manana" — time expression
          if (next && (next.word === 'la' || next.word === 'el') &&
              next2 && (next2.word === 'manana' || next2.word === 'tarde' || next2.word === 'noche')) continue;
          // "por + determiner + non-human noun" (through/along) — skip
          if (next && (next.word === 'el' || next.word === 'la' || next.word === 'los' || next.word === 'las' || next.word === 'todo')) continue;
          // "por + pronoun object" (por ti, por mi as cause) — skip
          if (next && (next.word === 'ti' || next.word === 'mi' || next.word === 'el' || next.word === 'ella') && !next2) continue;
          // "por + number + time unit" = correct duration — skip
          if (next && (DURATION_NUMBERS.has(next.word) || /^\d+$/.test(next.word)) &&
              next2 && TIME_UNITS.has(next2.word)) continue;

          // ── Pattern: por + infinitive (purpose) -> para ──
          if (next && isInfinitive(next.word, vocab)) {
            findings.push({
              rule_id: 'es-por-para',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: 'para',
              patternType: 'purpose',
              message: t.display + ' + infinitivo -> para',
              severity: 'warning',
            });
            continue;
          }

          // ── Pattern: por + possessive + human noun (beneficiary) -> para ──
          if (next && POSSESSIVES.has(next.word) && next2 && (HUMAN_NOUNS.has(next2.word) || FAMILY_COLLECTIVE.has(next2.word))) {
            findings.push({
              rule_id: 'es-por-para',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: 'para',
              patternType: 'beneficiary',
              message: t.display + ' + ' + next.display + ' ' + next2.display + ' -> para',
              severity: 'warning',
            });
            continue;
          }

          // ── Pattern: por + possessive + goal noun -> para ──
          if (next && POSSESSIVES.has(next.word) && next2 && GOAL_NOUNS.has(next2.word)) {
            findings.push({
              rule_id: 'es-por-para',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: 'para',
              patternType: 'purpose',
              message: t.display + ' + ' + next.display + ' ' + next2.display + ' -> para',
              severity: 'warning',
            });
            continue;
          }

          // ── Pattern: por + deadline marker -> para ──
          if (next && (DEADLINE_DAYS.has(next.word) || DEADLINE_MONTHS.has(next.word) || DEADLINE_RELATIVE.has(next.word))) {
            findings.push({
              rule_id: 'es-por-para',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: 'para',
              patternType: 'deadline',
              message: t.display + ' + ' + next.display + ' -> para',
              severity: 'warning',
            });
            continue;
          }
        }

        if (w === 'para') {
          // ── Pattern: para + number + time unit (duration) -> por ──
          if (next && (DURATION_NUMBERS.has(next.word) || /^\d+$/.test(next.word)) &&
              next2 && TIME_UNITS.has(next2.word)) {
            findings.push({
              rule_id: 'es-por-para',
              start: t.start,
              end: t.end,
              original: t.display,
              fix: 'por',
              patternType: 'duration',
              message: t.display + ' + duracion -> por',
              severity: 'warning',
            });
            continue;
          }
        }
      }

      return findings;
    },
  };

  host.__lexiSpellRules.push(rule);
  if (typeof module !== 'undefined' && module.exports) module.exports = rule;
})();

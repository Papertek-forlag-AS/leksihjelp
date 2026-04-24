#!/usr/bin/env node
/**
 * Leksihjelp — Interactive Fixture Creator (with AI Request Queue)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Mock self/globalThis for the IIFE rules
const host = { __lexiSpellRules: [] };
globalThis.self = host;

const CORE_PATH = path.join(__dirname, '..', 'extension', 'content', 'spell-check-core.js');
const VOCAB_CORE_PATH = path.join(__dirname, '..', 'extension', 'content', 'vocab-seam-core.js');
const RULES_DIR = path.join(__dirname, '..', 'extension', 'content', 'spell-rules');

const spellCore = require(CORE_PATH);
const vocabCore = require(VOCAB_CORE_PATH);
fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.js')).forEach(f => require(path.join(RULES_DIR, f)));

const DATA_DIR = path.join(__dirname, '..', 'extension', 'data');
const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function question(query) { return new Promise(resolve => rl.question(query, resolve)); }

const COMMON_RULES = [
  { id: 'typo', desc: 'General spelling mistake' },
  { id: 'en-grammar', desc: 'English specific grammar (tense, S-V agreement, etc)' },
  { id: 'gender', desc: 'Article/Noun gender mismatch' },
  { id: 'agreement', desc: 'Plural/Singular mismatch' },
  { id: 'modal_form', desc: 'Wrong verb form after modal (can/must/etc)' },
  { id: 'es-accent', desc: 'Spanish missing accent or ñ' },
  { id: 'de-capitalization', desc: 'German lowercase noun' },
  { id: 'other', desc: 'Something else (type custom ID)' }
];

function generateChallenge(lang, vocab) {
  const challenges = [];
  const clean = (w) => (w || '').split(';')[0].trim();
  
  if (lang === 'en') {
    const pronouns = ['he', 'she', 'it', 'I', 'we', 'they'];
    const verbs = Array.from(vocab.verbInfinitive.values()).slice(0, 100).map(clean);
    const pitfalls = Object.keys(vocab.pitfalls || {});
    const p = pronouns[Math.floor(Math.random() * pronouns.length)];
    const v = verbs[Math.floor(Math.random() * verbs.length)];
    if (v) challenges.push(`${p} ${v} today.`);
    if (pitfalls.length > 0) {
      const pit = pitfalls[Math.floor(Math.random() * pitfalls.length)];
      const entry = vocab.pitfalls[pit];
      if (entry.next) {
        const next = entry.next[Math.floor(Math.random() * entry.next.length)];
        challenges.push(`I think ${pit} ${next} coming.`);
      }
    }
  } else if (lang === 'de') {
    const nouns = Array.from(vocab.nounGenus.keys()).slice(0, 100).map(clean);
    if (nouns.length > 0) {
      const n = nouns[Math.floor(Math.random() * nouns.length)];
      challenges.push(`Ich habe ein ${n.toLowerCase()}.`);
    }
  } else if (lang === 'es' || lang === 'fr') {
    const nouns = Array.from(vocab.nounGenus.keys()).slice(0, 100).map(clean);
    const arts = lang === 'es' ? ['el', 'la', 'un', 'una'] : ['le', 'la', 'un', 'une'];
    if (nouns.length > 0) {
      const n = nouns[Math.floor(Math.random() * nouns.length)];
      const a = arts[Math.floor(Math.random() * arts.length)];
      challenges.push(`${a} ${n}.`);
    }
  } else if (lang === 'nb' || lang === 'nn') {
    // Pick a random noun + determiner. NB/NN share the data model but use
    // different subject pronouns/modals, so branch on the dialect. We draw
    // nouns from nounGenus (native bank entries with genus) and verbs from
    // verbInfinitive.values() (registered infinitive forms).
    const nouns = Array.from(vocab.nounGenus.keys()).slice(0, 200).map(clean);
    const verbs = Array.from(new Set(Array.from(vocab.verbInfinitive.values()))).slice(0, 200).map(clean);
    const subjects = lang === 'nb'
      ? ['Jeg', 'Du', 'Han', 'Hun', 'Vi', 'De']
      : ['Eg', 'Du', 'Han', 'Ho', 'Vi', 'Dei'];
    const modals = lang === 'nb'
      ? ['kan', 'vil', 'må', 'skal']
      : ['kan', 'vil', 'må', 'skal'];
    const subj = subjects[Math.floor(Math.random() * subjects.length)];
    const modal = modals[Math.floor(Math.random() * modals.length)];
    const verb = verbs[Math.floor(Math.random() * verbs.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    if (verb) challenges.push(`${subj} ${modal} ${verb} i dag.`);
    if (noun) {
      const article = lang === 'nb' ? 'En' : 'Ein';
      challenges.push(`${article} ${noun} er her.`);
    }
  }
  // Generic fallback only when no lang-specific generator ran (shouldn't
  // happen for the six supported dialects, but keeps challenges non-empty).
  return challenges.length > 0 ? challenges[Math.floor(Math.random() * challenges.length)] : "The cat is happy.";
}

async function pickRule() {
  console.log('\nSelect Rule Category:');
  COMMON_RULES.forEach((r, i) => console.log(`${i + 1}) ${r.id.padEnd(18)} — ${r.desc}`));
  const choice = await question('\nPick a number (or type rule ID): ');
  const idx = parseInt(choice) - 1;
  if (!isNaN(idx) && COMMON_RULES[idx]) {
    if (COMMON_RULES[idx].id === 'other') return await question('Enter custom Rule ID: ');
    return COMMON_RULES[idx].id;
  }
  const matched = COMMON_RULES.find(r => r.id === choice.toLowerCase());
  if (matched) return matched.id;
  return choice || 'grammar';
}

const BOX_WIDTH = 60;

function printCaseHeader(label, text, why) {
  console.log('\n' + '═'.repeat(BOX_WIDTH));
  console.log(' ' + label);
  console.log('═'.repeat(BOX_WIDTH));
  console.log(`  SENTENCE: "${text}"`);
  if (why) console.log(`  WHY:      ${why}`);
  console.log('─'.repeat(BOX_WIDTH));
}

function printSummary(data) {
  console.log('\n' + '═'.repeat(BOX_WIDTH));
  console.log('       PROPOSED TEST CASE SUMMARY');
  console.log('═'.repeat(BOX_WIDTH));
  console.log(`Text:       "${data.text}"`);
  if (data.status === 'unsure') {
    console.log(`Expectation: [UNSURE] (Needs AI Review)`);
  } else if (data.expected.length === 0) {
    console.log(`Expectation: [CLEAN] (No errors should be found)`);
  } else {
    data.expected.forEach((ex, i) => {
      console.log(`Error ${i+1}:    "${data.text.slice(ex.start, ex.end)}" → "${ex.suggestion}" [${ex.rule_id}]`);
    });
  }
  if (data.comment) console.log(`Comment:    "${data.comment}"`);
  console.log('═'.repeat(BOX_WIDTH));
}

function appendCase(fixturePath, currentCase) {
  fs.appendFileSync(fixturePath, JSON.stringify({ id: `case-${Date.now()}`, ...currentCase }) + '\n');
}

async function main() {
  const args = process.argv.slice(2);
  const lang = args[0];
  if (!lang) { console.error('Usage: node scripts/add-fixture.js <lang>'); process.exit(1); }

  const fixturePath = path.join(FIXTURE_DIR, lang, `grammar.jsonl`);
  const queuePath = path.join(FIXTURE_DIR, lang, `ai-requests.jsonl`);
  
  if (!fs.existsSync(path.dirname(fixturePath))) fs.mkdirSync(path.dirname(fixturePath), { recursive: true });

  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, lang + '.json'), 'utf8'));
  let pitfalls = {};
  const pitfallFile = path.join(DATA_DIR, 'pitfalls-' + lang + '.json');
  if (fs.existsSync(pitfallFile)) pitfalls = JSON.parse(fs.readFileSync(pitfallFile, 'utf8'));
  const vocab = vocabCore.buildIndexes({ raw, lang, isFeatureEnabled: () => true });
  vocab.pitfalls = pitfalls;

  console.log(`\n--- Interactive Fixture Mode: ${lang.toUpperCase()} ---`);

  // ── AI REQUEST QUEUE PASS ──
  if (fs.existsSync(queuePath)) {
    const requests = fs.readFileSync(queuePath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
    if (requests.length > 0) {
      console.log(`\n>>> AI has requested verification for ${requests.length} cases.`);
      console.log(`>>> Please finish these before continuing to your own tests.\n`);

      for (let i = 0; i < requests.length; i++) {
        const req = requests[i];
        printCaseHeader(`AI REQUEST ${i + 1} / ${requests.length}`, req.text, req.comment);
        await processSentence(req.text, lang, vocab, fixturePath);
      }
      // Clear the queue after processing
      fs.unlinkSync(queuePath);
      console.log('\n>>> All AI requests completed! Entering normal mode...');
    }
  }

  console.log('\nTIP: Press Enter without typing to get a Challenge Sentence.');

  while (true) {
    let text = await question('\nType sentence (or Enter for challenge, "exit" to quit): ');
    if (text.toLowerCase() === 'exit') break;
    if (text.trim() === '') {
      text = generateChallenge(lang, vocab);
    }
    printCaseHeader('FREE-FORM CASE', text, null);
    await processSentence(text, lang, vocab, fixturePath);
  }
  rl.close();
}

async function processSentence(text, lang, vocab, fixturePath) {
    const findings = host.__lexiSpellCore.check(text, vocab, { lang });
    let currentCase = { text, expected: [], comment: '', status: 'ok' };
    // `fastPath` short-circuits the comment + save-confirmation prompts
    // when the user picks an "I agree with what the app did" branch
    // (Enter/y on a clean sentence, y/r/d on one with findings). The
    // slow path (n, p, u) keeps both prompts so the user can add context.
    let fastPath = false;

    if (findings.length === 0) {
      console.log('  App found NO errors — sentence appears clean.');
      const fb = (await question('  [Enter=Yes, n=No (missed error), u=Unsure] > ')).toLowerCase();
      if (fb === 'u') {
        currentCase.status = 'unsure';
      } else if (fb === 'n') {
        const wrongWord = await question('  Which word is WRONG? ');
        const start = text.indexOf(wrongWord);
        if (start !== -1) {
          const sug = await question(`  What should "${wrongWord}" be? `);
          const rid = await pickRule();
          currentCase.expected.push({ rule_id: rid, start, end: start + wrongWord.length, suggestion: sug });
        }
      } else if (fb === '' || fb === 'y') {
        fastPath = true;
      } else {
        return; // unrecognized input — bail without saving
      }
    } else {
      console.log('  APP FINDINGS:');
      findings.forEach((f, i) => {
        console.log(`    ${i + 1}) [${f.rule_id}] "${text.slice(f.start, f.end)}" → "${f.suggestion || f.fix}"`);
        if (f.message) console.log(`       ${f.message}`);
      });
      const feedback = (await question(
        '\n  [y=Yes, n=No, r=Reject all (clean), d=Reject all (pending data), p=Partial, u=Unsure] > '
      )).toLowerCase();
      if (feedback === 'u') {
        currentCase.status = 'unsure';
      } else if (feedback === 'y') {
        currentCase.expected = findings.map(f => ({ rule_id: f.rule_id, start: f.start, end: f.end, suggestion: f.suggestion || f.fix }));
        fastPath = true;
      } else if (feedback === 'r') {
        // Reject-all: every finding is a false positive and the sentence is
        // clean. Use this when the rule is correct NOW and the fixture
        // should pass immediately — check-fixtures will hard-fail if any
        // finding fires.
        currentCase.expected = [];
        fastPath = true;
      } else if (feedback === 'd') {
        // Reject-all + pending upstream data fix: the rule is still firing
        // because of a data gap at the Papertek vocabulary layer (missing
        // inflected form, wrong genus, etc). Save as clean but tag with
        // `pending: true` so check-fixtures parks the case until the
        // upstream fix lands. When papertek-vocabulary ships the fix and
        // the fixture starts passing, remove the `pending` flag.
        currentCase.expected = [];
        currentCase.pending = true;
        fastPath = true;
      } else if (feedback === 'p') {
        console.log('\n  Guided Review:');
        for (let i = 0; i < findings.length; i++) {
          const f = findings[i];
          console.log(`\n  Issue ${i + 1}/${findings.length}: [${f.rule_id}] "${text.slice(f.start, f.end)}" → "${f.suggestion || f.fix}"`);
          const action = (await question('  Action? [Enter=Accept, d=Discard, e=Edit fix] > ')).toLowerCase();
          if (action === 'd') {
            continue;
          } else if (action === 'e') {
            const override = await question(`  Correct suggestion for "${text.slice(f.start, f.end)}": `);
            currentCase.expected.push({
              rule_id: f.rule_id, start: f.start, end: f.end, suggestion: override
            });
          } else {
            currentCase.expected.push({
              rule_id: f.rule_id, start: f.start, end: f.end, suggestion: f.suggestion || f.fix
            });
          }
        }
      } else if (feedback !== 'n') {
        return; // unrecognized input — bail without saving
      }
    }

    if (fastPath) {
      appendCase(fixturePath, currentCase);
      const label = currentCase.pending ? '✓ Saved (pending upstream data fix)'
                  : currentCase.expected.length === 0 ? '✓ Saved (clean)'
                  : `✓ Saved (${currentCase.expected.length} expected finding${currentCase.expected.length === 1 ? '' : 's'})`;
      console.log('  ' + label);
      return;
    }

    // Slow path — user is in n/p/u territory; comment and save confirmation
    // are useful here because the saved case diverges from the app's output.
    currentCase.comment = await question('\n  More info for AI (or press Enter): ');
    printSummary(currentCase);
    const saveConfirm = await question('  Save? [Enter=yes, n=no] > ');
    if (saveConfirm.toLowerCase() !== 'n') {
      appendCase(fixturePath, currentCase);
      console.log('  Saved.');
    } else {
      console.log('  Discarded.');
    }
}

main();

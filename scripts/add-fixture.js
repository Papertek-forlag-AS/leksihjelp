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
  }
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

function printSummary(data) {
  console.log('\n' + '='.repeat(50));
  console.log('       PROPOSED TEST CASE SUMMARY');
  console.log('='.repeat(50));
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
  console.log('='.repeat(50));
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
        console.log(`\nAI REQUEST ${i+1}/${requests.length}:`);
        console.log(`TEXT:    "${req.text}"`);
        if (req.comment) console.log(`WHY:     ${req.comment}`);
        
        await processSentence(req.text, lang, vocab, fixturePath);
      }
      // Clear the queue after processing
      fs.unlinkSync(queuePath);
      console.log('\n>>> All AI requests completed! Entering normal mode...');
    }
  }

  console.log('TIP: Press Enter without typing to get a Challenge Sentence.');

  while (true) {
    let text = await question('\nType sentence (or Enter for challenge, "exit" to quit): ');
    if (text.toLowerCase() === 'exit') break;
    if (text.trim() === '') {
      text = generateChallenge(lang, vocab);
      console.log(`CHALLENGE: "${text}"`);
    }

    await processSentence(text, lang, vocab, fixturePath);
  }
  rl.close();
}

async function processSentence(text, lang, vocab, fixturePath) {
    const findings = host.__lexiSpellCore.check(text, vocab, { lang });
    let currentCase = { text, expected: [], comment: '', status: 'ok' };

    if (findings.length === 0) {
      console.log('\n--- App found NO errors.');
      const fb = (await question('Is this correct? (y = Yes, n = No (missed error), u = Unsure): ')).toLowerCase();
      if (fb === 'u') {
        currentCase.status = 'unsure';
      } else if (fb === 'n') {
        const wrongWord = await question('Which word is WRONG? ');
        const start = text.indexOf(wrongWord);
        if (start !== -1) {
          const sug = await question(`What should "${wrongWord}" be? `);
          const rid = await pickRule();
          currentCase.expected.push({ rule_id: rid, start, end: start + wrongWord.length, suggestion: sug });
        }
      } else if (fb !== 'y') return;
    } else {
      console.log('\nApp Findings:');
      findings.forEach((f, i) => {
        console.log(`${i + 1}) [${f.rule_id}] "${text.slice(f.start, f.end)}" -> "${f.suggestion || f.fix}" (${f.message})`);
      });
      const feedback = (await question('\nIs the app correct? (y = Yes, n = No (hallucination), p = Partial/Guided Review, u = Unsure): ')).toLowerCase();
      if (feedback === 'u') {
        currentCase.status = 'unsure';
      } else if (feedback === 'y') {
        currentCase.expected = findings.map(f => ({ rule_id: f.rule_id, start: f.start, end: f.end, suggestion: f.suggestion || f.fix }));
      } else if (feedback === 'p') {
        console.log('\n--- Guided Review ---');
        for (let i = 0; i < findings.length; i++) {
          const f = findings[i];
          console.log(`\nIssue ${i + 1}/${findings.length}: [${f.rule_id}] "${text.slice(f.start, f.end)}" -> "${f.suggestion || f.fix}"`);
          const action = (await question('Action? (Enter = Accept, d = Discard, e = Edit fix): ')).toLowerCase();
          
          if (action === 'd') {
            continue; // Skip this finding
          } else if (action === 'e') {
            const override = await question(`Correct suggestion for "${text.slice(f.start, f.end)}": `);
            currentCase.expected.push({
              rule_id: f.rule_id, start: f.start, end: f.end, suggestion: override
            });
          } else {
            // Default: Accept
            currentCase.expected.push({
              rule_id: f.rule_id, start: f.start, end: f.end, suggestion: f.suggestion || f.fix
            });
          }
        }
      } else if (feedback !== 'n') return;
    }

    currentCase.comment = await question('\nMore info for AI (or press Enter): ');
    printSummary(currentCase);
    const saveConfirm = await question('Save? (Enter=yes, n=no): ');
    if (saveConfirm.toLowerCase() !== 'n') {
      fs.appendFileSync(fixturePath, JSON.stringify({ id: `case-${Date.now()}`, ...currentCase }) + '\n');
      console.log('Saved.');
    } else {
      console.log('Discarded.');
    }
}

main();

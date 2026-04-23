
const path = require('path');
const fs = require('fs');
const vocabCore = require('./extension/content/vocab-seam-core.js');
const spellCore = require('./extension/content/spell-check-core.js');

// Load all rules
const SPELL_RULES_DIR = path.join(__dirname, 'extension', 'content', 'spell-rules');
fs.readdirSync(SPELL_RULES_DIR)
  .filter(f => f.endsWith('.js'))
  .forEach(f => require(path.join(SPELL_RULES_DIR, f)));

function test(text, lang) {
  console.log(`\nTesting [${lang}]: "${text}"`);
  
  // Load vocab for the language
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension', 'data', `${lang}.json`), 'utf8'));
  let bigrams = null, freq = null;
  try { bigrams = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension', 'data', `bigrams-${lang}.json`), 'utf8')); } catch(e) {}
  try { freq = JSON.parse(fs.readFileSync(path.join(__dirname, 'extension', 'data', `freq-${lang}.json`), 'utf8')); } catch(e) {}
  
  // Enable all grammar features for the mock
  const isFeatureEnabled = () => true;
  
  const vocab = vocabCore.buildIndexes({ raw, bigrams, freq, lang, isFeatureEnabled });
  
  const findings = spellCore.check(text, vocab, { lang });
  if (findings.length === 0) {
    console.log("  ✅ No errors found (sentence is correct).");
  } else {
    findings.forEach(f => {
      console.log(`  ❌ [${f.rule_id}] "${f.original}" -> "${f.fix}"`);
      if (f.suggestions) console.log(`      Suggestions: ${f.suggestions.join(', ')}`);
      if (f.message) console.log(`      Message: ${f.message}`);
    });
  }
}

// 1. Og/Å rule
test("Jeg liker og bade", "nb");
test("En katt å en hund", "nb");

// 2. Da/Når rule
test("Da jeg går til skolen", "nb");
test("Når jeg var liten gutt", "nb");

// 3. Gjerne/Hjerne rule
test("Jeg vil hjerne ha kake", "nb");
test("Han har en stor gjerne", "nb");

// 4. Vær/Hver rule
test("Det skjer vær dag", "nb");
test("Det er fint hver i dag", "nb");

// 5. Bigram Context Typo rule
test("Hun er veldig bar", "nb");

// 6. Typo limit lowered to 3 chars
test("Hva jør du?", "nb");

// 7. English Homophones
test("Your not alono", "en");
test("There dog is cute.", "en");
test("They are playing over their.", "en");
test("Its a very nice day.", "en");
test("He is taller then me.", "en");

// 8. English SV Agreement
test("The dog run fast.", "en");

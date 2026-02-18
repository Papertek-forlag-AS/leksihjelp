# Word Prediction: Ze Big Plan

A comprehensive plan for making word prediction in Lexi truly helpful for dyslexic students learning foreign languages.

## Current State

### What We Have
- Basic word prediction with fuzzy matching (Levenshtein distance)
- Pronoun-aware verb conjugation boosting ("ich spr..." → "spreche")
- Modal verb detection for infinitive boosting ("ich kann spr..." → "sprechen")
- Grammar feature filtering (respects user's enabled tenses/cases)
- Bidirectional prediction (target language ↔ Norwegian)

### What's Missing
- No phonetic/sound-based matching (critical for dyslexia)
- No learning from user behavior
- No sentence structure awareness beyond immediate context
- No visual feedback for grammar patterns
- No audio preview of suggestions

---

## Understanding Dyslexia in Language Learning

### Key Challenges
1. **Phoneme-grapheme mapping** - Difficulty connecting sounds to written letters
2. **Working memory load** - Holding grammar rules while writing
3. **Letter reversals/transpositions** - "ei" vs "ie", "sch" vs "chs"
4. **Vowel confusion** - Especially with umlauts (a/ä, o/ö, u/ü)
5. **Morphological awareness** - Recognizing word parts (prefixes, suffixes, stems)

### What Helps
- **Sound-based matching** - Match what they hear, not just what they type
- **Consistent patterns** - Show grammar patterns visually
- **Reduced cognitive load** - Smart defaults, fewer choices
- **Multi-sensory feedback** - See + hear suggestions
- **Error tolerance** - Accept common dyslexic error patterns

---

## Feature Roadmap

### Phase 1: Phonetic Matching (High Priority)

#### 1.1 German Phonetic Rules
Create phonetic equivalence classes for common confusions:

```javascript
const PHONETIC_EQUIVALENCES = {
  // Vowel sounds
  'ei': ['ai', 'ey', 'ay'],           // "mein" might be typed "main"
  'ie': ['i', 'ih'],                   // "die" might be typed "di"
  'eu': ['oi', 'äu'],                  // "neu" might be typed "noi"
  'äu': ['eu', 'oi'],                  // "Häuser" might be typed "Hoiser"

  // Umlauts (often typed without dots)
  'ä': ['a', 'ae'],
  'ö': ['o', 'oe'],
  'ü': ['u', 'ue'],
  'ß': ['ss', 's'],

  // Consonant sounds
  'sch': ['sh', 'ch', 'sc'],           // "Schule" might be typed "Shule"
  'ch': ['g', 'k', 'sch'],             // varies by dialect
  'v': ['f', 'w'],                     // "Vogel" might be typed "Fogel"
  'w': ['v'],                          // "was" might be typed "vas"
  'z': ['ts', 's'],                    // "Zeit" might be typed "Tsait"
  'qu': ['kw', 'kv'],

  // Common endings
  'ung': ['ong', 'unk'],
  'tion': ['sion', 'zion'],
  'heit': ['hait', 'keit'],
  'keit': ['kait', 'heit'],
};
```

#### 1.2 Spanish Phonetic Rules
```javascript
const SPANISH_PHONETIC = {
  // B/V confusion (same sound in Spanish)
  'b': ['v'],
  'v': ['b'],

  // H is silent
  'h': [''],                           // "hola" might be typed "ola"

  // LL/Y confusion
  'll': ['y', 'j'],
  'y': ['ll', 'i'],

  // C/S/Z confusion (varies by region)
  'c': ['s', 'z'],                     // before e/i
  'z': ['s', 'c'],

  // G/J confusion
  'g': ['j'],                          // before e/i
  'j': ['g', 'h'],

  // Ñ
  'ñ': ['n', 'ny', 'ni'],

  // QU
  'qu': ['k', 'c'],
};
```

#### 1.3 Implementation Approach
```javascript
function phoneticMatch(query, target, lang) {
  // 1. Normalize both strings
  const normalizedQuery = normalizePhonetic(query, lang);
  const normalizedTarget = normalizePhonetic(target, lang);

  // 2. Check direct phonetic match
  if (normalizedTarget.startsWith(normalizedQuery)) {
    return { match: true, score: 80, reason: 'phonetic' };
  }

  // 3. Check with substitutions
  const variants = generatePhoneticVariants(query, lang);
  for (const variant of variants) {
    if (target.toLowerCase().startsWith(variant)) {
      return { match: true, score: 70, reason: 'phonetic-variant' };
    }
  }

  return { match: false, score: 0 };
}
```

### Phase 2: Common Error Patterns

#### 2.1 Dyslexia-Specific Patterns
```javascript
const DYSLEXIA_PATTERNS = {
  // Letter reversals
  reversals: [
    ['b', 'd'],
    ['p', 'q'],
    ['m', 'w'],
    ['n', 'u'],
  ],

  // Letter transpositions (switching adjacent letters)
  transpositions: true,  // "teh" → "the", "freund" → "fruend"

  // Doubling errors
  doubling: [
    ['ss', 's'],
    ['mm', 'm'],
    ['nn', 'n'],
    ['ll', 'l'],
    ['tt', 't'],
  ],

  // Missing/extra letters
  omissions: true,       // "sprechen" → "spreche" (missing n)
  insertions: true,      // "und" → "unnd"
};
```

#### 2.2 Implementation
```javascript
function generateDyslexiaVariants(word) {
  const variants = new Set([word]);

  // Generate reversal variants
  for (const [a, b] of DYSLEXIA_PATTERNS.reversals) {
    variants.add(word.replace(new RegExp(a, 'g'), b));
    variants.add(word.replace(new RegExp(b, 'g'), a));
  }

  // Generate transposition variants (swap adjacent letters)
  for (let i = 0; i < word.length - 1; i++) {
    const swapped = word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    variants.add(swapped);
  }

  // Generate doubling variants
  for (const [double, single] of DYSLEXIA_PATTERNS.doubling) {
    variants.add(word.replace(new RegExp(double, 'g'), single));
    variants.add(word.replace(new RegExp(single, 'g'), double));
  }

  return [...variants];
}
```

### Phase 3: Context-Aware Prediction

#### 3.1 Sentence Position Detection
```javascript
const SENTENCE_POSITIONS = {
  START: 'start',      // After period/start of text
  AFTER_SUBJECT: 'after_subject',  // After pronoun/noun
  AFTER_VERB: 'after_verb',
  AFTER_MODAL: 'after_modal',
  AFTER_ARTICLE: 'after_article',
  AFTER_PREPOSITION: 'after_preposition',
};

function detectPosition(textBeforeCursor, lang) {
  const words = textBeforeCursor.trim().split(/\s+/);
  const lastWord = words[words.length - 1]?.toLowerCase();
  const secondLast = words[words.length - 2]?.toLowerCase();

  // Check for sentence start
  if (words.length === 0 || /[.!?]$/.test(secondLast)) {
    return SENTENCE_POSITIONS.START;
  }

  // Check what came before
  if (ARTICLES[lang]?.has(lastWord)) {
    return SENTENCE_POSITIONS.AFTER_ARTICLE;
  }
  if (PREPOSITIONS[lang]?.has(lastWord)) {
    return SENTENCE_POSITIONS.AFTER_PREPOSITION;
  }
  if (MODAL_VERBS.has(lastWord)) {
    return SENTENCE_POSITIONS.AFTER_MODAL;
  }
  // ... etc

  return null;
}
```

#### 3.2 Word Type Boosting by Position
```javascript
const POSITION_BOOSTS = {
  [SENTENCE_POSITIONS.START]: {
    boost: ['pronoun', 'article', 'conjunction'],
    penalize: ['verb-infinitive'],
  },
  [SENTENCE_POSITIONS.AFTER_ARTICLE]: {
    boost: ['noun', 'adjective'],
    penalize: ['verb', 'pronoun'],
  },
  [SENTENCE_POSITIONS.AFTER_PREPOSITION]: {
    boost: ['noun', 'article'],
    penalize: ['verb-conjugated'],
  },
  [SENTENCE_POSITIONS.AFTER_MODAL]: {
    boost: ['verb-infinitive'],
    penalize: ['verb-conjugated', 'noun'],
  },
};
```

#### 3.3 German Case Detection (Advanced)
```javascript
// After certain prepositions, boost specific cases
const PREPOSITION_CASES = {
  // Akkusativ
  'für': 'akkusativ',
  'gegen': 'akkusativ',
  'ohne': 'akkusativ',
  'durch': 'akkusativ',
  'um': 'akkusativ',

  // Dativ
  'mit': 'dativ',
  'bei': 'dativ',
  'nach': 'dativ',
  'von': 'dativ',
  'zu': 'dativ',
  'aus': 'dativ',

  // Wechselpräpositionen (context-dependent)
  'in': 'context',
  'an': 'context',
  'auf': 'context',
  // ...
};
```

### Phase 4: Visual Grammar Hints

#### 4.1 Color-Coded Suggestions
Show visual cues for grammar properties:

```css
/* Gender colors */
.pred-gender-m { border-left: 3px solid #3b82f6; }  /* Blue for masculine */
.pred-gender-f { border-left: 3px solid #ec4899; }  /* Pink for feminine */
.pred-gender-n { border-left: 3px solid #10b981; }  /* Green for neutral */

/* Verb tense indicators */
.pred-tense-present::after { content: "nå"; }
.pred-tense-past::after { content: "før"; }
.pred-tense-future::after { content: "snart"; }

/* Case indicators */
.pred-case-nom { background: rgba(59, 130, 246, 0.1); }
.pred-case-akk { background: rgba(249, 115, 22, 0.1); }
.pred-case-dat { background: rgba(139, 92, 246, 0.1); }
```

#### 4.2 Enhanced Dropdown Display
```html
<div class="lh-pred-item" data-gender="f" data-case="nominativ">
  <span class="lh-pred-word">
    <span class="gender-dot"></span>
    Schule
  </span>
  <span class="lh-pred-grammar">f · nom</span>
  <span class="lh-pred-translation">skole</span>
</div>
```

### Phase 5: Audio Integration

#### 5.1 Audio Preview on Hover
```javascript
let audioPreviewTimeout = null;

function handleSuggestionHover(entry) {
  // Clear previous timeout
  clearTimeout(audioPreviewTimeout);

  // Wait 500ms before playing (don't spam audio)
  audioPreviewTimeout = setTimeout(() => {
    if (entry.audio) {
      playAudioPreview(entry.audio);
    }
  }, 500);
}

function playAudioPreview(audioId) {
  const url = chrome.runtime.getURL(`audio/${currentLang}/${audioId}.mp3`);
  const audio = new Audio(url);
  audio.volume = 0.5;  // Quieter for preview
  audio.play();
}
```

#### 5.2 Keyboard Shortcut for Audio
```javascript
// Press 'P' to hear the selected suggestion
if (e.key === 'p' && selectedIndex >= 0) {
  const selected = currentSuggestions[selectedIndex];
  if (selected.audio) {
    playAudioPreview(selected.audio);
  }
}
```

### Phase 6: Learning & Adaptation

#### 6.1 Usage Tracking
```javascript
// Track which words the user selects
async function trackSelection(word, context) {
  const stats = await chrome.storage.local.get('predictionStats') || {};

  stats[word] = stats[word] || { count: 0, contexts: [] };
  stats[word].count++;
  stats[word].lastUsed = Date.now();
  stats[word].contexts.push(context);

  await chrome.storage.local.set({ predictionStats: stats });
}
```

#### 6.2 Personalized Boosting
```javascript
function getPersonalBoost(word) {
  const stats = predictionStats[word];
  if (!stats) return 0;

  // Recency bonus (used in last hour = +50, last day = +30, etc.)
  const hourAgo = Date.now() - 3600000;
  const dayAgo = Date.now() - 86400000;

  let boost = 0;
  if (stats.lastUsed > hourAgo) boost += 50;
  else if (stats.lastUsed > dayAgo) boost += 30;

  // Frequency bonus (capped at +100)
  boost += Math.min(stats.count * 10, 100);

  return boost;
}
```

#### 6.3 Error Pattern Learning
```javascript
// Learn from corrections
function learnFromCorrection(typed, selected) {
  // If user typed "fogel" and selected "Vogel", learn this pattern
  const pattern = { typed, correct: selected };

  const corrections = await chrome.storage.local.get('corrections') || [];
  corrections.push(pattern);

  // Keep last 100 corrections
  if (corrections.length > 100) corrections.shift();

  await chrome.storage.local.set({ corrections });
}
```

### Phase 7: Smart Defaults

#### 7.1 Reduced Cognitive Load
```javascript
// Limit suggestions based on context
function getMaxSuggestions(context) {
  // Fewer choices = less overwhelming
  if (context.hasModalVerb) return 3;  // Usually one clear answer
  if (context.afterArticle) return 4;  // Nouns/adjectives
  return 5;  // Default
}
```

#### 7.2 Confidence-Based Display
```javascript
// Only show suggestions above a confidence threshold
function filterByConfidence(suggestions) {
  const topScore = suggestions[0]?.score || 0;

  // Only show suggestions within 30% of top score
  return suggestions.filter(s => s.score >= topScore * 0.7);
}
```

---

## Data Requirements from API

### Current API Fields Used
- `word` - the word itself
- `translation` - Norwegian translation
- `conjugations` - verb conjugations
- `cases` - noun declensions
- `genus` - grammatical gender
- `audio` - audio file reference

### Requested API Additions

#### 1. Phonetic Field
```json
{
  "word": "Vogel",
  "phonetic": "foːɡl̩",
  "phonetic_simple": "fogel"  // Simplified for matching
}
```

#### 2. Word Frequency
```json
{
  "word": "sein",
  "frequency": 1,  // 1 = most common, 5 = least common
  "cefr_level": "A1"
}
```

#### 3. Related Words
```json
{
  "word": "sprechen",
  "related": {
    "nouns": ["Sprache", "Sprecher"],
    "adjectives": ["sprachlich"]
  }
}
```

---

## Implementation Priority

### Must Have (Phase 1-2)
1. Phonetic matching for German
2. Common dyslexia error patterns
3. Better umlaut handling

### Should Have (Phase 3-4)
4. Position-aware word type boosting
5. Visual gender indicators
6. Case detection after prepositions

### Nice to Have (Phase 5-7)
7. Audio preview on hover
8. Usage learning
9. Personalized boosting

---

## Success Metrics

### Quantitative
- **Selection rate**: % of suggestions that get selected (target: >40%)
- **Position in list**: Average position of selected word (target: <2)
- **Keystrokes saved**: Characters typed vs autocompleted (target: >50% saved)

### Qualitative
- User feedback from dyslexic students
- Teacher observations
- Writing speed comparisons

---

## Technical Considerations

### Performance
- Phonetic variant generation must be cached
- Maximum 1000 entries in scored list before sorting
- Debounce input handling (100ms)

### Storage
- `chrome.storage.local` for user stats (synced across devices)
- Maximum 5MB for learning data

### Accessibility
- Keyboard navigation must work
- Screen reader announcements for suggestions
- High contrast mode support

---

## Timeline

| Phase | Feature | Effort | Priority |
|-------|---------|--------|----------|
| 1 | German phonetic matching | 2 days | P0 |
| 1 | Spanish phonetic matching | 1 day | P0 |
| 2 | Dyslexia error patterns | 2 days | P0 |
| 3 | Sentence position detection | 2 days | P1 |
| 3 | Case detection (German) | 2 days | P1 |
| 4 | Visual grammar hints | 1 day | P1 |
| 5 | Audio preview | 1 day | P2 |
| 6 | Usage tracking | 1 day | P2 |
| 6 | Personalized boosting | 1 day | P2 |
| 7 | Smart defaults | 0.5 day | P1 |

**Total estimated effort: ~13.5 days**

---

## Open Questions

1. **User testing**: How do we get feedback from actual dyslexic students?
2. **Teacher input**: What patterns do teachers observe most frequently?
3. **Language priority**: Should we perfect German first or parallel development?
4. **Privacy**: How much learning data should we store?
5. **Sync**: Should learning data sync across devices via chrome.storage.sync?

---

## References

- [Dyslexia and Language Learning](https://dyslexiaida.org/dyslexia-and-language-learning/)
- [Phonological Processing in Dyslexia](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3020095/)
- [German Phonetics for Learners](https://www.goethe.de/en/spr/ueb.html)
- [Assistive Technology for Dyslexia](https://www.bdadyslexia.org.uk/advice/technology)

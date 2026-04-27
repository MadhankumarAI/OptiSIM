text = "Tim Cook visited London yesterday and met Sundar Pichai at Google ."
spans = [(0, 8, 'PER'), (17, 23, 'LOC'), (42, 55, 'PER'), (59, 65, 'ORG')]

words, offsets, i = [], [], 0
for w in text.split():
    s = text.find(w, i)
    words.append(w)
    offsets.append((s, s + len(w)))
    i = s + len(w)

labels = []
for ws, we in offsets:
    tag = 'O'
    for ss, se, t in spans:
        if ws >= ss and we <= se:
            tag = ('B-' if ws == ss else 'I-') + t
            break
    labels.append(tag)

for w, l in zip(words, labels):
    print(f'{w:15s} {l}')


"""
=== Concept: BIO Tagging Scheme ===

The problem BIO solves
  - NER labels are per-WORD, but entities can span MULTIPLE words.
    "New York", "Tim Cook", "Bank of America" are all single entities
    of multiple tokens.
  - You need a per-token labeling scheme that can ALSO encode where
    entity boundaries are. BIO does this.

The three tag prefixes

  B-X : BEGINNING of an entity of type X.
  I-X : INSIDE an entity of type X (continuation of the previous token).
  O   : OUTSIDE any entity.

  The full label for a token = prefix + entity type, e.g.:
        B-PER, I-PER, B-LOC, I-LOC, B-ORG, I-ORG, O.

Why two prefixes (B and I) instead of just one?

  Without B/I you'd have IO tagging: just PER, LOC, O. But then if two
  PER entities appear next to each other ("Tim Cook Steve Jobs"), you
  can't tell where one ends and the next begins — they all just look
  like "PER PER PER PER".

  B-PER marks the START of a new entity. So:
        Tim   Cook  Steve Jobs
        B-PER I-PER B-PER I-PER
  Now the boundary is clear: "Tim Cook" = entity 1, "Steve Jobs" = entity 2.

What this script does
  - Takes a sentence + a list of entity SPANS (character offsets + type).
  - Word-tokenizes the sentence.
  - For each word, checks if its character offsets fall inside any span.
  - Assigns:
        B-X if the word starts AT the span's start (first word of entity)
        I-X if the word is INSIDE the span but not the first
        O   if the word is outside all spans

  Output:
        Tim             B-PER
        Cook            I-PER
        visited         O
        London          B-LOC
        yesterday       O
        and             O
        met             O
        Sundar          B-PER
        Pichai          I-PER
        at              O
        Google          B-ORG
        .               O

The BIO scheme is the standard NER label format
  - CoNLL-2003 ships in BIO format.
  - HuggingFace `pipeline('ner', aggregation_strategy=None)` returns
    BIO labels per subword.
  - Almost every published NER paper uses BIO (sometimes called IOB2).

Variants of BIO

  IO       : just I-X and O. Simplest, but can't separate adjacent
             entities of the same type. Rarely used today.

  IOB1     : older variant where B-X is ONLY used when two entities of
             the same type are adjacent. So most "first" tokens are
             actually I-X. Confusing.

  IOB2 / BIO : modern variant where EVERY first token of an entity is
             B-X. This is what the script implements and what everyone
             uses now.

  BIOES (a.k.a. BILOU)
        B-X : Beginning of a multi-token entity
        I-X : Inside a multi-token entity
        E-X : End (Last) token of a multi-token entity
        S-X : Single-token entity (entity is just one token)
        O   : Outside
    - More information per token (5 prefixes vs 3) → easier for the model
      to learn span boundaries.
    - Slightly higher F1 in practice (~1-2% on CoNLL).
    - Used in some research, but BIO is more common.

  BMES, BMEO, etc.
    - Variants with different naming. Same idea as BIOES.

How the model uses BIO during training

  - Each token gets one of {B-X, I-X, O} for X in entity types.
  - Number of labels = 2*N + 1 where N is the number of entity types.
    For CoNLL-2003 (PER, LOC, ORG, MISC):  2*4 + 1 = 9 labels.
  - The model learns a softmax over these 9 labels per token.
  - At inference: argmax → BIO predictions → walk through to extract
    entity spans (the inverse of what this script does).

Common BIO violations the model can produce (and how to fix them)

  - I-X following O                : "I came from I-LOC" — illegal,
                                      I-X must follow B-X or I-X of the
                                      same type. Fix: treat as B-X.
  - I-X following B-Y or I-Y        : type mismatch. Fix: stop the
                                      previous span, start a new one.
  - These are post-processing rules; HuggingFace's
    aggregation_strategy='simple' handles them for you.

Inverse direction (BIO → spans)
  - This script: spans → BIO. The inverse is BIO → spans, used during
    PREDICTION:
        for each contiguous run of B-X, I-X, I-X, ...
            emit a span with type X and offsets [start_of_B, end_of_last_I]

Why not just predict (start, end, type) triples directly?
  - Some modern systems do! "Span-based NER" treats it as a pair of
    offsets per entity. Avoids the BIO complications above.
  - But BIO is simpler to train (per-token classification with standard
    softmax + cross-entropy) and works well, so it's still the default.

Subword issue (interaction with BERT-style tokenizers)
  - BERT tokenizes "Washington" as ["Wash", "##ington"] — but BIO labels
    are per WORD.
  - Standard fix: label only the FIRST subword with the word's BIO tag,
    set later subwords to -100 (ignored by loss).
  - At prediction time, take the first subword's label as the word's
    label.
  - Q61 already handles this in its tokenize() function.

=== Code notes ===

words, offsets, i = [], [], 0
for w in text.split():
    s = text.find(w, i)
    words.append(w)
    offsets.append((s, s + len(w)))
    i = s + len(w)
  - Word-tokenize and track the character offset of each word in the
    original text. The (start, end) offsets are what we compare against
    the entity spans.
  - text.find(w, i) starts searching from position i, which prevents
    finding the wrong occurrence of a repeated word.

for ws, we in offsets:
    tag = 'O'
    for ss, se, t in spans:
        if ws >= ss and we <= se:
            tag = ('B-' if ws == ss else 'I-') + t
            break
  - For each word's character span (ws, we), check every entity span
    (ss, se, t):
        - If word span is fully INSIDE entity span → it belongs to this
          entity.
        - If word starts AT the entity start → first word → B-prefix.
        - Otherwise → continuation → I-prefix.
  - First match wins (assumes spans don't overlap).

How to extend
  - INVERSE (BIO → spans):
        spans = []
        cur_start, cur_type = None, None
        for (ws, we), tag in zip(offsets, labels):
            if tag.startswith('B-'):
                if cur_start is not None:
                    spans.append((cur_start, prev_end, cur_type))
                cur_start, cur_type = ws, tag[2:]
            elif tag.startswith('I-') and tag[2:] == cur_type:
                pass   # extend current
            else:
                if cur_start is not None:
                    spans.append((cur_start, prev_end, cur_type))
                    cur_start = None
            prev_end = we
        if cur_start is not None:
            spans.append((cur_start, prev_end, cur_type))

  - BIOES (richer scheme):
        for span:
            if single-word: S-X
            else:           B-X, I-X, ..., I-X, E-X

  - HANDLE OVERLAPPING SPANS (rare in NER, common in nested NER):
        BIO can't natively express overlap. Use multi-label BIO
        (one tag per layer) or a span-based model.

  - VALIDATE BIO SEQUENCES (catch model errors):
        for prev, cur in zip(labels, labels[1:]):
            if cur.startswith('I-'):
                if prev == 'O' or (prev[2:] != cur[2:]):
                    print('BIO violation:', prev, '→', cur)
"""

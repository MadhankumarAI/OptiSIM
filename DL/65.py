from transformers import pipeline
from spacy import displacy

nlp = pipeline('ner', model='dslim/bert-base-NER', aggregation_strategy='simple')
text = "Apple is looking at buying U.K. startup for $1 billion. Tim Cook visited London yesterday."
ents = nlp(text)

for e in ents:
    print(f"[{e['entity_group']:5s}] {e['word']:25s} ({e['score']:.2f}) {e['start']}-{e['end']}")

displacy.render(
    {'text': text, 'ents': [{'start': e['start'], 'end': e['end'], 'label': e['entity_group']} for e in ents]},
    style='ent', manual=True, jupyter=True,
)


"""
=== Concept: Visualizing NER Predictions ===

Two complementary outputs are useful when working with NER models:

  1. STRUCTURED OUTPUT (the print loop)
     A list of entity dicts:
        [{'entity_group': 'ORG',
          'score': 0.99,
          'word': 'Apple',
          'start': 0,
          'end': 5},
         ...]
     - entity_group : the entity type after BIO tags are merged into spans.
                      Common types: PER, LOC, ORG, MISC.
     - score        : softmax probability of the predicted class.
     - word         : the actual text span.
     - start, end   : character offsets in the original input.

  2. RENDERED VIEW (displacy)
     - Highlights each entity span IN-LINE in the source text with a
       colored background and the predicted label.
     - The standard NER visualization across the NLP world (spaCy ships
       with it; HF and others piggyback on it).
     - jupyter=True renders inline in a notebook. In plain Python use
       displacy.serve(...) to launch a local web server, or pass
       jupyter=False and save displacy's returned HTML string.

The pipeline abstraction (the easy way to use any model)

  pipeline('ner', model='dslim/bert-base-NER', aggregation_strategy='simple')

  - 'ner'                 : the task. Other tasks: 'sentiment-analysis',
                            'fill-mask', 'translation', 'summarization',
                            'question-answering', 'zero-shot-classification'.
  - model='dslim/bert-base-NER' : a pre-fine-tuned NER checkpoint on
                            CoNLL-2003. ~85% F1 out of the box.
  - aggregation_strategy='simple' : auto-merge sub-token BIO tags into
                            full entity spans. Without this, you'd get
                            one prediction per subword, with B-/I- prefixes
                            you'd need to merge yourself.

Why aggregation matters
  - Without aggregation:
        Apple → [{'B-ORG', score=0.99}]
        is    → [{'O',     score=0.99}]
        ...
        Tim   → [{'B-PER', score=0.99}]
        Cook  → [{'I-PER', score=0.99}]   ← same entity continues
        London→ [{'B-LOC', score=0.99}]
    You'd have to walk the list and stitch B-/I- tags back together.
  - With aggregation_strategy='simple':
        - {'word': 'Apple',     'entity_group': 'ORG'}
        - {'word': 'Tim Cook',  'entity_group': 'PER'}     ← merged!
        - {'word': 'London',    'entity_group': 'LOC'}
    Span-level output, ready to display.
  - Other strategies: 'first', 'average', 'max' — different ways to
    merge sub-token scores into the span score.

Aggregation strategy quick reference

    'none'    : no merging. One label per subword. Useful for debugging.
    'simple'  : merge adjacent same-type tags into one span. Default.
    'first'   : same as 'simple' but uses first-subword score.
    'average' : averages subword scores across the span.
    'max'     : uses max subword score across the span.

When to use each visualization

  Print loop
    - Quick sanity check during dev.
    - Easy to filter / sort / pipe to JSON.
    - No notebook required.

  displacy
    - Demos, presentations, error analysis.
    - The colored highlights make it obvious where the model went
      wrong on a specific sentence.
    - Requires `pip install spacy` and a notebook (or web server).

  Other options (worth knowing about)
    - Pandas DataFrame  : sort and filter in tabular form.
    - HuggingFace Inference UI : built into model cards on the hub.
    - Streamlit / Gradio : quick interactive web app for entering
      sentences and seeing predictions.

Plugging YOUR fine-tuned model in

  After running 61.py, save with model.save_pretrained('my-ner') and
  tokenizer.save_pretrained('my-ner'). Then:
        nlp = pipeline('ner', model='my-ner', tokenizer='my-ner',
                       aggregation_strategy='simple')
  Same pipeline interface, your weights.

Common analysis workflows

  1. ERROR ANALYSIS — pick failure cases, displacy them side-by-side
     with ground truth, look for systematic mistakes (e.g., misses
     of MISC entities, confusions between ORG and PER).

  2. CONFIDENCE THRESHOLDING — drop predictions with score < 0.7,
     measure precision/recall trade-off.

  3. CONFUSION MATRIX — for each entity type, count true vs predicted.
     Use sklearn.metrics.confusion_matrix on the per-token labels.

  4. ENTITY DENSITY — average number of entities per sentence, or
     per token. Useful for downstream pipelines that consume NER
     output.

=== Code notes ===

nlp = pipeline('ner', model='dslim/bert-base-NER', aggregation_strategy='simple')
  - First call downloads the model (~440MB), cached after.
  - Returns a callable. Call it on a string to get predictions.
  - For batch inference: nlp([sent1, sent2, ...]) → list of lists.

text = "Apple is looking at buying U.K. startup ..."
ents = nlp(text)
  - Returns a list of dicts. One per detected entity span.

for e in ents:
    print(f"[{e['entity_group']:5s}] {e['word']:25s} ({e['score']:.2f}) ...")
  - The print loop is the structured-output view.
  - {e['entity_group']:5s} pads to 5 chars (PER, LOC, ORG, MISC).

displacy.render({...}, style='ent', manual=True, jupyter=True)
  - manual=True tells displacy that we're passing pre-formatted entity
    dicts (not a real spaCy Doc object). Required when using non-spaCy
    models like ours.
  - style='ent' renders entities as colored spans. Other style: 'dep'
    for dependency parses.
  - jupyter=True renders inline; jupyter=False returns an HTML string.

How to extend
  - USE YOUR OWN FINE-TUNED MODEL (after 61.py):
        from transformers import AutoModelForTokenClassification, AutoTokenizer
        model = AutoModelForTokenClassification.from_pretrained('out')  # checkpoint dir
        tok   = AutoTokenizer.from_pretrained('distilbert-base-cased')
        nlp = pipeline('ner', model=model, tokenizer=tok,
                       aggregation_strategy='simple')

  - BATCH OF SENTENCES:
        texts = ["Sentence 1 with Alice.", "Sentence 2 with Google."]
        all_ents = nlp(texts)
        for t, ents in zip(texts, all_ents):
            displacy.render({'text': t, 'ents': [...] }, ...)

  - CONFIDENCE FILTERING:
        ents = [e for e in nlp(text) if e['score'] > 0.9]

  - CUSTOM COLORS in displacy:
        colors = {'PER': '#aa9cfc', 'LOC': '#feca74', 'ORG': '#ff9561'}
        options = {'ents': list(colors), 'colors': colors}
        displacy.render({...}, style='ent', manual=True, options=options)

  - SAVE TO HTML FILE (no jupyter):
        html = displacy.render({...}, style='ent', manual=True, jupyter=False, page=True)
        open('ner.html', 'w').write(html)

  - TEXT-ONLY ANSI VERSION (no jupyter, no spacy):
        for e in ents:
            print(text[:e['start']] + f"\033[44m{text[e['start']:e['end']]}\033[0m" +
                  text[e['end']:e['start']+1] + ...)
        # or use the `colorama` package for cross-platform colors.
"""

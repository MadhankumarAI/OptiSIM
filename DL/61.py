import numpy as np
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForTokenClassification, TrainingArguments, Trainer
from seqeval.metrics import precision_score, recall_score, f1_score

ds = load_dataset('conll2003')
labels = ds['train'].features['ner_tags'].feature.names
tok = AutoTokenizer.from_pretrained('distilbert-base-cased')

def tokenize(b):
    enc = tok(b['tokens'], is_split_into_words=True, truncation=True, padding=64)
    enc['labels'] = [[-100 if w is None else tags[w] for w in enc.word_ids(i)] for i, tags in enumerate(b['ner_tags'])]
    return enc

ds = ds.map(tokenize, batched=True, remove_columns=ds['train'].column_names)

model = AutoModelForTokenClassification.from_pretrained('distilbert-base-cased', num_labels=len(labels))
args = TrainingArguments('out', num_train_epochs=1, per_device_train_batch_size=16, report_to='none')
trainer = Trainer(model=model, args=args, train_dataset=ds['train'].select(range(500)), eval_dataset=ds['validation'].select(range(100)))
trainer.train()

p = trainer.predict(ds['validation'].select(range(100)))
pid = np.argmax(p.predictions, axis=-1)
tid = p.label_ids
true = [[labels[t] for t in s if t != -100] for s in tid]
pred = [[labels[pp] for pp, tt in zip(ps, ts) if tt != -100] for ps, ts in zip(pid, tid)]

print(f'precision = {precision_score(true, pred):.4f}')
print(f'recall    = {recall_score(true, pred):.4f}')
print(f'f1        = {f1_score(true, pred):.4f}')


"""
=== Concept: Fine-tuning BERT for Named Entity Recognition ===      learning_rate=2e-5,  

NER (Named Entity Recognition) in one sentence
  Given a sentence, label EACH TOKEN with an entity type (PERSON,
  LOCATION, ORGANIZATION, etc.) or "O" (outside any entity).

  Example:
        John     lives  in  New     York   .
        B-PER    O      O   B-LOC   I-LOC  O
  - "John" is the BEGINNING of a PERSON entity.
  - "New" begins a LOCATION; "York" is INSIDE the same location.
  - "lives", "in", "." are OUTSIDE any entity.

  This is called BIO (or IOB) tagging — every token is one of:
    B-X : Beginning of an entity of type X
    I-X : Inside an entity of type X (continuation)
    O   : Outside any entity

CoNLL-2003 (the standard NER benchmark)
  - 14K labeled English sentences from Reuters news.
  - 4 entity types: PER, LOC, ORG, MISC. Combined with B/I prefixes
    plus O = 9 labels total.
  - The dataset HuggingFace ships gives integer label IDs already.

What "fine-tuning BERT" means

  Pre-training (already done by Google, billions of words)
    - Train BERT to PREDICT MASKED WORDS in raw text.
    - Result: a model that has learned rich representations of
      English at the token level. No supervised labels needed.

  Fine-tuning (what this script does)
    - Take the pre-trained BERT.
    - Stack a small task-specific head on top — for NER, a
      Dense(num_labels) over each token's contextual embedding.
    - Train on labeled NER data for 1-3 epochs at a small learning
      rate (5e-5 typical).
    - The pre-trained weights provide a STRONG starting point;
      fine-tuning just teaches the model "use these embeddings to
      predict NER tags".

  Why this beats training from scratch
    - BERT learned language structure from billions of unlabeled
      tokens. NER datasets are tiny (10-100K labeled examples) —
      not enough to learn language AND the task at the same time.
    - Fine-tuning lets you transfer the language knowledge for free.
    - This is the same recipe behind every modern NLP system.

The architecture diagram
        Input tokens   →   BERT encoder   →   per-token embeddings
                                              shape (seq, hidden)
                                                    ↓
                                              Dense(num_labels)
                                                    ↓
                                              softmax over 9 NER tags
        For each input token: probability over (B-PER, I-PER, B-LOC,
        I-LOC, B-ORG, I-ORG, B-MISC, I-MISC, O).

The subword token alignment problem (the trickiest part)

  - BERT uses SUBWORD tokenization. "Washington" might be split into
    ["Wash", "##ington"] — two tokens, one word.
  - But your NER labels are per-WORD, not per-subword.
  - Solution: tokenize with is_split_into_words=True so the tokenizer
    knows your input is already word-tokenized, then use word_ids()
    to map subwords back to original word positions.
  - Convention: label the FIRST subword of each word with the word's
    real label, label all OTHER subwords (and special tokens like
    [CLS], [SEP], [PAD]) with -100, which PyTorch's loss function
    ignores.

  This is what these lines do:
        enc.word_ids(i)
        # Returns [None, 0, 0, 1, 2, 2, None, ...]
        # None = special token, integers = original word index

        [-100 if w is None else tags[w] for w in enc.word_ids(i)]
        # Maps each subword position to either the word's NER label
        # (for the first subword) or -100 (for special tokens).
        # NOTE: this LABELS EVERY SUBWORD, not just the first. For
        # cleaner training many tutorials only label the first subword
        # and set later ones to -100. This script's simpler version
        # labels every subword with the word's tag — usually fine in
        # practice, slightly less precise than first-subword-only.

Why distilbert-base-cased?
  - Smaller (66M params vs BERT's 110M) → 2x faster to fine-tune.
  - Cased (preserves capitalization) — NER cares about capitals
    (proper nouns).
  - Drop-in replacement: same tokenizer interface, same Trainer,
    same checkpoints.
  - For better quality, swap to 'bert-base-cased' or
    'roberta-base' — same code, just slower.

Why only 500 train + 100 val samples?
  - For demonstration speed. Real NER fine-tuning uses all 14K
    CoNLL training sentences and 3 epochs. Expect 60-80% F1 with
    this tiny subset; 90%+ F1 with the full dataset.

The Trainer abstraction
  - HuggingFace's Trainer wraps the entire training loop:
    optimizer, learning rate schedule, gradient accumulation,
    mixed precision, evaluation, checkpointing.
  - You just hand it a model + datasets + TrainingArguments.
  - Equivalent in spirit to Keras's m.compile + m.fit, but tailored
    to transformer fine-tuning.

Things you can change easily
  - Different model: AutoModelForTokenClassification.from_pretrained(
        'bert-base-cased' / 'roberta-base' / 'xlm-roberta-base' /
        'microsoft/deberta-v3-base')
  - Different task — same pattern, different head class:
        AutoModelForSequenceClassification : sentence classification
        AutoModelForQuestionAnswering      : SQuAD-style QA
        AutoModelForCausalLM               : text generation
        AutoModelForSeq2SeqLM              : translation/summarization
  - Different dataset:
        load_dataset('wnut_17')   # Twitter NER
        load_dataset('ontonotes') # Bigger NER benchmark
        load_dataset('imdb')      # sentiment (different head class)

Modern fine-tuning workflow (what this is a slim version of)

  1. Pick a pre-trained model (HF hub)
  2. Pick a dataset
  3. Tokenize + align labels for your task
  4. Wrap model with the right Auto*ForX head
  5. Hand off to Trainer
  6. Train 1-3 epochs with lr ≈ 5e-5
  7. Evaluate (F1, accuracy, etc.)
  8. Push to HF hub or save with model.save_pretrained()

This script is the smallest end-to-end NER recipe — every modern
NLP fine-tuning task follows the same shape.

=== Code notes ===

ds = load_dataset('conll2003')
  - Loads CoNLL-2003 from the HuggingFace hub. Cached on first run.
  - Returns a DatasetDict with train/validation/test splits.

labels = ds['train'].features['ner_tags'].feature.names
  - Read the label names from the dataset's feature spec.
  - For CoNLL-2003: ['O', 'B-PER', 'I-PER', 'B-ORG', 'I-ORG',
                     'B-LOC', 'I-LOC', 'B-MISC', 'I-MISC'] — 9 labels.

tok = AutoTokenizer.from_pretrained('distilbert-base-cased')
  - The tokenizer that matches the model. Always pair them.

enc = tok(b['tokens'], is_split_into_words=True, ...)
  - is_split_into_words=True tells the tokenizer the input is already
    a list of words. It applies subword splitting WITHIN each word
    and tracks which subword belongs to which original word.

enc['labels'] = [...]
  - Build the per-subword label tensor with -100 padding/masking.

AutoModelForTokenClassification.from_pretrained('distilbert-base-cased',
                                                num_labels=len(labels))
  - Loads pretrained DistilBERT, adds a fresh Dense(9) head on top
    for the 9 NER tags. The head's weights are randomly initialized;
    BERT's body weights start from the checkpoint.

TrainingArguments('out', num_train_epochs=1, per_device_train_batch_size=16,
                  report_to='none')
  - 'out' = output directory for checkpoints.
  - report_to='none' silences W&B / tensorboard logging.
  - Real fine-tuning: 3 epochs, batch_size 16-32, lr 5e-5 (default).

trainer.train()
  - Runs the training loop. Prints loss per epoch.

print(trainer.evaluate())
  - Runs validation. Returns {'eval_loss': ..., 'eval_runtime': ...}.
  - For a real F1 number, plug in seqeval:
        from datasets import load_metric
        metric = load_metric('seqeval')
        # then convert label IDs back to strings and call metric.compute()

How to extend
  - FULL DATASET, MORE EPOCHS:
        train_dataset=ds['train']     # all 14K samples
        eval_dataset=ds['validation']
        num_train_epochs=3
        learning_rate=5e-5
    Expect ~90% F1 on CoNLL-2003 in 5-10 minutes on a GPU.

  - PRECISE METRICS (entity-level F1, not token-level accuracy):
        pip install seqeval
        from seqeval.metrics import classification_report
        # Convert label IDs to strings, drop -100 positions, then call.

  - DIFFERENT MODEL:
        AutoModelForTokenClassification.from_pretrained('bert-base-cased', ...)
        AutoModelForTokenClassification.from_pretrained('roberta-base', ...)
        AutoModelForTokenClassification.from_pretrained(
            'microsoft/deberta-v3-base', ...)

  - DIFFERENT NER DATASET:
        load_dataset('wnut_17')      # Twitter NER, harder
        load_dataset('ontonotes_v5') # 18 entity types, larger
        load_dataset('few_nel')      # entity linking
"""

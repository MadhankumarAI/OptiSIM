import numpy as np
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, RepeatVector, TimeDistributed, Embedding
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction

np.random.seed(0)
N, T, V = 1000, 5, 10
X = np.random.randint(1, V, size=(N, T))
Y = X[:, ::-1]

inp = Input(shape=(T,))
e = Embedding(V, 16)(inp)
ctx = LSTM(32)(e)
dec = LSTM(32, return_sequences=True)(RepeatVector(T)(ctx))
out = TimeDistributed(Dense(V, activation='softmax'))(dec)

m = Model(inp, out)
m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(X[:800], Y[:800], epochs=20, verbose=0)

pred = m.predict(X[800:], verbose=0).argmax(-1)
sm = SmoothingFunction().method1
scores = [sentence_bleu([list(map(str, r))], list(map(str, p)), smoothing_function=sm)
          for r, p in zip(Y[800:], pred)]
print(f'avg BLEU = {np.mean(scores):.4f}')


"""
=== Concept: BLEU Score for Seq2Seq Evaluation ===

Why a different metric for seq2seq?
  - For classification, accuracy works. For regression, MSE works.
  - For TEXT generation (translation, summarization, dialogue) you need
    something that handles:
        * variable-length outputs
        * multiple valid answers (paraphrases)
        * partial credit (a near-correct sentence is better than a totally
          wrong one)
  - BLEU (BiLingual Evaluation Understudy, Papineni 2002) is the
    classic answer.

What BLEU measures
  - The n-gram overlap between the PREDICTED sequence and one or more
    REFERENCE sequences.
  - Default: combines 1-grams, 2-grams, 3-grams, 4-grams. The geometric
    mean of their precisions, multiplied by a "brevity penalty".
  - Range: 0 (no overlap) to 1 (perfect match). Often reported as 0-100.

The math (BLEU-4, the standard)

    precision_n = (#matched n-grams in prediction) / (#total n-grams in prediction)

    BP = brevity_penalty
       = 1                       if pred_len > ref_len
       = exp(1 - ref_len/pred_len)  otherwise   ← punishes too-short predictions

    BLEU = BP * exp( (1/4) * sum_{n=1..4} log(precision_n) )

  - The brevity penalty stops the model from gaming BLEU by emitting
    very short outputs (which would have artificially high precision).
  - The geometric mean of precisions punishes any zero (if you miss any
    n-gram order entirely, BLEU drops sharply).

Sentence BLEU vs Corpus BLEU
  - sentence_bleu : compute per-sample, then average. Easy but slightly
                    biased upward.
  - corpus_bleu   : sum n-gram counts ACROSS all samples, then compute
                    once. The official metric reported in MT papers.
                    Lower than sentence_bleu on the same outputs.

Smoothing (the SmoothingFunction part)
  - When a prediction has zero matches for some n-gram order, log(0) = -inf
    → BLEU collapses to 0.
  - SmoothingFunction adds tiny constants to avoid this. method1 is the
    simplest and most common.
  - Always use smoothing for short sequences; never trust raw 0 BLEU
    without checking whether smoothing was applied.

What you'll see in this script
  - The toy task: predict reverse(input). 5-token sequences of integers
    1-9.
  - After 20 epochs the model usually nearly memorizes the reversal
    pattern → BLEU close to 1.0 on the test split.
  - If the model fails to learn (e.g. too few epochs), BLEU drops
    proportionally — partial credit for getting some tokens right.

Real-world BLEU values (rough)
  - 0.0 - 0.1   : random / broken
  - 0.1 - 0.2   : structure but mostly wrong
  - 0.2 - 0.3   : decent for low-resource translation
  - 0.3 - 0.5   : strong system, e.g. WMT-quality translation
  - 0.5 - 0.7   : excellent (often near-human)
  - 0.7+        : trained on data very similar to test (memorized)

When BLEU is appropriate
  - Tasks with deterministic-ish ground truth: machine translation,
    code generation, paraphrasing, captioning.
  - Tasks where word-level overlap is the right signal.

When BLEU is INAPPROPRIATE
  - Open-ended generation (chatbots, story writing) — many valid answers,
    BLEU penalizes anything different from the reference.
  - Tasks where MEANING matters more than surface form. BLEU can't
    handle synonyms or paraphrases — "I'm happy" vs "I am glad" gets a
    low BLEU even though they mean the same.
  - For these, consider:
        * METEOR     : handles synonyms, stemming.
        * ROUGE-L    : longest common subsequence — common for
                       summarization.
        * BERTScore  : embedding-based, semantic similarity.
        * GPT-judge  : ask a stronger LLM to score outputs.

Why this script uses a synthetic copy-reversal task
  - BLEU evaluates parallel TEXT data — predicted vs reference token
    sequences. Real translation corpora (WMT, Multi30k) require multi-MB
    downloads and tokenization machinery.
  - Integer reversal is the SIMPLEST possible parallel sequence task —
    same shape (sequence in, sequence out), same training pattern, same
    BLEU computation. Once this works on toy data, the ONLY change for
    real translation is swapping the dataset.

=== Code notes ===

X = np.random.randint(1, V, size=(N, T))
Y = X[:, ::-1]
  - 1000 sequences of 5 random integers in [1, 9]. Y is the same with
    indices reversed.
  - Token 0 is reserved for padding (not used here, but conventional).

inp = Input(shape=(T,))
e = Embedding(V, 16)(inp)
ctx = LSTM(32)(e)
dec = LSTM(32, return_sequences=True)(RepeatVector(T)(ctx))
out = TimeDistributed(Dense(V, activation='softmax'))(dec)
  - Standard text seq2seq: Embedding → encoder LSTM → context →
    repeat → decoder LSTM → softmax over vocabulary.
  - Loss = sparse_categorical_crossentropy because targets are integer
    token IDs, not one-hot.

pred = m.predict(X[800:], verbose=0).argmax(-1)
  - Output is shape (test_size, T, V). argmax over the vocab axis gives
    the predicted token at each position.

scores = [sentence_bleu([list(map(str, r))], list(map(str, p)),
                         smoothing_function=sm)
          for r, p in zip(Y[800:], pred)]
  - sentence_bleu([reference], candidate). The double list around
    reference is because BLEU supports MULTIPLE valid references —
    [[ref1, ref2, ...]]. We have one.
  - list(map(str, r)) — BLEU compares string tokens. Convert ints to
    strings so n-gram comparison works.
  - sm = SmoothingFunction().method1 — prevents BLEU = 0 on tiny
    sequences.

How to extend
  - CORPUS BLEU instead of averaged sentence BLEU:
        from nltk.translate.bleu_score import corpus_bleu
        refs = [[list(map(str, r))] for r in Y[800:]]
        cands = [list(map(str, p)) for p in pred]
        print(corpus_bleu(refs, cands, smoothing_function=sm))

  - WEIGHTS for BLEU-1 / BLEU-2 / BLEU-3:
        sentence_bleu([ref], cand, weights=(1, 0, 0, 0))      # BLEU-1
        sentence_bleu([ref], cand, weights=(0.5, 0.5, 0, 0))  # BLEU-2

  - REAL TRANSLATION DATASET — replace X, Y with a parallel corpus:
        from datasets import load_dataset
        ds = load_dataset('opus_books', 'en-fr')
        # Tokenize, build vocab, then plug in the same model.
    Or use TensorFlow's tfds 'wmt14_translate'.

  - METEOR / ROUGE / BERTScore for comparison:
        from nltk.translate.meteor_score import meteor_score
        from rouge_score import rouge_scorer
        from bert_score import score as bert_score
"""

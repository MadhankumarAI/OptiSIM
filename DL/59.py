import os
import glob
import tensorflow as tf
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, Embedding, RepeatVector, TimeDistributed
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences

path = tf.keras.utils.get_file('spa-eng', 'http://storage.googleapis.com/download.tensorflow.org/data/spa-eng.zip', extract=True)
fpath = glob.glob(os.path.dirname(path) + '/**/spa.txt', recursive=True)[0]
pairs = [ln.split('\t')[:2] for ln in open(fpath, encoding='utf-8').read().strip().split('\n')[:3000] if '\t' in ln]
en = [p[0].lower() for p in pairs]
fr = ['<s> ' + p[1].lower() + ' </s>' for p in pairs]

en_t, fr_t = Tokenizer(), Tokenizer(filters='')
en_t.fit_on_texts(en)
fr_t.fit_on_texts(fr)
X = pad_sequences(en_t.texts_to_sequences(en), padding='post')
Y = pad_sequences(fr_t.texts_to_sequences(fr), padding='post')
V_in, V_out = len(en_t.word_index) + 1, len(fr_t.word_index) + 1

inp = Input(shape=(X.shape[1],))
e = Embedding(V_in, 64)(inp)
c = LSTM(128)(e)
d = LSTM(128, return_sequences=True)(RepeatVector(Y.shape[1])(c))
out = TimeDistributed(Dense(V_out, activation='softmax'))(d)

m = Model(inp, out)
m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(X, Y[..., None], epochs=10, verbose=0)
print(m.evaluate(X, Y[..., None], verbose=0))


"""
=== Concept: Seq2Seq for Machine Translation ===

This is the canonical seq2seq use case — translate one natural language
to another. Same encoder-decoder skeleton as the toy reversal task in
Q56, but with real parallel text and a vocabulary that's typed words
instead of digits.

The full pipeline (5 stages)

  1. Get parallel data
     - Need pairs of (source sentence, target sentence) in two languages.
     - Anki's Tatoeba sentence pairs are the standard tiny benchmark
       (~ 200K pairs across many language pairs).
     - We grab the English-French file (fra-eng.zip) and use first 3000
       short pairs.

  2. Tokenize each side
     - Build a SEPARATE vocabulary for each language. Each unique word
       gets an integer ID.
     - Add <s> (start) and </s> (end) tokens to the target side. They
       mark sequence boundaries during decoding (especially important
       for autoregressive inference).
     - filters='' on the French tokenizer prevents stripping the angle
       brackets from <s> and </s>.

  3. Pad to fixed length
     - Different sentences have different word counts. The model needs
       fixed-shape tensors, so pad short sentences with zeros up to the
       max length in the batch (or in the whole dataset).
     - padding='post' adds zeros at the END of each sequence (more
       natural for LSTMs than padding the front).

  4. Train an encoder-decoder
     - Encoder: Embedding → LSTM. Output: a single context vector
       (the encoder's final hidden state).
     - Decoder: RepeatVector → LSTM → Dense(V_out, softmax). Outputs
       a probability distribution over the target vocab at each
       position.
     - Loss: sparse_categorical_crossentropy. Targets are integer
       token IDs at every output position.

  5. Inference (not in this script)
     - For real use, you decode autoregressively: start with <s>,
       generate one token at a time, feed each prediction back as the
       next input, stop at </s>.
     - The teacher-forcing setup used here at training time is faster
       than autoregressive generation but has a "mismatch" problem
       at inference (covered in Q60+).

Key vocabulary

  Tokenization
    - Splitting raw text into discrete tokens (here, words).
    - Modern systems use SUBWORD tokenizers (BPE, SentencePiece,
      WordPiece) instead of whole words — handles unknown words better
      and keeps vocab small.

  Vocabulary size
    - Number of unique tokens. Determines Embedding input dim and
      output Dense dim. For 3000 short Tatoeba pairs:
        V_in  ≈ 1500-2000 English words
        V_out ≈ 2500-3500 French words (more morphology)
    - Real translation systems use 32K-64K subword tokens.

  Padding token
    - Special token (ID = 0) added to short sequences to bring them
      up to fixed length.
    - Important to MASK the loss on padding positions in real systems
      (use a custom loss or sample_weight). Skipped here for
      simplicity — the model just learns to output 0 for padding.

  Start/end tokens
    - <s> tells the decoder "begin generating".
    - </s> tells the decoder "stop". At inference, you stop generating
      when </s> is predicted (or after a max length).

  Teacher forcing (the implicit training pattern here)
    - During training, the decoder sees the GROUND TRUTH at each step,
      not its own previous prediction.
    - Faster training, but creates a train-test gap (the model never
      sees its own mistakes during training). Solutions: scheduled
      sampling, sequence-level training, or just modern Transformers
      where this matters less.

What makes machine translation hard

  Word reordering
    - English: "I went home" — Subject Verb Object
    - German : "Ich ging nach Hause" — same order
    - But: "I am going home" → "Ich gehe nach Hause" — different
      structure. Many language pairs have wildly different word
      orders → attention helps a lot.

  Morphology
    - English has few inflected forms; French/Spanish/Russian have
      many. The target vocab grows fast.
    - Subword tokenization (BPE) helps — split "running" → "run" +
      "##ing" so morphological structure is shared.

  Long-range dependencies
    - "The cat that the dog chased ran away." — translating this
      requires understanding nested clauses across many words.
    - Vanilla seq2seq with no attention struggles past 20-30 words.
    - Attention + Transformers handle this much better.

  Multiple correct translations
    - "Hello" can be "Bonjour", "Salut", "Allô"... evaluation must
      handle this. BLEU partially does (multiple references).

Modern reality (post-2017)

  - Vanilla seq2seq with LSTM is OBSOLETE for translation. Production
    systems (Google Translate, DeepL, Marian) use Transformers
    exclusively.
  - But the encoder-decoder PATTERN remains. Transformers ARE
    encoder-decoder seq2seq, just without recurrence.
  - This script teaches the SKELETON. Once you understand it, the
    Transformer version is just "swap LSTMs for self-attention".

=== Code notes ===

path = tf.keras.utils.get_file('fra-eng', 'http://www.manythings.org/anki/fra-eng.zip', extract=True)
fpath = glob.glob(os.path.dirname(path) + '/**/fra.txt', recursive=True)[0]
  - keras.utils.get_file downloads + caches in ~/.keras/datasets.
  - Extracted file location varies between Keras versions, so we glob
    for fra.txt under the parent directory.

lines = open(fpath, encoding='utf-8').read().strip().split('\n')[:3000]
pairs = [l.split('\t')[:2] for l in lines if len(l.split('\t')) >= 2]
  - File format: english\tfrench\tlicense_info per line.
  - Take first 3000 short pairs to keep training fast.
  - Real systems use 200K+ pairs and train for hours/days.

fr = ['<s> ' + p[1].lower() + ' </s>' for p in pairs]
  - Wrap each French sentence in start/end tokens.
  - .lower() because Tokenizer doesn't lowercase by default.

en_t = Tokenizer()
fr_t = Tokenizer(filters='')
  - Two SEPARATE tokenizers — different vocabularies for source and
    target.
  - filters='' on French preserves the < > characters in <s> and </s>.

X = pad_sequences(en_t.texts_to_sequences(en), padding='post')
  - Convert text to integer sequences, then pad to max length with 0s
    at the end.

inp = Input(shape=(T_in,))
e = Embedding(V_in, 64)(inp)
ctx = LSTM(128)(e)
dec = LSTM(128, return_sequences=True)(RepeatVector(T_out)(ctx))
out = TimeDistributed(Dense(V_out, activation='softmax'))(dec)
  - Same architecture as Q51's seq2seq, just with Embedding +
    softmax-over-vocab head for text.
  - 64-dim word embeddings, 128-dim LSTM hidden state.
  - For real translation, use 256-512 dim everywhere and 6+ layers.

m.fit(X, Y[..., None], epochs=10, verbose=0)
  - Y[..., None] adds a trailing dim because sparse_categorical_cross
    entropy expects targets of shape (batch, T_out, 1).
  - 10 epochs is too few for real translation; this just demonstrates
    the pipeline runs end-to-end.

How to extend
  - ADD ATTENTION (huge accuracy boost on translation):
        enc_seq = LSTM(128, return_sequences=True)(e)
        ctx     = LSTM(128)(enc_seq)
        dec_seq = LSTM(128, return_sequences=True)(
                      RepeatVector(T_out)(ctx))
        attn    = Attention()([dec_seq, enc_seq])
        out     = TimeDistributed(Dense(V_out, activation='softmax'))(attn)

  - INFERENCE LOOP (autoregressive generation):
        # Build a separate inference model that takes (encoder_states,
        # previous_token) and emits next_token. Loop until </s> or
        # max length. Reverse-lookup IDs through fr_t.index_word to
        # get text.

  - EVALUATE WITH BLEU (Q56's metric):
        from nltk.translate.bleu_score import corpus_bleu
        # Predict a batch, decode to words, compare to references.

  - TRANSFORMER REPLACEMENT:
        from tensorflow.keras.layers import MultiHeadAttention
        # Replace LSTMs with self-attention layers. Modern, faster
        # on GPU, generally higher accuracy.

  - LARGER DATASET / MORE EPOCHS:
        lines = open(fpath, encoding='utf-8').read().split('\n')[:50000]
        m.fit(X, Y[..., None], epochs=50, batch_size=128, verbose=1)
        # Expect markedly better translations after this scale of training.
"""

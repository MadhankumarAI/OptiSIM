import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, RepeatVector, TimeDistributed, Attention

y = np.sin(np.linspace(0, 100, 1000))
T_in, T_out = 20, 5
X = np.array([y[i:i+T_in] for i in range(len(y) - T_in - T_out)])[..., None]
Y = np.array([y[i+T_in:i+T_in+T_out] for i in range(len(y) - T_in - T_out)])[..., None]

inp = Input(shape=(T_in, 1))
enc = LSTM(32, return_sequences=True)(inp)
ctx = LSTM(32)(enc)
dec = LSTM(32, return_sequences=True)(RepeatVector(T_out)(ctx))
attn_out, w = Attention()([dec, enc], return_attention_scores=True)
out = TimeDistributed(Dense(1))(attn_out)

m = Model(inp, out)
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], epochs=10, verbose=0)

attn_model = Model(inp, w)
W = attn_model.predict(X[800:], verbose=0).mean(0)
align = W.argmax(-1)
entropy = -(W * np.log(W + 1e-9)).sum(-1)

print('argmax alignment :', align)
print('entropy per row  :', entropy.round(3))

fig, axes = plt.subplots(1, 3, figsize=(14, 4))
axes[0].imshow(W, aspect='auto', cmap='viridis')
axes[0].set_title('avg attention')
axes[0].set_xlabel('encoder step')
axes[0].set_ylabel('decoder step')
axes[1].plot(W.sum(0), marker='o')
axes[1].set_title('total attention per encoder step')
axes[2].plot(entropy, marker='o')
axes[2].set_title('attention entropy per decoder step')
plt.tight_layout()
plt.show()


"""
=== Concept: Alignment Analysis in Attention Models ===

What "alignment" means
  - The attention weight matrix W of shape (T_out, T_in) encodes a
    soft alignment: row i tells you which input positions contribute
    to output position i.
  - In machine translation this corresponds to which source words
    each target word "translates from". For forecasting it's "which
    past timesteps each future prediction relies on".
  - VISUALIZING the matrix (Q53) shows the alignment qualitatively.
  - ANALYZING the matrix (this script) quantifies it: where does
    attention go on average, how peaked is it, is it diagonal?

Three core analyses

  1. ARGMAX alignment per decoder step
        align[i] = argmax over j of W[i, j]
     - Tells you the SINGLE most-attended input position for each
       output. Like a hard alignment derived from soft attention.
     - For a clean diagonal attention, align[i] grows linearly with i.
     - For right-bias attention, align[i] is always near T_in - 1.
     - For uniform attention, align[i] is essentially noise.

  2. PER-ENCODER-STEP USAGE  (column sum)
        usage[j] = sum over i of W[i, j]
     - How much TOTAL attention each input position receives across
     all output steps.
     - High peaks → those input positions are heavily used.
     - Low values → those positions are essentially ignored.
     - Helps decide whether to TRIM the encoder window.

  3. ATTENTION ENTROPY per decoder step
        H[i] = -sum_j W[i, j] log(W[i, j])
     - Information-theoretic measure of attention sharpness.
     - LOW entropy (close to 0)  → attention is concentrated on one
                                    or few positions (confident).
     - HIGH entropy (log T_in)  → attention is uniform across all
                                    inputs (uncertain or noisy).
     - For T_in=20, max entropy = log(20) ≈ 3.0.

Why this is useful
  - Diagnostic: a peaked low-entropy attention with a sensible argmax
    alignment is a sign the model has learned a structured input →
    output mapping.
  - Pruning: if the column sum is near zero for many encoder positions,
    you can shorten the encoder window or use sparse attention.
  - Comparing models: train two models, plot both alignments — the
    one with sharper, more interpretable attention often generalizes
    better.
  - Debugging: if all rows have max entropy (uniform), the model
    isn't using attention at all.

Common patterns and what they mean

  Diagonal alignment (i ↔ i)
    - argmax forms a straight line from (0,0) to (T_out-1, T_in-1).
    - Common in monotonic tasks (transliteration, copy with offset).
    - Low entropy along the diagonal.

  Right-edge bias
    - argmax always near T_in - 1.
    - Common in forecasting — the most recent inputs matter most.
    - This script's sine-wave model usually shows this.

  Inverted alignment (i ↔ T_in - 1 - i)
    - argmax decreases with i.
    - Indicates the model learned to reverse the input.

  Block / clustered alignment
    - argmax stays at one input position for several decoder steps.
    - Indicates aggregation: the model summarizes a region of input
      into multiple outputs.

  Diffuse / uniform attention
    - High entropy, no clear argmax pattern.
    - Bad sign — model isn't using attention productively.
    - Try more training, smaller LR, or remove the attention layer
      entirely.

Average over many samples (what this script does)
  - A single-sample heatmap (Q53) can be misleading — the model may
    behave differently for different inputs.
  - Averaging over the test set gives the TYPICAL attention pattern,
    which reveals the LEARNED behavior more reliably.
  - Single samples answer "what did the model do here?"; averaged
    samples answer "what did the model learn?".

Quantitative comparison metrics

  - Average max weight: mean(max(W[i, :])) — how peaked is attention
    on average?
  - Coverage: fraction of encoder positions that receive at least
    epsilon attention from some decoder step. Low coverage = pruning
    opportunity.
  - Diagonal score: how close argmax(W[i, :]) is to the expected
    diagonal i*T_in/T_out. Closer to 0 = more diagonal.

=== Code notes ===

attn_model = Model(inp, w)
W = attn_model.predict(X[800:], verbose=0).mean(0)
  - Reuse the trained model's attention output. Predict on the held-out
    set, then AVERAGE the (test_size, T_out, T_in) tensor across the
    batch axis to get a single (T_out, T_in) "typical" alignment matrix.

align = W.argmax(-1)
  - Hard alignment per decoder step. Shape: (T_out,).
  - argmax along the last axis (encoder positions).

entropy = -(W * np.log(W + 1e-9)).sum(-1)
  - Standard Shannon entropy. The +1e-9 prevents log(0) blowup if some
    weight is exactly zero.
  - Shape: (T_out,) — one entropy value per decoder step.

Three subplots
  - axes[0] : the alignment heatmap.
  - axes[1] : column sum — encoder-position importance.
  - axes[2] : row entropy — attention sharpness per output step.

How to extend
  - PER-SAMPLE alignment instead of averaged:
        for i in range(5):
            W_i = attn_model.predict(X[800+i:801+i], verbose=0)[0]
            print(W_i.argmax(-1))
    Compare to see if alignment is stable across inputs.

  - COMPARE attention types (after Q55):
        for AttnType in [Attention, AdditiveAttention]:
            ... rebuild + train ...
            print(AttnType.__name__, 'entropy=', entropy.mean())
    Lower mean entropy usually = more confident / decisive attention.

  - DIAGONAL SCORE:
        expected = np.linspace(0, T_in - 1, T_out).round().astype(int)
        diag_err = np.abs(align - expected).mean()
        print('mean off-diagonal :', diag_err)
    0 = perfectly diagonal; large = far from diagonal alignment.

  - COVERAGE:
        cov = (W.sum(0) > 0.01).sum()
        print(f'{cov}/{T_in} encoder positions actively used')
"""

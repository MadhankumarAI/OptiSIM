import numpy as np
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, RepeatVector, TimeDistributed, Attention, AdditiveAttention

y = np.sin(np.linspace(0, 100, 1000))
T_in, T_out = 20, 5
X = np.array([y[i:i+T_in] for i in range(len(y) - T_in - T_out)])[..., None]
Y = np.array([y[i+T_in:i+T_in+T_out] for i in range(len(y) - T_in - T_out)])[..., None]

for AttnType in [Attention, AdditiveAttention]:
    inp = Input(shape=(T_in, 1))
    enc = LSTM(32, return_sequences=True)(inp)
    ctx = LSTM(32)(enc)
    dec = LSTM(32, return_sequences=True)(RepeatVector(T_out)(ctx))
    out,attw = TimeDistributed(Dense(1))(AttnType()([dec, enc]))
    m = Model(inp, out)
    m.compile(optimizer='adam', loss='mse')
    h = m.fit(X[:800], Y[:800], validation_data=(X[800:], Y[800:]), epochs=10, verbose=0)
    print(f'{AttnType.__name__:20s} val_loss={h.history["val_loss"][-1]:.6f}')


"""
=== Concept: Two Attention Types — Dot-product vs Additive ===

Both attention types compute the same THREE-step recipe:
    1. score(Q[i], K[j])     for every (i, j) pair
    2. weights = softmax(score, axis=encoder)
    3. attn_out[i] = sum_j weights[i, j] · V[j]

The ONLY thing that changes between attention types is the score
function in step 1. Everything else is identical.

The two main score functions

  Dot-product attention (Luong 2015) ← Keras `Attention`
        score(Q, K) = Q · K^T          (matrix multiply)
    - Pros: cheap (one matmul), no extra trainable params, easy to
            parallelize on GPU.
    - Cons: requires Q and K to have the same dimension.
    - This is what TRANSFORMERS use (with scaling: divide by sqrt(d_k)).

  Additive attention (Bahdanau 2014) ← Keras `AdditiveAttention`
        score(Q, K) = v · tanh(W_q · Q + W_k · K)
    - Pros: more expressive (has learnable W_q, W_k, v); works even
            when Q and K have different dimensions.
    - Cons: more parameters, slower (one tanh + matmul per pair),
            harder to parallelize.
    - This is the ORIGINAL 2014 attention, before dot-product won.

Both produce the same OUTPUT shape — just compute weights differently.

What you'll see in this script
  - Both should achieve very similar val_loss on this simple sine task
    (~0.0001 to 0.001 range).
  - On harder tasks (translation, long sequences), additive sometimes
    edges out dot-product because of its extra expressiveness.
  - On large-scale tasks (Transformers, big LSTMs), scaled dot-product
    wins because it's much faster on GPUs.

When to use which

  Dot-product (Attention)
    - Your default. Used by Transformers, BERT, GPT, ViT — everything
      modern.
    - Pick this when Q and K have the same dimension.
    - Add use_scale=True for the Transformer-style /sqrt(d_k).

  Additive (AdditiveAttention)
    - Use when Q and K have very different dimensions.
    - Use when the dataset is small and a few extra parameters help.
    - Use when reproducing the original Bahdanau 2014 paper.

  Multi-head (MultiHeadAttention)
    - Run dot-product attention h times in parallel with different
      linear projections, concatenate.
    - The Transformer's secret sauce — each head learns a different
      kind of relationship.
    - Always preferred over single-head for serious work.

Other variants you'll encounter
  - Scaled dot-product : dot-product / sqrt(d_k). Standard in
                         Transformers.
  - Multi-head         : h parallel attentions. Keras
                         `MultiHeadAttention`.
  - Local attention    : restrict each query to a window of nearby
                         keys. Used for very long sequences.
  - Sparse attention   : only attend to a small subset of keys (e.g.
                         every 32nd one). Used in Longformer, BigBird.
  - Linear attention   : O(n) instead of O(n²). Performer, Linformer.

=== Code notes ===

for AttnType in [Attention, AdditiveAttention]:
  - Loop over the layer CLASS itself; instantiate inside with
    AttnType(). Same trick as the pool comparison in Q33.
  - Same architecture across runs — only the score function differs.

inp = Input(shape=(T_in, 1))
enc = LSTM(32, return_sequences=True)(inp)        # full encoder sequence
ctx = LSTM(32)(enc)                                # encoder summary
dec = LSTM(32, return_sequences=True)(
            RepeatVector(T_out)(ctx))              # decoder
out = TimeDistributed(Dense(1))(
            AttnType()([dec, enc]))                # attention then projection
  - Identical wiring to Q53. The single line `AttnType()([dec, enc])`
    is the only place attention enters.
  - Inputs to attention: [Q, V]. Q = decoder, V = encoder (also used
    as keys when K isn't given separately).

How to extend
  - ADD MULTI-HEAD ATTENTION as a third comparison:
        from tensorflow.keras.layers import MultiHeadAttention
        # Caveat: MHA's interface differs slightly:
        #   mha = MultiHeadAttention(num_heads=4, key_dim=8)
        #   out = mha(query=dec, value=enc)
        # Wrap or branch the loop to handle both APIs.

  - VISUALIZE WEIGHTS for both (compare attention patterns):
        attn_layer = AttnType()
        out_attn, w = attn_layer([dec, enc], return_attention_scores=True)
        ...
        plt.imshow(w_dot[0])     # dot-product pattern
        plt.imshow(w_add[0])     # additive pattern

  - TIME EACH RUN to see speed difference:
        import time
        for AttnType in [Attention, AdditiveAttention]:
            t = time.time()
            ...
            print(f'{AttnType.__name__} time={time.time()-t:.2f}s')
    Dot-product is usually a bit faster on GPU.
"""

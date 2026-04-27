import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, RepeatVector, TimeDistributed, Attention

y = np.sin(np.linspace(0, 100, 1000))
T_in, T_out = 20, 5
X = np.array([y[i:i+T_in] for i in range(len(y) - T_in - T_out)])[..., None]
Y = np.array([y[i+T_in:i+T_in+T_out] for i in range(len(y) - T_in - T_out)])[..., None]

inp = Input(shape=(T_in, 1))
enc_seq = LSTM(32, return_sequences=True)(inp)
ctx = LSTM(32)(enc_seq)
dec_in = RepeatVector(T_out)(ctx)
dec_seq = LSTM(32, return_sequences=True)(dec_in)
attn_out, attn_w = Attention()([dec_seq, enc_seq], return_attention_scores=True)
out = TimeDistributed(Dense(1))(attn_out)

m = Model(inp, out)
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], epochs=10, verbose=0)

attn_model = Model(inp, attn_w)
w = attn_model.predict(X[800:801], verbose=0)[0]

plt.imshow(w, aspect='auto', cmap='viridis')
plt.xlabel('encoder timestep (input)')
plt.ylabel('decoder timestep (output)')
plt.colorbar()
plt.title('Attention weights')
plt.show()


"""
=== Concept: Attention in Seq2Seq ===

The fix for the seq2seq bottleneck

  Vanilla seq2seq (Q51): the decoder sees ONLY the encoder's final
  hidden state — a single fixed-size context vector. Long inputs lose
  information.

  Attention (Bahdanau 2014, Luong 2015): the decoder gets access to
  ALL encoder hidden states (the full sequence), and at every output
  step it computes a WEIGHTED AVERAGE of those states. The weights
  are learned and depend on what the decoder is currently producing.

  This solves the bottleneck — the decoder can selectively "look at"
  whichever input position is most relevant for each output token.

How attention computes weights (the dot-product version used in this script)

  Inputs:
    Q = decoder hidden states (queries)        shape (T_out, d)
    K = encoder hidden states (keys = values)  shape (T_in,  d)

  Step 1: compatibility score for each (decoder_step, encoder_step) pair:
        scores[i, j] = Q[i] · K[j]              shape (T_out, T_in)

  Step 2: softmax along the encoder axis → attention weights:
        weights[i, :] = softmax(scores[i, :])   shape (T_out, T_in)
        Each row sums to 1. Row i = "where decoder step i is looking".

  Step 3: weighted average of values for each decoder step:
        attn_out[i] = sum_j  weights[i, j] · V[j]    shape (T_out, d)

  In Keras: Attention()([Q, V]) does all three steps.
  Add return_attention_scores=True to also get the weights tensor.

Reading the attention heatmap (the plot this script produces)
  - X axis : encoder timestep (one column per input position)
  - Y axis : decoder timestep (one row per output position)
  - Color  : attention weight at that (output, input) pair
             bright = strong attention, dark = ignored

Common patterns

  Diagonal stripe (most common for time series & translation)
    - Decoder step i pays most attention to encoder step ~ T_in - T_out + i.
    - "Each output looks at the corresponding input" — a sensible
      alignment for monotonic sequences (forecasting, transliteration).

  Right-edge bias
    - Decoder always attends to the last few encoder timesteps.
    - Means the model learned: "to predict the next 5 values, focus on
      the most recent 5 inputs". For sine waves this is often optimal.

  Distributed (uniform-ish row)
    - Decoder spreads attention evenly across all encoder positions.
    - Either the model didn't learn a useful alignment, or the
      task genuinely needs global context.

  Off-diagonal jumps (typical of translation)
    - When source and target words don't appear in the same order
      (e.g. English "I went home" → German "Ich ging nach Hause" has
      different word order), you'll see attention zigzag.

Why visualizing attention is useful
  - Interpretability: see WHICH input positions drive each output.
  - Debugging: if attention is uniform, the model isn't using
    attention productively (might as well drop it).
  - Alignment: in translation, attention often matches the
    word-by-word alignment a human translator would draw.
  - Confidence: peaked attention = model is confident; flat
    attention = uncertain.

Modern attention mechanisms (after this basic dot-product version)

  Bahdanau (additive) attention
    - score = v · tanh(W_q · Q + W_k · K). Learnable mix.
    - The original 2014 attention paper. Slightly more parameters.
    - Use Keras's AdditiveAttention layer.

  Luong (dot / general / concat) attention
    - 2015 simplification. Includes the dot-product variant we used.

  Scaled dot-product attention
    - score = (Q · K^T) / sqrt(d_k), then softmax.
    - The /sqrt(d_k) keeps gradients well-scaled when d is large.
    - This is what Transformers use.

  Multi-head attention
    - Run dot-product attention h times in parallel with different
      linear projections, concatenate.
    - Lets each head focus on a different kind of relationship.
    - tf.keras.layers.MultiHeadAttention in Keras.

  Self-attention
    - Q, K, V all come from the SAME sequence. The sequence attends
      to itself. Foundation of Transformers.

Attention vs RNN — why Transformers replaced LSTMs

  - LSTM: O(T) sequential steps, hard to parallelize, vanishing
    gradients past ~500 steps.
  - Attention: O(T²) but FULLY PARALLEL — every (i, j) score can be
    computed at once on GPU. Scales to thousands of timesteps.
  - Transformers stack many self-attention layers and ditch RNNs
    entirely. Same encoder-decoder idea, completely different
    machinery.

=== Code notes ===

enc_seq = LSTM(32, return_sequences=True)(inp)
  - Encoder returns ALL hidden states (the FULL sequence) — shape
    (batch, T_in, 32).
  - This is the key change vs Q51's seq2seq: we keep every encoder
    state available so attention has something to query.

ctx = LSTM(32)(enc_seq)
dec_in = RepeatVector(T_out)(ctx)
dec_seq = LSTM(32, return_sequences=True)(dec_in)
  - The decoder side is the same RepeatVector pattern as Q51 — but
    instead of going straight to Dense, we route through Attention.

attn_out, attn_w = Attention()([dec_seq, enc_seq],
                               return_attention_scores=True)
  - Attention([Q, V]) — Q = decoder, V = encoder (also used as keys).
  - return_attention_scores=True gives us the weights tensor too.
  - Shapes:
        attn_out  : (batch, T_out, 32)   ← weighted sum of encoder states
        attn_w    : (batch, T_out, T_in) ← the weights themselves

out = TimeDistributed(Dense(1))(attn_out)
  - Per-timestep linear output, same as before. attn_out is the new
    "context" — different at every decoder step, instead of one fixed
    vector.

m = Model(inp, out)                    # for training
attn_model = Model(inp, attn_w)        # for visualization
  - Two models sharing the same layers and weights. Train m, then
    use attn_model to extract weights AFTER training.
  - This pattern works because attn_w is in the same TF graph as out,
    just at a different output node.

How to extend
  - SCALED DOT-PRODUCT (Transformer-style):
        Attention(use_scale=True)
    Adds the /sqrt(d_k) scaling that Transformers rely on for stable
    gradients in larger models.

  - MULTI-HEAD ATTENTION:
        from tensorflow.keras.layers import MultiHeadAttention
        mha = MultiHeadAttention(num_heads=4, key_dim=16)
        attn_out, attn_w = mha(dec_seq, enc_seq, return_attention_scores=True)
    Each head learns a different attention pattern; concatenated at
    the end. Standard component of Transformers.

  - SELF-ATTENTION ON THE ENCODER:
        enc_self = Attention()([enc_seq, enc_seq])
    Lets each input timestep aggregate information from every other
    input timestep before being passed to the decoder. Pre-Transformer
    "self-attentive encoder" idea.

  - VISUALIZE MULTIPLE TEST EXAMPLES:
        for idx in [800, 850, 900]:
            w = attn_model.predict(X[idx:idx+1], verbose=0)[0]
            plt.imshow(w, aspect='auto', cmap='viridis')
            plt.show()
    Different inputs may produce different attention patterns —
    averaging across many shows the typical alignment the model learned.
"""

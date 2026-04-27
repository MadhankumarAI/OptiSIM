import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Model
from tensorflow.keras.layers import Input, LSTM, Dense, RepeatVector, TimeDistributed

y = np.sin(np.linspace(0, 100, 1000))
T_in, T_out = 20, 5
X = np.array([y[i:i+T_in] for i in range(len(y) - T_in - T_out)])[..., None]
Y = np.array([y[i+T_in:i+T_in+T_out] for i in range(len(y) - T_in - T_out)])[..., None]

inp = Input(shape=(T_in, 1))
enc = LSTM(32)(inp)
rep = RepeatVector(T_out)(enc)
dec = LSTM(32, return_sequences=True)(rep)
out = TimeDistributed(Dense(1))(dec)

m = Model(inp, out)
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], epochs=10, verbose=0)

pred = m.predict(X[800:], verbose=0)[0, :, 0]
plt.plot(Y[800, :, 0], label='true')
plt.plot(pred, label='pred')
plt.legend()
plt.show()


"""
=== Concept: Seq2Seq (Sequence-to-Sequence) WITHOUT Attention ===

The vanilla seq2seq architecture (Sutskever, Vinyals, Le 2014) has TWO
parts wired in a chain:

    INPUT SEQUENCE  →  ENCODER  →  context vector  →  DECODER  →  OUTPUT SEQUENCE
    (length T_in)    (an LSTM)   (a fixed-size       (an LSTM)    (length T_out)
                                  bottleneck)

  - The ENCODER reads the entire input sequence one timestep at a time.
    Its FINAL hidden state is a fixed-size summary of the whole input —
    that's the "context vector".
  - The DECODER takes that context vector and produces the output one
    timestep at a time.
  - Everything the model knows about the input must be squeezed through
    that single context vector. This is the famous "information
    bottleneck" of vanilla seq2seq.

Two ways to feed the context to the decoder

  (A) RepeatVector pattern  ← used in this script
        Repeat the encoder's final hidden state T_out times, then feed it
        to the decoder LSTM as input at every output timestep:
            ctx (shape: (32,))
            rep (shape: (T_out, 32))   ← same vector at every step
            dec (shape: (T_out, 32))   ← LSTM unrolls over rep
            out (shape: (T_out, 1))    ← TimeDistributed Dense at each step
        Pros: easy to write with Sequential or Functional API.
        Cons: slightly wasteful (repeats the same context T_out times).

  (B) Initial-state pattern  ← classic "encoder-decoder"
        Use the encoder's final state as the decoder's INITIAL state, and
        feed the previously-generated output as input at each decoder
        timestep:
            encoder_out, h, c = LSTM(32, return_state=True)(inp)
            decoder = LSTM(32, return_sequences=True, return_state=True)
            dec_out, _, _ = decoder(decoder_input, initial_state=[h, c])
        This is the original Sutskever 2014 architecture. Slightly more
        code but more flexible.

Why this is called "without attention"
  - The DECODER only sees the ENCODER's FINAL hidden state — a single
    fixed-size vector.
  - It has no way to "look back" at specific input positions during
    decoding. If the input is "I went to the store yesterday and bought
    bread", the decoder can't selectively focus on "store" vs "bread"
    when generating each output word — it only has the context vector.
  - For short inputs (5-20 tokens) this works. For long inputs (50+),
    the bottleneck causes performance to degrade — the context vector
    can't carry enough information.
  - Adding ATTENTION (Bahdanau 2014, Luong 2015) lets the decoder peek
    at all encoder hidden states at every output step. This is the
    fix that made seq2seq usable for real translation, and it's the
    direct ancestor of today's Transformers.

Common applications of seq2seq

  - Machine translation     : English → French (the original use case)
  - Text summarization      : article → headline
  - Question answering      : question → answer
  - Chatbots                : input message → response
  - Time series forecasting : past 20 steps → next 5 steps (this script)
  - Speech recognition      : audio → transcript
  - Code generation         : prompt → code
  - Handwriting recognition : pen strokes → text

Modern picture: vanilla seq2seq is mostly a HISTORICAL stepping stone
now. Anything serious uses Transformers (which are seq2seq + attention,
without recurrence). But the basic encoder-decoder idea — compress input,
generate output from compressed representation — is everywhere.

Limits of the bottleneck (why attention won)
  - Suppose the encoder LSTM has 32 hidden units. The context vector is
    a single 32-dim float vector — that's all the information the
    decoder ever sees.
  - For an input sequence of 5 tokens, that's plenty.
  - For 50 tokens, the encoder must compress 50 timesteps into 32 floats
    — a ~50:1 compression ratio. Lossy.
  - For 500 tokens, vanilla seq2seq simply fails: BLEU scores collapse
    on long sentences.
  - With attention, the decoder gets access to ALL encoder hidden states
    (one per input timestep), and learns which ones to focus on per
    output token. The bottleneck disappears.

When to use vanilla seq2seq today
  - Tutorials and learning the architecture (this script's purpose).
  - Very short, fixed-form translation tasks.
  - Quick baselines.
  - Otherwise: skip it. Use a Transformer.

=== Code notes ===

X = np.array([y[i:i+T_in] for i in range(len(y) - T_in - T_out)])[..., None]
Y = np.array([y[i+T_in:i+T_in+T_out] for i in range(len(y) - T_in - T_out)])[..., None]
  - Sliding-window setup. Each X is the past T_in values; each Y is the
    next T_out values that come immediately after.
  - Final shapes:
        X.shape = (samples, T_in, 1)    = (975, 20, 1)
        Y.shape = (samples, T_out, 1)   = (975,  5, 1)
  - The trailing [..., None] adds the feature dim (univariate signal).

inp = Input(shape=(T_in, 1))
ctx = LSTM(32)(inp)                            # encoder
  - Encoder LSTM. Default return_sequences=False → outputs only the
    final hidden state. Shape: (batch, 32). This is the context vector.

rep = RepeatVector(T_out)(ctx)
  - Tile the (32,) context vector T_out times → shape (batch, T_out, 32).
  - This gives the decoder LSTM something to unroll over.

dec = LSTM(32, return_sequences=True)(rep)     # decoder
  - Decoder LSTM. return_sequences=True so we get one hidden state per
    output timestep, shape (batch, T_out, 32).

out = TimeDistributed(Dense(1))(dec)
  - TimeDistributed wraps a layer so it's applied independently at every
    timestep. Here: same Dense(1) at each of the T_out steps → shape
    (batch, T_out, 1).
  - In modern Keras you can also just write Dense(1)(dec) — Dense
    auto-applies along the last dim — but TimeDistributed makes the
    intent explicit.

How to extend
  - INITIAL-STATE pattern (the textbook seq2seq):
        enc_out, h, c = LSTM(32, return_state=True)(inp)
        dec_in = Input(shape=(T_out, 1))   # teacher-forcing input
        dec_out, _, _ = LSTM(32, return_sequences=True, return_state=True)(
                          dec_in, initial_state=[h, c])
        out = TimeDistributed(Dense(1))(dec_out)
        m = Model([inp, dec_in], out)
    During training feed Y shifted by one timestep as dec_in
    ("teacher forcing"). At inference, generate one step at a time,
    feeding back predictions.

  - DEEPER ENCODER / DECODER (stack LSTMs):
        x = LSTM(32, return_sequences=True)(inp)
        ctx = LSTM(32)(x)
        rep = RepeatVector(T_out)(ctx)
        dec = LSTM(32, return_sequences=True)(rep)
        dec = LSTM(32, return_sequences=True)(dec)

  - ADD ATTENTION (Q52 territory):
        from tensorflow.keras.layers import Attention
        # Encoder returns full sequence
        enc_seq = LSTM(32, return_sequences=True)(inp)
        # Decoder also full sequence
        dec_seq = LSTM(32, return_sequences=True)(rep)
        # Attention queries decoder over encoder
        attn = Attention()([dec_seq, enc_seq])
        out = TimeDistributed(Dense(1))(attn)

  - FOR TEXT (machine translation toy):
        Use Embedding(vocab_size, emb_dim) before the encoder LSTM,
        Dense(vocab_size, softmax) at the output, and
        sparse_categorical_crossentropy as the loss.
"""

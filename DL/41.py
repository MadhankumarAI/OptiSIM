import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense

y = np.sin(np.linspace(0, 100, 1000))
X = np.array([y[i:i+20] for i in range(len(y) - 20)])[..., None]
Y = y[20:]
n = 800

m = Sequential([Input(shape=(20, 1)), LSTM(32), Dense(1)])
m.compile(optimizer='adam', loss='mse')
m.fit(X[:n], Y[:n], epochs=10, verbose=0)

pred = m.predict(X[n:], verbose=0)
plt.plot(Y[n:], label='true')
plt.plot(pred, label='pred')
plt.legend()
plt.show()


"""
=== Concept: LSTM for Time Series Forecasting ===

Time series forecasting in one sentence
  Predict the NEXT value (or next N values) of a sequence using its
  PAST values.

The "windowing" pattern (what makes time series learnable by a normal
neural network)

  Raw signal:   [y0, y1, y2, y3, ..., y999]
  Sliding window of length 20:
        X[0] = [y0..y19]   →   Y[0] = y20
        X[1] = [y1..y20]   →   Y[1] = y21
        X[2] = [y2..y21]   →   Y[2] = y22
        ...
  - Each input is a length-20 window of past values.
  - The target is the value immediately AFTER the window.
  - This converts a 1D sequence into a regular (X, Y) supervised dataset.

Why LSTM (and not a regular Dense layer)?
  - You COULD flatten the window to (20,) and use Dense — that ignores
    the temporal ORDER of the values.
  - LSTM processes the window one timestep at a time, maintaining an
    internal "memory" that updates as it sees each value. This lets it
    learn patterns like "value goes up when the last 3 values went down".
  - For most short-to-medium sequences (10-200 timesteps), LSTM beats
    plain Dense; for very short windows the difference is small.

What is an LSTM cell? (the bare minimum)
  An LSTM unit at each timestep maintains:
    - h_t : the "hidden state" (short-term output)
    - c_t : the "cell state"   (long-term memory)
  It uses 3 SIGMOID GATES to decide what to do at each step:
    - forget gate  : how much of c_{t-1} to keep
    - input  gate  : how much of the new candidate to write into c_t
    - output gate  : how much of c_t to expose as h_t
  Equations are essentially:
        f_t = sigmoid(W_f · [h_{t-1}, x_t])
        i_t = sigmoid(W_i · [h_{t-1}, x_t])
        c~_t = tanh   (W_c · [h_{t-1}, x_t])
        c_t  = f_t * c_{t-1} + i_t * c~_t
        o_t = sigmoid(W_o · [h_{t-1}, x_t])
        h_t = o_t * tanh(c_t)
  - The forget gate is the key innovation that lets LSTMs "remember"
    over hundreds of timesteps without vanishing gradients.
  - Default LSTM(32) has roughly 4 × (input_dim + 32 + 1) × 32 weights —
    much more than a simple Dense layer per unit.

Why classic RNNs (no gates) don't work for long sequences
  - In a vanilla RNN, the hidden state is squashed through tanh at
    every step → repeated multiplication → exponentially decaying
    gradient signal during BPTT (Backpropagation Through Time).
  - LSTM's cell state c_t is updated by ADDITION (not multiplication)
    plus gating, so gradient can flow far back without vanishing.

LSTM input/output shapes (the part that confuses everyone)

  Input shape   : (batch, timesteps, features)
                  - batch     = how many windows in this minibatch
                  - timesteps = window length (20 in this script)
                  - features  = how many variables per timestep
                                (1 = univariate; >1 = multivariate)

  Output shape  : (batch, units)            ← when return_sequences=False (default)
                  (batch, timesteps, units) ← when return_sequences=True
  - return_sequences=True : you get the full sequence of hidden states
                            (use this when stacking LSTMs).
  - return_sequences=False: you get only the LAST hidden state (use this
                            before a Dense classifier / regressor).

Common forecasting variants

  - One-step ahead    : predict y_{t+1} from y_{t-19}..y_t. (this script)
  - Multi-step ahead  : predict y_{t+1}..y_{t+N} all at once with a
                        Dense(N) head.
  - Recursive forecast: feed prediction back as next input → predict
                        100 steps into the future iteratively.
  - Multivariate input: window has multiple features per timestep
                        (e.g. price, volume, MA), shape (T, F) per
                        sample.

LSTM vs GRU vs Transformer for time series

  LSTM
    - Battle-tested, well-tuned baseline.
    - 4 gates → most parameters per unit.
    - Use as default for sequences ≤ ~500 timesteps.

  GRU (Gated Recurrent Unit)
    - Simplified LSTM (3 gates merged into 2). Fewer params, often
      similar accuracy. Faster to train.
    - Drop-in: from tensorflow.keras.layers import GRU; just swap.

  Transformer / Attention
    - State of the art for LONG sequences and big data.
    - Bigger / harder to train. Overkill for small univariate problems.

  Classical methods (ARIMA, Prophet, ETS)
    - Often beat LSTMs on small / well-behaved series.
    - Always worth as a baseline before reaching for LSTM.

When to use LSTM vs not
  - Use LSTM when:
        sequence length 20-500, multivariate input, non-linear pattern,
        enough data to train (>1000 samples).
  - Skip LSTM when:
        sequence is very short (≤ 5) → just use Dense on flattened window.
        sequence is very long (>1000) → consider Transformer or
        dilated convs.
        you have <100 samples → use ARIMA / Prophet.

=== Code notes ===

y = np.sin(np.linspace(0, 100, 1000))
  - 1000-point sine wave. Sinusoidal signals are the canonical "Hello
    world" for sequence models — periodic, smooth, learnable from a
    short history. Use a real CSV (Jena climate, airline passengers,
    stock prices) for non-toy work.

X = np.array([y[i:i+20] for i in range(len(y) - 20)])[..., None]
Y = y[20:]
  - Sliding windows: 980 samples of length 20.
  - [..., None] adds a TRAILING channel/feature dim → final shape
    (980, 20, 1) = (samples, timesteps, features).
  - Y is the value at position window_end (= y[20], y[21], ..., y[999]).

m = Sequential([Input(shape=(20, 1)), LSTM(32), Dense(1)])
  - Input shape = (timesteps, features). NOTE: NO batch dim here.
  - LSTM(32) = 32-unit LSTM. By default returns only the LAST hidden
    state, shape (batch, 32). Perfect input for a Dense regressor.
  - Dense(1) = single linear output (no activation) — predicts the
    next value directly.

m.compile(optimizer='adam', loss='mse')
  - MSE loss because this is regression. For classification of
    sequences (e.g. "will tomorrow rain?") use binary_crossentropy
    + Dense(1, sigmoid).

How to extend
  - Stack LSTMs (deeper temporal model):
        Sequential([Input(...), LSTM(32, return_sequences=True),
                    LSTM(32), Dense(1)])
    return_sequences=True on all but the last LSTM.
  - Bidirectional LSTM (sees future context too — only valid if the
    full sequence is known at inference, e.g. text not real-time):
        from tensorflow.keras.layers import Bidirectional
        Bidirectional(LSTM(32))
  - Multi-step forecast (predict 5 steps at once):
        Y = np.stack([y[i+20:i+25] for i in range(len(y) - 25)])
        Dense(5)   # output 5 values per sample
  - Multivariate input (e.g. sin + noise as 2 features):
        X = np.stack([y[...], y[...] + noise], axis=-1)  # shape (N, T, 2)
        Input(shape=(20, 2))
  - Try GRU instead — same shape, often faster:
        from tensorflow.keras.layers import GRU
        GRU(32) instead of LSTM(32)
"""

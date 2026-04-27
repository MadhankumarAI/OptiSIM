import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense

y = np.sin(np.linspace(0, 100, 1000))

for T in [5, 20, 50]:
    X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
    Y = y[T:]
    m = Sequential([Input(shape=(T, 1)), LSTM(32), Dense(1)])
    m.compile(optimizer='adam', loss='mse')
    h = m.fit(X[:800], Y[:800], epochs=10, verbose=0)
    print(f'T={T:3d} final_loss={h.history["loss"][-1]:.6f}')
    plt.plot(h.history['loss'], label=f'T={T}')

plt.legend()
plt.xlabel('epoch')
plt.ylabel('loss')
plt.show()


"""
=== Concept: Sequence Length in LSTMs ===

The "sequence length" (T) is the number of past timesteps the LSTM sees
before producing each prediction. It's a hyperparameter — and one of the
most impactful ones.

Three regimes

  Too SHORT (e.g. T=2 for a sine wave with period ~6)
    - LSTM doesn't see enough context to recognize the pattern.
    - Network underfits — both train and val loss stay high.
    - Symptoms: predictions look like a noisy version of the input.
    - In this script: T=5 covers less than one full period of the sine
      wave → LSTM has trouble figuring out where in the cycle it is.

  Just RIGHT (e.g. T=20-30 for this sine wave)
    - Window covers a few full cycles of the dominant pattern.
    - LSTM can match the period and predict the next value accurately.
    - Loss drops to near zero.

  Too LONG (e.g. T=200+ for a simple periodic signal)
    - Most of the window is redundant for prediction.
    - Training is SLOWER (more timesteps to backprop through per
      sample) and uses more memory.
    - Vanishing gradients reappear: even LSTMs struggle past ~500
      timesteps. The forget gate can route gradient back, but the
      practical limit is much shorter than the theoretical one.
    - Often loss plateaus higher than at the sweet spot because the
      network can't focus on the relevant recent context.

What you'll see in this script

  T=5    : loss stays relatively HIGH — too little context.
  T=20   : loss drops to near zero — sweet spot for this signal.
  T=50   : loss similar to T=20, slightly slower convergence; the
           extra context is redundant for a pure sine wave.

  On a more complex signal (real stock prices, multiple frequencies),
  T=50 might be the sweet spot and T=20 too short.

How to choose T

  1. Look at your signal's structure
     - Periodic? Pick T to cover 2-5 periods.
     - Trend with seasonality? Pick T to cover at least one full season
       (e.g. 365 days for yearly seasonality, 24 hours for daily).
     - Highly autocorrelated? Use the autocorrelation plot to find the
       lag where correlation drops to ~0 — go a bit longer than that.

  2. Memory and compute constraints
     - T directly multiplies training time per step.
     - GPU memory grows linearly with T (and quadratically for
       attention-based models).

  3. Sweep it as a hyperparameter
     - Train with T = [10, 20, 50, 100, 200], plot val loss curves,
       pick the lowest. (This script is the smallest version of that
       sweep.)

Practical limits per architecture
  Vanilla RNN  : ~10 timesteps before vanishing gradient kills it.
  LSTM / GRU   : 100-500 timesteps reliable. Past that, struggles.
  Transformer  : 512-8192+ with attention. The current standard for
                 long sequences.
  TCN / Dilated : up to ~10,000 timesteps with dilated 1D convs.
                  Often beat LSTM on long pure time-series tasks.

Memory & speed cost of T (rough rules)

  Time / epoch    : O(T)        — linear in sequence length
  GPU memory      : O(T)        — must store hidden states for BPTT
  For Transformer : O(T²)       — attention is quadratic in T
                                  (this is why long-context transformers
                                   need tricks: sliding windows, FlashAttn)

Truncated BPTT (for very long sequences)
  - If T is so large that backprop through all timesteps doesn't fit in
    memory, you can split the sequence into chunks and only backprop
    within each chunk, while CARRYING FORWARD the hidden state between
    chunks.
  - In Keras this is done with stateful=True LSTMs:
        LSTM(32, stateful=True)
    Plus you reset the state manually between epochs:
        m.reset_states()

When sequence length matters most
  - Short windows + slow signal       → underfit (script's T=5 case).
  - Long windows + simple signal      → wasted compute.
  - Long windows + complex signal     → essential (multi-period or
                                         distant dependencies).
  - Variable-length sequences         → use Masking or padding to a
                                         fixed length, or RaggedTensor.

=== Code notes ===

for T in [5, 20, 50]:
  - Loops over three sequence lengths. Same model architecture, same
    data, only the window size changes.

X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
Y = y[T:]
  - Sliding-window construction. Notice the shape changes per T:
        T=5  → X.shape = (995,  5, 1)
        T=20 → X.shape = (980, 20, 1)
        T=50 → X.shape = (950, 50, 1)
  - Sample count drops slightly for longer windows (you lose T samples
    at the start of the series).

m = Sequential([Input(shape=(T, 1)), LSTM(32), Dense(1)])
  - Input shape DEPENDS on T — that's why we rebuild the model inside
    the loop.
  - LSTM(32) is the same regardless of T; the gate equations apply at
    every timestep.

How to extend
  - Larger sweep:
        for T in [2, 5, 10, 20, 50, 100, 200]:
    Plot final loss vs T to find the U-curve sweet spot.
  - Track training TIME too (longer T = longer epochs):
        import time
        t = time.time()
        m.fit(...)
        print(f'T={T} time={time.time()-t:.1f}s')
  - Try a more complex signal where T matters more:
        y = np.sin(t) + 0.5 * np.sin(t/5) + np.random.normal(0, 0.1, len(t))
    The longer-period component (period 31 here) means T must be > 30
    to capture it.
  - Compare LSTM vs Transformer on long T:
        from tensorflow.keras.layers import MultiHeadAttention
    For T > 200, transformers usually pull ahead.
"""

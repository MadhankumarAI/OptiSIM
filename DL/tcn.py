import numpy as np
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv1D, Dense, Flatten

y = np.sin(np.linspace(0, 100, 1000))
T = 20
X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
Y = y[T:]

dilations = [1, 2, 4, 8]
m = Sequential([Input(shape=(T, 1))] + [Conv1D(16, 3, padding='causal', dilation_rate=d, activation='relu') for d in dilations] + [Flatten(), Dense(1)])
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], validation_data=(X[800:], Y[800:]), epochs=10, verbose=0)
print(m.evaluate(X[800:], Y[800:], verbose=0))


"""
=== Concept: Temporal Convolutional Network (TCN) ===

TCN = LSTM's competitor for sequence modeling, built from STACKED CAUSAL
DILATED 1D CONVOLUTIONS. No recurrence — fully parallel on GPU.

Three ingredients

  1. CAUSAL convolution (padding='causal')
     - Output at time t depends only on inputs ≤ t.
     - Achieved by left-padding the input and trimming the right side.
     - Without causal, a "future" timestep would leak into the prediction.

  2. DILATION (dilation_rate=d)
     - Skip d-1 timesteps between kernel taps:
           d=1: tap positions [t-2, t-1, t]            (kernel=3)
           d=2: tap positions [t-4, t-2, t]            (every 2nd)
           d=4: tap positions [t-8, t-4, t]            (every 4th)
           d=8: tap positions [t-16, t-8, t]           (every 8th)
     - Doubling d at each layer gives EXPONENTIAL receptive field growth
       with linear depth — covers thousands of timesteps with a few
       layers.

  3. STACKED layers
     - Each layer compounds the receptive field of the previous one.
     - With kernel=3, dilations=[1, 2, 4, 8], you can see back
       2*(1+2+4+8) = 30 timesteps. The user list `dilations` controls
       this directly.

The receptive field formula
     RF = 1 + 2 * sum(dilations)         (for kernel=3)

Why TCN often beats LSTM on long sequences
  - Parallel: every timestep computed at once on GPU.
  - No vanishing gradient: no recurrent products of weights.
  - Adjustable receptive field via dilations list.
  - Simpler to train (no hidden-state initialization issues).

When NOT to use TCN
  - Variable-length sequences with very different lengths (LSTMs handle
    this more naturally).
  - When you need streaming inference token-by-token (LSTMs hold state).

The lever in this script

  dilations = [1, 2, 4, 8]
  - Edit this single list to change the model's receptive field.
  - More dilations → bigger RF, but more compute.
  - Examples:
        [1]              → RF = 3   (no dilation, just one conv layer)
        [1, 2, 4, 8, 16] → RF = 63  (deeper, sees further back)

=== Code notes ===

Conv1D(16, 3, padding='causal', dilation_rate=d, activation='relu')
  - 16 filters, kernel size 3.
  - padding='causal' = the magic word that makes it a TEMPORAL conv.
  - dilation_rate=d controls the gap between kernel taps.

Sequential([Input...] + [Conv1D... for d in dilations] + [Flatten, Dense])
  - Build the stack with a list comprehension; one Conv1D per dilation.

Flatten + Dense(1)
  - Collapse (T, 16) to a single scalar prediction. For multi-step
    output use Dense(T_out) and a multi-target Y instead.

How to extend
  - ADD RESIDUAL CONNECTIONS (true TCN block from Bai et al. 2018):
        functional API needed; for each block:
            x_skip = x
            x = Conv1D(...)(x); x = Conv1D(...)(x)
            x = x + x_skip
  - USE pip install keras-tcn for the full library:
        from tcn import TCN
        m = Sequential([Input(...), TCN(nb_filters=16, kernel_size=3,
                                        dilations=[1,2,4,8]), Dense(1)])
  - DROPOUT: Conv1D(16, 3, padding='causal', dilation_rate=d,
                   activation='relu', kernel_regularizer='l2')
"""

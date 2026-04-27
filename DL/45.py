import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense

y = np.sin(np.linspace(0, 100, 1000))
T = 20
X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
Y = y[T:]

m = Sequential([Input(shape=(T, 1)), LSTM(16, return_sequences=True), LSTM(16), Dense(1)])
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], epochs=5, verbose=0)

hidden = m.layers[0](X[:1]).numpy()

plt.imshow(hidden[0].T, aspect='auto', cmap='RdBu_r')
plt.xlabel('timestep')
plt.ylabel('hidden unit')
plt.colorbar()
plt.show()


"""
=== Concept: Visualizing LSTM Hidden States ===

What hidden states are
  - h_t = the LSTM's "output" at timestep t. There's one h_t per
    timestep per hidden unit.
  - For LSTM(units=16) reading a length-20 window: hidden state tensor
    shape = (batch, 20, 16).
  - These are RUNTIME ACTIVATIONS — they depend on the input. Different
    input → different hidden states. (This is the key difference from
    WEIGHTS, which are static.)

Why visualize them
  - Interpretability: see WHICH hidden units track WHICH features of
    the input. After training on a sine wave, you'll often find:
        - some units track the SIGN of the signal (oscillate ±)
        - some units track the PHASE (rise/fall)
        - some units track the long-running AVERAGE
        - some units stay near zero (didn't specialize)
  - Debugging: if all units look identical, the LSTM has collapsed
    (bad init, dead gates, training failure).
  - Pretty pictures of how recurrent memory evolves.

The two-step trick to extract hidden states

  1. Build the LSTM with return_sequences=True
     - Default LSTM returns only the FINAL hidden state h_T → shape
       (batch, units). You lose all intermediate states.
     - With return_sequences=True you get the FULL sequence → shape
       (batch, T, units). One activation per timestep per unit.

  2. Capture the layer's output during inference
     - Easiest: call the layer directly:
           h = m.layers[0](some_input).numpy()
     - Or build a sub-model:
           sub = Model(m.input, m.layers[0].output)
           h = sub.predict(some_input)
     - Either way you get a numpy array of shape (batch, T, units).

How to read the heatmap in this script
  - X axis = timestep (0 to 19, oldest to newest in the window)
  - Y axis = hidden unit (0 to 15)
  - Cell color = activation value at that (unit, timestep) — RED for
    positive, BLUE for negative.
  - HORIZONTAL stripes = a unit that produces a roughly constant
    activation regardless of timestep (boring / uninformative).
  - WAVY rows = a unit whose activation oscillates with the input —
    likely tracking the sine wave's phase or sign.
  - SHARP transitions = a unit that flips between two states based on
    something specific in the input.

Hidden state vs cell state (the c_t / h_t distinction)
  - LSTM keeps two state tensors:
        h_t : "hidden state" — the layer's output (what we visualized).
        c_t : "cell state"   — the long-term memory; not exposed by
                                default.
  - To get c_t too:
        out, h_final, c_final = LSTM(16, return_state=True,
                                     return_sequences=True)(inp)
    But return_state only gives you the FINAL (h_T, c_T), not every
    timestep's c. Capturing c at every step requires a custom layer
    or LSTMCell loop.
  - For most interpretation work, h_t is enough.

What you can learn from these plots

  Specialized units
    - You'll see distinct "specializations" emerge: e.g. unit 3
      activates strongly when the recent input has been increasing,
      unit 7 fires near sign changes.
    - Real-world LSTMs trained on text/code show even more dramatic
      specialization (Karpathy 2015 famously found units that
      tracked quote-balance, line-length, etc.).

  Memory horizon
    - If a unit's activation at timestep T depends only on the most
      recent input, it has a SHORT memory.
    - If it depends on values 15 timesteps ago, it has LONG memory.
    - You can probe this by perturbing the input at timestep 0 and
      seeing how late the change in the unit's activation persists.

  Dead units
    - Units stuck near zero across all inputs and all timesteps. Common
      symptom of poor init or insufficient training.

Comparison with feature maps in CNNs (Q26)
  - Feature maps in CNNs   : 2D images — "where in the spatial
                              extent does this feature occur?"
  - Hidden states in RNNs  : 2D heatmap (units × timesteps) —
                              "when in time does each unit activate?"
  - Same idea: visualize internal activations to understand what the
    network is doing.

Other visualization tricks (worth trying)

  - PER-UNIT LINE PLOTS: for each unit, plot activation over time as a
    1D curve. Easier to see the shape of one unit's behavior than a
    heatmap row.
        for i in range(16):
            plt.plot(hidden[0, :, i] + i * 2, label=f'u{i}')

  - INPUT OVERLAY: plot the input signal AND a hidden unit's activation
    on the same axes, see where they correlate.
        plt.plot(X[0, :, 0], label='input')
        plt.plot(hidden[0, :, 5], label='hidden unit 5')

  - GATE ACTIVATIONS: forget/input/output gate values, not just h.
    Requires a custom LSTMCell call to expose them — for serious
    interpretability work, consider attention models which are far
    more interpretable than LSTMs.

  - PCA on h_T across many sequences: cluster sequences by how the
    LSTM summarized them. Useful for sentence embeddings.

=== Code notes ===

m = Sequential([Input(shape=(T, 1)),
                LSTM(16, return_sequences=True),
                LSTM(16),
                Dense(1)])
  - The FIRST LSTM uses return_sequences=True so we have something to
    visualize at every timestep.
  - The second LSTM has return_sequences=False (default), turning the
    sequence back into a single vector before the Dense head.
  - This is the standard "stacked LSTM" pattern: True everywhere
    except the last LSTM, then go to a Dense classifier/regressor.

hidden = m.layers[0](X[:1]).numpy()
  - Call the LSTM layer directly on a tensor. Layers in Keras are
    callable — feeding input through one layer gives that layer's
    output as a Tensor. .numpy() converts to a numpy array.
  - Shape: (1, 20, 16) = (batch, timesteps, units).
  - SHORTCUT — works because layers in already-built models can be
    re-called on new input. Cheaper than building a sub-Model when
    you just need one layer's output.

plt.imshow(hidden[0].T, aspect='auto', cmap='RdBu_r')
  - .T (transpose) so units are on the Y axis and timesteps on X.
  - aspect='auto' lets matplotlib stretch the image — without this,
    the heatmap would be very narrow (only 20 wide).
  - cmap='RdBu_r' is a diverging colormap, ideal for showing positive
    vs negative activations symmetrically.

How to extend
  - Try multiple test inputs side by side:
        for j, sample in enumerate([X[800], X[850], X[900]]):
            h = m.layers[0](sample[None]).numpy()
            ax[j].imshow(h[0].T, aspect='auto', cmap='RdBu_r')
  - Visualize the second LSTM too (set return_sequences=True on it
    temporarily and re-extract).
  - Train on a more complex signal to see richer specialization:
        y = np.sin(t) + 0.5 * np.cos(t/3) + 0.3 * np.random.randn(len(t))
"""

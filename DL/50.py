import numpy as np
import matplotlib.pyplot as plt
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense

t = np.linspace(0, 100, 1000)
y = np.sin(t) + 0.5 * np.sin(t / 10)

T = 20
X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
Y = y[T:]

m = Sequential([Input(shape=(T, 1)), LSTM(32, return_sequences=True), LSTM(32), Dense(1)])
m.compile(optimizer='adam', loss='mse')
m.fit(X[:800], Y[:800], epochs=20, verbose=0)

base = X[800:801]
base_pred = m.predict(base, verbose=0)[0, 0]
sens = []
for k in range(T):
    p = base.copy()
    p[0, k, 0] += 1.0
    sens.append(m.predict(p, verbose=0)[0, 0] - base_pred)

plt.bar(range(T), sens)
plt.xlabel('perturbed timestep (0=oldest, 19=newest)')
plt.ylabel('change in prediction')
plt.title('LSTM sensitivity to each past timestep')
plt.show()


"""
=== Concept: Analyzing Temporal Dependencies ===

The question this script answers
  "How far back in the input sequence does the LSTM actually look when
   making a prediction?"

The trick: PERTURBATION SENSITIVITY ANALYSIS

  1. Take a trained LSTM and a fixed test window.
  2. Predict y_hat for the original input → call this base_pred.
  3. For each timestep k in the window:
        - Add a small bump (+1.0) to the input AT THAT TIMESTEP ONLY.
        - Predict again → call this perturbed_pred.
        - sens[k] = perturbed_pred - base_pred.
  4. Plot sens[k] vs k.

What the bar chart reveals
  - If sens[k] is LARGE for some k, that timestep STRONGLY influences
    the prediction → the LSTM "remembers" it.
  - If sens[k] is NEAR ZERO, that timestep is effectively forgotten.
  - The shape of the bars IS the LSTM's effective memory profile.

Typical patterns

  Recency-biased (what you'll see here)
    - Bars largest near k = T-1 (most recent), shrinking toward k = 0
      (oldest). Classic exponential decay.
    - This is the "natural" behavior of LSTMs — recent input dominates,
      old input gradually fades.

  Long-range dependence
    - On signals with slow components (like our sin(t/10) term), some
      bars at SMALL k may be non-trivial — the LSTM is using older
      context to predict the slow-cycle position.
    - The mix of fast (sin(t)) and slow (sin(t/10)) components in this
      signal forces the LSTM to attend to BOTH recent and distant past.

  Vanishing memory (vanilla RNN, or under-trained LSTM)
    - Sharp cutoff: sens > 0 only for the last 5-10 timesteps; bars
      effectively zero beyond that.
    - Indicates the model can't propagate information past that horizon.

  Random noise
    - Bars look randomly distributed → model didn't really learn the
      temporal structure (training failed or insufficient).

Why this is the right way to measure "temporal dependency"
  - The naive answer ("the input is T timesteps long, so the LSTM uses
    T timesteps") is WRONG. You feed it T timesteps; how many it
    actually USES is a separate, learnable property.
  - Looking at hidden states alone (Q45) tells you what's REPRESENTED;
    perturbation analysis tells you what's USED.
  - This is a model-agnostic technique — works for LSTMs, GRUs,
    Transformers, or any black-box predictor.

Other ways to probe temporal dependencies (advanced)

  Gradient-based (saliency)
    - Compute |∂ŷ / ∂x_k| for each k. Large gradient = high importance.
    - Faster than perturbation (one backward pass vs T forward passes).
    - But gradient saturation can underestimate importance.

  Integrated gradients
    - Average gradients along a path from a baseline (e.g. zeros) to
      the actual input. More robust than raw gradients.

  Attention weights
    - For attention-based models, the attention scores literally tell
      you which timesteps the model "looked at". LSTMs have no
      attention by default — that's why we need perturbation tricks.

  Autocorrelation of hidden states
    - For a unit u, plot Corr(h_u[t], h_u[t-k]) vs k.
    - Slow decay = long memory; fast decay = short memory.

What you'll see for THIS script
  - The signal y = sin(t) + 0.5*sin(t/10) has two components:
        * fast period ≈ 6.28
        * slow period ≈ 62.8
  - With T=50, the window covers ~8 fast cycles but less than 1 slow
    cycle.
  - Expected bar pattern:
        * Strong bars at k = 45-49 (recent context dominates)
        * Moderate bars at k = 30-44 (mid-range context for tracking
          fast cycle)
        * Some non-zero bars at k = 0-15 (the LSTM uses oldest context
          to estimate slow-component phase)
  - Run-to-run variation: exact bar heights depend on the trained
    weights, but the overall RECENCY BIAS is consistent.

Practical implications
  - If you find bars near zero past some k = K, you can SHORTEN your
    window to K and lose nothing — saves compute.
  - If important bars are at k = 0 (oldest), consider LENGTHENING your
    window — the LSTM may be hitting the boundary of what it can see.
  - If the bar pattern is uniform (all the same height), the LSTM
    isn't differentiating timesteps — it might as well be a Dense
    layer on the flattened window.

=== Code notes ===

y = np.sin(t) + 0.5 * np.sin(t / 10)
  - Two-component signal. Fast (sin(t)) for short-range dependency
    learning, slow (sin(t/10)) for long-range. Forces the LSTM to use
    both recent and distant context.

base = X[1500:1501]
base_pred = m.predict(base, verbose=0)[0, 0]
  - "Reference" input from the held-out portion (not seen during
    training). Single sample, kept as a (1, T, 1) batch.

for k in range(T):
    p = base.copy()
    p[0, k, 0] += 1.0
    sens.append(m.predict(p, verbose=0)[0, 0] - base_pred)
  - Perturb ONE timestep at a time, measure prediction change.
  - +1.0 is a large bump on a [-1.5, 1.5]-range signal → produces
    measurable changes. For tiny perturbations, sensitivity becomes
    noise; for huge ones, the LSTM extrapolates outside its training
    distribution.
  - Cost: T+1 forward passes total. Cheap for T=50; expensive for
    T=1000 (use gradient-based methods then).

How to extend
  - GRADIENT-BASED VERSION (faster, single pass):
        import tensorflow as tf
        x = tf.constant(base)
        with tf.GradientTape() as tape:
            tape.watch(x)
            y_hat = m(x)
        grads = tape.gradient(y_hat, x).numpy()[0, :, 0]
        plt.bar(range(T), np.abs(grads))
    Often produces a similar shape to perturbation analysis but
    requires only one backward pass.

  - DIFFERENT PERTURBATION SIZES — sweep delta to see linearity:
        for delta in [0.01, 0.1, 1.0]:
            ...
    Linear response → LSTM is using that timestep's value directly.
    Saturating response → LSTM bottlenecks on a gate.

  - PER-SAMPLE VARIATION:
        for sample_idx in [1500, 1700, 1900]:
            base = X[sample_idx:sample_idx+1]
            ...
    Different inputs may use the temporal context differently.
    Average over many samples to find the model's *typical* dependency.

  - COMPARE LSTM vs SIMPLE_RNN on the same task:
        from tensorflow.keras.layers import SimpleRNN
        # SimpleRNN's bars will collapse to only the last few timesteps
        # — visible vanishing-gradient memory limit.
"""

import matplotlib.pyplot as plt
from tensorflow.keras.layers import Dense

inits = ['zeros', 'random_normal', 'random_uniform', 'glorot_uniform', 'glorot_normal', 'he_normal']
fig, axes = plt.subplots(2, 3, figsize=(12, 6))

for ax, init in zip(axes.flat, inits):
    layer = Dense(100, kernel_initializer=init)
    layer.build((None, 100))
    W = layer.get_weights()[0].flatten()
    ax.hist(W, bins=40)
    ax.set_title(f"{init}  (std={W.std():.3f})")

plt.tight_layout()
plt.show()


"""
=== Concept: Visualizing Weight Distributions ===

Every initializer produces a CHARACTERISTIC SHAPE when you plot a histogram
of the weight values. Looking at these shapes is the fastest way to build
intuition for why each initializer behaves the way it does.

What you'll see in each subplot

  zeros
    - A single spike at 0. Every weight is exactly 0.
    - std = 0. No spread at all → symmetry → network can't learn.

  random_normal       (mean=0, stddev=0.05 by default)
    - Classic bell curve centered at 0.
    - Most weights clustered near 0, with a thin tail of larger values.
    - std ≈ 0.05.

  random_uniform      (range [-0.05, 0.05] by default)
    - Flat-top "rectangle" — every value in the range equally likely.
    - Sharp cutoffs at the edges (no tail beyond ±0.05).
    - std ≈ 0.029  (uniform std = range / sqrt(12)).

  glorot_uniform      (range = ±sqrt(6 / (fan_in + fan_out)))
    - Flat-top, but the range AUTO-SCALES to layer size.
    - For Dense(100, input_shape=(100,)) → limit = sqrt(6/200) ≈ 0.173
    - Wider than naive random_uniform's ±0.05.
    - std ≈ sqrt(2 / (fan_in + fan_out)) ≈ 0.10.

  glorot_normal       (Gaussian with σ² = 2 / (fan_in + fan_out))
    - Bell curve, std auto-scaled to layer size.
    - Same variance target as glorot_uniform, just normally distributed.
    - std ≈ 0.10.

  he_normal           (Gaussian with σ² = 2 / fan_in)
    - Bell curve, but WIDER than Glorot — variance only scales with
      fan_in (not fan_in + fan_out), so it's roughly 2x the variance of
      Glorot for square layers.
    - std ≈ sqrt(2 / 100) ≈ 0.141.
    - The wider spread compensates for ReLU killing half the activations.

What to look for in the plots
  - Center : Every well-designed initializer is centered at 0 (positive and
             negative weights are equally likely).
  - Spread : This is the variance/std. Bigger fan_in/fan_out → smaller
             spread (Glorot/He auto-shrink for big layers).
  - Shape  : Bell vs flat-top tells you Gaussian vs Uniform.
  - Zeros  : A degenerate spike at 0 — visibly broken vs everything else.

The size relationship
        std(zeros)   <   std(random_uniform_default)   <
        std(random_normal_default)   ≈   std(glorot_*)   <   std(he_*)

Why this matters in practice
  - Activations through a layer have variance roughly fan_in * Var(W).
  - If Var(W) is the WRONG size for fan_in, activations either explode or
    vanish across depth.
  - Glorot/He pick Var(W) precisely so that variance stays ≈ 1 across
    layers — that's why their histograms have layer-size-dependent widths
    while naive random_normal/uniform are stuck at a fixed 0.05.

=== Code notes ===

layer = Dense(100, kernel_initializer=init)
layer.build((None, 100))
W = layer.get_weights()[0].flatten()
  - Dense(100, kernel_initializer=init) — declare a layer with 100 output
    units and the chosen initializer; no model needed.
  - layer.build((None, 100)) — explicitly build the layer with input
    dimension 100. This is what creates the actual weight tensor; before
    this, the layer has no weights to inspect.
  - get_weights() returns [kernel, bias]. We take [0] (the kernel), and
    .flatten() turns the (100, 100) matrix into a 1D array of 10,000
    values for the histogram.

ax.hist(W, bins=40)
  - 40 bins is plenty for 10k samples. More bins → finer detail; fewer
    bins → smoother shape.
  - To overlay them on one axis instead of subplots:
        plt.hist(W, bins=40, alpha=0.5, label=init)
        plt.legend()

How to extend
  - Change the layer size to see how Glorot/He scale:
        Dense(10, ...)   → wider weights (smaller fan)
        Dense(1000, ...) → narrower weights (bigger fan)
  - Plot biases too: layer.get_weights()[1] — they default to zeros.
  - Compare AFTER training:  m.fit(...) then re-plot — you'll see weights
    drift from their init shapes.
"""

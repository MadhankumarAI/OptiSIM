from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.initializers import VarianceScaling

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

init = VarianceScaling(scale=2.0, mode='fan_in', distribution='truncated_normal')

m = Sequential([Dense(32, activation='relu', input_shape=(4,), kernel_initializer=init), Dense(3, activation='softmax', kernel_initializer=init)])
m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(Xtr, ytr, epochs=50, verbose=0)
print(m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Variance Scaling Initialization ===

VarianceScaling is the GENERAL FAMILY that Glorot, He, and LeCun all belong
to. They aren't different ideas — they're the same idea with different
knobs:

    Var(W) = scale / denominator

You pick:
  scale         : how much variance you want (1.0, 2.0, …)
  denominator   : fan_in, fan_out, or (fan_in + fan_out) / 2  ("fan_avg")
  distribution  : how to sample within that variance (normal vs uniform)

That's it. Three knobs covers every named initializer in deep learning.

Keras API
    from tensorflow.keras.initializers import VarianceScaling
    VarianceScaling(scale=2.0,
                    mode='fan_in',
                    distribution='truncated_normal',
                    seed=None)

The named inits are just presets

    Initializer       scale   mode      distribution         Used with
    ──────────────────────────────────────────────────────────────────────
    he_normal         2.0     fan_in    truncated_normal     ReLU family
    he_uniform        2.0     fan_in    uniform              ReLU family
    glorot_normal     1.0     fan_avg   truncated_normal     tanh / sigmoid
    glorot_uniform    1.0     fan_avg   uniform              tanh / sigmoid
    lecun_normal      1.0     fan_in    truncated_normal     SELU
    lecun_uniform     1.0     fan_in    uniform              SELU

Verify by checking std on a 100x100 layer:
  - he_normal       → std ≈ sqrt(2 / 100) ≈ 0.141
  - glorot_normal   → std ≈ sqrt(2 / 200) ≈ 0.100
  - lecun_normal    → std ≈ sqrt(1 / 100) ≈ 0.100

The math behind the knobs

  Forward variance preservation argument:
        out = W @ x → Var(out) ≈ fan_in · Var(W) · Var(x)
        For Var(out) = Var(x):  Var(W) = 1 / fan_in   → mode='fan_in', scale=1
                                                        (= LeCun)

  Backward variance preservation argument:
        For gradient stability:  Var(W) = 1 / fan_out → mode='fan_out', scale=1

  Compromise (Glorot/Xavier):
        Var(W) = 2 / (fan_in + fan_out) → mode='fan_avg', scale=1

  ReLU correction (He):
        ReLU kills half the activations, halving Var(out). Compensate by
        DOUBLING the variance:
        Var(W) = 2 / fan_in → mode='fan_in', scale=2

The three modes — quick reference

  mode='fan_in'   : Var(W) = scale / fan_in
                    Tunes for forward signal stability (input side).
                    Used by He and LeCun.

  mode='fan_out'  : Var(W) = scale / fan_out
                    Tunes for backward gradient stability (output side).
                    Rarely used as a primary choice.

  mode='fan_avg'  : Var(W) = scale / ((fan_in + fan_out) / 2)
                    Compromise between forward and backward stability.
                    Used by Glorot/Xavier.

Distribution: normal vs uniform
  - truncated_normal : Gaussian, but values beyond ±2σ are re-sampled.
                       This is the recommended default — it avoids the
                       rare extreme weights of plain Gaussian without
                       changing the bulk of the distribution.
  - untruncated_normal : raw Gaussian; you may get rare large weights.
  - uniform          : flat distribution. Range auto-computed so the
                       variance matches `scale / denominator`.
                       (For variance V, uniform range = ±sqrt(3V).)

When to reach for VarianceScaling directly (instead of the presets)
  - You're using an unusual activation (e.g. Swish, Mish, GELU) and want to
    tune scale to match its statistical properties — say scale=1.5 if you
    suspect the standard He scale=2.0 is too aggressive.
  - You're running an ablation or research experiment that sweeps
    initialization variance.
  - You want one initializer object you can re-parameterize at config time
    without changing layer code.

In normal day-to-day usage, just pick the named preset:
    ReLU family    → 'he_normal'
    tanh/sigmoid   → 'glorot_uniform'   (Keras default)
    SELU           → 'lecun_normal'

=== Code notes ===

init = VarianceScaling(scale=2.0, mode='fan_in', distribution='truncated_normal')
  - This exact configuration IS he_normal. Equivalent to:
        from tensorflow.keras.initializers import HeNormal
        HeNormal()
    Or just the string 'he_normal'.
  - To make it Glorot-equivalent:
        VarianceScaling(scale=1.0, mode='fan_avg', distribution='uniform')
  - To experiment with a custom scale:
        VarianceScaling(scale=1.5, mode='fan_in', distribution='truncated_normal')
        # halfway between Glorot and He — useful for activations between
        # tanh and ReLU in steepness (Swish, GELU).

m = Sequential([
    Dense(32, activation='relu', input_shape=(4,), kernel_initializer=init),
    Dense(3,  activation='softmax', kernel_initializer=init),
])
  - Same VarianceScaling instance used on both layers — fine, because
    Var(W) is computed AT BUILD TIME from each layer's own fan_in. The
    initializer doesn't store any layer-specific state.

To inspect what variance was actually applied
    print(m.layers[0].get_weights()[0].std())   # ≈ sqrt(2/4)  ≈ 0.707
    print(m.layers[1].get_weights()[0].std())   # ≈ sqrt(2/32) ≈ 0.250
  Notice how the std is DIFFERENT per layer — that's VarianceScaling
  adapting to each layer's fan_in automatically.
"""

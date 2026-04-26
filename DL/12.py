from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for init in ['zeros', 'random_normal']:
    m = Sequential([Dense(16, activation='relu', input_shape=(4,), kernel_initializer=init), Dense(3, activation='softmax', kernel_initializer=init)])
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(init, m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Random Initialization (vs Zero Initialization) ===

The whole point of random init is ONE thing: BREAK SYMMETRY.

Zero init problem (recap)
  - Every neuron in a layer starts identical → computes the same output →
    gets the same gradient → updates the same way → stays identical.
  - The layer collapses to the capacity of a single neuron, no matter how
    many units you declared.
  - On iris (3 classes) with zero init: accuracy stuck at ~33% (random
    chance).

Random init fix
  - Sampling each weight independently from a distribution gives every
    neuron a DIFFERENT starting point.
  - Different starting weights → different outputs → different gradients →
    each neuron learns its own feature.
  - Even crude random init (e.g. random_normal with stddev=0.05) lets the
    network train normally — accuracy on iris jumps to ~95%+.

Two flavors of "naive" random init
  - random_normal(mean=0, stddev=0.05)
        Weights drawn from a Gaussian. Most weights cluster near 0; rare
        large values. Default Keras stddev = 0.05.
  - random_uniform(minval=-0.05, maxval=0.05)
        Weights drawn uniformly in a range. All values in the range are
        equally likely. Default range = [-0.05, 0.05].
  - Both work for breaking symmetry. The difference between them is
    usually noise.

Why "random" alone isn't the WHOLE answer
  - Naive random init uses a FIXED variance regardless of layer size.
  - In deep networks this causes a problem:
        * Too small variance → activations shrink with depth → vanishing
                               gradients → deep layers don't learn.
        * Too large variance → activations explode with depth → unstable
                               training.
  - Smart initializers (Glorot, He, LeCun) scale the variance to the
    layer's fan_in/fan_out, keeping activation magnitudes stable across
    depth. They're random init, just with the RIGHT variance.

Hierarchy
        zeros            ← broken (symmetry collapse)
        random_*         ← works but variance is arbitrary
        glorot / he /    ← random WITH variance scaled to layer size,
        lecun              tuned to your activation function (best)

Rule of thumb
  - For a quick toy / shallow net: random_normal is fine.
  - For anything serious or deep: use he_* (ReLU) or glorot_* (tanh/sigmoid)
    — they're still random, just with smarter variance.
    
    
    
    
 Glorot init = Xavier init. Same thing, different names. Xavier Glorot introduced it in his 2010 paper with Yoshua Bengio, so the community uses both names interchangeably. Keras names it glorot_*; PyTorch and most papers call it xavier_*.

What it is
A random initializer that scales the variance based on layer size, designed to keep activation and gradient magnitudes roughly constant across layers — preventing vanishing/exploding signals in deep networks.

The math
For a Dense layer with fan_in inputs and fan_out outputs:

Glorot uniform — sample weights from Uniform(−limit, +limit) where:


limit = sqrt(6 / (fan_in + fan_out))
Glorot normal — sample weights from Normal(0, σ²) where:


σ² = 2 / (fan_in + fan_out)
Both produce the same variance: Var(W) = 2 / (fan_in + fan_out). The uniform / normal choice is just how the values are distributed within that variance.

The intuition (why this specific number)
Imagine a forward pass through one Dense layer:


y = W · x + b
Var(y) ≈ fan_in · Var(W) · Var(x)
If you want Var(y) ≈ Var(x) (signal magnitude preserved), you need:


Var(W) = 1 / fan_in
If you do the same analysis on the backward pass (gradients flowing backward through the same layer), you get:


Var(W) = 1 / fan_out
You can't satisfy both exactly, so Glorot picks the harmonic compromise: Var(W) = 2 / (fan_in + fan_out). That's why it works for both forward signal AND backward gradient stability.

When to use it
Tanh / sigmoid / softmax activations → Glorot is the correct choice. The derivation assumes a roughly linear activation around 0, which tanh/sigmoid satisfy near origin.
ReLU and its variants → Glorot underestimates the variance (ReLU kills half the inputs). Use He init instead, which scales to 2 / fan_in to compensate. Glorot still works with ReLU but trains slightly slower in deep networks.
Quick comparison
Initializer	Variance	Designed for
Glorot / Xavier	2 / (fan_in + fan_out)	tanh, sigmoid, softmax
He / Kaiming	2 / fan_in	ReLU, LeakyReLU, ELU
LeCun	1 / fan_in	SELU
Why it's the Keras default for Dense
When Keras was designed, tanh/sigmoid were still common and Glorot is a safe middle ground — it works acceptably with ReLU even though He is technically better. So they picked it as the universal default.

Practical takeaway: if your hidden layers are ReLU, manually set kernel_initializer='he_normal'. Otherwise Glorot's default is fine.

=== Code notes ===

m = Sequential([Dense(16, activation='relu', input_shape=(4,),
                      kernel_initializer=init),
                Dense(3, activation='softmax',
                      kernel_initializer=init)])
  - kernel_initializer=init flips the experiment. Same architecture, same
    optimizer, same data → only the initial weights differ, so the
    accuracy gap is purely from initialization.
  - For a custom random distribution:
        from tensorflow.keras.initializers import RandomNormal, RandomUniform
        RandomNormal(mean=0.0, stddev=0.05, seed=0)
        RandomUniform(minval=-0.1, maxval=0.1, seed=0)
  - To set bias init too (defaults to 'zeros' which is fine):
        Dense(16, ..., bias_initializer='zeros')

The lever
  - for init in ['zeros', 'random_normal']: — only the init changes.
  - To extend:
        ['zeros', 'random_uniform', 'random_normal',
         'glorot_uniform', 'he_normal']
    Watch how zeros stays at chance while ALL the random variants train
    fine, with the variance-scaled ones (glorot/he) usually fastest.

Expected output (typical)
  zeros           → loss ≈ 1.10, accuracy ≈ 0.30   (chance)
  random_normal   → loss ≈ 0.20, accuracy ≈ 0.95+  (works)
"""

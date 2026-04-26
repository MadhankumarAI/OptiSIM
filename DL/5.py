from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for bs, name in [(len(Xtr), 'batch_GD'), (32, 'mini_batch_GD'), (1, 'stochastic_GD')]:
    m = Sequential([Dense(16, activation='relu', input_shape=(30,)), Dense(1, activation='sigmoid')])
    m.compile(optimizer='sgd', loss='binary_crossentropy', metrics=['accuracy'])
    m.fit(Xtr, ytr, epochs=50, batch_size=bs, verbose=0)
    print(name, m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Batch size in gradient descent ===

Gradient descent updates weights using a gradient computed from SOME subset
of the training data. The size of that subset is the "batch size", and it
gives three classic flavors:

1. Batch GD (full-batch)         batch_size = N (whole training set)
     - One gradient per epoch, computed over ALL samples.
     - Smooth, exact gradient → very stable but slow progress per epoch.
     - 1 weight update per epoch → needs many epochs to converge.
     - Memory hungry: must hold every sample's activation in memory.
     - Tends to get stuck in saddle points / sharp minima.

2. Stochastic GD (SGD, true)     batch_size = 1
     - One gradient per sample.
     - Extremely noisy estimate of the true gradient.
     - Many updates per epoch → fast wall-clock progress.
     - Noise can HELP escape local minima and saddle points, and often
       improves generalization.
     - Doesn't use vectorized hardware (GPU) efficiently.

3. Mini-batch GD                 batch_size = small constant (32, 64, 128…)
     - One gradient per small batch — average of B sample gradients.
     - Best of both worlds:
         * vectorized → GPU-friendly, fast
         * many updates per epoch → fast progress
         * a little noise → better generalization than full batch
     - The de-facto standard in modern deep learning.

Mental model
  - Full batch  : reads the whole map before taking one careful step. Slow,
                  precise, can miss interesting detours.
  - SGD (1)     : takes a step after every glance at one sample. Fast but
                  drunk-walking.
  - Mini-batch  : takes a step after each room of samples. Brisk and on
                  track.

When to use what
  - Batch GD     : tiny datasets, classical optimization analysis, convex
                   problems where the exact gradient matters. Almost never
                   used in modern deep learning.
  - Mini-batch   : 99% of cases. Default to 32, 64, 128, or 256.
  - SGD (bs=1)   : niche — online learning where samples arrive one at a
                   time. In modern usage, "SGD" almost always means
                   mini-batch SGD.

Picking a batch size
  - Powers of 2 (32 / 64 / 128 / 256) align with GPU memory allocation.
  - Larger batch  → smoother gradient, better hardware utilization, but
                    often WORSE generalization and needs a higher LR.
  - Smaller batch → noisier gradient, often BETTER generalization, slower
                    epoch wall-clock.
  - Linear scaling rule: if you double the batch size, roughly double the
    learning rate to keep the same effective step.
  - Memory-bound? Pick the largest batch that fits in GPU memory.

=== Code notes ===

m = Sequential([Dense(16, activation='relu', input_shape=(30,)),
                Dense(1, activation='sigmoid')])
  - Same model in both runs — only the batch_size changes, so the
    comparison is fair.
  - input_shape=(30,) : 30 features in breast_cancer.
  - Dense(1, 'sigmoid') + binary_crossentropy : binary classification.

The lever
  - m.fit(..., batch_size=bs) — that's where batch vs mini-batch is set.
        batch_size = len(Xtr)  → batch GD (full-batch)
        batch_size = 32        → mini-batch GD
        batch_size = 1         → stochastic GD (very slow)
  - epochs is held at 50 for both, but remember: full-batch makes only
    50 updates total while mini-batch makes ~50 * (455/32) ≈ 700 updates.
    That's WHY mini-batch usually wins this comparison — same time budget,
    far more weight updates.

Pure batch / stochastic from scratch (no Keras shortcut)
  - You'd write a manual training loop with tf.GradientTape and slice the
    data yourself. The Keras batch_size argument already gives you the
    same behavior — no need to reimplement unless you're doing custom
    research code.
"""

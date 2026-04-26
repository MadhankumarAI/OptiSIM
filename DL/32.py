import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from tensorflow.keras.datasets import mnist
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense, Dropout

(x, y), _ = mnist.load_data()
x = x[..., None] / 255.0
x, y = x[:2500], y[:2500]
xtr, xt, ytr, yt = train_test_split(x, y, test_size=0.2, random_state=42)

for d in [0.0, 0.5]:
    m = Sequential([Input(shape=(28, 28, 1)), Conv2D(32, 3, activation='relu'), MaxPooling2D(), Flatten(), Dropout(d), Dense(64, activation='relu'), Dropout(d), Dense(10, activation='softmax')])
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    h = m.fit(xtr, ytr, validation_data=(xt, yt), epochs=20, verbose=0)
    plt.plot(h.history['loss'], label=f'train_d{d}')
    plt.plot(h.history['val_loss'], '--', label=f'val_d{d}')

plt.legend()
plt.xlabel('epoch')
plt.ylabel('loss')
plt.show()


"""
=== Concept: Dropout and Overfitting ===

Overfitting in one sentence
  The model learns the TRAINING set too well — including its noise and
  quirks — and gets WORSE at predicting new data.

How to spot overfitting in a loss plot
  - TRAIN loss   keeps decreasing.
  - VAL   loss   plateaus, then RISES.
  - The growing gap between them is the visual signature of overfitting.

This script forces overfitting on purpose
  - Uses only the first 2000 MNIST images (instead of all 60,000) so the
    network has plenty of capacity to memorize but not enough variety to
    generalize. Without that, MNIST is too easy and you barely see the
    overfitting gap.

What is Dropout?
  - During training, with probability `p`, each unit's output is set to
    ZERO for that forward pass. The remaining units are scaled by
    1/(1-p) so the average signal magnitude stays the same.
  - At test time, dropout is OFF — every unit is used.
  - Effect: the network can't rely on any single neuron, because that
    neuron might be dropped. Forces redundancy and prevents co-adaptation
    of features.
  - Equivalent in spirit to training many smaller subnetworks and
    averaging them — like a built-in ensemble.

How to read this script's plot
  - d=0.0  : "no dropout" baseline.
        train loss → near zero (model memorizes the 2000 examples).
        val loss   → starts dropping, then BENDS UP after ~5-8 epochs.
        Big gap between train and val = classic overfitting.
  - d=0.5  : "with dropout".
        train loss → decreases more slowly, doesn't reach zero.
        val loss   → drops further and stays low; the train-val gap is
                     much smaller.
        Dropout traded a bit of training accuracy for much better
        generalization.

Where to put dropout in a CNN
  - After Dense layers (most common, most impactful). Typical p = 0.5.
  - After Conv layers (use Spatial Dropout: drops whole feature maps,
    not individual pixels — `from tensorflow.keras.layers import
    SpatialDropout2D`). Typical p = 0.1 to 0.25 (smaller because conv
    layers are already regularized by weight sharing).
  - NEVER on the output layer — you want the final logits intact.
  - NEVER between BatchNorm and the next layer — BN already provides
    some regularization, and combining the two can hurt. Standard order:
        Dense → BatchNorm → ReLU → Dropout → next layer.

Choosing the dropout rate
  - p = 0.2-0.3 : light regularization, safe default.
  - p = 0.5     : strong, classic Hinton et al. (2014) recommendation
                  for large fully-connected layers.
  - p > 0.5     : usually too aggressive; the model loses too much
                  capacity.
  - p = 0.0     : no dropout (you might as well delete the layer).

Other anti-overfitting techniques (alternatives or complements)

  Technique           When to use
  ─────────────────────────────────────────────────────────────────────
  Dropout             Default for Dense layers in any architecture.
  L1/L2 weight decay  Add `kernel_regularizer='l2'` to layers; common in
                      tabular nets and when dropout helps too much.
  Data augmentation   FIRST thing to try in image tasks — flips, crops,
                      rotations, color jitter. Often more effective
                      than dropout for vision.
  Early stopping      Stop training when val loss stops improving. Use
                      tf.keras.callbacks.EarlyStopping(patience=3).
  Smaller model       If you can accept lower train accuracy, just use
                      fewer params — directly limits overfitting.
  Batch normalization Provides slight regularization as a side effect.
  Mixup / CutMix      Advanced augmentation that mixes images and
                      labels. Strong regularizer for vision.

Modern practice
  - Vision CNNs:   data augmentation + BatchNorm + light dropout (0.1-0.2).
  - Transformers:  dropout (0.1) on attention + FFN, weight decay (1e-2).
  - Tabular MLPs:  dropout (0.3-0.5) + weight decay.

=== Code notes ===

Xtr, ytr = Xtr[:2000], ytr[:2000]
  - Subsampled training set forces overfitting to be visible. With the
    full 60k MNIST, even an unregularized model generalizes well and the
    train/val gap is barely noticeable.

m = Sequential([
    Input(shape=(28, 28, 1)),
    Conv2D(32, 3, activation='relu'),
    MaxPooling2D(),
    Flatten(),
    Dropout(d),
    Dense(64, activation='relu'),
    Dropout(d),
    Dense(10, activation='softmax'),
])
  - Two Dropout layers, both with rate `d`. Trick: when d=0.0, Dropout
    becomes a no-op, so the SAME architecture cleanly switches between
    "no dropout" and "with dropout" via the loop variable.
  - Dropout placement: after Flatten (the dense classifier head is the
    most overfit-prone part) and between the two dense layers.
  - For dropout BETWEEN conv layers, swap to SpatialDropout2D — but in
    a small CNN like this, regular dropout in the dense head is enough.

h = m.fit(Xtr, ytr, validation_data=(Xte, yte), epochs=20, verbose=0)
  - validation_data=(Xte, yte) — Keras runs forward passes on the test
    set after each epoch. h.history['val_loss'] is the per-epoch
    validation loss curve.
  - 20 epochs is enough to see the d=0.0 model overfit clearly.

How to extend
  - Add early stopping (often the simplest fix to overfitting):
        from tensorflow.keras.callbacks import EarlyStopping
        cb = EarlyStopping(patience=3, restore_best_weights=True)
        m.fit(..., callbacks=[cb])
  - Add data augmentation (the strongest single technique for image
    overfitting):
        from tensorflow.keras.layers import RandomFlip, RandomRotation
        m = Sequential([Input(...), RandomFlip(), RandomRotation(0.1),
                        Conv2D(...), ...])
  - Plot accuracy too: h.history['accuracy'], h.history['val_accuracy'].
  - Try L2 weight decay as an alternative:
        Dense(64, activation='relu', kernel_regularizer='l2')
  - Sweep dropout rates: for d in [0.0, 0.1, 0.3, 0.5, 0.7]:
"""

import numpy as np
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, LSTM, Dense
from tensorflow.keras.optimizers import Adam

y = np.sin(np.linspace(0, 100, 1000))
T = 20
X = np.array([y[i:i+T] for i in range(len(y) - T)])[..., None]
Y = y[T:]

for units in [8, 32, 64]:
    for lr in [1e-2, 1e-3]:
        m = Sequential([Input(shape=(T, 1)), LSTM(units), Dense(1)])
        m.compile(optimizer=Adam(lr), loss='mse')
        h = m.fit(X[:800], Y[:800], validation_data=(X[800:], Y[800:]), epochs=10, verbose=0)
        print(f'units={units:3d} lr={lr:.0e}  val_loss={h.history["val_loss"][-1]:.6f}')


"""
=== Concept: Tuning LSTM Hyperparameters grid search=looping===


import keras_tuner as kt
def build(hp):
    m = Sequential([Input(shape=(T, 1)),
        LSTM(hp.Int('units', 8, 128, step=8)),
        Dense(1)])
    m.compile(optimizer=Adam(hp.Float('lr', 1e-4, 1e-2, sampling='log')), loss='mse')
    return m
tuner = kt.RandomSearch(build, objective='val_loss', max_trials=20)
tuner.search(X[:800], Y[:800], epochs=10, validation_data=(X[800:], Y[800:]))
print(tuner.get_best_hyperparameters()[0].values)


The main hyperparameters that affect an LSTM's quality

  1. units (hidden size)
     - LSTM(8)  : tiny memory, fast, may underfit complex sequences.
     - LSTM(32-128) : typical sweet spot for most tasks.
     - LSTM(256+) : large capacity, slower, overfits without regularization.
     - Rule of thumb: start at 32-64, double if underfitting, halve if
       overfitting.

  2. number of layers (depth)
     - 1 LSTM   : default. Often enough for simple sequences.
     - 2-3 LSTMs: typical for harder problems (NLP, speech).
     - 4+        : rare; vanishing gradients become an issue. Use
                   residual connections or transformers instead.
     - Stacking: all but the last LSTM need return_sequences=True.

  3. learning rate
     - Adam default 1e-3 is the strong baseline.
     - Too HIGH (1e-2+) → loss explodes or oscillates.
     - Too LOW  (1e-5)  → trains painfully slowly, may underfit.
     - For LSTMs, 1e-3 to 1e-4 is the typical good range.

  4. sequence length T
     - Covered in 44.py. Pick to cover 2-5 cycles of the dominant
       pattern in your signal.

  5. batch size
     - 32-128 is the typical default.
     - Bigger → faster per epoch (GPU utilization), but smoother
       gradients → may need higher learning rate.
     - Smaller → noisier gradients, more updates per epoch, often
       better generalization.

  6. dropout / recurrent_dropout
     - dropout=0.2-0.5     : dropout on the input → LSTM connection.
     - recurrent_dropout=0.1-0.3 : dropout on the hidden → hidden
                                    recurrent connection.
     - Use both for strong regularization on small datasets. Typical:
           LSTM(64, dropout=0.2, recurrent_dropout=0.1)

  7. optimizer
     - Adam (default) wins almost always for LSTMs.
     - RMSprop was the historical RNN default — still decent.
     - SGD+momentum needs careful tuning, rarely matches Adam.

  8. activation / recurrent_activation
     - tanh / sigmoid are the original LSTM defaults — don't change
       these unless you know why.

How to tune (the practical hierarchy)

  1. GRID SEARCH (small spaces) — what this script does. Loop over
     a handful of values for 1-2 hyperparameters. Fine for ≤ 20
     configurations.

  2. RANDOM SEARCH (medium spaces) — sample random combinations from
     ranges. Better than grid when most hyperparameters don't matter
     much.

  3. KERAS TUNER / OPTUNA / RAY TUNE (big spaces) — Bayesian
     optimization, Hyperband, ASHA. The right tool when you're
     tuning many hyperparameters seriously.

  4. EARLY STOPPING — always use it. Don't waste time on bad configs.
        from tensorflow.keras.callbacks import EarlyStopping
        cb = EarlyStopping(patience=3, restore_best_weights=True)
        m.fit(..., callbacks=[cb])

The order to tune in (priority)

  1. learning rate  — biggest impact, easy to sweep.
  2. units (width)  — second biggest impact.
  3. dropout        — when overfitting is visible.
  4. batch size     — affects training speed more than final accuracy.
  5. depth          — only deepen if width alone isn't enough.
  6. T (window)     — usually fix from domain knowledge.

Common tuning pitfalls
  - Tuning on the test set → leak. Always use a held-out validation
    split that the final test set never sees.
  - Comparing single runs. RNN training is noisy; average over 3-5
    seeds before declaring a winner.
  - Forgetting to scale features. LSTMs are sensitive to input scale —
    always normalize multivariate inputs.
  - Tuning too many hyperparams at once. Start with 1-2; expand only
    after you know what matters.

What you'll typically see in this script

  units=  8 lr=1e-02  val_loss = 0.0010-0.01    (tiny model, high lr is fine)
  units=  8 lr=1e-03  val_loss = 0.001-0.005    (tiny model, slow LR — slower fit)
  units= 32 lr=1e-02  val_loss = 0.0001-0.0005  (good size, fast LR converges)
  units= 32 lr=1e-03  val_loss = 0.0001-0.001   (typical sweet spot)
  units= 64 lr=1e-02  val_loss = 0.0001-0.005   (more capacity, fast LR may oscillate)
  units= 64 lr=1e-03  val_loss = 0.0001-0.0005  (more capacity but slower convergence)

The exact numbers vary run-to-run because of random init. The pattern
to look for: a U-shape with units, and a sweet-spot lr around 1e-3.

=== Code notes ===

for units in [8, 32, 64]:
    for lr in [1e-2, 1e-3]:
  - Nested loop = 2D grid search. 3 unit sizes × 2 learning rates = 6
    configs. Small enough to run in seconds.
  - To extend: add another loop level for batch_size, T, dropout, etc.
    Cost grows multiplicatively — be careful past ~3 hyperparams.

m = Sequential([Input(shape=(T, 1)), LSTM(units), Dense(1)])
m.compile(optimizer=Adam(lr), loss='mse')
  - Note: Adam(lr) accepts a positional learning_rate. Equivalent to
    Adam(learning_rate=lr).
  - Same architecture across all configs — only `units` and `lr`
    change. Keeps the comparison clean.

How to extend
  - ADD MORE HYPERPARAMS:
        for units in [16, 32, 64]:
            for lr in [1e-3, 1e-4]:
                for drop in [0.0, 0.2]:
                    for layers in [1, 2]:
                        m = Sequential([Input(shape=(T, 1))] +
                            [LSTM(units, return_sequences=(i < layers - 1),
                                  dropout=drop) for i in range(layers)] +
                            [Dense(1)])
                        m.compile(...)
                        ...
  - USE EARLY STOPPING (saves time on bad configs):
        from tensorflow.keras.callbacks import EarlyStopping
        cb = EarlyStopping(monitor='val_loss', patience=3,
                           restore_best_weights=True)
        h = m.fit(..., callbacks=[cb])

  - USE KERAS TUNER (proper hyperparameter search):
        import keras_tuner as kt
        def build(hp):
            m = Sequential([Input(shape=(T, 1)),
                LSTM(hp.Int('units', 8, 128, step=8)),
                Dense(1)])
            m.compile(optimizer=Adam(
                hp.Float('lr', 1e-4, 1e-2, sampling='log')),
                loss='mse')
            return m
        tuner = kt.RandomSearch(build, objective='val_loss',
                                max_trials=20)
        tuner.search(X[:800], Y[:800], epochs=10,
                     validation_data=(X[800:], Y[800:]))
        tuner.get_best_hyperparameters()[0].values
"""

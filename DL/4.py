from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for opt in ['adam', 'nadam']:
    m = Sequential([Dense(32, activation='relu', input_shape=(4,)), Dense(3, activation='softmax')])
    m.compile(optimizer=opt, loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(opt, m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Adam vs Nadam ===

Adam (Adaptive Moment Estimation)
  Combines TWO ideas:
    1. Momentum         — running average of past gradients   (1st moment, m)
    2. RMSProp scaling  — running average of squared gradients (2nd moment, v)

  Update rule:
    m_t = beta1 * m_{t-1} + (1-beta1) * g_t              # momentum term
    v_t = beta2 * v_{t-1} + (1-beta2) * g_t**2           # RMSProp term
    m_hat = m_t / (1 - beta1**t)                         # bias correction
    v_hat = v_t / (1 - beta2**t)
    weight = weight - lr * m_hat / (sqrt(v_hat) + eps)

  Defaults (Keras): lr=0.001, beta_1=0.9, beta_2=0.999, epsilon=1e-7.
  Strong general-purpose default. Works well out-of-the-box on almost
  anything — NLP, vision, tabular.

Nadam (Nesterov-accelerated Adam)
  Adam, but with NESTEROV momentum instead of plain momentum.

  The difference: plain momentum applies the velocity AFTER computing the
  gradient at the current position. Nesterov momentum "looks ahead" — it
  computes the gradient at the projected next position (where momentum is
  already pulling you), giving a more informed step.

  Same hyperparameters as Adam. Drop-in replacement.

How they differ in practice
  - Convergence speed : Nadam is slightly faster (the look-ahead anticipates
                        curvature better).
  - Final accuracy    : Usually within noise of Adam. Sometimes Nadam gives
                        a small (< 1%) boost; sometimes it's flat or worse.
  - Stability         : Both are very robust to lr choice. Adam is the more
                        battle-tested of the two.

When to use which
  - Adam  : your default. Pick it first for any new project.
  - Nadam : try as a drop-in if Adam plateaus. Often helps on RNNs / language
            modeling and on losses with sharp curvature transitions.
  - AdamW : if you're fine-tuning transformers, prefer AdamW (Adam with
            decoupled weight decay) over either of these.

=== Code notes ===

m = Sequential([Dense(32, activation='relu', input_shape=(13,)),
                Dense(3, activation='softmax')])
  - input_shape=(4,) : 4  features
  - Dense(32, 'relu') : one hidden layer; small because the dataset is
    tiny (178 samples).
  - Dense(3, 'softmax') : 3 wine cultivars → 3 output neurons producing a
    probability distribution.

Loss / metric
  - 'sparse_categorical_crossentropy' : labels are integer class IDs
    (0, 1, 2). Use 'categorical_crossentropy' for one-hot labels.
  - 'accuracy' : straight % correct.

The lever
  - for opt in ['adam', 'nadam']: — the only thing that changes between
    runs. Same model, data, loss, epochs → fair head-to-head.
  - To tune either: from tensorflow.keras.optimizers import Adam, Nadam
    Adam(learning_rate=1e-4, beta_1=0.9, beta_2=0.999)
    Nadam(learning_rate=1e-4)
  - To extend the comparison: ['adam', 'nadam', 'adamw'] (AdamW lives in
    tensorflow.keras.optimizers in TF 2.11+).
"""

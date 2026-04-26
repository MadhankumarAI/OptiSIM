import time
import matplotlib.pyplot as plt
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for init in ['zeros', 'random_normal', 'glorot_uniform', 'he_normal']:
    m = Sequential([Dense(64, activation='relu', input_shape=(4,), kernel_initializer=init), Dense(64, activation='relu', kernel_initializer=init), Dense(3, activation='softmax', kernel_initializer=init)])
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    t = time.time()
    h = m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(f"{init:18s} time={time.time()-t:.2f}s  final_loss={h.history['loss'][-1]:.4f}")
    plt.plot(h.history['loss'], label=init)

plt.xlabel('epoch')
plt.ylabel('loss')
plt.legend()
plt.show()


"""
=== Concept: Convergence Speed and Initialization ===

Convergence speed = how quickly training loss drops over epochs (or wall-clock
time) until it plateaus near a minimum. The starting weights set BOTH:
  - where on the loss surface you start, and
  - how strong the gradient signal is in the first few updates.

Why initialization affects speed

  1. The starting loss
     - zeros / tiny random : every input produces nearly the same output →
                              starting loss ≈ ln(num_classes) (chance level).
     - well-scaled random  : outputs vary across inputs → loss starts lower
                              because some predictions are already partially
                              right by luck.

  2. The gradient signal in the first few epochs
     - If activations are too small (vanishing) → gradients are tiny → weights
       barely move → slow descent.
     - If activations are too large (exploding) → gradients blow up → updates
       overshoot → loss bounces around.
     - If variance is well-tuned (Glorot/He) → activations stay near unit
       magnitude → gradients are healthy → fast, smooth descent.

  3. Symmetry
     - zeros : all neurons identical → no learning at all → loss curve is
               a flat horizontal line at chance.

What you'll see in the plot (typical, on this 2-hidden-layer ReLU net)

  zeros            : FLAT line near loss ≈ 1.10. Never decreases.
                     Symmetric init = no learning ever.

  random_normal    : Slow descent. Default stddev=0.05 is too small for a
                     2-layer ReLU net → mild vanishing-gradient effect →
                     loss drops slowly, may not reach a great minimum in
                     50 epochs.

  glorot_uniform   : Fast descent. Variance scaled to layer size, but
                     tuned for tanh/sigmoid (slightly under-scaled for
                     ReLU). Still works well — Adam compensates.

  he_normal        : Fastest descent. Variance specifically tuned for
                     ReLU (2/fan_in). Activations stay healthy through
                     both layers → strong gradient signal from epoch 1.

Order from slowest to fastest:
        zeros (never)  ≪  random_normal  <  glorot_*  ≤  he_*  (for ReLU)

How init effect scales with network depth

  - 1 hidden layer   : all reasonable inits converge in similar time.
                       Differences are tiny because the net isn't deep
                       enough for variance issues to compound.
  - 2-3 hidden layers : gap becomes visible (this script).
  - 5-10 hidden layers : gap becomes huge — naive random_normal often
                          fails to train at all (vanishing gradients),
                          while He still works fine.
  - 20+ hidden layers : you NEED variance-scaled init or you need
                         BatchNorm / residual connections to compensate.
                         This is why He init was introduced (alongside
                         deep ResNets).

The takeaway
  - On shallow networks: init choice barely matters.
  - On deep networks:    init choice can be the difference between training
                          and not training at all.
  - Modern practice: pick He for ReLU, Glorot for tanh/sigmoid, and forget
                     about it. The default Glorot is "good enough" for most
                     things, but matching init to activation function speeds
                     up convergence noticeably.

=== Code notes ===

m = Sequential([
    Dense(64, activation='relu', input_shape=(4,), kernel_initializer=init),
    Dense(64, activation='relu', kernel_initializer=init),
    Dense(3, activation='softmax', kernel_initializer=init),
])
  - TWO hidden layers (not one) — done deliberately. With only one hidden
    layer the init differences are too small to see; with two layers
    the He vs random_normal gap becomes clearly visible.
  - kernel_initializer=init flips on every layer, so the experiment is
    pure (only the init varies).

h = m.fit(...)
plt.plot(h.history['loss'], label=init)
  - h.history['loss'] is the per-epoch training loss list — exactly what
    "convergence speed" means visually.
  - Add validation curves too:
        m.fit(..., validation_split=0.2)
        plt.plot(h.history['val_loss'], '--', label=init+'_val')
  - Add accuracy view:  plt.plot(h.history['accuracy'])

How to extend
  - Plot on a log scale to see slow descent better:
        plt.yscale('log')
  - Make the gap dramatic — increase depth:
        layers = [Dense(64, 'relu', kernel_initializer=init) for _ in range(8)]
        m = Sequential([Dense(64, 'relu', input_shape=(4,),
                              kernel_initializer=init)] + layers +
                       [Dense(3, 'softmax', kernel_initializer=init)])
    On 8+ hidden layers, random_normal will visibly stall while He
    keeps converging.
  - Time the runs: import time; before/after each fit, record time.time().
"""

from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

m = Sequential([Dense(16, activation='relu', input_shape=(4,)), Dense(3, activation='softmax')])
m.compile(optimizer='rmsprop', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(Xtr, ytr, epochs=50, verbose=0)
print(m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: RMSProp ===

RMSProp (Root Mean Square Propagation, Hinton, 2012) is an adaptive optimizer.
It scales each parameter's learning rate by a running average of the SQUARES
of its recent gradients:

    cache = rho * cache + (1 - rho) * gradient**2          (rho ~ 0.9)
    weight = weight - lr * gradient / (sqrt(cache) + eps)

Effect:
  - Parameters with consistently LARGE gradients → cache grows → effective
    learning rate shrinks (so you don't overshoot).
  - Parameters with SMALL/sparse gradients → cache stays small → effective
    learning rate stays high (so they still learn).

How it differs from SGD and Adam
  - vs SGD     : SGD uses one global learning rate for everyone. RMSProp gives
                 each weight its own adaptive scale → much more stable on
                 problems with very different gradient magnitudes per layer.
  - vs Adam    : Adam = RMSProp + momentum (it also tracks a running average
                 of the gradient itself, not just the squared gradient).
                 Practically: Adam ≈ RMSProp with smoother direction.

When to use RMSProp
  - Recurrent nets (RNN / LSTM / GRU) — historically the default; gradients
    in RNNs swing wildly between timesteps and RMSProp's per-parameter scaling
    handles that well.
  - Reinforcement learning (DQN, A3C papers all use RMSProp).
  - Non-stationary objectives (loss landscape changes over time).
  - When Adam underperforms but you still want adaptive scaling.

Default hyperparams (Keras): lr=0.001, rho=0.9, epsilon=1e-7. Usually fine.

=== Classification setup (what changed vs the regression in 1.py) ===

  - Output layer    : Dense(3, activation='softmax') — one neuron PER CLASS,
                      softmax turns logits into a probability distribution
                      that sums to 1. (For 2 classes you can use
                      Dense(1, activation='sigmoid') instead.)
  - Loss            : 'sparse_categorical_crossentropy' — use when labels are
                      integer class IDs (0, 1, 2). Use
                      'categorical_crossentropy' if labels are one-hot
                      ([1,0,0], [0,1,0], ...). Use 'binary_crossentropy' for
                      a single sigmoid output.
  - Metric          : 'accuracy' instead of 'mae' — fraction of correct
                      predictions.

=== Code notes ===

m = Sequential([Dense(16, activation='relu', input_shape=(4,)),
                Dense(3, activation='softmax')])
  - Dense(16, 'relu', input_shape=(4,)) : hidden layer.
      * 4 features in the iris dataset (sepal length/width, petal
        length/width).
      * 16 neurons is plenty — iris is tiny (150 samples, 3 classes).
  - Dense(3, activation='softmax') : output layer.
      * 3 because iris has 3 species (setosa, versicolor, virginica).
      * softmax → outputs sum to 1, so you can read them as
        P(class | input).

m.compile(optimizer='rmsprop', loss='sparse_categorical_crossentropy',
          metrics=['accuracy'])
  - optimizer='rmsprop' is the lever. To tune it:
        from tensorflow.keras.optimizers import RMSprop
        RMSprop(learning_rate=1e-3, rho=0.9)
  - Swap the loss/metric only if you change the label format or task type
    (see "Classification setup" above).
"""

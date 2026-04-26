from sklearn.datasets import load_diabetes
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_diabetes(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for opt in ['sgd', 'adam']:
    m = Sequential([Dense(32, activation='relu', input_shape=(10,)), Dense(1)])
    m.compile(optimizer=opt, loss='mse', metrics=['mae'])
    m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(opt, m.evaluate(Xte, yte, verbose=0))



d=load_diabetes()
print(d.feature_names)

"""
=== Concept: Optimizers ===

An optimizer is the algorithm that decides HOW to update the network's weights
using the gradients from backpropagation. The loss tells you how wrong you are;
the optimizer decides which direction and how big a step to take to reduce it.

SGD (Stochastic Gradient Descent)
  - Plain rule: weight = weight - learning_rate * gradient. Same step size for
    every parameter.
  - Slow, noisy, sensitive to learning rate. Often needs momentum
    (SGD(momentum=0.9)) to stop zig-zagging.
  - Use when: training large CNNs (e.g. ResNet on ImageNet) — SGD+momentum
    often generalizes better than adaptive optimizers, even if it converges
    slower.

Adam (Adaptive Moment Estimation)
  - Keeps a running average of past gradients (1st moment = momentum) AND of
    squared gradients (2nd moment = per-parameter learning rate scaling).
  - Each weight gets its own adaptive learning rate. Converges fast, works well
    out-of-the-box with default lr=0.001.
  - Use when: you want a strong default — NLP, transformers, RNNs, most quick
    experiments. Pick Adam first, switch only if it underperforms.

Other common ones
  - RMSprop  : Adam without momentum (just squared-gradient scaling).
               Classic default for RNNs / LSTMs.
  - Adagrad  : Accumulates ALL past squared gradients → learning rate keeps
               shrinking. Good for sparse features (NLP bag-of-words,
               recommender embeddings).
  - Adadelta : Fixes Adagrad's vanishing learning rate. Rarely used now.
  - Nadam    : Adam + Nesterov momentum (looks one step ahead). Drop-in for
               Adam when you want a tiny boost.
  - AdamW    : Adam with proper decoupled weight decay. Modern transformers /
               fine-tuning (BERT, ViT).

Rule of thumb: Start with Adam (lr=1e-3). If it overfits or plateaus, try
SGD+momentum with a learning-rate schedule. Use AdamW for transformers,
Adagrad/RMSprop for sparse or recurrent setups.

=== Code notes ===

m = Sequential([Dense(32, activation='relu', input_shape=(10,)), Dense(1)])
  - Sequential([...]) : a linear stack of layers; data flows top → bottom.
    Use the functional API instead when you need multi-input/output or skip
    connections.
  - Dense(32, activation='relu', input_shape=(10,)) : the hidden layer.
      * 32 = number of neurons (more = more capacity, more overfit risk).
      * 'relu' = max(0, x). Non-linearity is what lets the network learn
        non-linear patterns; without it stacked Dense layers collapse to a
        single linear function.
      * input_shape=(10,) = diabetes has 10 features. ONLY the first layer
        needs this — later layers infer shape. For California housing it'd
        be (8,), for MNIST flattened it'd be (784,).
  - Dense(1) : output layer, 1 neuron, NO activation.
      * 1 because regression predicts a single number.
      * No activation = linear output, can be any real number. relu would
        clamp negatives to 0, sigmoid would squash to 0–1 — both wrong here.
      * Binary classification → Dense(1, activation='sigmoid').
        Multi-class → Dense(num_classes, activation='softmax').

m.compile(optimizer=opt, loss='mse', metrics=['mae'])
  - This is the only line that changes between SGD and Adam runs — everything
    else (data, model, loss, epochs) is held constant for a fair comparison.
  - To add more optimizers, just extend the loop list:
        for opt in ['sgd', 'adam', 'rmsprop', 'nadam', 'adagrad']:
  - To control the learning rate, swap the string for an instance:
        from tensorflow.keras.optimizers import Adam
        Adam(learning_rate=1e-4)

How to change the architecture
  - Wider : Dense(128, 'relu', input_shape=(10,))
  - Deeper: Sequential([Dense(64, 'relu', input_shape=(10,)),
                        Dense(32, 'relu'),
                        Dense(1)])
  - Other activations: 'tanh', 'elu', 'gelu' — try if ReLU underperforms.
  - Regularize: Dense(32, 'relu', kernel_regularizer='l2', input_shape=(10,))
                or insert Dropout(0.2) between Dense layers.
"""

from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense
from tensorflow.keras.optimizers import SGD

X, y = load_breast_cancer(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

m = Sequential([Dense(1, activation='sigmoid', input_shape=(30,))])
m.compile(optimizer=SGD(learning_rate=0.01, momentum=0.9), loss='binary_crossentropy', metrics=['accuracy'])
m.fit(Xtr, ytr, epochs=50, verbose=0)
print(m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Logistic Regression (as a neural net) ===

Logistic regression = the simplest possible neural network:
    ONE Dense layer, ONE neuron, SIGMOID activation, BINARY CROSSENTROPY loss.

    p = sigmoid(W·x + b)        # probability of class 1
    loss = -[y*log(p) + (1-y)*log(1-p)]

No hidden layer, no non-linearity in the middle. Equivalent to the classic
statistical logistic regression model — it just happens to be trained with
gradient descent here instead of an iterative reweighted least squares solver.

Use it when:
  - The decision boundary is approximately linear in the features.
  - You want a fast, interpretable baseline before trying deeper models.
  - For multi-class: switch to Dense(num_classes, activation='softmax') with
    categorical crossentropy — that's "softmax regression" / "multinomial
    logistic regression".

=== Concept: Momentum ===

Plain SGD only looks at the CURRENT gradient. It zig-zags down narrow valleys
and crawls along flat plateaus. Momentum fixes this by keeping a velocity
vector that accumulates past gradients:

    velocity = momentum * velocity - lr * gradient
    weight   = weight + velocity

Think of it as a ball rolling downhill — it builds up speed in the direction
of consistent gradient, and oscillations in irrelevant directions cancel out.

Effects:
  - Faster convergence along persistent directions.
  - Damps oscillations across narrow valleys (the classic SGD pain point).
  - Helps escape small local minima / saddle points by carrying through them.

Typical value: momentum = 0.9 (sometimes 0.95 or 0.99 for very smooth losses).
0 = plain SGD. >1 = unstable.

Nesterov momentum (nesterov=True): "look-ahead" variant — compute the
gradient at the position you'd be in AFTER applying the current velocity,
not at where you currently are. Slightly better in most cases, drop-in:
    SGD(learning_rate=0.01, momentum=0.9, nesterov=True)

When to use SGD+momentum vs Adam:
  - SGD+momentum often generalizes BETTER on large vision models (ResNet,
    EfficientNet on ImageNet) — final test accuracy beats Adam.
  - But it needs a learning-rate schedule (step decay, cosine) and more
    tuning. Adam works out-of-the-box.
  - Practical rule: prototype with Adam, switch to SGD+momentum if you're
    chasing the last few % of accuracy on a big model.

=== Code notes ===

m = Sequential([Dense(1, activation='sigmoid', input_shape=(30,))])
  - Just ONE Dense layer — that's what makes it "logistic regression"
    rather than a deep network. Adding a hidden layer would turn it into
    a 1-hidden-layer MLP.
  - input_shape=(30,) : breast_cancer has 30 features per sample.
  - Dense(1, activation='sigmoid') : 1 output neuron squashed to (0, 1) =
    probability of the positive class (malignant vs benign).

m.compile(optimizer=SGD(learning_rate=0.01, momentum=0.9),
          loss='binary_crossentropy', metrics=['accuracy'])
  - The lever: SGD(learning_rate=0.01, momentum=0.9). To use Nesterov:
        SGD(learning_rate=0.01, momentum=0.9, nesterov=True)
    To turn momentum off (plain SGD): drop the momentum kwarg.
  - loss='binary_crossentropy' is REQUIRED for sigmoid + 0/1 labels — this
    is the "logistic" loss. mse here would still train but converges much
    slower and gives worse probability calibration.

Practical tip (not in this minimal code):
  - For real use, scale the features first (StandardScaler from sklearn).
    Breast-cancer features have very different magnitudes (areas in
    hundreds, concavity in 0.x), and gradient descent converges much
    faster on standardized inputs. Skipped here to keep the code minimal.
"""

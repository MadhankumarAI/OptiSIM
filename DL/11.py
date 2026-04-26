from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_iris(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for init in ['zeros', 'glorot_uniform']:
    print("\nInitializer:", init)

    m = Sequential([
        Dense(64, activation='relu', input_shape=(4,), kernel_initializer=init),
        Dense(3, activation='softmax', kernel_initializer=init)
    ])

    for i, layer in enumerate(m.layers):
        weights, bias = layer.get_weights()
        print(f"\nLayer {i} weights:\n", weights)
        print(f"Layer {i} bias:\n", bias)
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(init, m.evaluate(Xte, yte, verbose=0))


"""
=== Concept: Weight Initialization ===

When a network is created, every weight needs a starting value. That starting
value matters far more than people expect — it controls TWO things:

  1. Symmetry breaking
     If every weight in a layer starts equal (e.g. all zeros), then every
     neuron in that layer:
         - sees the same input
         - computes the same output
         - receives the same gradient
         - therefore updates by the same amount
     They stay identical forever. The layer behaves as if it had ONE neuron.
     A 16-unit hidden layer with zero init has the capacity of a 1-unit
     layer.

  2. Signal magnitude through layers
     If weights start too LARGE → activations blow up exponentially through
     depth → exploding gradients.
     If weights start too SMALL → activations shrink to zero through depth
     → vanishing gradients (the network can't learn).
     Good initializers pick a variance that keeps activations roughly
     unit-scale across layers.

What "zeros" does to this network
  - Hidden layer Dense(16, 'relu', kernel_initializer='zeros'):
      * All 16 neurons compute relu(0·x + 0) = 0.
      * Their input-side gradients are identical → they update in lockstep.
  - Output layer Dense(3, 'softmax', kernel_initializer='zeros'):
      * Every class logit is 0 → softmax outputs (1/3, 1/3, 1/3) regardless
        of input.
      * Bias terms (still default-zero) get tiny class-frequency updates,
        but the kernel never differentiates between inputs.
  - Result: accuracy stuck near 1 / num_classes ≈ 33% on iris.
  - Compare against 'glorot_uniform' (Keras default) — accuracy jumps to
    ~95-100%.

Common initializers and when to use them
  - zeros          : NEVER for weights. Fine for biases.
  - random_normal  : random_normal(stddev=0.01) — historical, easy to
                     misconfigure (too small → vanishing, too large →
                     exploding).
  - glorot_uniform : Var = 2 / (fan_in + fan_out). Default in Keras Dense.
                     Best paired with TANH or SIGMOID activations.
  - he_normal /
    he_uniform     : Var = 2 / fan_in. Designed for RELU and its variants
                     (LeakyReLU, ELU). Use this when your hidden layers
                     are ReLU.
  - lecun_normal   : Var = 1 / fan_in. For SELU activations
                     (self-normalizing nets).
  - orthogonal     : For RECURRENT weights in RNN/LSTM/GRU layers — keeps
                     gradients stable through long timesteps.

Picking quickly
  - Activation = ReLU / LeakyReLU / ELU       → he_normal or he_uniform
  - Activation = tanh / sigmoid               → glorot_uniform / glorot_normal
  - Activation = SELU                         → lecun_normal
  - RNN / LSTM / GRU recurrent kernel         → orthogonal
  - Biases                                    → zeros (almost always)

Why biases CAN start at zero
  - Each bias is added to exactly one neuron, so different biases don't
    create symmetry. Symmetry only happens when MANY neurons share the
    same weights to the same inputs — which is the kernel, not the bias.

=== Code notes ===

m = Sequential([Dense(16, activation='relu', input_shape=(4,),
                      kernel_initializer=init),
                Dense(3, activation='softmax',
                      kernel_initializer=init)])
  - kernel_initializer=init is the lever. It sets the starting values of
    the WEIGHT MATRIX (not the bias). To set bias init too:
        Dense(16, ..., kernel_initializer='zeros',
                       bias_initializer='zeros')
  - You can pass either a string ('zeros', 'he_normal', ...) or an
    instance: from tensorflow.keras.initializers import HeNormal
              HeNormal(seed=0)

The lever
  - for init in ['zeros', 'glorot_uniform']: — same model and optimizer,
    only the initializer changes, so any accuracy gap is purely the
    initialization effect.
  - To extend the comparison:
        ['zeros', 'random_normal', 'glorot_uniform', 'he_normal']

Expected output (typical)
  zeros            → loss ≈ 1.10, accuracy ≈ 0.30   (random chance)
  glorot_uniform   → loss ≈ 0.10, accuracy ≈ 0.97   (works fine)
"""



import time
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
x,y=load_breast_cancer(return_X_y=True)
xtr,xte,ytr,yte=train_test_split(x,y,test_size=0.2,random_state=42)
for init in ['zeros','glorot_uniform']:
  print(init)
  m=Sequential([Dense(32,activation='sigmoid',input_shape=(30,),kernel_initializer=init),Dense(1,activation='sigmoid',kernel_initializer=init)])
  for i,j in enumerate(m.layers):
    w,b=j.get_weights()
    print(w)

  m.compile(loss='binary_crossentropy',metrics=['accuracy'])
  m.fit(xtr,ytr,verbose=0)
  print(m.evaluate(xte,yte,verbose=0))
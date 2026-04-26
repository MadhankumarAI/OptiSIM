from sklearn.model_selection import train_test_split
from tensorflow.keras.datasets import mnist
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense

(x, y), _ = mnist.load_data()
x = x[..., None] / 255.0
xtr, xt, ytr, yt = train_test_split(x[:5000], y[:5000], test_size=0.2, random_state=42)

m1 = [Input(shape=(28, 28, 1)), Conv2D(8, 3, activation='relu'), MaxPooling2D(), Flatten(), Dense(10, activation='softmax')]
m2 = [Input(shape=(28, 28, 1)), Conv2D(8, 3, activation='relu'), Conv2D(8, 3, activation='relu'), MaxPooling2D(), Conv2D(8, 3, activation='relu'), Flatten(), Dense(10, activation='softmax')]

for name, layers in [('shallow', m1), ('deep', m2)]:
    m = Sequential(layers)
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    h = m.fit(xtr, ytr, validation_data=(xt, yt), verbose=0)
    print(f"{name} acc={h.history['val_accuracy'][-1]:.4f} param={m.count_params()}")



""" print(m.summary()) prints param,  use padding = same to keep the params high in deep 
=== Concept: Shallow vs Deep CNN Architectures ===

The depth of a CNN = number of stacked conv (and dense) layers between
input and output. "Shallow" usually means 1-3 conv layers; "deep" means
anywhere from 5 to 100+.

Why depth helps (the four big reasons)

  1. Hierarchical feature composition
     - Layer 1 detects edges.
     - Layer 2 combines edges into corners and short curves.
     - Layer 3 combines those into textures and small shapes.
     - Layer 4+ combines textures into object parts, then whole objects.
     - You CAN'T detect a "face" with a single 3x3 kernel — you need a
       hierarchy. Each level builds on the abstractions below it.

  2. Receptive field grows
     - Each conv layer with kernel=3 expands the receptive field by 2.
     - 1 layer  → each output pixel sees a 3x3 input region.
     - 5 layers → each output pixel sees a ~11x11 input region.
     - With pooling, this grows even faster (each pool doubles the
       receptive field).
     - Deep nets can "see" larger context per output without giant
       kernels.

  3. Parameter efficiency
     - Two stacked 3x3 convs (18 params) cover the same receptive field
       as one 5x5 conv (25 params), but with more non-linearities → more
       expressive.
     - Three stacked 3x3 convs ≈ one 7x7 conv (27 vs 49 params).
     - This is why VGG / ResNet stack many small kernels.

  4. More non-linearities = more expressive
     - Each layer adds a ReLU. With more ReLUs you can carve more
       complex decision boundaries through input space.
     - A shallow net is closer to a polynomial; a deep net is closer
       to "any function" (universal approximation, with caveats).

What you'll see in this script

  shallow  : ~50K params,  val_acc ≈ 0.88-0.90 after 5 epochs.
  deep     : ~300K params, val_acc ≈ 0.91-0.93 after 5 epochs.

  - Deep wins on Fashion-MNIST because the dataset has more visual
    complexity (textures, shapes) than digits.
  - On plain MNIST the difference is much smaller (digits are simple
    enough that one conv layer almost suffices).

The cost of depth (it's not free)

  - More compute per forward pass — each layer does work.
  - More parameters → more memory, longer training, easier to overfit
    (especially without dropout / augmentation).
  - Vanishing / exploding gradients — gradients shrink (or blow up)
    multiplicatively as they backprop through many layers.
  - Harder to train — needs proper init (He), normalization (BatchNorm),
    and sometimes residual / skip connections to stay trainable.

When deeper STOPS helping (the "ResNet problem")
  - Empirically, plain VGG-style stacks degrade past ~20 layers — train
    AND val accuracy both drop, even with infinite data. Not overfitting
    — it's a TRAINING failure (gradient signal can't reach early layers).
  - ResNet (2015) fixed this by adding "skip connections":
        x → Conv → Conv → +x → next layer
    The +x lets gradients bypass the conv block, so 50, 100, 1000-layer
    networks become trainable. Modern architectures (ResNet, DenseNet,
    Transformers) all use some form of skip connection.

When to choose shallow vs deep

  Go SHALLOW when:
    - Small dataset (deep nets memorize easily).
    - Simple task (MNIST, sentiment with bag-of-words).
    - You need a fast / mobile model.
    - You don't have GPU compute.

  Go DEEP when:
    - Complex visual data (CIFAR-10, ImageNet, faces, medical images).
    - Lots of training data.
    - You can afford GPU time and use BatchNorm + skip connections.
    - State-of-the-art accuracy matters more than latency.

Architecture progression (historical landmarks)

  LeNet-5   (1998) :  2 conv + 2 FC                ← shallow
  AlexNet   (2012) :  5 conv + 3 FC                ← deep
  VGG-16    (2014) :  13 conv + 3 FC               ← deeper, all 3x3
  GoogLeNet (2014) :  22 layers, inception modules ← width + depth
  ResNet    (2015) :  18 / 50 / 152 layers + skips ← arbitrary depth
  DenseNet  (2017) :  every layer connected to every other
  EfficientNet (2019) :  systematic depth/width/resolution scaling

Modern picture: depth is one of THREE knobs (depth, width, input
resolution) — you scale all three together for best accuracy/compute
trade-off (EfficientNet's "compound scaling").

=== Code notes ===

shallow = [Input(...), Conv2D(32, 3, 'relu'), MaxPool, Flatten, Dense(10, softmax)]
  - 1 conv layer, ~50K params (mostly from Flatten → Dense head).

deep = [Input(...),
        Conv2D(32, 3, same, relu) x2, MaxPool,
        Conv2D(64, 3, same, relu) x2, MaxPool,
        Flatten, Dense(64, relu), Dense(10, softmax)]
  - 4 conv layers in two "blocks" + a Dense hidden layer.
  - padding='same' keeps spatial size constant within a block; pool
    halves it between blocks. Filter count doubles per block — classic
    pattern (32 → 64).
  - ~300K params, more receptive field, more abstraction depth.

m.count_params()
  - Quick sanity check: shows the total trainable param count. Useful
    to ensure your "deep" model is actually bigger AND that the gain
    isn't just from extra Dense head capacity.

How to extend
  - Try DEEPER (3 blocks of 3 convs each, like a tiny VGG):
        Conv x3, MaxPool, Conv x3, MaxPool, Conv x3, MaxPool, Dense.
    Watch how it overfits without dropout / augmentation.
  - Try BatchNorm to stabilize the deep net:
        Conv2D → BatchNormalization → Activation('relu')
  - Add skip connections (mini-ResNet) for >10 layers:
        from tensorflow.keras import Model
        from tensorflow.keras.layers import add
        # functional API; can't be done cleanly with Sequential.
  - Run on CIFAR-10 (32x32x3) — depth gap will be much wider:
        from tensorflow.keras.datasets import cifar10
"""

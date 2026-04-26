import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from tensorflow.keras.datasets import mnist
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, AveragePooling2D, Flatten, Dense

(x, y), _ = mnist.load_data()
x = x[..., None] / 255.0
xtr, xt, ytr, yt = train_test_split(x[:5000], y[:5000], test_size=0.2, random_state=42)

for pool in [MaxPooling2D, AveragePooling2D]:
    m = Sequential([Input(shape=(28, 28, 1)), Conv2D(16, 3, activation='relu'), pool(pool_size=2), Flatten(), Dense(10, activation='softmax')])
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    h = m.fit(xtr, ytr, validation_data=(xt, yt), epochs=10, verbose=0)
    plt.plot(h.history['val_accuracy'], label=pool)

plt.legend()
plt.xlabel('epoch')
plt.ylabel('val_accuracy')
plt.show()


"""
=== Concept: Max Pooling vs Average Pooling ===

Pooling = downsampling a feature map by combining each non-overlapping
window of pixels into a single value. The default window is 2x2 with
stride 2 → output is half the size in each spatial dimension (1/4 the
total pixels).

  Input 4x4:                    After 2x2 MaxPool:
   [1 3 | 2 5]                   [3 5]
   [2 1 | 1 4]                   [7 8]
   ─────┼─────         →
   [4 6 | 7 8]
   [7 2 | 3 1]

  After 2x2 AveragePool:
   [(1+3+2+1)/4  (2+5+1+4)/4]    [1.75  3.0 ]
   [(4+6+7+2)/4  (7+8+3+1)/4] →  [4.75  4.75]

Same window, different reduction:
  - MAX  : keep the strongest activation in each window.
  - AVG  : keep the average activation in each window.

What each one means semantically

  Max pooling
    - "Was this feature present anywhere in this 2x2 patch?"
    - Keeps the LOUDEST signal, throws away the quieter ones.
    - Good when a feature's mere PRESENCE matters more than its
      magnitude (edge detected vs no edge).
    - Slight translation invariance — small shifts of the input still
      produce the same output if the feature falls in the same window.
    - The classic CNN choice (LeNet, AlexNet, VGG all use max pool).

  Average pooling
    - "How strong is this feature on average in this patch?"
    - Smooths the feature map — preserves overall magnitude information.
    - Less aggressive: doesn't drop information, just blurs it.
    - Better when the AVERAGE response matters (texture analysis,
      global context).
    - Modern global average pooling (GAP) replaced FC layers in ResNet,
      Inception, MobileNet — see "Global pooling" below.

Differences in practice
  - Sharpness: max preserves crisp edges; avg blurs them.
  - Sparsity:  max produces sparser outputs (most values come from
              isolated peaks); avg produces denser outputs.
  - Gradient flow: max only sends gradient back through the winning
                   neuron in each window; avg distributes gradient
                   evenly across all 4 neurons.
  - Performance: max usually wins on classification tasks (people care
                about WHETHER a feature is present, not its average).
                On this script, MaxPool typically beats AvgPool by 1-2%
                val accuracy.

When to use which

  Use MAX pooling when:
    - Image classification (default choice for nearly all CNNs).
    - You want to detect WHETHER a feature appears.
    - Translation invariance is important.

  Use AVERAGE pooling when:
    - You want to preserve global/contextual information.
    - Smooth gradients are important (e.g. when training is unstable).
    - As GLOBAL average pooling at the end of a network (see below).

Global Pooling — the modern replacement for Flatten + Dense
  - GlobalMaxPooling2D / GlobalAveragePooling2D collapse the entire
    spatial dimension to ONE value per channel:
        input  : (batch, H, W, C)
        output : (batch, C)
  - Used at the end of modern CNNs (ResNet, EfficientNet, MobileNet)
    instead of Flatten + Dense, because:
        * fewer parameters (no big FC layer)
        * works on any input size (FC requires fixed shape)
        * less overfitting
  - Almost always GlobalAveragePooling2D ("GAP"), not Global Max.
  - Drop-in replacement: replace Flatten → Dense(num_classes) with
        GlobalAveragePooling2D() → Dense(num_classes).

Strided convolutions as an alternative to pooling
  - Conv2D(filters, kernel_size, strides=2) downsamples in the same
    way that pooling does, but with LEARNABLE weights instead of a
    fixed max/avg op.
  - Modern architectures (ResNet, EfficientNet) often use strided
    conv instead of MaxPool because the downsampling itself can adapt
    to the data.
  - Tradeoff: strided conv has more parameters; pooling has zero.

Other pool variants
  - GlobalMaxPooling2D     : max across the whole feature map (rarely
                             used; GAP is usually better).
  - GlobalAveragePooling2D : the modern default at the head of CNNs.
  - LpPool                 : generalized pool with Lp norm (p=∞ → max,
                             p=1 → avg up to scaling). Rarely used.
  - Stochastic pooling     : pick a value from each window weighted by
                             magnitude. Adds noise / regularization.
                             Rarely used today.

=== Code notes ===

for pool in [MaxPooling2D, AveragePooling2D]:
    m = Sequential([..., pool(), ...])
  - Pass the LAYER CLASS itself (not an instance) into the loop, then
    instantiate inside the model definition with pool().
  - Same architecture across runs → only the pool type differs → fair
    A/B comparison.
  - Default window is (2, 2) with stride 2 — produces 14x14 output from
    a 28x28 input.

Conv2D(16, 3, activation='relu') + pool() + Flatten() + Dense(10, softmax)
  - Tiny CNN — one conv block, one classifier head. Just enough to
    show that the pooling choice affects accuracy.

How to extend
  - Try it on a harder dataset (CIFAR-10) where the difference is more
    pronounced — vision tasks with complex features benefit more from
    max pooling's "presence" semantics.
  - Visualize the effect on a feature map directly:
        from tensorflow.image import extract_patches
        # pick a feature map, pool with both, plot side by side.
  - Try strided convolution instead:
        Conv2D(16, 3, strides=2, activation='relu')   # no pool layer
    Compare its accuracy curve to MaxPool.
  - Replace Flatten + Dense with GlobalAveragePooling2D + Dense:
        from tensorflow.keras.layers import GlobalAveragePooling2D
        Sequential([..., Conv2D(16, 3, activation='relu'),
                    GlobalAveragePooling2D(), Dense(10, softmax)])
    Smaller model, similar accuracy, less overfitting.
"""

import matplotlib.pyplot as plt
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense
from tensorflow.keras.datasets import mnist

(X, y), _ = mnist.load_data()
X = X[..., None] / 255.0

m = Sequential([Input(shape=(28, 28, 1)), Conv2D(8, 3, activation='relu'), MaxPooling2D(), Flatten(), Dense(10, activation='softmax')])
m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(X, y, epochs=3, verbose=0)

W = m.layers[0].get_weights()[0]

fig, axes = plt.subplots(1, 8, figsize=(12, 2))
for i in range(8):
    axes[i].imshow(W[:, :, 0, i], cmap='gray')
    axes[i].set_title(f'k{i}')
    axes[i].axis('off')
plt.show()


"""
=== Concept: Visualizing Learned Filters (Kernels) ===

In Q26 we visualized FEATURE MAPS — the OUTPUTS of conv layers. In this
script we visualize the FILTERS themselves — the actual 3x3 weight
matrices that the network learned during training.

Feature maps vs filters (the distinction)

  Filter (kernel)      = the 3x3 weight matrix. Static. Same for every
                         input image. This is what you train.
  Feature map          = the output produced by sliding that filter over
                         a specific input image. Different per image.

  Filter is the QUESTION ("Is there a vertical edge here?").
  Feature map is the ANSWER for one specific image.

Where the weights live in Keras
  - For a Conv2D(num_filters, kernel_size) layer:
        W = layer.get_weights()[0]
        # shape: (kh, kw, in_channels, out_channels)
  - For Conv2D(8, 3) with grayscale input:
        W.shape == (3, 3, 1, 8)
        W[:, :, 0, i] is the i-th filter (a 3x3 matrix).

What you'll see in this script (after training)
  - 8 tiny 3x3 grayscale patches, one per filter.
  - Bright pixels = positive weights, dark pixels = negative weights.
  - Recognizable patterns:
        * vertical-edge detector       (bright column on one side)
        * horizontal-edge detector     (bright row on one side)
        * diagonal-edge detectors
        * "blob" / averaging filters   (mostly uniform)
        * Laplacian-like center-vs-surround patterns
  - This is the network INDEPENDENTLY rediscovering Sobel-like kernels
    that we hand-coded back in Q24. No one told it to — gradient
    descent converged to those patterns because they're useful for
    recognizing digits.

What untrained filters look like (try it)
  - If you skip m.fit() and just plot the weights, you'll see RANDOM
    noise — that's the Glorot-uniform initial state.
  - The DIFFERENCE between random init and trained weights IS what the
    learning process did, made visible.

Why filters in deep layers are harder to visualize
  - 1st conv layer: filter is (3, 3, 1, N). The "1" means it operates
    on raw image channels, so each filter is just a (3, 3) image —
    directly viewable.
  - 2nd conv layer: filter is (3, 3, in_channels=N, out_channels=M).
    Now each filter has DEPTH (one 3x3 slice per input channel) — you
    can't just imshow a 3D tensor.
  - For deeper layers, people use:
        * Activation maximization — synthesize an input image that
          maximizes a particular filter's response (Olah et al., 2017).
        * Guided backprop — show which input pixels most contributed to
          a filter's activation.
        * Saliency maps — gradient of output with respect to input.
  - These are all in libraries like keras-vis, captum, or tf-explain.

Why this matters
  - SANITY CHECK: if your filters all look like noise after training,
    something's wrong (bad init, learning rate too high, dead ReLUs,
    not enough training).
  - INTUITION: helps you trust that the CNN is learning meaningful
    features, not just memorizing.
  - INTERPRETABILITY: the foundation of explainable AI for vision.
  - PEDAGOGY: connects the abstract idea of "learned features" to
    visible, concrete patterns.

Common pitfalls when interpreting filter visualizations
  - The filter is what the network LOOKS FOR — in the input it tries to
    detect that pattern via correlation. So a "bright column on the
    right" filter activates when the input has a bright column on the
    right.
  - But the visualization is in raw weight space, NOT image space.
    Filter values can range from negative to positive; matplotlib auto-
    scales, so what looks "bright" is really just "the most positive
    value in this filter".
  - Filters from later layers don't look like images at all because they
    operate on feature-map space, not pixel space.

=== Code notes ===

W = m.layers[0].get_weights()[0]
  - layers[0] is the first Conv2D (the only one whose kernels are
    directly viewable as 2D images).
  - get_weights() returns [kernel, bias]. We take [0] for the kernel.
  - Resulting shape: (3, 3, 1, 8) → kh=3, kw=3, in_channels=1,
    out_channels=8.

W[:, :, 0, i]
  - All 3x3 spatial weights for filter i, looking at input channel 0.
  - Plot directly with imshow — it's just a 3x3 grayscale image.

m.fit(X, y, epochs=3, verbose=0)
  - 3 epochs is enough to see clear filter structure on MNIST. More
    epochs make the patterns sharper but the basic structure shows up
    fast.

How to extend
  - Compare BEFORE and AFTER training:
        m_init = Sequential([...])  # don't fit
        W_init = m_init.layers[0].get_weights()[0]
        m_init.fit(...)
        W_trained = m_init.layers[0].get_weights()[0]
        plot both side by side.
  - Visualize a deeper conv layer's filters as composite images:
        W2 = m.layers[2].get_weights()[0]   # shape (3,3,8,16)
        # average across input channels for a viewable summary
        for i in range(16):
            plt.imshow(W2[:, :, :, i].mean(axis=-1), cmap='gray')
  - Try with VGG16 (real-world example):
        from tensorflow.keras.applications import VGG16
        vgg = VGG16(weights='imagenet')
        W = vgg.get_layer('block1_conv1').get_weights()[0]  # (3,3,3,64)
        for i in range(8):
            plt.imshow(W[:, :, :, i])  # RGB filter, 3 input channels
    The first-layer filters of VGG16 look like classic edge detectors,
    Gabor patterns, and color-blob detectors — visible directly.
"""

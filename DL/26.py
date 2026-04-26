import matplotlib.pyplot as plt
from tensorflow.keras.datasets import mnist
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense

(X, y), _ = mnist.load_data()
X = X[..., None] / 255.0

m = Sequential([Input(shape=(28, 28, 1)), Conv2D(8, 3, activation='relu'), MaxPooling2D(), Conv2D(8, 3, activation='relu'), Flatten(), Dense(10, activation='softmax')])
m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
m.fit(X, y, epochs=2, verbose=0)

x = X[:1]
maps = []
for ly in m.layers:
    x = ly(x)
    if isinstance(ly, Conv2D):
        maps.append(x)

fig, axes = plt.subplots(2, 8, figsize=(16, 4))
for i in range(8):
    axes[0, i].imshow(maps[0][0, :, :, i], cmap='gray')
    axes[1, i].imshow(maps[1][0, :, :, i], cmap='gray')
plt.show()


"""
=== Concept: Visualizing Feature Maps from Real Conv Layers ===

In Q24 we hand-coded 8 kernels and visualized 8 feature maps. This script
does the same thing, except the kernels are now LEARNED by a real CNN
trained on MNIST. You see what the network ACTUALLY converges to.

What is a feature map?
  - The output of one filter inside a conv layer.
  - For Conv2D(8, (3, 3)) → 8 filters → 8 feature maps stacked along
    the channel axis.
  - Each map = "where in the input is this particular feature present?"
    Bright = strong response, dark = weak / no response.

How to grab feature maps in Keras (the sub-model trick)

    conv_outs = [l.output for l in m.layers if isinstance(l, Conv2D)]
    extractor = Model(inputs=m.input, outputs=conv_outs)
    maps = extractor(img)

  - Build a NEW model that shares the original's layers but exposes each
    conv layer's output as one of its outputs.
  - Calling extractor(img) returns a LIST: maps[0] is layer-1 output,
    maps[1] is layer-2 output, etc.
  - No retraining — same weights, just different output points.
  - Shape of each output: (batch, H, W, num_filters).

What you'll typically see

  Layer 1 (8 filters, 28x28 spatial size — close to input)
    - You'll recognize the digit clearly in most maps.
    - Different maps respond to different LOW-LEVEL features:
        * one filter brightens vertical strokes
        * another brightens horizontal/diagonal strokes
        * another brightens curved edges
        * one or two might look almost like the original (blob/identity)
    - These are essentially Sobel-like / Gabor-like edge detectors,
      learned automatically — exactly the patterns we hand-coded in 24.py.

  Layer 2 (16 filters, 14x14 spatial size — after one MaxPool)
    - Spatial size halved by pooling → coarser maps.
    - Each map combines patterns from Layer 1 → it responds to
      COMPOUND features:
        * combinations of edges (corners, junctions)
        * specific stroke shapes (a curved-bottom + vertical-stroke combo)
    - Less recognizable as "the digit" — more abstract.
    - The deeper you go, the more abstract and class-specific the maps
      become.

The hierarchy in one sentence
  - Early layers detect EDGES.
  - Middle layers detect TEXTURES / CORNERS / SHAPE FRAGMENTS.
  - Deep layers detect OBJECT PARTS or whole objects.
  - This is true for any CNN — MNIST-tiny or ResNet-huge — only the
    complexity changes.

Why visualizing feature maps is useful
  - DEBUGGING       : if all feature maps look identical, your filters
                       collapsed (init or training problem).
  - INTERPRETATION  : you can see WHY a model classified an image a
                       certain way — which features lit up.
  - TRANSFER LEARNING : confirms early layers learn generic edges
                        (reusable across tasks) while deep layers learn
                        task-specific features (need to retrain).
  - ADVERSARIAL ANALYSIS : compare feature maps for an original image vs.
                            an adversarial perturbation — reveals where
                            the network was fooled.

Untrained vs trained (try it!)
  - If you skip m.fit() and just run extractor on a random-init model,
    feature maps look like noise — random kernels = random responses.
  - After training, kernels organize into recognizable detectors.
  - The DIFFERENCE between random and trained maps IS what training did.

=== Code notes ===

m = Sequential([
    Conv2D(8, (3, 3), activation='relu', padding='same', input_shape=(28, 28, 1)),
    MaxPooling2D(),
    Conv2D(16, (3, 3), activation='relu', padding='same'),
    MaxPooling2D(),
    Flatten(),
    Dense(10, activation='softmax'),
])
  - A minimal CNN: two conv blocks (Conv → Pool) then a classifier.
  - padding='same' keeps spatial size the same after each Conv2D so the
    feature maps don't shrink unexpectedly. Pooling does the shrinking.
  - input_shape=(28, 28, 1) — MNIST is 28x28 grayscale, 1 channel.
  - Filters: 8 in layer 1, 16 in layer 2 (typical CNN doubling pattern).

m.fit(Xtr, ytr, epochs=2, verbose=0)
  - Just 2 epochs is enough to make the difference between random and
    trained kernels obvious. For a clearer demo, bump to 5-10 epochs.

conv_outs = [l.output for l in m.layers if isinstance(l, Conv2D)]
extractor = Model(inputs=m.input, outputs=conv_outs)
maps = extractor(img)
  - This is the "feature extractor" pattern in Keras. Works on any
    pretrained model (VGG, ResNet, MobileNet) — just import the model
    and grab the layer outputs you want.
  - Common variant: name the layer and grab by name:
        extractor = Model(inputs=m.input,
                          outputs=m.get_layer('conv1').output)

How to extend
  - Show ALL 16 maps from layer 2:
        fig, axes = plt.subplots(2, 8, figsize=(16, 4))
        for i in range(16):
            axes.flat[i].imshow(maps[1][0, :, :, i], cmap='gray')
  - Try with a deeper, pretrained model:
        from tensorflow.keras.applications import VGG16
        from tensorflow.keras.applications.vgg16 import preprocess_input
        vgg = VGG16(weights='imagenet')
        layer_names = ['block1_conv1', 'block3_conv1', 'block5_conv1']
        outs = [vgg.get_layer(n).output for n in layer_names]
        extractor = Model(inputs=vgg.input, outputs=outs)
    Compare block1 (looks like edges) → block3 (textures) → block5
    (object parts). The hierarchy is most visible on real RGB images.
  - Visualize the KERNELS themselves (not the activations):
        W = m.layers[0].get_weights()[0]   # shape: (3, 3, 1, 8)
        fig, axes = plt.subplots(1, 8)
        for i in range(8):
            axes[i].imshow(W[:, :, 0, i], cmap='gray')
    Compare these 3x3 patterns to the hand-coded kernels in 24.py.
"""

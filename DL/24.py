import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera
from scipy.signal import convolve2d

img = camera()
filters = {
    'identity':  np.array([[0, 0, 0], [0, 1, 0], [0, 0, 0]]),
    'sobel_x':   np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]]),
    'sobel_y':   np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]]),
    'laplacian': np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]]),
    'box_blur':  np.ones((3, 3)) / 9,
    'gaussian':  np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]]) / 16,
    'sharpen':   np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]]),
    'emboss':    np.array([[-2, -1, 0], [-1, 1, 1], [0, 1, 2]]),
}

fig, axes = plt.subplots(2, 4, figsize=(14, 7))
for ax, (name, k) in zip(axes.flat, filters.items()):
    out = convolve2d(img, k, mode='same', boundary='symm')
    ax.imshow(out, cmap='gray')
    ax.set_title(name)
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Multiple Filters = Feature Maps (the CNN core idea) ===

In Q21-23 we ran ONE kernel at a time. In a real CNN, every conv layer
runs MANY kernels in parallel on the same input — each one producing a
new "feature map" that highlights a different aspect of the image.

This script is exactly that: 8 different 3x3 kernels, all applied to the
same 512x512 input, producing 8 feature maps side-by-side. It's a manual
demo of what one CNN conv layer with 8 filters looks like.

What each filter detects

  identity      : center=1, rest=0 → output IS the input. The "do nothing"
                  filter. Useful as a baseline / sanity check.

  sobel_x       : vertical edges (horizontal intensity changes). Bright
                  pixels = there's a vertical line here.

  sobel_y       : horizontal edges (vertical intensity changes). Bright
                  pixels = there's a horizontal line here.

  laplacian     : all edges in any direction (second derivative). Single
                  kernel that finds edges without needing X/Y separation.
                  More noise-sensitive than Sobel.

  box_blur      : uniform 3x3 average → smooths out fine detail.

  gaussian      : weighted average favoring the center → smoother, more
                  natural blur than box_blur.

  sharpen       : center positive, surround negative → amplifies edge
                  contrast.

  emboss        : asymmetric kernel that creates a 3D / "carved stone"
                  look. Highlights one diagonal direction.
                    [-2 -1  0]
                    [-1  1  1]
                    [ 0  1  2]
                  Mathematically: a directional gradient combined with the
                  identity, producing both shading and edges.

The key insight (this is the whole CNN intuition)

    ONE kernel = ONE feature detector = ONE output channel.

  - 8 kernels in this script → 8 feature maps shown in 8 subplots.
  - In a Keras layer:
        Conv2D(filters=32, kernel_size=(3, 3))
    means "apply 32 kernels in parallel and stack the 32 output feature
    maps into a (H, W, 32) tensor". Each of those 32 channels is exactly
    like one of these subplots, just learned from data.

Why CNNs use many filters per layer
  - Different features are useful for different tasks. A face detector
    might want kernels for: vertical edges (cheekbones), curves (eyes),
    skin-tone blobs, etc.
  - You don't know in advance WHICH features matter, so the network
    starts with many random kernels and lets gradient descent shape each
    one into a useful detector during training.
  - Typical filter counts:
        first conv layer  : 32 or 64 filters (low-level: edges, blobs)
        middle layers     : 128, 256 filters (textures, patterns)
        deeper layers     : 512+ filters (object parts, whole objects)
    The deeper you go, the more abstract the features.

What you'd see if you visualized a real trained CNN
  - First conv layer of a trained CNN often produces feature maps that
    look REMARKABLY like this script:
        * vertical-edge detectors (≈ sobel_x)
        * horizontal-edge detectors (≈ sobel_y)
        * diagonal-edge detectors
        * blob/color detectors (≈ blur of specific colors)
        * sharpening-like contrast detectors
  - Famous papers (Zeiler & Fergus 2014, Krizhevsky 2012 AlexNet) showed
    that after training on ImageNet, the first-layer kernels of AlexNet
    converge to Gabor-like edge filters and color blobs — almost exactly
    what we're hand-coding here.

Stacking layers = composing features
  - Layer 1 outputs (this script's outputs) become the INPUT to Layer 2.
  - Layer 2's kernels see edge maps and learn to detect combinations of
    edges → corners, textures.
  - Layer 3 sees textures → object parts (eyes, wheels, fur patches).
  - Layer N sees object parts → whole objects (faces, cars, dogs).
  - The hierarchy is what makes deep CNNs powerful — early layers are
    generic and reusable; deeper layers are task-specific.

=== Code notes ===

filters = { ... }
  - A dict of named (kernel) pairs. To add more, just add entries:
        'prewitt_x': np.array([[-1,0,1],[-1,0,1],[-1,0,1]]),
        'motion_blur': np.eye(5) / 5,
        'ridge': np.array([[0,-1,0],[-1,4,-1],[0,-1,0]]),
  - Each kernel is its own "feature detector" — independent of all the
    others. There's no interaction between filters within one layer.

for ax, (name, k) in zip(axes.flat, filters.items()):
    out = convolve2d(img, k, mode='same', boundary='symm')
  - The SAME convolve2d call from 21/22/23.py — only the kernel changes.
  - Each iteration produces one feature map. In a CNN this would all
    happen in a single tensor op (parallel on GPU).

How to extend (bridge to a real CNN)
  - Replicate this with a Keras Conv2D layer holding all 8 kernels:
        from tensorflow.keras.layers import Conv2D
        kernels = np.stack(list(filters.values()), axis=-1).astype(np.float32)
        kernels = kernels.reshape(3, 3, 1, 8)   # (kh, kw, in_channels, out_channels)
        conv = Conv2D(8, (3, 3), padding='same', use_bias=False)
        conv.build((None, 512, 512, 1))
        conv.set_weights([kernels])
        x = img.astype(np.float32).reshape(1, 512, 512, 1)
        feature_maps = conv(x).numpy()[0]   # shape: (512, 512, 8)
    Compare the 8 channels of feature_maps against this script's 8
    subplots — they should match exactly (Conv2D = convolution).
  - Train a real CNN on MNIST / CIFAR-10, then visualize the LEARNED
    first-layer kernels. You'll see filters that look like the ones in
    this dict, even though no one programmed them.
"""

import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Input, Conv2D

img = camera()[None, :, :, None].astype(np.float32)

configs = [('valid', 1), ('valid', 2), ('same', 1), ('same', 2)]
fig, axes = plt.subplots(1, 4, figsize=(16, 4))
for ax, (pad, stride) in zip(axes, configs):
    m = Sequential([Input(shape=(512, 512, 1)), Conv2D(1, 3, strides=stride, padding=pad)])
    out = m(img).numpy()
    ax.imshow(out[0, :, :, 0], cmap='gray')
    ax.set_title(f'pad={pad}, stride={stride}\nshape={out.shape[1:3]}')
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Padding and Stride ===

These are the two knobs that control the SPATIAL SIZE of a Conv2D output.
The kernel weights decide WHAT feature you're looking for; padding and
stride decide HOW you scan the image.

The output-size formula

    out = floor( (in + 2*pad - kernel) / stride ) + 1

For an image with side-length `in`, kernel `k`, padding `p`, and stride
`s`, this single formula tells you the output side-length.

  Example:  in=28, k=3, p=0, s=1   →  (28 - 3) / 1 + 1   = 26
            in=28, k=3, p=1, s=1   →  (28 + 2 - 3) / 1 + 1 = 28
            in=28, k=3, p=0, s=2   →  (28 - 3) / 2 + 1   = 13
            in=28, k=3, p=1, s=2   →  (28 + 2 - 3) / 2 + 1 = 14

PADDING — the two named modes in Keras

  padding='valid'   (= no padding, p = 0)
    - Kernel only sits where it FULLY fits inside the image.
    - Output is SMALLER than input. For a 3x3 kernel: out_size = in - 2.
    - Edge pixels are seen by FEWER kernel positions than middle pixels →
      slight edge-information loss.
    - Default in Keras.

  padding='same'    (= auto zero-pad to keep output size = input size)
    - Keras adds the right amount of zero-padding so that
      ceil(in / stride) = out.
    - For stride=1: out_size = in_size (always). The "same" name comes
      from this property.
    - For stride>1: out_size = ceil(in / stride), and zero-padding fills
      whatever is needed for that to hold.
    - Most modern CNNs use 'same' for every conv layer so the spatial
      dimensions only shrink during pooling/strided steps — not by
      accident from the kernel size.

STRIDE — how far the kernel jumps between positions

  stride=1
    - Kernel moves one pixel at a time. Output is roughly the same size
      as input (modulo padding). Captures the most fine-grained spatial
      detail.

  stride=2
    - Kernel jumps two pixels per step. Output is HALF the size in each
      spatial dimension. This is "strided convolution" — a common
      replacement for max-pooling that lets the network LEARN how to
      downsample (whereas max-pool is a fixed operation).
    - In modern architectures (ResNet, EfficientNet, transformers'
      patch-embed) most downsampling is done with stride=2 conv instead
      of pooling.

  stride > 2 (rare)
    - Used in patch-tokenization (e.g. ViT uses Conv2D with kernel=16,
      stride=16 to chop an image into 16x16 patches).
    - Otherwise rarely seen.

What this script shows

  Subplot 1  pad=valid, stride=1   →  shape (510, 510)
    Output 2 pixels smaller per side because kernel can't sit on edges.
    Otherwise looks ~identical to input.

  Subplot 2  pad=valid, stride=2   →  shape (255, 255)
    Each step skips a pixel → roughly half resolution. Sub-sampled view
    of the image.

  Subplot 3  pad=same,  stride=1   →  shape (512, 512)
    Same size as input. The "drop-in" mode used by most CNN designs.

  Subplot 4  pad=same,  stride=2   →  shape (256, 256)
    Half resolution, but unlike valid+stride=2, no information at the
    edges is lost to padding asymmetry.

Why padding matters
  - Without padding, every conv layer shrinks the image. Stack 5 conv
    layers with kernel=3 and no padding and you've lost 10 pixels per
    side — small images vanish quickly.
  - For an N-layer fully-convolutional network you'd need
    padding='same' on every layer so the input/output have a clean
    relationship.
  - Edge-pixel coverage: 'valid' padding means corner pixels are touched
    by the kernel only ONCE; center pixels are touched many times.
    'same' padding equalizes this.

Why stride matters
  - Computational: stride=2 reduces output spatial size by 4x → 4x
    fewer operations in subsequent layers.
  - Receptive field: bigger stride → each output pixel "sees" a larger
    region of the input → useful for capturing global context.
  - Trade-off: aliasing — strided conv can drop high-frequency information
    if you don't precede it with a smoothing layer (anti-aliasing).

Padding modes beyond 'valid' and 'same'
  - In Keras Conv2D you only get those two strings. But scipy and
    PyTorch let you specify 'reflect', 'replicate', 'circular', etc.
  - For specialty cases (e.g. periodic signals), you'd use a Lambda layer
    or a custom Conv that pre-pads the input differently.

=== Code notes ===

img = camera()[None, :, :, None].astype(np.float32)
  - Adds a batch dim and a channel dim → shape (1, 512, 512, 1).
  - astype(float32) because Conv2D expects float input.

m = Sequential([Input(shape=(512, 512, 1)), Conv2D(1, 3, strides=stride, padding=pad)])
  - Conv2D(1, 3, ...) means 1 filter, 3x3 kernel.
  - The kernel here is RANDOM (no training) — we're only demonstrating
    spatial dimensions, not learned features. The output looks like a
    noisy version of the input.

out.shape[1:3]
  - Slices out (height, width) for printing, ignoring batch and channel
    dims.

How to extend
  - Verify the output-size formula by hand:
        in=512, k=3, p=0, s=1 → 510  ✓
        in=512, k=3, p=0, s=2 → 255  ✓ (formula gives 254.5, floored = 255 due to keras quirk; actually floor((512-3)/2)+1 = 255)
  - Try larger strides:  Conv2D(1, 16, strides=16) → patch-tokenize.
  - Combine with pooling:
        Conv2D(1, 3, padding='same') + MaxPooling2D() → same as
        Conv2D(1, 3, padding='same', strides=2) in terms of output size,
        but different computational cost and learnability.
  - Cause an error on purpose to see what mismatched shapes do:
        Conv2D(1, 7, padding='valid') on a 5x5 input → kernel bigger
        than image, raises an error.
"""

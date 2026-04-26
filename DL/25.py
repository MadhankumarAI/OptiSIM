import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera

def conv2d(img, k):
    H, W = img.shape
    kh, kw = k.shape
    ph, pw = kh // 2, kw // 2
    p = np.pad(img, ((ph, ph), (pw, pw)))
    out = np.zeros_like(img, dtype=float)
    for i in range(H):
        for j in range(W):
            out[i, j] = np.sum(p[i:i+kh, j:j+kw] * k)
    return out

img = camera()
sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
edge = conv2d(img, sobel_x)

fig, axes = plt.subplots(1, 2, figsize=(8, 4))
for ax, im, t in zip(axes, [img, edge], ['original', 'manual_sobel_x']):
    ax.imshow(im, cmap='gray')
    ax.set_title(t)
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Convolution from Scratch ===

Q21-24 used scipy.signal.convolve2d as a black box. This script opens the
black box and shows what convolution ACTUALLY does at the array-indexing
level. Every CNN library (TensorFlow, PyTorch, scipy) does this same
thing under the hood — just much faster, on the GPU, and across many
kernels and channels at once.

The four ingredients

  1. PADDING
     Without padding, the output is smaller than the input — the kernel
     can't be centered on edge pixels because it would hang off the side.
     For a 3x3 kernel, you need 1 pixel of padding on each side; for 5x5,
     2 pixels.
        Output size = (H + 2*pad - kh) / stride + 1
     "same" padding (output size = input size) requires pad = kh // 2.
     Common pad values:
        np.pad(img, ((1,1),(1,1)))                  # zero pad (CNN default)
        np.pad(img, ((1,1),(1,1)), mode='reflect')  # mirror border
        np.pad(img, ((1,1),(1,1)), mode='edge')     # repeat edge pixel

  2. SLIDING WINDOW (the double for-loop)
     For each output position (i, j), grab the kh x kw patch of the
     padded image centered there:
        window = p[i:i+kh, j:j+kw]
     This is the receptive field of that output pixel.

  3. ELEMENT-WISE MULTIPLY AND SUM
     The output value is the sum of element-wise products between the
     window and the kernel:
        out[i, j] = np.sum(window * kernel)
     If the window pattern matches the kernel pattern (large values
     where the kernel is large, etc.), the sum is large → "this feature
     is here". If they don't match, the sum is small → "this feature
     isn't here".

  4. STRIDE (not in this minimal code)
     We're moving by 1 pixel per step (stride=1). With stride=2, you'd
     move by 2 pixels each step, halving the output resolution. CNNs
     use stride to downsample without pooling.

A subtle point: convolution vs cross-correlation
  - Pure mathematical convolution FLIPS the kernel before multiplying:
        out[i,j] = sum_{u,v} img[i+u, j+v] * kernel[-u, -v]
  - What this code (and TensorFlow's Conv2D, and PyTorch's Conv2d) does
    is CROSS-CORRELATION:
        out[i,j] = sum_{u,v} img[i+u, j+v] * kernel[u, v]    ← no flip
  - Why the deep learning world calls it "convolution" anyway:
        * For symmetric kernels (Gaussian, identity), they're the same.
        * For asymmetric kernels in CNNs, the network just LEARNS the
          flipped version of whatever it would have learned with true
          convolution → result is identical, name was kept by tradition.
  - When you see "convolution" in a CNN paper or in Keras, assume it
    means cross-correlation. Pure math convolution shows up in signal
    processing texts.

Why the double for-loop is slow
  - This implementation: O(H * W * kh * kw) Python-level iterations.
    For a 512x512 image with a 3x3 kernel, that's 512*512*9 ≈ 2.4M
    multiplications IN A PYTHON LOOP (slow).
  - scipy.signal.convolve2d: same big-O but vectorized in C → ~50-100x
    faster.
  - tf.keras.layers.Conv2D: same big-O, plus parallelized on GPU
    across many filters and a batch of images → ~10000x+ faster.
  - Real CNN implementations also use tricks like:
        * im2col       : reshape windows into a giant matrix, then
                         convolution becomes one matmul (fast on GPU).
        * FFT          : O(H*W*log(H*W)) regardless of kernel size — only
                         worth it for big kernels.
        * Winograd     : algebraic identity that reduces multiply count
                         for 3x3 kernels (used in cuDNN).

Extending to multi-channel input/output (what real CNNs need)
  - This script: 1 input channel (grayscale) → 1 output channel.
  - A real Conv2D layer:
        Input:  (H, W, in_channels)
        Kernel: (kh, kw, in_channels, out_channels)
        Output: (H, W, out_channels)
  - For each output channel, you sum across all input channels:
        out[i, j, c_out] = sum_{c_in} sum_{u,v}
                              input[i+u, j+v, c_in] * kernel[u, v, c_in, c_out]
  - The "sum across input channels" is what makes a 3-channel RGB image
    collapse into a single scalar per output channel position.
  - To extend this script:
        for c_out in range(out_channels):
            for c_in in range(in_channels):
                out[..., c_out] += conv2d(input[..., c_in],
                                          kernel[..., c_in, c_out])

=== Code notes ===

p = np.pad(img, ((ph, ph), (pw, pw)))
  - Default pad mode is 'constant' with value 0 — the standard "zero
    padding" used by CNNs.
  - The shape becomes (H + 2*ph, W + 2*pw), so when we index into it
    starting at (i, j), the kh x kw window is centered on the original
    image's (i, j) pixel.

out = np.zeros_like(img, dtype=float)
  - dtype=float because the kernel can have negative values and the
    output can exceed the uint8 range (255). Storing in float prevents
    overflow / underflow.

for i in range(H): / for j in range(W):
  - Iterating over OUTPUT positions, not input positions. Each output
    pixel is one weighted sum.

out[i, j] = np.sum(p[i:i+kh, j:j+kw] * k)
  - The whole convolution kernel logic in one line:
        1. p[i:i+kh, j:j+kw] = the receptive field (input patch)
        2. * k                = element-wise multiply
        3. np.sum(...)        = collapse to one scalar
  - Add bias if you want to mimic a real Conv2D:
        out[i, j] = np.sum(p[i:i+kh, j:j+kw] * k) + bias

Sanity check
  - Compare against scipy.signal.convolve2d(img, sobel_x, mode='same'):
        np.allclose(edge, scipy_result)   # should be True
    Note: scipy's convolve2d does TRUE convolution (flipped kernel).
    For the same output as this script, use scipy.signal.correlate2d.

How to extend
  - Add stride:
        def conv2d(img, k, stride=1):
            ...
            out = np.zeros((H // stride, W // stride))
            for i in range(0, H, stride):
                for j in range(0, W, stride):
                    out[i // stride, j // stride] = np.sum(
                        p[i:i+kh, j:j+kw] * k)
  - Add multi-channel support (sketch above).
  - Vectorize the loop using as_strided or im2col — turns the double loop
    into a single matrix multiplication for a 50-100x speedup.
"""

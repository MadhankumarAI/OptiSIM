import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera
from scipy.signal import convolve2d

img = camera()
sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])

ex = convolve2d(img, sobel_x, mode='same', boundary='symm')
ey = convolve2d(img, sobel_y, mode='same', boundary='symm')
edges = np.sqrt(ex**2 + ey**2)

fig, axes = plt.subplots(1, 4, figsize=(14, 3))
for ax, im, t in zip(axes, [img, ex, ey, edges], ['original', 'sobel_x', 'sobel_y', 'magnitude']):
    ax.imshow(im, cmap='gray')
    ax.set_title(t)
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Convolution and Edge Detection ===

This is the gateway concept to CNNs. Everything a CNN does is built on this
one operation: SLIDE A SMALL MATRIX (the "kernel" or "filter") OVER A
LARGER MATRIX (the image), AT EACH POSITION COMPUTE A WEIGHTED SUM.

What a kernel is
  - A small 2D matrix (typically 3x3, 5x5, 7x7).
  - The values in the kernel decide WHAT FEATURE the kernel responds to.
  - Sliding the same kernel over the whole image gives you a "feature map"
    — a new image where bright pixels mean "this feature is strong here"
    and dark pixels mean "this feature is weak here".

How convolution works (3x3 kernel example)
  - Center the kernel on a pixel.
  - Multiply each kernel value by the underlying pixel value.
  - Sum all 9 products → that's the new pixel's value.
  - Move one step right, repeat. After scanning the whole image, you have
    a new (filtered) image of roughly the same size.

Edge detection kernels — the classics

  Sobel X (detects VERTICAL edges = horizontal intensity changes)
        [-1   0   +1]
        [-2   0   +2]
        [-1   0   +1]
    Strong response when pixels on the LEFT are dark and pixels on the
    RIGHT are bright (or vice versa). Mathematically: an approximation
    of the partial derivative ∂I/∂x.

  Sobel Y (detects HORIZONTAL edges = vertical intensity changes)
        [-1  -2  -1]
        [ 0   0   0]
        [+1  +2  +1]
    Same idea, but top-vs-bottom. Approximates ∂I/∂y.

  Edge magnitude (rotation-invariant — finds ALL edges)
        magnitude = sqrt(Sobel_X² + Sobel_Y²)
    Combines the two directional responses into one image where every
    edge — vertical, horizontal, diagonal — lights up.

  Prewitt (Sobel's simpler cousin)
        [-1 0 1]
        [-1 0 1]
        [-1 0 1]
    Same shape as Sobel but uniform weights. Slightly noisier in practice;
    Sobel's center-row weighting (the 2's) makes it more robust.

  Laplacian (second derivative — detects edges in any direction at once)
        [ 0  -1   0]
        [-1   4  -1]
        [ 0  -1   0]
    No need for X/Y separation, but more sensitive to noise.

  Scharr (improved Sobel)
        [-3   0  +3]
        [-10  0 +10]
        [-3   0  +3]
    Better rotational symmetry than Sobel. OpenCV's preferred edge kernel.

Why this matters for CNNs
  - In a CNN, you don't hand-code these kernels — the network LEARNS them
    from data via gradient descent.
  - When you visualize the learned kernels of the first conv layer of a
    trained CNN, you typically see edge detectors (vertical, horizontal,
    diagonal) and color-blob detectors. They naturally rediscover Sobel /
    Gabor-like patterns because edges are the most useful low-level
    feature.
  - Deeper layers stack these primitive detectors into more complex
    features (textures → object parts → whole objects).
  - So this script is a manual demo of what the FIRST layer of a CNN
    learns to do automatically.

Other common kernels (preview of what CNN layers learn)
  - Blur / smoothing : averaging kernels (e.g. all 1/9 in a 3x3) — used
                       to reduce noise before edge detection.
  - Sharpening       : center-positive, surround-negative kernels — boost
                       edges.
  - Gabor            : sinusoidal patterns — early visual-cortex models
                       use these; CNNs often learn them.
  - Identity         : center=1, rest=0 → no change. The "do nothing"
                       kernel.

=== Code notes ===

img = camera()
  - skimage.data.camera() is a built-in 512x512 grayscale photo of a man
    with a camera (the classic "cameraman" image, used in image-processing
    textbooks for decades).
  - Other built-ins to try: skimage.data.coins(), .astronaut() (color),
    .checkerboard(), .text(), .horse(). Use rgb2gray() if the image is
    color.

sobel_x, sobel_y
  - These are the actual 3x3 Sobel kernels — exactly the same matrices
    a freshly-trained CNN's first layer often converges to.
  - To experiment, just swap them:
        prewitt_x = np.array([[-1,0,1],[-1,0,1],[-1,0,1]])
        laplacian = np.array([[0,-1,0],[-1,4,-1],[0,-1,0]])

convolve2d(img, kernel, mode='same', boundary='symm')
  - mode='same'    : output image is the same size as the input.
                     (Default 'full' would give a slightly larger output.)
  - boundary='symm': mirrors the image at the edges so the kernel always
                     has values to multiply against. Other options:
                     'fill' (zero-pad — default in CNNs) or 'wrap'.
  - In a Keras Conv2D layer, this is what's happening under the hood —
    just with the kernel values learned from data and parallelized
    across many kernels at once.

edges = np.sqrt(ex**2 + ey**2)
  - The standard "gradient magnitude" formula. Combines the directional
    responses into a single isotropic edge map.
  - Cheaper alternative (used in real-time systems): np.abs(ex) + np.abs(ey).
    Slightly less accurate but no sqrt.

How to extend
  - Try a color image:
        from skimage.data import astronaut
        from skimage.color import rgb2gray
        img = (rgb2gray(astronaut()) * 255).astype(np.uint8)
  - Apply a Gaussian blur first (denoising), then edge-detect:
        from scipy.ndimage import gaussian_filter
        img = gaussian_filter(camera(), sigma=1.5)
  - Threshold the magnitude image to get a binary edge map:
        binary = edges > edges.mean() + edges.std()
  - Bridge to CNNs — replicate this with a Keras Conv2D:
        from tensorflow.keras.layers import Conv2D
        conv = Conv2D(1, (3,3), padding='same', use_bias=False)
        conv.build((None, 512, 512, 1))
        conv.set_weights([sobel_x.reshape(3,3,1,1).astype(np.float32)])
        out = conv(img.reshape(1,512,512,1).astype(np.float32))
"""

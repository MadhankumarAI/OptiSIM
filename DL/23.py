import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera
from scipy.signal import convolve2d

img = camera()
sharpen = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
strong = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])

s1 = np.clip(convolve2d(img, sharpen, mode='same', boundary='symm'), 0, 255)
s2 = np.clip(convolve2d(img, strong, mode='same', boundary='symm'), 0, 255)

fig, axes = plt.subplots(1, 3, figsize=(12, 4))
for ax, im, t in zip(axes, [img, s1, s2], ['original', 'sharpen', 'strong_sharpen']):
    ax.imshow(im, cmap='gray')
    ax.set_title(t)
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Sharpening as Convolution ===

A sharpening kernel is a HIGH-PASS FILTER — it boosts high-frequency
content (edges, fine detail) and suppresses low-frequency content (smooth
gradients). The result: edges look crisper.

The trick (the math behind every sharpening kernel)

    sharpened = original + edges
              = original + (original - blurred)

    The "(original - blurred)" part isolates the edges — anywhere the
    image differs from its smoothed version is by definition an edge.
    Add that back to the original and the edges get amplified.

Equivalently in kernel form:
    sharpen_kernel = identity_kernel + amount * laplacian_kernel

Two classic sharpening kernels

  Mild sharpen (Laplacian-based)
        [ 0  -1   0]
        [-1   5  -1]      ← center = 5, sum of all = 1
        [ 0  -1   0]
    Each output pixel = 5 * itself - 1 * each of its 4 neighbors. The
    "subtract neighbors" part is exactly an edge detector; the "+5 *
    self" part keeps the original image.

  Strong sharpen (Laplacian-of-8 neighbors)
        [-1  -1  -1]
        [-1   9  -1]      ← center = 9, sum of all = 1
        [-1  -1  -1]
    Same idea, but now ALL 8 neighbors are subtracted. More aggressive
    edge boost, also amplifies noise more.

Why both kernels sum to 1
  - Sum of weights = 1 ensures average brightness is preserved on flat
    (non-edge) regions. On a uniformly gray patch, the kernel returns
    the same gray.
  - Edges are where the "subtract neighbors" terms don't cancel out —
    those locations get amplified.

Why we need np.clip(..., 0, 255)
  - Sharpening can push pixel values BELOW 0 (very dark edge halos) or
    ABOVE 255 (very bright halos). Without clipping, matplotlib will
    rescale and the image looks washed out. Clipping holds them in the
    valid display range.

Sharpening = inverse of blurring
  - Both use the same convolution operation — only the kernel changes.
    Blur kernels: positive weights summing to 1 (low-pass).
    Sharpen kernels: center positive, surround negative, summing to 1
                     (high-pass).
  - You can literally derive a sharpen kernel from a blur kernel:
        sharpen = 2 * identity - blur
        For a 3x3 box blur: 2*I - (1/9 matrix) → a sharpen kernel.

Unsharp masking (the better way to sharpen, used in Photoshop)
  - Step 1: blur the image (Gaussian).
  - Step 2: subtract blurred from original → "edge mask".
  - Step 3: add edge mask back to original, scaled by some "amount".
        sharpened = original + amount * (original - blurred)
  - Lets you tune sharpening strength continuously, and works at any
    spatial scale (small kernel = enhance fine detail; bigger kernel =
    enhance broader contrast).

When to use sharpening (and when NOT to)
  - Use after JPEG compression / downscaling to recover crispness.
  - Use to make small text/edges more readable.
  - DON'T over-sharpen — it amplifies noise and creates ugly halos
    around high-contrast edges.

In CNNs
  - CNNs rarely have a dedicated "sharpening" layer, but their learned
    kernels often combine blur-and-subtract patterns. Anything that
    increases edge contrast counts as implicit sharpening.
  - The "deconvolution" / "transposed convolution" used for upsampling
    in autoencoders and GANs is mathematically related to sharpening.

=== Code notes ===

sharpen = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
strong  = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])
  - Both are valid sharpen kernels. The center value = 1 + |sum of
    surround weights| keeps the kernel sum at 1.
  - To make sharpening MILDER, reduce the negative weights:
        mild = np.array([[0, -0.5, 0], [-0.5, 3, -0.5], [0, -0.5, 0]])
  - To make it STRONGER, scale up:
        very_strong = np.array([[0, -2, 0], [-2, 9, -2], [0, -2, 0]])

np.clip(..., 0, 255)
  - Required because sharpening produces values outside the 0-255 range.
    Without it, imshow auto-scales and the contrast looks wrong.
  - .astype(np.uint8) afterwards is also common if you want to save the
    image with PIL / OpenCV.

How to extend (proper unsharp mask)
  blur = convolve2d(img, np.ones((5,5))/25, mode='same', boundary='symm')
  amount = 1.5
  unsharp = np.clip(img + amount * (img - blur), 0, 255)
  - This is the technique most photo editors actually use, and it gives
    much finer control than a fixed kernel.

Why convolution is the same operation in all three scripts (21, 22, 23)
  - 21.py edge:  kernel emphasizes neighbor differences along an axis.
  - 22.py blur:  kernel averages neighbors uniformly.
  - 23.py sharp: kernel subtracts neighbor average from center.
  - The convolution operation itself is identical in all three — what
    changes is the kernel values. This is exactly why CNNs are powerful:
    you can express "edge", "blur", "sharpen", "texture detector",
    "object part detector" all in one operation, and learn the right
    weights for the task instead of designing them by hand.
"""

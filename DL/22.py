import numpy as np
import matplotlib.pyplot as plt
from skimage.data import camera
from scipy.signal import convolve2d

img = camera()
box = np.ones((5, 5)) / 25
print(box)
gauss = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]]) / 16
print(gauss)


box_blur = convolve2d(img, box, mode='same', boundary='symm')
gauss_blur = convolve2d(img, gauss, mode='same', boundary='symm')

fig, axes = plt.subplots(1, 3, figsize=(12, 4))
for ax, im, t in zip(axes, [img, box_blur, gauss_blur], ['original', 'box_5x5', 'gaussian_3x3']):
    ax.imshow(im, cmap='gray')
    ax.set_title(t)
    ax.axis('off')
plt.tight_layout()
plt.show()


"""
=== Concept: Blur (Smoothing) as Convolution ===

A blur kernel is a LOW-PASS FILTER — it suppresses high-frequency content
(sharp transitions, fine detail, noise) and keeps low-frequency content
(broad shapes, gradual gradients).

How it works
  - Each output pixel = average (or weighted average) of its neighborhood.
  - Sharp edges in the input get smoothed out because pixels on either side
    of an edge get mixed together.
  - The bigger the kernel, the larger the neighborhood being averaged →
    the blurrier the result.

Two classic blur kernels

  Box blur (uniform average)
        1/9  1/9  1/9
        1/9  1/9  1/9
        1/9  1/9  1/9
    All neighbors weighted equally. Cheapest possible blur. Good enough
    for quick smoothing but produces "boxy" artifacts on close inspection.

  Gaussian blur (weighted average, center pixels count more)
        1/16  2/16  1/16
        2/16  4/16  2/16
        1/16  2/16  1/16
    Weights follow a 2D Gaussian curve — center matters most, corners
    matter least. Smoother, more natural-looking blur. The de-facto
    standard for general-purpose smoothing.

Why kernel weights sum to 1
  - Sum of weights = the average brightness multiplier on the image.
  - If weights summed to >1, the blurred image would be brighter than
    the original. <1 → darker. =1 → preserves average brightness.
  - That's why box uses 1/9, Gaussian 3x3 uses 1/16, etc.

Bigger kernel = stronger blur
  - 3x3   : light smoothing
  - 5x5   : moderate blur
  - 9x9+  : heavy blur, good for noise removal
  - For Gaussian, you can also tune sigma directly:
        from scipy.ndimage import gaussian_filter
        gaussian_filter(img, sigma=1.5)
    sigma controls effective kernel width — bigger sigma = blurrier.

Other blur variants
  - Motion blur     : a 1D kernel along one direction (e.g. all 1/n on a
                      diagonal). Simulates camera shake / object motion.
  - Median filter   : not a true convolution — replaces each pixel with
                      the MEDIAN of its neighborhood. Excellent for
                      salt-and-pepper noise.
  - Bilateral filter: edge-preserving blur — averages pixels but only
                      mixes pixels of similar brightness. Smooths smooth
                      regions while keeping edges sharp.

Why blur matters in practice
  - Noise reduction : random noise is high-frequency; blurring averages
                      it out. Almost every CV pipeline starts with a
                      Gaussian blur.
  - Anti-aliasing   : before downsampling an image (e.g. resize to
                      thumbnail), blur first to prevent aliasing
                      artifacts.
  - Visual effects  : depth-of-field, glow, drop shadows.
  - As a step in    : edge detection (Sobel/Canny denoise first), blob
                      detection, optical flow, etc.

Why blur matters in CNNs
  - CNNs don't usually USE blur kernels — but they LEARN something
    similar in their averaging-style filters. Many low-level CNN
    filters look like Gaussian-blob detectors.
  - More importantly, AVERAGE POOLING and STRIDED CONVOLUTIONS implicitly
    do blur-like averaging during downsampling, which is why CNNs are
    robust to small input shifts.

=== Code notes ===

box   = np.ones((5, 5)) / 25
gauss = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]]) / 16
  - The /25 and /16 are the normalization constants — they make the kernel
    weights sum to 1 (so brightness is preserved).
  - Easy way to make any kernel "average-preserving":
        kernel = kernel / kernel.sum()
  - For a stronger box blur, just enlarge the kernel:
        box = np.ones((11, 11)) / 121

convolve2d(img, kernel, mode='same', boundary='symm')
  - Same call as the edge-detection script (21.py). The ONLY thing that
    changed is the kernel values — that's the whole point of convolution.

How to extend
  - Try Gaussian with bigger sigma:
        from scipy.ndimage import gaussian_filter
        gaussian_filter(img, sigma=3)
  - Add a noisy version, then blur to denoise:
        noisy = img + np.random.normal(0, 30, img.shape)
        denoised = convolve2d(noisy, gauss, mode='same', boundary='symm')
  - Compare median filter for salt-and-pepper noise:
        from scipy.ndimage import median_filter
        median_filter(noisy, size=3)
"""

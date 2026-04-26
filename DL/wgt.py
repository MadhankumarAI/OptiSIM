import numpy as np
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

m = Sequential([Dense(2, activation='relu', input_shape=(3,))])

W = np.array([[0.1, 0.2],
              [0.3, 0.4],
              [0.5, 0.6]])
b = np.array([0.7, 0.8])

m.layers[0].set_weights([W, b])
print(m.layers[0].get_weights())


"""
=== Setting your OWN weights and biases ===


Method 1 — set_weights() AFTER the model is built  (used above)
  - Build the model normally, then overwrite the values:
        m.layers[i].set_weights([W, b])
  - Order matters: [kernel, bias]. Shapes must match exactly:
        kernel shape = (input_dim, units)
        bias   shape = (units,)
  - Lets you change weights any time — also how you load saved weights
    from another model.


Tip: call m.summary() or layer.get_weights() first to see the exact shapes
the layer expects before you build your arrays.
"""

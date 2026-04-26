from sklearn.datasets import load_diabetes
from sklearn.model_selection import train_test_split
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dense

X, y = load_diabetes(return_X_y=True)
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

for opt in ['sgd', 'adam']:
    m = Sequential([Dense(32, activation='relu', input_shape=(10,)), Dense(1)])
    m.compile(optimizer=opt, loss='mse', metrics=['mae'])
    m.fit(Xtr, ytr, epochs=50, verbose=0)
    print(opt, m.evaluate(Xte, yte, verbose=0))

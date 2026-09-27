export class ModelNotLoadedError extends Error {
  constructor(message = 'The on-device model is not loaded yet.') {
    super(message);
    this.name = 'ModelNotLoadedError';
  }
}

export class OutOfMemoryError extends Error {
  constructor(message = 'This device does not have enough memory to load the model.') {
    super(message);
    this.name = 'OutOfMemoryError';
  }
}

export class TranslationError extends Error {
  constructor(message = 'Translation failed. Try again with shorter text.') {
    super(message);
    this.name = 'TranslationError';
  }
}

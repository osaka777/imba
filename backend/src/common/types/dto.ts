export class Dto<T> {
  constructor(partial: Partial<T>) {
    Object.assign(this, partial);
  }
}

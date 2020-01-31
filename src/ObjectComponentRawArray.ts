import { IComponentRawArray } from "./detail/ComponentDataArray";

export class ObjectComponentRawArray<T> implements IComponentRawArray<T> {
    capacity: number;
    cursor = 0;
    private _array: Array<T>;
    private _defaultValue: T;

    constructor(capacity: number, defaultValue: T) {
        this.capacity = capacity;
        this._array = [];
        this._array.length = capacity;
        this._defaultValue = defaultValue;
    }

    read(): T {
        return this._array[this.cursor++];
    }
    write(value: T): void {
        this._array[this.cursor++] = value;
    }
    reset(): void {
        this._array[this.cursor++] = this._defaultValue;
    }
}
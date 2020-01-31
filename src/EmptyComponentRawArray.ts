import { IComponentRawArray } from "./detail/ComponentDataArray";

export class EmptyComponentRawArray<T> implements IComponentRawArray<T> {
    readonly capacity: number;
    cursor: number = 0;
    private _singleton: T;
    
    constructor(capacity: number, singleton: T) {
        this.capacity = capacity;
        this._singleton = singleton;
    }
    
    read(): T {
        this.cursor++;
        return this._singleton;
    }
    write(_: T): void {
        this.cursor++;
    }
    reset(): void {
        this.cursor++;
    }
}

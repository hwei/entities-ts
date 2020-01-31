

export interface IComponentRawArray<T> {
    readonly capacity: number;
    cursor: number;
    read(): T;
    write(value: T): void;
    reset(): void;
}

export class ComponentDataArray<T> implements Iterable<T> {
    private _count: number;
    private _componentRawArray: IComponentRawArray<T>;

    constructor(componentRawArray: IComponentRawArray<T>) {
        this._count = 0;
        this._componentRawArray = componentRawArray;
    }

    get capacity() {
        return this._componentRawArray.capacity;
    }
    
    get count() {
        return this._count;
    }

    add(value?: T): number {
        if(this._count >= this._componentRawArray.capacity)
            throw new Error('Reach full capacity')
        const index = this._count;
        this._componentRawArray.cursor = index;
        if(value === undefined)
            this._componentRawArray.reset();
        else
            this._componentRawArray.write(value);
        this._count = index + 1;
        return index;
    }

    remove(index: number): T | null {
        if(index >= this._count || index < 0)
            throw new Error('Remove exceed boundary')
        const lastIndex = this._count - 1;
        if(index === lastIndex) {
            this._count--;
            return null;
        }
        
        this._componentRawArray.cursor = lastIndex;
        const data = this._componentRawArray.read();
        this._componentRawArray.cursor = index;
        this._componentRawArray.write(data);
        this._count = lastIndex;
        return data;
    }

    get(index: number): T {
        if(index >= this._count || index < 0)
            throw new Error('Get exceed boundary')
        this._componentRawArray.cursor = index;
        return this._componentRawArray.read();
    }

    set(index: number, value: T): void {
        if(index >= this._count || index < 0)
            throw new Error('Set exceed boundary')
        this._componentRawArray.cursor = index;
        this._componentRawArray.write(value);
    }

    *[Symbol.iterator](): Iterator<T, any, undefined> {
        let iterationCount = 0;
        for(let i = 0; i < this._count; ++i) {
            ++iterationCount;
            yield this.get(i);
        }
        return iterationCount;
    }
}



import { IComponentRawArray } from "./detail/ComponentDataArray";


interface IMultiTypeWriteBuffer {
    writeInt16(value: number): void;
    writeMultipleInt16(...values: Array<number>): void;
    writeInt32(value: number): void;
    writeMultipleInt32(...values: Array<number>): void;
    writeFloat32(value: number): void;
    writeMultipleFloat32(...values: Array<number>): void;
}

interface IMultiTypeReadBuffer {
    readInt16(): number;
    readMultipleInt16(count: number): Generator<number>;
    readInt32(): number;
    readMultipleInt32(count: number): Generator<number>;
    readFloat32(): number;
    readMultipleFloat32(count: number): Generator<number>;
}

export interface StructDefineConfig<T> {
    readonly read: (buffer: IMultiTypeReadBuffer) => T;
    readonly write: (buffer: IMultiTypeWriteBuffer, value: T) => void;
    readonly reset: (buffer: IMultiTypeWriteBuffer) => void;
}

interface IMultiTypeBufferParams {
    int16Count: number,
    int32Count: number,
    float32Count: number,
}

export class StructDefine<T> {
    private _multiTypeBufferParams: IMultiTypeBufferParams
    private _read: (buffer: IMultiTypeReadBuffer) => T;
    private _write: (buffer: IMultiTypeWriteBuffer, value: T) => void;
    private _reset: (buffer: IMultiTypeWriteBuffer) => void;

    constructor(config: StructDefineConfig<T>) {
        this._read = config.read;
        this._write = config.write;
        this._reset = config.reset;

        const params = {
            int16Count: 0,
            int32Count: 0,
            float32Count: 0,
        };
        this._multiTypeBufferParams = params;
        this._reset({
            writeInt16: (_: number) => params.int16Count++,
            writeMultipleInt16: (...values: Array<number>) => params.int16Count += values.length,
            writeInt32: (_: number) => params.int32Count++,
            writeMultipleInt32: (...values: Array<number>) => params.int32Count += values.length,
            writeFloat32: (_: number) => params.float32Count++,
            writeMultipleFloat32: (...values: Array<number>) => params.float32Count += values.length,
        });
    }

    private static StructComponentRawArray = class <T1> implements IComponentRawArray<T1> {
        readonly capacity: number;
        private _buffer: MultiTypeBuffer;
        private _structDefine: StructDefine<T1>;
        private _cursor = 0;

        constructor(capacity: number, structDefine: StructDefine<T1>) {
            this.capacity = capacity;
            this._structDefine = structDefine;
            const multiTypeBufferParams = {
                int16Count: structDefine._multiTypeBufferParams.int16Count * capacity,
                int32Count: structDefine._multiTypeBufferParams.int32Count * capacity,
                float32Count: structDefine._multiTypeBufferParams.float32Count * capacity,
            };
            this._buffer = new MultiTypeBuffer(multiTypeBufferParams);
        }
        set cursor(pos: number) {
            if(pos === this._cursor)
                return;
            const { _multiTypeBufferParams: multiTypeBufferParams } = this._structDefine;
            const buffer = this._buffer;
            buffer.int16Offset = multiTypeBufferParams.int16Count * pos;
            buffer.int32Offset = multiTypeBufferParams.int32Count * pos;
            buffer.float32Offset = multiTypeBufferParams.float32Count * pos;
            this._cursor = pos;
        }
        get cursor(): number {
            return this._cursor;
        }
        read(): T1 {
            const r = this._structDefine._read(this._buffer);
            this._cursor++;
            return r;
        }
        write(value: T1): void {
            this._structDefine._write(this._buffer, value);
            this._cursor++;
        }
        reset(): void {
            this._structDefine._reset(this._buffer);
            this._cursor++;
        }
    }

    createComponentRawArray(capacity: number): IComponentRawArray<T> {
        return new StructDefine.StructComponentRawArray(capacity, this);
    }
}

class MultiTypeBuffer implements IMultiTypeWriteBuffer, IMultiTypeReadBuffer {
    int16Offset = 0;
    private _int16Array: Int16Array | null = null;
    int32Offset = 0;
    private _int32Array: Int32Array | null = null;
    float32Offset = 0;
    private _float32Array: Float32Array | null = null;

    constructor({ int16Count = 0, int32Count = 0, float32Count = 0 }) {
        if(int16Count > 0) {
            this._int16Array = new Int16Array(int16Count);
            this.int16Offset = 0;
        }
        if(int32Count > 0) {
            this._int32Array = new Int32Array(int32Count);
            this.int32Offset = 0;
        }
        if(float32Count > 0) {
            this._float32Array = new Float32Array(float32Count);
            this.float32Offset = 0;
        }
    }

    readInt16() {
        if(this._int16Array === null)
            throw new Error('No int16Array');
        const [a, b, c, d] = this._int16Array;
        return this._int16Array[this.int16Offset++];
    }
    *readMultipleInt16(count: number) {
        const array = this._int16Array;
        if(array === null)
            throw new Error('No int16Array');
        const begin = this.int16Offset;
        const end = this.int16Offset + count;
        this.int16Offset = end;
        for(let i = begin; i < end; ++i) {
            yield array[i];
        }
        return count;
    }
    writeInt16(value: number) {
        if(this._int16Array === null)
            throw new Error('No int16Array');
        this._int16Array[this.int16Offset++] = value;
    }
    writeMultipleInt16(...values: Array<number>) {
        const array = this._int16Array;
        if(array === null)
            throw new Error('No int16Array');
        const begin = this.int16Offset;
        const count = values.length;
        for(let i = 0; i < count; ++i) {
            array[i + begin] = values[i];
        }
        this.int16Offset = begin + count;
    }
    readInt32() {
        if(this._int32Array === null)
            throw new Error('No int32Array');
        return this._int32Array[this.int32Offset++];
    }
    *readMultipleInt32(count: number) {
        const array = this._int32Array;
        if(array === null)
            throw new Error('No int32Array');
        const begin = this.int32Offset;
        const end = this.int32Offset + count;
        this.int32Offset = end;
        for(let i = begin; i < end; ++i) {
            yield array[i];
        }
        return count;
    }
    writeInt32(value: number) {
        if(this._int32Array === null)
            throw new Error('No int32Array');
        this._int32Array[this.int32Offset++] = value;
    }
    writeMultipleInt32(...values: Array<number>) {
        const array = this._int32Array;
        if(array === null)
            throw new Error('No int32Array');
        const begin = this.int32Offset;
        const count = values.length;
        for(let i = 0; i < count; ++i) {
            array[i + begin] = values[i];
        }
        this.int32Offset = begin + count;
    }
    readFloat32() {
        if(this._float32Array === null)
            throw new Error('No float32Array');
        return this._float32Array[this.float32Offset++];
    }
    *readMultipleFloat32(count: number) {
        const array = this._float32Array;
        if(array === null)
            throw new Error('No float32Array');
        const begin = this.float32Offset;
        const end = this.float32Offset + count;
        this.float32Offset = end;
        for(let i = begin; i < end; ++i) {
            yield array[i];
        }
        return count;
    }
    writeFloat32(value: number) {
        if(this._float32Array === null)
            throw new Error('No float32Array');
        this._float32Array[this.float32Offset++] = value;
    }
    writeMultipleFloat32(...values: Array<number>) {
        const array = this._float32Array;
        if(array === null)
            throw new Error('No float32Array');
        const begin = this.float32Offset;
        const count = values.length;
        for(let i = 0; i < count; ++i) {
            array[i + begin] = values[i];
        }
        this.float32Offset = begin + count;
    }
}
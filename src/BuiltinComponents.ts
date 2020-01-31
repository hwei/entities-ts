import { StructDefine } from './StructComponentRawArray';
import { EmptyComponentRawArray } from './EmptyComponentRawArray';

export class Entity {
    readonly entityId: number;
    readonly version: number;

    constructor(entityId: number, version: number) {
        this.entityId = entityId;
        this.version = version;
    }

    toString() {
        return `Entity(${this.entityId}, ${this.version})`;
    }

    private static structDefine = new StructDefine<Entity>({
        read(buffer) {
            const entityId = buffer.readInt16();
            const version = buffer.readInt16();
            return new Entity(entityId, version);
        },
        write(buffer, entity) {
            buffer.writeInt16(entity.entityId);
            buffer.writeInt16(entity.version);
        },
        reset(buffer) {
            buffer.writeInt16(0);
            buffer.writeInt16(0);
        },
    });

    static createRawArray(capacity: number) {
        return Entity.structDefine.createComponentRawArray(capacity);
    }
}

export class AliveTag {
    static readonly instance = new AliveTag();
    static createRawArray(capacity: number) {
        return new EmptyComponentRawArray(capacity, AliveTag.instance);
    }
}

export class Translation {
    x: number;
    y: number;
    z: number;

    constructor();
    constructor(x: number, y: number, z: number);
    constructor(x?: number, y?: number, z?: number) {
        this.x = x || 0;
        this.y = y || 0;
        this.z = z || 0;
    }

    private static structDefine = new StructDefine<Translation>({
        read(buffer) {
            const r = new Translation();
            [r.x, r.y, r.z] = [...buffer.readMultipleFloat32(3)];
            return r;
        },
        write(buffer, translation) {
            buffer.writeMultipleFloat32(translation.x, translation.y, translation.z);
        },
        reset(buffer) {
            buffer.writeMultipleFloat32(0, 0, 0);
        },
    });

    static createRawArray(capacity: number) {
        return Translation.structDefine.createComponentRawArray(capacity);
    }
}

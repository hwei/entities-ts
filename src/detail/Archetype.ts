import { Entity, AliveTag } from "../BuiltinComponents";
import { IComponentRawArray, ComponentDataArray } from './ComponentDataArray';

export interface IComponentCtor<T> {
    new(): T;
    createRawArray(capacity: number): IComponentRawArray<T>;
    isSystemState?: true;
}

export class Archetype {
    private static readonly _chunkCapacity = 512;
    readonly archetypeString: string;
    readonly componentCtors: Array<IComponentCtor<any>>;
    private _entityDataArray: Array<ComponentDataArray<Entity>>;
    private _componentDataArrayMap: Map<string, Array<ComponentDataArray<any>>>;
    private _chunkArray: Array<Chunk>;
    private _systemStateComponentCtors: Array<IComponentCtor<any>> | null;
    private _componentCtorMap: Map<string, IComponentCtor<any>> | null;
    private _entityCount: number;

    static createEmpty() {
        return new Archetype('type<>', []);
    }

    constructor(archetypeString: string, sortedComponentCtors: Array<IComponentCtor<any>>) {
        this.archetypeString = archetypeString;
        this.componentCtors = sortedComponentCtors;
        this._entityDataArray = [];
        this._componentDataArrayMap = new Map();
        for(const componentCtor of sortedComponentCtors) {
            this._componentDataArrayMap.set(componentCtor.name, []);
        }
        this._chunkArray = [];
        this._systemStateComponentCtors = null;
        this._componentCtorMap = null;
        this._entityCount = 0;
    }

    get entityCount() {
        return this._entityCount;
    }

    getSystemStateComponentCtors() {
        let systemStateComponentCtors = this._systemStateComponentCtors;
        if(systemStateComponentCtors === null) {
            systemStateComponentCtors = new Array<IComponentCtor<any>>();
            this._systemStateComponentCtors = systemStateComponentCtors;
            for(const c of this.componentCtors) {
                if(c.isSystemState) {
                    systemStateComponentCtors.push(c);
                }
            }
        }
        return systemStateComponentCtors;
    }

    iterChunks() {
        return this._chunkArray[Symbol.iterator]();
    }

    getChunk(chunkIndex: number) {
        return this._chunkArray[chunkIndex];
    }

    addEntityData(data: Map<string, object>, entity?: Entity) {
        let chunkIndex = 0;
        let chunk: Chunk | null = null;
        const chunkArray = this._chunkArray;
        for(let i = 0; i < chunkArray.length; ++i) {
            const c = chunkArray[i];
            if(!c.isFull) {
                chunkIndex = i;
                chunk = c;
                break;
            }
        }
        if(chunk === null) {
            chunk = this._createChunk();
            chunkIndex = chunkArray.length;
            chunkArray.push(chunk);
        }
        const entityIndex = chunk.addEntity(data, entity);
        this._entityCount++;
        return {
            chunkIndex,
            entityIndex,
        };
    }

    removeEntityData(chunkIndex: number, entityIndex: number) {
        const chunk = this._chunkArray[chunkIndex];
        const movedEntity = chunk.removeEntity(entityIndex);
        this._entityCount--;
        return movedEntity;
    }

    private _createChunk() {
        const capacity = Archetype._chunkCapacity;
        const rawArray = Entity.createRawArray(capacity);
        const chunkIndex = this._entityDataArray.length;
        this._entityDataArray.push(new ComponentDataArray(rawArray));
        for(const componentCtor of this.componentCtors) {
            const rawArray = componentCtor.createRawArray(capacity);
            const componentDataArray = this._componentDataArrayMap.get(componentCtor.name);
            if(componentDataArray === undefined)
                throw new Error('No componentDataArray for ' + componentCtor.name);
            componentDataArray.push(new ComponentDataArray(rawArray));
        }
        return new Chunk(this._entityDataArray, this._componentDataArrayMap, this.componentCtors, chunkIndex);
    }

    private _getComponentCtorMap() {
        let componentCtorMap = this._componentCtorMap;
        if(componentCtorMap === null) {
            componentCtorMap = new Map();
            this._componentCtorMap = componentCtorMap;
            for(const c of this.componentCtors) {
                componentCtorMap.set(c.name, c);
            }
        }
        return componentCtorMap;
    }

    hasComponent(componentCtor: IComponentCtor<any>) {
        const componentCtorMap = this._getComponentCtorMap();
        return componentCtorMap.has(componentCtor.name);
    }
    
    matchQuery({ include, exclude }: {
        include: Array<IComponentCtor<any>>,
        exclude?: Array<IComponentCtor<any>>,
    }) {
        const componentCtorMap = this._getComponentCtorMap();
        for(const c of include) {
            if(!componentCtorMap.has(c.name)) {
                return false;
            }
        }
        if(exclude) {
            for(const c of exclude) {
                if(componentCtorMap.has(c.name)) {
                    return false;
                }
            }
        }
        return true;
    }
}

export class Chunk {
    private _entityDataArray: Array<ComponentDataArray<Entity>>;
    private _componentDataArrayMap: Map<string, Array<ComponentDataArray<any>>>;
    private _componentCtors: Array<IComponentCtor<any>>;
    private _chunkIndex: number;

    constructor(
        entityDataArray: Array<ComponentDataArray<Entity>>,
        componentDataArrayMap: Map<string, Array<ComponentDataArray<any>>>,
        componentCtors: Array<IComponentCtor<any>>,
        chunkIndex: number) {
        this._entityDataArray = entityDataArray;
        this._componentDataArrayMap = componentDataArrayMap;
        this._componentCtors = componentCtors;
        this._chunkIndex = chunkIndex;
    }

    get isFull() {
        const entityDataArray = this._entityDataArray[this._chunkIndex];
        return entityDataArray.count >= entityDataArray.capacity;
    }

    get capacity() {
        return this._entityDataArray[this._chunkIndex].capacity;
    }

    get count() {
        return this._entityDataArray[this._chunkIndex].count;
    }

    getDataArray<T>(c: IComponentCtor<T>): ComponentDataArray<T> | null {
        const componentDataArray = this._componentDataArrayMap.get(c.name);
        if(!componentDataArray)
            return null;
        return componentDataArray[this._chunkIndex];
    }

    getEntityArray() {
        return this._entityDataArray[this._chunkIndex];
    }

    addEntity(data: Map<string, object>, entity?: Entity) {
        const chunkIndex = this._chunkIndex;
        const index = this._entityDataArray[chunkIndex].add(entity);
        const componentDataArrayMap = this._componentDataArrayMap;
        for(const componentCtor of this._componentCtors) {
            const {name} = componentCtor;
            const componentDataArray = componentDataArrayMap.get(name);
            if(componentDataArray === undefined) {
                throw new Error('No compnentDataArray for ' + name);
            }
            componentDataArray[chunkIndex].add(data.get(name));
        }
        return index;
    }

    removeEntity(index: number) {
        const chunkIndex = this._chunkIndex;
        const entityDataArray = this._entityDataArray[chunkIndex];
        const movedEntity = entityDataArray.remove(index);
        const componentDataArrayMap = this._componentDataArrayMap;
        for(const componentCtor of this._componentCtors) {
            const {name} = componentCtor;
            const componentDataArray = componentDataArrayMap.get(name);
            if(componentDataArray === undefined) {
                throw new Error('No compnentDataArray for ' + name);
            }
            componentDataArray[chunkIndex].remove(index);
        }
        return movedEntity;
    }
};

export class ArchetypeDatabase {
    private _archetypeMap = new Map<string, Archetype>();
    private _version = 1;

    get version() {
        return this._version;
    }

    getArchetype(componentCtors: Iterable<IComponentCtor<any>>, addAliveTag = true) {
        const { archetypeString, sortedComponentCtors } = getArchetypeString(componentCtors, addAliveTag);
        if(this._archetypeMap.has(archetypeString)) {
            return <Archetype>this._archetypeMap.get(archetypeString);
        } else {
            const r = new Archetype(archetypeString, sortedComponentCtors);
            this._archetypeMap.set(archetypeString, r);
            this._version++;
            return r;
        }
    }

    archetypes() {
        return this._archetypeMap.values();
    }
}

function getArchetypeString(componentCtors: Iterable<IComponentCtor<any>>, addAliveTag: boolean) {
    const componentCtorArray = addAliveTag ? [...componentCtors, AliveTag] : [...componentCtors];
    if(componentCtorArray.length === 0)
        throw new Error('componentCtors.length == 0')
    componentCtorArray.sort(function(a, b){
        if(a.name < b.name) { return -1; }
        if(a.name > b.name) { return 1; }
        return 0;
    })
    let lastComponentCtor: IComponentCtor<any> | null = null;
    for(const componentCtor of componentCtorArray) {
        if(lastComponentCtor !== null) {
            if(lastComponentCtor.name === componentCtor.name) {
                throw new Error('Duplicated component ' + componentCtor.name);
            }
        }
        lastComponentCtor = componentCtor;
    }

    return {
        archetypeString: 'type<' + componentCtorArray.join(',') + '>',
        sortedComponentCtors: componentCtorArray,
    };
}
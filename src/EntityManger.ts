import { ArchetypeDatabase, Archetype, IComponentCtor, Chunk } from "./detail/Archetype";
import { Entity } from "./BuiltinComponents";

interface EntityInfo {
    archetype: Archetype;
    chunkIndex: number;
    entityIndex: number;
    version: number;
}

export interface IQueryDefine {
    include: Array<IComponentCtor<any>>;
    exclude?: Array<IComponentCtor<any>>;
}

class EntityIdManger {
    private _entityInfoArray: Array<EntityInfo>;
    private _availableIdArray = new Array<number>();

    constructor() {
        // first element is a place holder
        this._entityInfoArray = [{
            archetype: Archetype.createEmpty(),
            chunkIndex: 0,
            entityIndex: 0,
            version: 0,
        }]
    }

    addEntity(archetype: Archetype, chunkIndex: number, entityIndex: number) {
        // const { chunkIndex, entityIndex } = archetype.addEntityData(data);
        const availableIdArray = this._availableIdArray;
        const entityInfoArray = this._entityInfoArray;
        let entityId: number;
        let version: number;
        if(availableIdArray.length > 0) {
            entityId = <number>availableIdArray.pop();
            const entityInfo = entityInfoArray[entityId];
            entityInfo.archetype = archetype;
            entityInfo.chunkIndex = chunkIndex;
            entityInfo.entityIndex = entityIndex;
            version = entityInfo.version;
        } else {
            entityId = entityInfoArray.length;
            version = 1;
            entityInfoArray.push({
                archetype,
                chunkIndex,
                entityIndex,
                version,
            })
        }
        const entity = new Entity(entityId, version);
        archetype.getChunk(chunkIndex).getEntityArray().set(entityIndex, entity);
        return entity;
    }
    
    removeEntity(entity: Entity) {
        const entityInfo = this._entityInfoArray[entity.entityId];
        if(entityInfo.version !== entity.version) {
            throw new Error('Entity version expired')
        }
        entityInfo.version++;
        this._availableIdArray.push(entity.entityId);
    }

    getEntityInfo(entity: Entity) {
        const entityInfo = this._entityInfoArray[entity.entityId];
        return entityInfo.version === entity.version ? entityInfo : null;
    }
}

class ComponentCtorIterableAdptor {
    private _componentDataArray: Array<object>;

    constructor(componentDataArray: Array<object>) {
        this._componentDataArray = componentDataArray;
    }

    *[Symbol.iterator](): Iterator<IComponentCtor<any>, any, undefined> {
        for(const componentData of this._componentDataArray) {
            const ctor = componentData.constructor;
            const value = <IComponentCtor<any>>ctor;
            if(!value.createRawArray) {
                throw new Error(`Class ${ctor.name} is missing static method createRawArray`)
            }
            yield value;
        }
        return this._componentDataArray.length;
    }
}

export class EntityManager {
    private _archetypeDatabase: ArchetypeDatabase;
    private _entityIdManger: EntityIdManger;
    private _tmpDataMap = new Map<string, object>();
    private _queryMap = new Map<string, IQuery>();

    constructor() {
        this._archetypeDatabase = new ArchetypeDatabase();
        this._entityIdManger = new EntityIdManger();
    }

    getArchetype(...componentCtor: Array<IComponentCtor<any>>) {
        return this._archetypeDatabase.getArchetype(componentCtor);
    }
    createEntityOfArchetype(archetype: Archetype, ...componentDataArray: Array<object>) {
        const tmpDataMap = this._tmpDataMap;
        for(const componentData of componentDataArray) {
            tmpDataMap.set(componentData.constructor.name, componentData);
        }
        const { chunkIndex, entityIndex } = archetype.addEntityData(tmpDataMap);
        tmpDataMap.clear();
        return this._entityIdManger.addEntity(archetype, chunkIndex, entityIndex);
    }
    createEntity(...componentDataArray: Array<object>) {
        if(componentDataArray.length === 0) {
            throw new Error('Can not add empty entity');
        }
        const archetype = this._archetypeDatabase.getArchetype(new ComponentCtorIterableAdptor(componentDataArray));
        return this.createEntityOfArchetype(archetype, ...componentDataArray);
    }
    private static *_getComponentData(archetype: Archetype, chunkIndex: number, entityIndex: number, componentCtorArray: Iterable<IComponentCtor<any>>) {
        const chunk = archetype.getChunk(chunkIndex);
        let count = 0;
        for(const componentCtor of componentCtorArray) {
            const componentDataArray = chunk.getDataArray(componentCtor);
            if(componentDataArray === null)
                throw new Error('No componentDataArray for ' + componentCtor.name);
            yield componentDataArray.get(entityIndex);
            ++count;
        }
        return count;
    }
    hasComponent(entity: Entity, componentCtor: IComponentCtor<any>) {
        const entityInfo = this._entityIdManger.getEntityInfo(entity);
        if(!entityInfo) {
            throw new Error('Invalid entity ' + entity);
        }
        const { archetype } = entityInfo;
        return archetype.hasComponent(componentCtor);
    }
    getComponentData(entity: Entity, ...componentCtorArray: Array<IComponentCtor<any>>) {
        const entityInfo = this._entityIdManger.getEntityInfo(entity);
        if(!entityInfo) {
            throw new Error('Invalid entity ' + entity);
        }
        const { archetype, chunkIndex, entityIndex } = entityInfo;
        return EntityManager._getComponentData(archetype, chunkIndex, entityIndex, componentCtorArray);
    }
    addComponent(entity: Entity, ...componentDataArray: Array<object>) {
        const entityInfo = this._entityIdManger.getEntityInfo(entity);
        if(!entityInfo) {
            console.trace('Invalid entity ', entity);
            return false;
        }
        const { archetype: oldArchetype, chunkIndex: oldChunkIndex, entityIndex: oldEntityIndex } = entityInfo;
        const componentCtorMap = new Map<string, IComponentCtor<any>>();
        for(const c of oldArchetype.componentCtors) {
            componentCtorMap.set(c.name, c);
        }
        const componentDataMap = new Map<string, any>();
        for(const d of componentDataArray) {
            const ctor = <IComponentCtor<any>>d.constructor;
            if(!ctor.createRawArray) {
                console.trace(ctor, 'is not a component class, in addComponent ', entity);
                return false;
            }
            if(componentCtorMap.has(ctor.name)) {
                console.trace(ctor, ' has already add to entity, in addComponent ', entity);
                return false;
            }
            componentCtorMap.set(ctor.name, ctor);
            componentDataMap.set(ctor.name, d);
        }
        let i = 0;
        for(const d of EntityManager._getComponentData(oldArchetype, oldChunkIndex, oldEntityIndex, oldArchetype.componentCtors)) {
            const ctor = oldArchetype.componentCtors[i++];
            componentDataMap.set(ctor.name, d);
        }

        const movedEntity = oldArchetype.removeEntityData(oldChunkIndex, oldEntityIndex);
        if(movedEntity) {
            const movedEntityInfo = this._entityIdManger.getEntityInfo(movedEntity);
            if(movedEntityInfo === null)
                throw new Error('Invalid entity ' + movedEntity);
            movedEntityInfo.entityIndex = oldEntityIndex;
        }

        const newArchetype = this._archetypeDatabase.getArchetype(componentCtorMap.values(), false);
        const { chunkIndex: newChunkIndex, entityIndex: newEntityIndex } = newArchetype.addEntityData(componentDataMap, entity);
        entityInfo.archetype = newArchetype;
        entityInfo.chunkIndex = newChunkIndex;
        entityInfo.entityIndex = newEntityIndex;
        return true;
    }
    removeComponent(entity: Entity, ...componentCtorArray: Array<IComponentCtor<any>>) {
        const entityIdManger = this._entityIdManger;
        const entityInfo = entityIdManger.getEntityInfo(entity);
        if(!entityInfo) {
            console.trace('Invalid entity ', entity);
            return false;
        }
        const { archetype: oldArchetype, chunkIndex: oldChunkIndex, entityIndex: oldEntityIndex } = entityInfo;
        const componentCtorMap = new Map<string, IComponentCtor<any>>();
        for(const c of oldArchetype.componentCtors) {
            componentCtorMap.set(c.name, c);
        }
        for(const c of componentCtorArray) {
            if(!componentCtorMap.has(c.name)) {
                console.trace(c, ' dose not exist in entity, in removeComponent ', entity);
                return false;
            }
            componentCtorMap.delete(c.name);
        }
        const componentDataMap = new Map<string, any>();
        let i = 0;
        const newComponentCtorArray = [...componentCtorMap.values()];
        for(const d of EntityManager._getComponentData(oldArchetype, oldChunkIndex, oldEntityIndex, newComponentCtorArray)) {
            const ctor = newComponentCtorArray[i++];
            componentDataMap.set(ctor.name, d);
        }

        const movedEntity = oldArchetype.removeEntityData(oldChunkIndex, oldEntityIndex);
        if(movedEntity) {
            const movedEntityInfo = entityIdManger.getEntityInfo(movedEntity);
            if(movedEntityInfo === null)
                throw new Error('Invalid entity ' + movedEntity);
            movedEntityInfo.entityIndex = oldEntityIndex;
        }

        if(componentCtorMap.size === 0) {
            // this entity should be deleted
            entityIdManger.removeEntity(entity);
        } else {
            const newArchetype = this._archetypeDatabase.getArchetype(newComponentCtorArray, false);
            const { chunkIndex: newChunkIndex, entityIndex: newEntityIndex } = newArchetype.addEntityData(componentDataMap, entity);
            entityInfo.archetype = newArchetype;
            entityInfo.chunkIndex = newChunkIndex;
            entityInfo.entityIndex = newEntityIndex;
        }
        return true;
    }
    deleteEntity(entity: Entity) {
        const entityIdManger = this._entityIdManger;
        const entityInfo = entityIdManger.getEntityInfo(entity);
        if(!entityInfo) {
            console.trace('Invalid entity ', entity);
            return false;
        }
        const { archetype, chunkIndex, entityIndex } = entityInfo;
        const systemStateComponentCtors = archetype.getSystemStateComponentCtors();
        if(systemStateComponentCtors.length === 0) {
            entityIdManger.removeEntity(entity);
        } else {
            const componentDataMap = new Map<string, any>();
            let i = 0;
            for(const d of EntityManager._getComponentData(archetype, chunkIndex, entityIndex, systemStateComponentCtors)) {
                const ctor = systemStateComponentCtors[i++];
                componentDataMap.set(ctor.name, d);
            }

            const newArchetype = this._archetypeDatabase.getArchetype(systemStateComponentCtors, false);
            const { chunkIndex: newChunkIndex, entityIndex: newEntityIndex } = newArchetype.addEntityData(componentDataMap, entity);
            entityInfo.archetype = newArchetype;
            entityInfo.chunkIndex = newChunkIndex;
            entityInfo.entityIndex = newEntityIndex;
        }

        const movedEntity = archetype.removeEntityData(chunkIndex, entityIndex);
        if(movedEntity) {
            const movedEntityInfo = entityIdManger.getEntityInfo(movedEntity);
            if(movedEntityInfo === null)
                throw new Error('Invalid entity ' + movedEntity);
            movedEntityInfo.entityIndex = entityIndex;
        }
        
        return true;
    }
    getQuery(queryDefine: IQueryDefine): IQuery {
        const includeNames = new Array<string>();
        for(const ctor of queryDefine.include) {
            includeNames.push(ctor.name);
        }
        includeNames.sort();
        let eStr = '';
        if(queryDefine.exclude) {
            const excludeNames = new Array<string>();
            for(const ctor of queryDefine.exclude) {
                excludeNames.push(ctor.name);
            }
            excludeNames.sort();
            eStr = ',e=' + excludeNames.join(',');
        }

        const queryString = `query<i=${includeNames.join(',')}${eStr}>`;
        let r = this._queryMap.get(queryString);
        if(!r) {
            if(includeNames.length === 0 && eStr === '') {
                r = new FullQuery(this._archetypeDatabase);
            } else {
                r = new Query(this._archetypeDatabase, queryDefine);
            }
            this._queryMap.set(queryString, r);
        }
        return r;
    }
}

export interface IQuery {
    iterChunks(): Iterable<Chunk>;
    isEmptyIgnoreFilter(): boolean;
}

class Query {
    private _archetypeDatabase: ArchetypeDatabase;
    private _queryDefine: IQueryDefine;
    private _matchedArchetypeArray: Array<Archetype> | null = null;
    private _version = 0;

    constructor(archetypeDatabase: ArchetypeDatabase, queryDefine: IQueryDefine) {
        this._archetypeDatabase = archetypeDatabase;
        this._queryDefine = queryDefine;
    }

    private _getMatchedArchetypeArray(): Array<Archetype> {
        let matchedArchetypeArray = this._matchedArchetypeArray;
        if(this._version !== this._archetypeDatabase.version) {
            matchedArchetypeArray = [];
            this._matchedArchetypeArray = matchedArchetypeArray;
            for(const archetype of this._archetypeDatabase.archetypes()) {
                if(archetype.matchQuery(this._queryDefine)) {
                    matchedArchetypeArray.push(archetype);
                }
            }
            this._version = this._archetypeDatabase.version;
        }
        return <Array<Archetype>>matchedArchetypeArray;
    }

    isEmptyIgnoreFilter() {
        for(const archetype of this._getMatchedArchetypeArray()) {
            if(archetype.entityCount !== 0)
                return false;
        }
        return true;
    }

    *iterChunks() {
        let count = 0;
        for(const archetype of this._getMatchedArchetypeArray()) {
            if(archetype.entityCount === 0)
                continue;
            for(const chunk of archetype.iterChunks()) {
                if(chunk.count === 0)
                    continue;
                yield chunk;
                ++count;
            }
        }
        return count;
    }
}

class FullQuery {
    private _archetypeDatabase: ArchetypeDatabase;

    constructor(archetypeDatabase: ArchetypeDatabase) {
        this._archetypeDatabase = archetypeDatabase;
    }

    isEmptyIgnoreFilter() {
        for(const archetype of this._archetypeDatabase.archetypes()) {
            if(archetype.entityCount !== 0)
                return false;
        }
        return true;
    }

    *iterChunks() {
        let count = 0;
        for(const archetype of this._archetypeDatabase.archetypes()) {
            if(archetype.entityCount === 0)
                continue;
            for(const chunk of archetype.iterChunks()) {
                if(chunk.count === 0)
                    continue;
                yield chunk;
                ++count;
            }
        }
        return count;
    }
}
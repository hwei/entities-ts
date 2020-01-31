import { ComponentSystem, World } from "../World";
import { Entity } from "../BuiltinComponents";
import { IComponentCtor } from "../detail/Archetype";

export class PostRemoveComponentSystem extends ComponentSystem {
    private _queue = new Array<{ entity: Entity, componentCtors: Array<IComponentCtor<any>> }>();
    
    enqueue(entity: Entity, ...componentCtors: Array<IComponentCtor<any>>) {
        this._queue.push({
            entity,
            componentCtors,
        });
    }

    createUpdateFuction(world: World) {
        const { entityManager } = world;
        return {
            logicUpdate: () => {
                for(const { entity, componentCtors } of this._queue) {
                    entityManager.removeComponent(entity, ...componentCtors);
                }
                this._queue.length = 0;
            }
        }
    }
}
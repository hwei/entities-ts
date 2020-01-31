import { ComponentSystem, World } from "../World";
import { Entity } from "../BuiltinComponents";


export class PostDeleteEntitySystem extends ComponentSystem {
    private _queue = new Array<Entity>();
    
    enqueue(entity: Entity) {
        this._queue.push(entity);
    }

    createUpdateFuction(world: World) {
        const { entityManager } = world;
        return {
            logicUpdate: () => {
                for(const entity of this._queue) {
                    entityManager.deleteEntity(entity);
                }
                this._queue.length = 0;
            }
        }
    }
}
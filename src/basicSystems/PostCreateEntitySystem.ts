import { ComponentSystem, World } from "../World";
import { Archetype } from "../detail/Archetype";


export class PostCreateEntitySystem extends ComponentSystem {
    private _queue = new Array<{ archetype: Archetype, componentDataArray: Array<object> }>();
    
    enqueue(archetype: Archetype, ...componentDataArray: Array<object>) {
        this._queue.push({ archetype, componentDataArray });
    }

    createUpdateFuction(world: World) {
        const { entityManager } = world;
        return {
            logicUpdate: () => {
                for(const { archetype, componentDataArray } of this._queue) {
                    entityManager.createEntityOfArchetype(archetype, ...componentDataArray);
                }
                this._queue.length = 0;
            }
        }
    }
}
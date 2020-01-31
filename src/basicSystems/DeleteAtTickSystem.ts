import { ComponentSystem, World, ITimeInfo } from "../World";
import { StructDefine } from "../StructComponentRawArray";
import { PostDeleteEntitySystem } from "./PostDeleteEntitySystem";

export class DeleteAtTickComponent {
    constructor(public tick = 0) {
    }

    private static structDefine = new StructDefine<DeleteAtTickComponent>({
        read(buffer) {
            const v = new DeleteAtTickComponent();
            v.tick = buffer.readInt32();
            return v;
        },
        write(buffer, v) {
            buffer.writeInt32(v.tick);
        },
        reset(buffer) {
            buffer.writeInt32(0);
        },
    });
    static createRawArray(capacity: number) {
        return DeleteAtTickComponent.structDefine.createComponentRawArray(capacity);
    }
}

export class DeleteAtTickSystem extends ComponentSystem {
 
    createUpdateFuction(world: World) {
        const { entityManager } = world;
        const query = entityManager.getQuery({
            include: [DeleteAtTickComponent]
        })
        const postDeleteEntitySystem = world.getSystem(PostDeleteEntitySystem);

        return {
            logicUpdate: (timeInfo: ITimeInfo) => {
                if(query.isEmptyIgnoreFilter())
                    return;
                const { tick } = timeInfo;
                for(const chunk of query.iterChunks()) {
                    const entityArray = chunk.getEntityArray();
                    const deleteTickArray = chunk.getDataArray(DeleteAtTickComponent);
                    if(deleteTickArray === null)
                        throw new Error();
                    for(let i = 0; i < chunk.count; ++i) {
                        if (deleteTickArray.get(i).tick <= tick) {
                            postDeleteEntitySystem.enqueue(entityArray.get(i));
                        }
                    }
                }
            }
        }
    }
}
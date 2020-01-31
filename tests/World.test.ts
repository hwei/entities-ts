import { expect } from 'chai';
import { EmptyComponentRawArray } from "../src/EmptyComponentRawArray";
import { World } from "../src/World";
import { Entity, Translation, AliveTag } from "../src/BuiltinComponents";

class Ball {
    static readonly instance = new Ball();
    static createRawArray(capacity: number) {
        return new EmptyComponentRawArray(capacity, Ball.instance);
    }
}

class Bullet {
    static readonly instance = new Bullet();
    static readonly isSystemState = true;
    static createRawArray(capacity: number) {
        return new EmptyComponentRawArray(capacity, Bullet.instance);
    }
}


describe('World', function() {
    const world = new World([]);
    const { entityManager } = world;
    it('works', function() {
        const entity0 = entityManager.createEntity(Ball.instance, new Translation(1, 2, 3));
        expect(entity0.entityId).equal(1);
        expect(entity0.version).equal(1);
        const entity1 = entityManager.createEntity(Ball.instance, new Translation(8, 9, 10));
        expect(entity1.entityId).equal(2);
        expect(entity1.version).equal(1);
        const ballQuery = entityManager.getQuery({
            include: [ Ball ],
        })
        const fullQuery = entityManager.getQuery({ include: []});
        const bulletDestroyQuery = entityManager.getQuery({
            include: [ Bullet ],
            exclude: [ AliveTag ],
        })

        expect(ballQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of ballQuery.iterChunks()) {
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            if(translationArray === null)
                throw new Error();

            expect(chunk.count).equal(2);

            expect(entityArray.get(0)).deep.equal({
                entityId: 1,
                version: 1,
            });
            expect(entityArray.get(1)).deep.equal({
                entityId: 2,
                version: 1,
            });

            expect(translationArray.get(0)).deep.equal({
                x: 1,
                y: 2,
                z: 3,
            });
            expect(translationArray.get(1)).deep.equal({
                x: 8,
                y: 9,
                z: 10,
            });
        }

        entityManager.removeComponent(entity0, Translation);
        expect(ballQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of ballQuery.iterChunks()) {
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            if (translationArray === null) {
                expect(entityArray.get(0)).deep.equal({
                    entityId: 1,
                    version: 1,
                })
            } else {
                expect(entityArray.get(0)).deep.equal({
                    entityId: 2,
                    version: 1,
                })
                expect(translationArray.get(0)).deep.equal({
                    x: 8,
                    y: 9,
                    z: 10,
                })
            }
        }

        entityManager.addComponent(entity0, new Translation(9, 9, 9));
        expect(ballQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of ballQuery.iterChunks()) {
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            if(translationArray === null)
                throw new Error();

            expect(chunk.count).equal(2);

            expect(entityArray.get(0)).deep.equal({
                entityId: 2,
                version: 1,
            });
            expect(entityArray.get(1)).deep.equal({
                entityId: 1,
                version: 1,
            });

            expect(translationArray.get(0)).deep.equal({
                x: 8,
                y: 9,
                z: 10,
            });
            expect(translationArray.get(1)).deep.equal({
                x: 9,
                y: 9,
                z: 9,
            });
        }

        entityManager.deleteEntity(entity0);
        expect(fullQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of fullQuery.iterChunks()) {
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            if(translationArray === null)
                throw new Error();
            expect(chunk.count).equal(1);

            expect(entityArray.get(0)).deep.equal({
                entityId: 2,
                version: 1,
            });
            expect(translationArray.get(0)).deep.equal({
                x: 8,
                y: 9,
                z: 10,
            });
        }

        const entity2 = entityManager.createEntity(Bullet.instance, new Translation(7, 7, 7));
        expect(fullQuery.isEmptyIgnoreFilter()).false;
        let n = 0;
        for(const chunk of fullQuery.iterChunks()) {
            expect(chunk.count).equal(1);
            n++;
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            if(translationArray === null)
                throw new Error();
            const ballArray = chunk.getDataArray(Ball);
            const bulletArray = chunk.getDataArray(Bullet);
            if(ballArray === null) {
                if(bulletArray === null)
                    throw new Error();
                expect(entityArray.get(0)).deep.equal({
                    entityId: 1,
                    version: 2,
                });
                expect(translationArray.get(0)).deep.equal({
                    x: 7,
                    y: 7,
                    z: 7,
                });
                
            } else {
                if(ballArray === null)
                    throw new Error();
                expect(entityArray.get(0)).deep.equal({
                    entityId: 2,
                    version: 1,
                });
                expect(translationArray.get(0)).deep.equal({
                    x: 8,
                    y: 9,
                    z: 10,
                });
            }
        }
        expect(n).equal(2);

        expect(bulletDestroyQuery.isEmptyIgnoreFilter()).true;
        entityManager.deleteEntity(entity2);
        expect(fullQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of fullQuery.iterChunks()) {
            const ballArray = chunk.getDataArray(Ball);
            const bulletArray = chunk.getDataArray(Bullet);
            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);

            if(ballArray === null) {
                if(bulletArray === null)
                    throw new Error();
                expect(translationArray).null;
                expect(entityArray.get(0)).deep.equal({
                    entityId: 1,
                    version: 2,
                });
            } else {
                if(ballArray === null)
                    throw new Error();
                if(translationArray === null)
                    throw new Error();
                expect(entityArray.get(0)).deep.equal({
                    entityId: 2,
                    version: 1,
                });
                expect(translationArray.get(0)).deep.equal({
                    x: 8,
                    y: 9,
                    z: 10,
                });
            }
        }

        expect(bulletDestroyQuery.isEmptyIgnoreFilter()).false;
        const clearEntityArray = new Array<Entity>();
        for(const chunk of bulletDestroyQuery.iterChunks()) {
            const entityArray = chunk.getEntityArray();
            for(let i = 0; i < chunk.count; ++i) {
                clearEntityArray.push(entityArray.get(i));
            }
        }
        expect(clearEntityArray).deep.equal([ { entityId: 1, version: 2 } ]);
        for(const e of clearEntityArray) {
            entityManager.removeComponent(e, Bullet);
        }

        expect(fullQuery.isEmptyIgnoreFilter()).false;
        for(const chunk of fullQuery.iterChunks()) {
            expect(chunk.count).equal(1);

            const ballArray = chunk.getDataArray(Ball);
            const bulletArray = chunk.getDataArray(Bullet);

            expect(ballArray).not.null;
            expect(bulletArray).null;

            const entityArray = chunk.getEntityArray();
            const translationArray = chunk.getDataArray(Translation);
            
            if(translationArray === null)
                throw new Error();

            expect(entityArray.get(0)).deep.equal({
                entityId: 2,
                version: 1,
            });
            expect(translationArray.get(0)).deep.equal({
                x: 8,
                y: 9,
                z: 10,
            });
        }
    }); 
});
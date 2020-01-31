import { EntityManager } from "./entityManger";

export class World {
    readonly entityManager: EntityManager;
    private _systemMap: Map<string, ComponentSystem>;
    private _logicUpdateArray: Array<IUpdateFunctions>;
    private _presentUpdateArray: Array<IUpdateFunctions>;
    private _maxTickPerframe: number;
    private _timeInfo: ITimeInfo;
    private _nextTickTime: number | undefined = undefined;
    private _logicDelayTime = 0;

    constructor(systems: Iterable<ComponentSystem>, tickInterval = 1 / 30, maxTickPerframe = 2) {
        this.entityManager = new EntityManager();
        const systemMap = new Map();
        this._systemMap = systemMap;
        for(const system of systems) {
            systemMap.set(system.constructor.name, system);
        }
        this._logicUpdateArray = [];
        this._presentUpdateArray = [];
        for(const system of systems) {
            const updateFunctions = system.createUpdateFuction(this);
            const { logicUpdate, presentUpdate } = updateFunctions;
            if(logicUpdate !== undefined)
                this._logicUpdateArray.push(updateFunctions);
            if(presentUpdate !== undefined)
                this._presentUpdateArray.push(updateFunctions);
        }
        this._timeInfo = {
            tickInterval,
            tick: 0,
            tickTime: 0,
            presentTime: 0,
        }
        this._maxTickPerframe = maxTickPerframe;
    }

    getSystem<T extends ComponentSystem>(ctor: new (...args: any[]) => T): T {
        const r = this._systemMap.get(ctor.name);
        if (r === undefined)
            throw new Error('No system named ' + ctor.name);
        return <T>r;
    }

    update(time: number) {
        // time == logicDelayTime + presentTime
        // presentTime == tick * tickInterval + fragTime
        const timeInfo = this._timeInfo;
        if(this._nextTickTime === undefined) {
            this._nextTickTime = time + timeInfo.tickInterval;
            timeInfo.tick = 1;
            timeInfo.tickTime = timeInfo.tickInterval;
            timeInfo.presentTime = timeInfo.tickInterval;
            this._logicDelayTime = time - timeInfo.presentTime;
            this._logicUpdate(timeInfo);
            this._presentUpdate(timeInfo);
            return;
        }
        let tickPerframe = 0;
        while(time >= this._nextTickTime) {
            timeInfo.tick++;
            const tickTime = timeInfo.tick * timeInfo.tickInterval;
            timeInfo.tickTime = tickTime;
            timeInfo.presentTime = tickTime;
            this._nextTickTime += timeInfo.tickInterval;
            this._logicUpdate(timeInfo);
            tickPerframe++;

            if(tickPerframe >= this._maxTickPerframe) {
                break;
            }
        }
        let presentTime = time - this._logicDelayTime;
        const fragTime = presentTime - timeInfo.tickTime;
        if(fragTime >= timeInfo.tickInterval) {
            // logic too slow, delay the game time
            this._logicDelayTime += fragTime;
            presentTime = timeInfo.tickTime; 
            this._nextTickTime = time + timeInfo.tickInterval;
        }
        timeInfo.presentTime = presentTime;
        this._presentUpdate(timeInfo);
    }

    private _logicUpdate(timeInfo: ITimeInfo) {
        for(const updateFunctions of this._logicUpdateArray) {
            try {
                if(updateFunctions.logicUpdate === undefined)
                    throw new Error();
                updateFunctions.logicUpdate(timeInfo);
            } catch (ex) {
                console.trace(ex);
            }
        }
    }

    private _presentUpdate(timeInfo: ITimeInfo) {
        for(const updateFunctions of this._presentUpdateArray) {
            try {
                if(updateFunctions.presentUpdate === undefined)
                    throw new Error();
                updateFunctions.presentUpdate(timeInfo);
            } catch (ex) {
                console.trace(ex);
            }
        }
    }
}

export interface ITimeInfo {
    tick: number;
    tickInterval: number;
    tickTime: number;
    presentTime: number;
}

interface IUpdateFunctions {
    logicUpdate?(timeInfo: ITimeInfo): void;
    presentUpdate?(timeInfo: ITimeInfo): void;
}

export abstract class ComponentSystem {
    createUpdateFuction(world: World): IUpdateFunctions {
        return {};
    }
}

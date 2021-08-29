import { Util } from "./util";

export class LocalStore {
    /**
     * all topic  subscribers
     */
    subscribers: Map<string | symbol, Array<Function>> = new Map();


    /**
     * 
     * @param type  register a topic
     * @param fn    create a function to subscribe to topics
     * @returns     A function to unsubscribe from this topic
     */
    subscribe(type: string | symbol, fn: Function): Function {

        if (!Util.isFunction(fn)) {
            throw new Error(`${fn} should be a function`);
        };

        const { subscribers } = this;
        const fnArrays: Array<Function> =
            subscribers.get(type) === undefined ?
                subscribers.set(type, new Array()).get(type) :
                subscribers.get(type);
        fnArrays.push(fn);
        return () => {
            const index = fnArrays.indexOf(fn);
            if (index === -1) {
                return;
            }
            fnArrays.splice(index, 1);
        }
    }

    /**
     * 
     * @param type  publish a topic
     * @param data Sent data
     * @returns 当前主题是否已经被注册
     */
    publish(type: string | symbol, data: any): boolean {
        const { subscribers } = this;
        const fnArrays: Array<Function> =
            subscribers.get(type) === undefined ?
                [] :
                subscribers.get(type);

        if (fnArrays.length > 0) {
            fnArrays.forEach((fn) => {
                try {
                    fn(type, data);
                } catch (e) {
                    throw new Error(`Function:${fn} execution error`);
                }
            }
            )
            return true;
        } else {
            return false;
        }
    }

    /**
     * 清除所有订阅
     */
    clearAllSubscriptions() {
        this.subscribers.clear();
    }


}

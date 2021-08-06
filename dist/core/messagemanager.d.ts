export declare class MessageManager {
    /**
     * all topic  subscribers
     */
    static subscribers: Map<string | symbol, Array<Function>>;
    /**
     *
     * @param type  register a topic
     * @param fn    create a function to subscribe to topics
     * @returns     A function to unsubscribe from this topic
     */
    static subscribe(type: string | symbol, fn: Function): Function;
    /**
     *
     * @param type  publish a topic
     * @param data Sent data
     * @returns  Whether topic are  registered subscribers
     */
    static publish(type: string | symbol, data: any): boolean;
    /**
     * Clean up all message subscribers
     */
    static clearAllSubscriptions(): void;
}

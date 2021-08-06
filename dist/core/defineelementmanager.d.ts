import { IDefineElementCfg } from "./types";
/**
 * 自定义元素管理器
 */
export declare class DefineElementManager {
    /**
     * 自定义element
     */
    private static elements;
    /**
     * 添加自定义元素类
     * @param name  元素名
     * @param cfg   配置
     */
    static add(name: string, cfg: IDefineElementCfg): void;
    /**
     * 获取自定义元素类
     * @param tagName 元素名
     */
    static get(tagName: string): IDefineElementCfg;
}

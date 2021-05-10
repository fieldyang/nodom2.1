import { Module } from "./module";
import { IMdlClassObj } from "./types";
/**
 * 过滤器工厂，存储模块过滤器
 */
export declare class ModuleFactory {
    /**
     * 模块对象工厂 {moduleId:{key:容器key,className:模块类名,instance:模块实例}}
     */
    private static modules;
    /**
     * 模块类集合
     */
    private static classes;
    /**
     * 主模块
     */
    private static mainModule;
    /**
     * 添加模块到工厂
     * @param id    模块id
     * @param item  模块存储对象
     */
    static add(item: Module): void;
    /**
     * 获得模块
     * @param id    模块id
     */
    static get(id: number): Module;
    /**
     * 获取模块实例（通过类名）
     * @param className     模块类名
     * @param moduleName    模块名
     * @param data          数据或数据url
     */
    static getInstance(className: string, moduleName?: string, data?: any): Promise<Module>;
    /**
     * 从工厂移除模块
     * @param id    模块id
     */
    static remove(id: number): void;
    /**
     * 设置主模块
     * @param m 	模块
     */
    static setMain(m: Module): void;
    /**
     * 获取主模块
     * @returns 	应用的主模块
     */
    static getMain(): Module;
    /**
     * 添加模块类
     * @param modules
     */
    static addModules(modules: Array<IMdlClassObj>): Promise<void>;
    /**
     * 出事化模块
     * @param cfg 模块类对象
     */
    private static initModule;
}
//# sourceMappingURL=modulefactory.d.ts.map
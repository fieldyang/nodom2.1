/**
 * 基础服务库
 * @since       1.0.0
 */
export declare class Util {
    private static generatedId;
    static genId(): number;
    /******对象相关******/
    /**
     * 对象复制
     * @param srcObj    源对象
     * @param expKey    不复制的键正则表达式或名
     * @param extra     clone附加参数
     * @returns         复制的对象
     */
    static clone(srcObj: Object, expKey?: RegExp | string[], extra?: any): any;
    /**
     * 合并多个对象并返回
     * @param   参数数组
     * @returns 返回对象
     */
    static merge(o1?: Object, o2?: Object, o3?: Object, o4?: Object, o5?: Object, o6?: Object): any;
    /**
     * 把obj2对象所有属性赋值给obj1
     */
    static assign(obj1: any, obj2: any): any;
    /**
     * 获取对象自有属性
     */
    static getOwnProps(obj: any): Array<string>;
    /**************对象判断相关************/
    /**
     * 是否为函数
     * @param foo   检查的对象
     * @returns     true/false
     */
    static isFunction(foo: any): boolean;
    /**
     * 是否为数组
     * @param obj   检查的对象
     * @returns     true/false
     */
    static isArray(obj: any): boolean;
    /**
     * 判断是否为map
     * @param obj
     */
    static isMap(obj: any): boolean;
    /**
     * 是否为对象
     * @param obj   检查的对象
     * @returns true/false
     */
    static isObject(obj: any): boolean;
    /**
     * 判断是否为整数
     * @param v 检查的值
     * @returns true/false
     */
    static isInt(v: any): boolean;
    /**
     * 判断是否为number
     * @param v 检查的值
     * @returns true/false
     */
    static isNumber(v: any): boolean;
    /**
     * 判断是否为boolean
     * @param v 检查的值
     * @returns true/false
     */
    static isBoolean(v: any): boolean;
    /**
     * 判断是否为字符串
     * @param v 检查的值
     * @returns true/false
     */
    static isString(v: any): boolean;
    /**
     * 是否为数字串
     * @param v 检查的值
     * @returns true/false
     */
    static isNumberString(v: any): boolean;
    /**
     * 对象/字符串是否为空
     * @param obj   检查的对象
     * @returns     true/false
     */
    static isEmpty(obj: any): boolean;
    /***********************对象相关******************/
    /**
     * 找到符合符合属性值条件的对象（深度遍历）
     * @param obj       待查询对象
     * @param props     属性值对象
     * @param one       是否满足一个条件就可以，默认false
     */
    static findObjByProps(obj: Object, props: Object, one: boolean): Array<Object> | Object;
    /**********dom相关***********/
    /**
     * 获取dom节点
     * @param selector  选择器
     * @param findAll   是否获取所有，默认为false
     * @param pview     父html element
     * @returns         html element/null 或 nodelist或[]
     */
    static get(selector: string, findAll?: boolean, pview?: HTMLElement | Document): Node | NodeList;
    /**
     * 是否为element
     * @param el    传入的对象
     * @returns     true/false
     */
    static isEl(el: any): boolean;
    /**
     * 是否为node
     * @param node 传入的对象
     * @returns true/false
     */
    static isNode(node: any): boolean;
    /**
     * 新建dom
     * @param tagName   标签名
     * @param config    属性集合
     * @param text      innerText
     * @returns         新建的elelment
     */
    static newEl(tagName: string, config?: Object, text?: string): HTMLElement;
    /**
     * 新建svg element
     * @param tagName   标签名
     * @returns         svg element
     */
    static newSvgEl(tagName: string, config?: Object): SVGElement;
    /**
     * 把srcNode替换为nodes
     * @param srcNode       源dom
     * @param nodes         替换的dom或dom数组
     */
    static replaceNode(srcNode: Node, nodes: Node | Array<Node>): void;
    /**
     * 清空子节点
     * @param el
     */
    static empty(el: HTMLElement): void;
    /**
     * 删除节点
     * @param node html node
     */
    static remove(node: Node): void;
    /**
     * 获取／设置属性
     * @param el    element
     * @param param 属性名，设置多个属性时用对象
     * @param value 属性值，获取属性时不需要设置
     * @returns     属性值
     */
    static attr(el: Element, param: string | Object, value?: any): any;
    /******日期相关******/
    /**
     * 日期格式化
     * @param srcDate   时间戳串
     * @param format    日期格式
     * @returns          日期串
     */
    static formatDate(srcDate: string | number, format: string): string;
    /******字符串相关*****/
    /**
     * 编译字符串，把{n}替换成带入值
     * @param str 待编译的字符串
     * @param args1,args2,args3,... 待替换的参数
     * @returns 转换后的消息
     */
    static compileStr(src: string, p1?: any, p2?: any, p3?: any, p4?: any, p5?: any): string;
    /**
     * 函数调用
     * @param foo   函数
     * @param obj   this指向
     * @param args  参数数组
     */
    static apply(foo: Function, obj: any, args?: Array<any>): any;
    /**
     * 合并并修正路径，即路径中出现'//','///','\/'的情况，统一置换为'/'
     * @param paths 待合并路径数组
     * @returns     返回路径
     */
    static mergePath(paths: string[]): string;
}
//# sourceMappingURL=util.d.ts.map
import { Application } from "./application";
import { Compiler } from "./compiler";
import { DefineElementManager } from "./defineelementmanager";
import { Directive } from "./directive";
import { Element } from "./element";
import { MessageQueue } from "./messagequeue";
import { MethodFactory } from "./methodfactory";
import { Model } from "./model";
import { ModelManager } from "./modelmanager";
import { ModuleFactory } from "./modulefactory";
import { request } from "./nodom";
import { Renderer } from "./renderer";
import { ResourceManager } from "./resourcemanager";
import { ChangedDom, IModuleCfg, IResourceObj, RegisterOps } from "./types";
import { Util } from "./util";
import { store } from "./nodom";
import { LocalStore } from "./localstore";

/**
 * 模块类
 */
export class Module {
    /**
     * 模块id(全局唯一)
     */
    public id: number;
    /**
     * 模块名(模块内(父模块的子模块之间)唯一)，如果不设置，则系统会自动生成Module+id
     */
    public name: string;

    /**
     * 模型
     */
    public model: Model;

    /**
     * 是否主模块，一个app只有一个根模块
     */
    private isMain: boolean;

    /**
     * 是否是首次渲染
     */
    private firstRender: boolean = true;

    /**
     * 根虚拟dom
     */
    public virtualDom: Element;

    /**
     * 渲染树
     */
    private renderTree: Element;

    /**
     * 父模块名
     */
    private parentId: number;

    /**
     * 子模块id数组
     */
    public children: Array<number> = [];

    /**
     * 模块对应容器选择器
     */
    private selector: string;

    /**
     * 模块创建时执行操作
     */
    private createOps: Array<Function> = [];

    /**
     * 状态 0 create(创建)、1 init(初始化，已编译)、2 unactive(渲染后被置为非激活) 3 active(激活，可渲染显示)
     */
    public state: number = 0;

    /**
     * 数据url
     */
    private dataUrl: string;

    /**
     * 需要加载新数据
     */
    private loadNewData: boolean = false;

    /**
     * 方法工厂
     */
    private methodFactory: MethodFactory;

    /**
     * 数据模型工厂
     */
    public modelManager: ModelManager;

    /**
     * 待渲染的虚拟dom数组
     */
    private renderDoms: Array<ChangedDom> = [];

    /**
     * 初始配置
     */
    private initConfig: IModuleCfg;

    /**
     * 放置模块的容器
     */
    private container: HTMLElement = null;

    /**
     * 模版串
     */
    private template: string;

    /**
     * 容器key
     */
    private containerKey: string;

    /**
     * 子模块名id映射，如 {modulea:1}
     */
    private moduleMap: Map<string, number> = new Map();

    /**
     * 状态管理对象
     */
    private store: object;
    /**
     * 所有订阅管理对象
     */
    public subscribes: LocalStore;

    public dataType: object;
    /**
     * 父模块通过标签 表达式/字符串 传值
     */
    props: object;


    /**
     * 构造器
     * @param config    模块配置
     */
    constructor(config?: IModuleCfg) {
        this.id = Util.genId();
        // 模块名字
        if (config && config.name) {
            this.name = config.name;
        } else {
            this.name = 'Module' + this.id;
        }
        ModuleFactory.add(this);
        this.methodFactory = new MethodFactory(this);
        this.modelManager = new ModelManager(this);
        //执行创建后操作
        for (let foo of this.createOps) {
            foo.call(this);
        }
        //执行创建事件
        this.doModuleEvent('onCreate');
        //无配置对象，不需要处理
        if (!config) {
            return;
        }

        //保存config，存在延迟初始化情况
        this.initConfig = config;
        //设置选择器
        this.selector = config.el;
        //方法加入工厂
        if (Util.isObject(config.methods)) {
            Util.getOwnProps(config.methods).forEach((item) => {
                this.methodFactory.add(item, config.methods[item]);
            });
        }

        //清除container的内部内容
        if (this.getContainer()) {
            // 处理特殊字符
            this.template = this.container.innerHTML.trim();
            let transferWords = { 'lt': '<', 'gt': '>', 'nbsp': ' ', 'amp': '&', 'quot': '"' };
            this.template = this.template.replace(/&(lt|gt|nbsp|amp|quot);/ig, function (all, t) { return transferWords[t]; });
            this.container.innerHTML = '';
        }
        if (store) {
            this.store = store;
        }

    }

    /**
     * 初始化模块（加载和编译）
     */
    private async init(): Promise<any> {
        let config = this.initConfig;
        let urlArr: Array<Object> = []; //请求url数组
        let cssPath: string = Application.getPath('css');
        let templatePath: string = Application.getPath('template');
        let jsPath: string = Application.getPath('js');
        //加载文件
        if (config && Util.isArray(config.requires) && config.requires.length > 0) {
            config.requires.forEach((item) => {
                let type: string;
                let url: string = '';
                if (Util.isObject(item)) { //为对象，可能是css或js
                    type = item['type'] || 'js';
                    url = item['url'];
                } else { //js文件
                    type = 'js';
                    url = <string>item;
                }
                //转换路径
                let path: string = type === 'js' ? jsPath : cssPath;
                urlArr.push({ url: Util.mergePath([path, url]), type: type });
            });
        }

        //模版串
        let templateStr: string = this.template;
        //模版信息
        if (config.template) {
            config.template = config.template.trim();
            if (config.template.startsWith('<')) { //html模版串
                templateStr = config.template;
            } else {  //文件
                urlArr.push({
                    url: Util.mergePath([templatePath, config.template]),
                    type: config.template.endsWith('.nd') ? 'nd' : 'template'
                });
            }
        }
        //删除template
        delete this.template;

        //注册自定义标签模块
        if (this.methodFactory.has('registerModule')) {
            let registers: Array<RegisterOps> = Reflect.apply(this.methodFactory.get('registerModule'), null, []);
            if (Array.isArray(registers) && registers.length > 0) {
                registers.forEach(v => {
                    const tagName = v.name.toUpperCase();

                    //重复注册
                    if (DefineElementManager.get(tagName) !== undefined) {
                        throw new Error(`The module name ${tagName}has been registered, please change the name `);
                    }
                    DefineElementManager.add(tagName, {
                        init: function (element: Element, parent?: Element) {
                            element.tagName = 'div';
                            element.setProp('modulename', v.name);
                            new Directive('module', v.class, element, parent);
                        }
                    })
                })
            }
        }

        //如果已存在templateStr，则直接编译
        if (!Util.isEmpty(templateStr)) {
            this.virtualDom = Compiler.compile(templateStr);
        }

        //数据
        if (config.data) { //数据
            if (Util.isObject(config.data)) { //数据
                this.model = new Model(config.data, this);
            } else { //数据url
                urlArr.push({
                    url: config.data,
                    type: 'data'
                });
                this.dataUrl = <string>config.data;
            }
        } else { //空数据
            this.model = new Model({}, this);
        }

        //批量请求文件
        if (urlArr.length > 0) {
            let rets: IResourceObj[] = await ResourceManager.getResources(urlArr);
            for (let r of rets) {
                if (r.type === 'template' || r.type === 'nd') {
                    this.virtualDom = <Element>r.content;
                } else if (r.type === 'data') {
                    this.model = new Model(r.content, this);
                }
            }
        }



        //处理子模块
        if (this.initConfig.modules) {
            for (let cfg of this.initConfig.modules) {
                let mdl: Module = new Module(cfg);
                mdl.parentId = this.id;
                this.addChild(mdl.id);
            }
        }
        changeState(this);
        delete this.initConfig;
        /**
         * 修改状态
         * @param mod 	模块
         */
        function changeState(mod: Module) {
            if (mod.isMain) {
                mod.state = 3;
                //可能不能存在数据，需要手动添加到渲染器
                Renderer.add(mod);
            } else if (mod.parentId) {
                mod.state = ModuleFactory.get(mod.parentId).state;
            } else {
                mod.state = 1;
            }
        }
    }

    /**
     * 模型渲染
     * @return false 渲染失败 true 渲染成功
     */
    public render(): boolean {
        //状态为2，不渲染
        if (this.state === 2) {
            return true;
        }
        //容器没就位或state不为active则不渲染，返回渲染失败
        if (this.state !== 3 || !this.virtualDom || !this.getContainer()) {
            return false;
        }
        //克隆新的树
        let root: Element = this.virtualDom.clone();

        if (this.firstRender) {
            //model无数据，如果存在dataUrl，则需要加载数据
            if (this.loadNewData && this.dataUrl) {
                request({
                    url: this.dataUrl,
                    type: 'json'
                }).then(
                    (r) => {
                        this.model = new Model(r, this);
                        this.doFirstRender(root);
                        this.loadNewData = false;
                    }
                );
            } else {
                this.doFirstRender(root);
            }
        } else { //增量渲染
            //执行每次渲染前事件
            this.doModuleEvent('onBeforeRender');
            if (this.model) {
                root.model = this.model;
                let oldTree = this.renderTree;
                this.renderTree = root;
                //渲染
                root.render(this, null);
                this.clearDontRender(root);
                this.doModuleEvent('onBeforeRenderToHtml');
                let deleteMap = new Map();
                // 比较节点
                root.compare(oldTree, this.renderDoms, deleteMap);
                //刪除和替換
                deleteMap.forEach((value, key) => {
                    let dp: HTMLElement = this.getNode(key);
                    for (let i = value.length - 1; i >= 0; i--) {
                        let index = value[i];
                        if (typeof index == 'string') {
                            let parm = index.split('|');
                            index = parm[0];
                            const vDom: Element = root.query(parm[1]);
                            dp.insertBefore((() => {
                                const el: HTMLElement | SVGElement = vDom.getTmpParam('isSvgNode') ? Util.newSvgEl(vDom.tagName) : Util.newEl(vDom.tagName);
                                //设置属性
                                Util.getOwnProps(vDom.props).forEach(k => el.setAttribute(k, vDom.props[k]));
                                el.setAttribute('key', vDom.key);
                                vDom.handleNEvents(this, el, vDom.parent);
                                vDom.handleAssets(el);
                                return el;
                            })(), dp.childNodes[index++]);
                        }
                        dp.removeChild(dp.childNodes[index]);
                    }
                });
                deleteMap.clear();

                // 渲染
                this.renderDoms.forEach((item) => {
                    item.node.renderToHtml(this, item);
                });
            }
            //执行每次渲染后事件
            this.doModuleEvent('onRender');
        }
        //通知更新数据
        if (this.subscribes) {
            this.subscribes.publish('@data' + this.id, null);
            if (Array.isArray(this.subscribes.subscribers) && this.subscribes.subscribers.get('@dataTry').length !== 0) {
                this.subscribes.publish('@dataTry' + this.id, null);
            }

        }
        let md: Module = ModuleFactory.get(this.parentId);
        if (md && md.subscribes !== undefined && Array.isArray(md.subscribes.subscribers) && md.subscribes.subscribers.get('@dataTry').length !== 0) {
            md.subscribes.publish('@dataTry' + this.parentId, null);
        }

        //数组还原
        this.renderDoms = [];
        return true;
    }

    /**
     * 执行首次渲染
     * @param root 	根虚拟dom
     */
    private doFirstRender(root: Element) {
        this.doModuleEvent('onBeforeFirstRender');
        //渲染树
        this.renderTree = root;
        if (this.model) {
            root.model = this.model;
        }

        root.render(this, null);
        this.clearDontRender(root);
        this.doModuleEvent('onBeforeFirstRenderToHTML');
        //清空子元素
        Util.empty(this.container);
        //渲染到html
        root.renderToHtml(this, <ChangedDom>{ type: 'fresh' });
        //删除首次渲染标志
        delete this.firstRender;
        //执行首次渲染后事件
        this.doModuleEvent('onFirstRender');

    }

    /**
     * 克隆模块
     * 共享virtual Dom，但是名字为新名字
     * @param moduleName    新模块名
     */
    clone(moduleName: string): any {
        let me = this;
        let m: Module = new Module({ name: moduleName });
        //克隆数据
        if (this.model) {
            let data = Util.clone(this.model, /^\$\S+/);
            m.model = new Model(data, m);
        }
        let excludes = ['id', 'name', 'model', 'virtualDom', 'container', 'containerKey', 'modelManager', 'defineElements'];
        Object.getOwnPropertyNames(this).forEach((item) => {
            if (excludes.includes(item)) {
                return;
            }
            m[item] = me[item];
        });
        //克隆虚拟dom树
        m.virtualDom = this.virtualDom.clone(true);
        return m;
    }

    /**
     * 检查容器是否存在，如果不存在，则尝试找到
     */
    public getContainer() {
        //根模块，直接使用el
        if (this.selector) {
            this.container = document.querySelector(this.selector);
        } else {  //非根模块，根据容器key获得
            this.container = document.querySelector("[key='" + this.containerKey + "']");
        }
        return this.container;
    }

    /**
     * 设置模块容器 key
     * @param key   模块容器key
     */
    public setContainerKey(key: string) {
        this.containerKey = key;
    }

    /**
     * 获取模块容器 key
     * @param key   模块容器key
     */
    public getContainerKey() {
        return (this.containerKey);
    }


    /**
     * 数据改变
     * @param model 	改变的model
     */
    public dataChange() {
        Renderer.add(this);
    }

    /**
     * 添加子模块
     * @param moduleId      模块id
     * @param className     类名
     */
    public addChild(moduleId: number) {
        if (!this.children.includes(moduleId)) {
            this.children.push(moduleId);
            let m: Module = ModuleFactory.get(moduleId);
            if (m) {
                m.parentId = this.id;
            }
            //保存name和id映射
            this.moduleMap.set(m.name, moduleId);

            //执行无主消息检测
            MessageQueue.move(m.name, moduleId, this.id);
        }
    }

    /**
     * 发送
     * @param toName 		接收模块名或模块id，如果为模块id，则直接发送，不需要转换
     * @param data 			消息内容
     */
    public send(toName: string | number, data: any) {
        if (typeof toName === 'number') {
            MessageQueue.add(this.id, toName, data);
            return;
        }

        let m: Module;
        let pm: Module = ModuleFactory.get(this.parentId);
        //1 比对父节点名
        //2 比对兄弟节点名
        //3 比对孩子节点名
        if (pm) {
            if (pm.name === toName) { //父亲
                m = pm
            } else { //兄弟
                m = pm.getChild(toName);
            }
        }
        if (!m) { //孩子节点
            m = this.getChild(toName);
        }
        if (m) {
            MessageQueue.add(this.id, m.id, data);
        }
    }


    /**
     * 广播给父、兄弟和孩子（第一级）节点
     */
    public broadcast(data: any) {
        //兄弟节点
        if (this.parentId) {
            let pmod: Module = ModuleFactory.get(this.parentId);
            if (pmod) {
                //父模块
                this.send(this.parentId, data);
                if (pmod.children) {
                    pmod.children.forEach((item) => {
                        //自己不发
                        if (item === this.id) {
                            return;
                        }
                        let m: Module = ModuleFactory.get(item);
                        //兄弟模块
                        this.send(m.id, data);
                    });
                }
            }
        }

        if (this.children !== undefined) {
            this.children.forEach((item) => {
                let m: Module = ModuleFactory.get(item);
                this.send(m.id, data);
            });
        }
    }

    /**
     * 接受消息
     * @param fromName 		来源模块名
     * @param data 			消息内容
     */
    public receive(fromName, data) {
        this.doModuleEvent('onReceive', [fromName, data]);
    }

    /**
     * 激活模块(添加到渲染器)
     */
    public async active() {
        //激活状态不用激活，创建状态不能激活
        if (this.state === 3) {
            return;
        }
        //未初始化，需要先初始化
        if (this.state === 0) {
            await this.init();
        }
        this.state = 3;
        //添加到渲染器
        Renderer.add(this);
        //孩子节点激活
        if (Util.isArray(this.children)) {
            this.children.forEach(async (item) => {
                let m: Module = ModuleFactory.get(item);
                if (m) {
                    await m.active();
                }
            });
        }
    }

    /**
     * 取消激活
     */
    public unactive() {
        //主模块不允许取消
        if (this.isMain || this.state === 2) {
            return;
        }
        this.state = 2;
        //设置首次渲染标志
        this.firstRender = true;
        if (Util.isArray(this.children)) {
            this.children.forEach((item) => {
                let m: Module = ModuleFactory.get(item);
                if (m) {
                    m.unactive();
                }
            });
        }
    }

    /**
     * 模块终结
     */
    public destroy() {
        if (Util.isArray(this.children)) {
            this.children.forEach((item) => {
                let m: Module = ModuleFactory.get(item);
                if (m) {
                    m.destroy();
                }
            });
        }
        //从工厂释放
        ModuleFactory.remove(this.id);
    }

    /*************事件**************/

    /**
     * 执行模块事件
     * @param eventName 	事件名
     * @param param 		参数，为数组
     */
    private doModuleEvent(eventName: string, param?: Array<any>) {
        const foo: Function = this.methodFactory.get(eventName);
        if (!foo) {
            return;
        }
        //模块作为第一个参数
        if (param) {
            param.unshift(this);
        } else {
            param = [this];
        }
        //调用方法
        Util.apply(foo, this.model, param);
    }

    /**
     * 添加实例化后操作
     * @param foo  	操作方法
     */
    public addCreateOperation(foo: Function) {
        if (!Util.isFunction(foo)) {
            return;
        }
        if (!this.createOps.includes(foo)) {
            this.createOps.push(foo);
        }
    }

    /**
     * 清理不渲染节点
     * @param dom   节点
     */
    clearDontRender(dom: Element) {
        for (let i = 0; i < dom.children.length; i++) {
            let item = dom.children[i];
            if (item.dontRender) {
                dom.children.splice(i, 1);
                return;
            }
            this.clearDontRender(item);
        }
    }
    /**
     * 获取子孙模块
     * @param name          模块名 
     * @param descendant    如果为false,只在子节点内查找，否则在后代节点查找（深度查询），直到找到第一个名字相同的模块
     */
    public getChild(name: string, descendant?: boolean): Module {
        if (this.moduleMap.has(name)) {
            let mid = this.moduleMap.get(name);
            return ModuleFactory.get(mid);
        } else if (descendant) {
            for (let id of this.children) {
                let m = ModuleFactory.get(id);
                if (m) {
                    let m1 = m.getChild(name, descendant);
                    if (m1) {
                        return m1;
                    }
                }
            }
        }
        return null;
    }

    /**
     * 获取模块方法
     * @param name  方法名
     * @returns     方法
     */
    public getMethod(name: string): Function {
        return this.methodFactory.get(name);
    }

    /**
     * 添加方法
     * @param name  方法名
     * @param foo   方法函数
     */
    public addMethod(name: string, foo: Function) {
        this.methodFactory.add(name, foo);
    }

    /**
     * 移除方法
     * @param name  方法名
     */
    public removeMethod(name: string) {
        this.methodFactory.remove(name);
    }

    /**
     * 设置数据url
     * @param url   数据url
     */
    public setDataUrl(url: string) {
        this.dataUrl = url;
        //设置新加载数据标志
        this.loadNewData = true;
    }

    /**
     * 获取模块下的html节点
     * @param key       el key值或对象{attrName:attrValue}
     * @param notNull   如果不存在，则返回container
     * @returns         html element
     */
    public getNode(key: string | Object, notNull?: boolean): HTMLElement {
        let keyName: string;
        let value: any;
        if (typeof key === 'string') {  //默认为key值查找
            keyName = 'key';
            value = key;
        } else {  //对象
            keyName = Object.getOwnPropertyNames(key)[0];
            value = key[keyName];
        }
        let qs: string = "[" + keyName + "='" + value + "']";
        let el: HTMLElement = this.container ? this.container.querySelector(qs) : null;
        if (!el && notNull) {
            return this.container;
        }
        return el;
    }

    /**
     * 获取虚拟dom节点
     * @param key               dom key
     * @param fromVirtualDom    是否从源虚拟dom数获取，否则从渲染树获取
     */
    public getElement(key: string | Object, fromVirtualDom?: boolean) {
        let tree = fromVirtualDom ? this.virtualDom : this.renderTree;
        return tree.query(key);
    }

    /**
     * 判断是否为容器key
     * @param key   element key
     */
    public isContainerKey(key: string): boolean {
        return this.containerKey === key;
    }

    /**
     * 设置首次渲染标志
     * @param flag  首次渲染标志true/false
     */
    setFirstRender(flag: boolean) {
        this.firstRender = flag;
    }

    /**
     * 设置为主模块
     */
    setMain() {
        this.isMain = true;
    }

    /**
     * 设置模块容器选择器
     * @param selector 
     */
    setSelector(selector: string) {
        this.selector = selector;
    }
}

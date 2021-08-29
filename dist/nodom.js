var nodom = (function (exports) {
    'use strict';

    /**
     * 应用类
     * 全局对象
     * @since 2.0
     */
    class Application {
        /**
         * 获取路径
         * @param type  路径类型 app,template,css,js,module,route
         * @returns     type对应的基础路径
         */
        static getPath(type) {
            if (!this.path) {
                return '';
            }
            let appPath = this.path.app || '';
            if (type === 'app') {
                return appPath;
            }
            else if (type === 'route') {
                return this.path.route || '';
            }
            else {
                let p = this.path[type] || '';
                if (appPath !== '') {
                    if (p !== '') {
                        return appPath + '/' + p;
                    }
                    else {
                        return appPath;
                    }
                }
                return p;
            }
        }
        /**
         * 设置path 对象
         * @param pathObj   路径对象
         */
        static setPath(pathObj) {
            this.path = pathObj;
        }
    }

    /**
     * 自定义元素管理器
     */
    class DefineElementManager {
        /**
         * 添加自定义元素类
         * @param name  元素名
         * @param cfg   配置
         */
        static add(name, cfg) {
            this.elements.set(name, cfg);
        }
        /**
         * 获取自定义元素类
         * @param tagName 元素名
         */
        static get(tagName) {
            return this.elements.get(tagName);
        }
    }
    /**
     * 自定义element
     */
    DefineElementManager.elements = new Map();

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    /**
     * 指令类
     */
    class DirectiveType {
        /**
         * 构造方法
         * @param name      指令类型名
         * @param prio      类型优先级
         * @param init      编译时执行方法
         * @param handle    渲染时执行方法
         */
        constructor(name, prio, init, handle) {
            this.name = name;
            this.prio = prio >= 0 ? prio : 10;
            this.init = init;
            this.handle = handle;
        }
    }

    /**
     * 模型类
     */
    const modelCloneExpKey = ["$moduleId", "$key", "$watch", "$query"];
    class Model$1 {
        /**
         * @param data 		数据
         * @param module 	模块对象
         * @returns         模型代理对象
         */
        constructor(data, module) {
            //模型管理器
            let mm = module.modelManager;
            let proxy = new Proxy(data, {
                set: (src, key, value, receiver) => {
                    //值未变,proxy 不处理
                    if (src[key] === value) {
                        return true;
                    }
                    //不处理原型属性 
                    let excludes = ['__proto__', 'constructor'];
                    if (excludes.includes(key)) {
                        return true;
                    }
                    const excArr = ['$watch', "$moduleId", "$query", "$key", "$index"];
                    //不进行赋值
                    if (typeof value !== 'object' || (value === null || !value.$watch)) {
                        //更新渲染
                        if (excArr.indexOf(key) == -1) {
                            mm.update(proxy, key, src[key], value);
                        }
                    }
                    return Reflect.set(src, key, value, receiver);
                },
                get: (src, key, receiver) => {
                    let res = Reflect.get(src, key, receiver);
                    let data = module.modelManager.getFromDataMap(src[key]);
                    if (data) {
                        return data;
                    }
                    if (typeof res === 'object' && res !== null) {
                        //如果是的对象，则返回代理，便于后续激活get set方法                   
                        // 判断是否已经代理，如果未代理，则增加代理
                        if (!src[key].$watch) {
                            let p = new Model$1(res, module);
                            // receiver[key] = p;
                            return p;
                        }
                        // else {
                        //     let data = module.modelManager.getFromDataMap(src[key]);
                        //     return data ? data : res;
                        // }
                    }
                    return res;
                },
                deleteProperty: function (src, key) {
                    //如果删除对象，从mm中同步删除
                    if (src[key] != null && typeof src[key] === 'object') {
                        mm.delToDataMap(src[key]);
                        mm.delModelToModelMap(src[key]);
                    }
                    delete src[key];
                    return true;
                }
            });
            proxy.$watch = this.$watch;
            proxy.$moduleId = module.id;
            proxy.$query = this.$query;
            proxy.$key = Util.genId();
            mm.addToDataMap(data, proxy);
            mm.addModelToModelMap(proxy, data);
            return proxy;
        }
        /**
         * 观察(取消观察)某个数据项
         * @param key       数据项名
         * @param operate   数据项变化时执行方法名(在module的methods中定义)
         * @param cancel    取消观察
         */
        $watch(key, operate, cancel) {
            let model = this;
            let index = -1;
            //如果带'.'，则只取最里面那个对象
            if ((index = key.lastIndexOf('.')) !== -1) {
                model = this.$query(key.substr(0, index));
                key = key.substr(index + 1);
            }
            if (!model) {
                return;
            }
            const mod = ModuleFactory.get(this.$moduleId);
            if (cancel) {
                mod.modelManager.removeWatcherFromModelMap(model, key, operate);
            }
            else {
                mod.modelManager.addWatcherToModelMap(model, key, operate);
            }
        }
        /**
         * 查询子属性
         * @param key   子属性，可以分级，如 name.firstName
         * @returns     属性对应model proxy
         */
        $query(key) {
            let model = this;
            if (key.indexOf('.') !== -1) { //层级字段
                let arr = key.split('.');
                for (let i = 0; i < arr.length - 1; i++) {
                    model = model[arr[i]];
                    if (!model) {
                        break;
                    }
                }
                if (!model) {
                    return;
                }
                key = arr[arr.length - 1];
            }
            return model[key];
        }
    }

    /**
     *  编译器
     *  描述：用于进行预编译和预编译后的json串反序列化，处理两个部分：虚拟dom树和表达式工厂
     *  版本2.1预留
     */
    class Serializer {
        /**
         * 序列化，只序列化virtualDom
         * @param module 	模块
         * @return   		jsonstring
         */
        static serialize(module) {
            let dom = module.virtualDom;
            addClsName(dom);
            return JSON.stringify(dom);
            /**
             * 为对象添加class name（递归执行）
             * @param obj 	对象
             */
            function addClsName(obj) {
                if (typeof obj !== 'object') {
                    return;
                }
                obj.className = obj.constructor.name;
                Util.getOwnProps(obj).forEach((item) => {
                    if (Util.isArray(obj[item])) {
                        //删除空数组
                        if (obj[item].length === 0) {
                            delete obj[item];
                        }
                        else {
                            obj[item].forEach((item1) => {
                                addClsName(item1);
                            });
                        }
                    }
                    else if (typeof obj[item] === 'object') {
                        //删除空对象
                        if (Util.isEmpty(obj[item])) {
                            delete obj[item];
                        }
                        else {
                            addClsName(obj[item]);
                        }
                    }
                });
            }
        }
        /**
         * 反序列化
         * @param jsonStr 	json串
         * @param module 	模块
         * @returns 		 virtualDom
         */
        static deserialize(jsonStr) {
            let jObj = JSON.parse(jsonStr);
            return handleCls(jObj);
            function handleCls(jsonObj) {
                if (!Util.isObject(jsonObj)) {
                    return jsonObj;
                }
                let retObj;
                if (jsonObj.hasOwnProperty('className')) {
                    const cls = jsonObj['className'];
                    let param = [];
                    //指令需要传入参数
                    switch (cls) {
                        case 'Directive':
                            param = [jsonObj['type']];
                            break;
                        case 'Expression':
                            param = [jsonObj['execString']];
                            break;
                        case 'Element':
                            param = [];
                            break;
                        case 'NodomNEvent':
                            param = [jsonObj['name']];
                            break;
                    }
                    // let clazz:any = eval(cls);
                    let clazz = new Function('return ' + cls);
                    retObj = Reflect.construct(clazz, param);
                }
                else {
                    retObj = {};
                }
                //子对象可能用到父对象属性，所以子对象要在属性赋值后处理
                let objArr = []; //子对象
                let arrArr = []; //子数组
                Util.getOwnProps(jsonObj).forEach((item) => {
                    //子对象
                    if (Util.isObject(jsonObj[item])) {
                        objArr.push(item);
                    }
                    else if (Util.isArray(jsonObj[item])) { //子数组
                        arrArr.push(item);
                    }
                    else { //普通属性
                        //className 不需要复制
                        if (item !== 'className') {
                            retObj[item] = jsonObj[item];
                        }
                    }
                });
                //子对象处理
                objArr.forEach((item) => {
                    retObj[item] = handleCls(jsonObj[item]);
                });
                //子数组处理
                arrArr.forEach(item => {
                    retObj[item] = [];
                    jsonObj[item].forEach((item1) => {
                        retObj[item].push(handleCls(item1));
                    });
                });
                return retObj;
            }
        }
    }

    /**
     * 资源管理器
     * 用于url资源的加载及管理，主要针对js、模版等
     */
    class ResourceManager {
        /**
         * 获取多个资源
         * @param urls  [{url:**,type:**}]或 [url1,url2,...]
         * @returns     IResourceObj
         */
        static getResources(reqs) {
            return __awaiter(this, void 0, void 0, function* () {
                let me = this;
                this.preHandle(reqs);
                //无请求
                if (reqs.length === 0) {
                    return [];
                }
                let taskId = Util.genId();
                //设置任务资源数组
                let resArr = [];
                for (let item of reqs) {
                    resArr.push(item.url);
                }
                this.loadingTasks.set(taskId, resArr);
                return new Promise((res, rej) => __awaiter(this, void 0, void 0, function* () {
                    //保存资源id状态
                    for (let item of reqs) {
                        let url = item.url;
                        if (this.resources.has(url)) { //已加载，直接获取资源内容
                            let r = me.awake(taskId);
                            if (r) {
                                res(r);
                            }
                        }
                        else if (this.waitList.has(url)) { //加载中，放入资源等待队列
                            this.waitList.get(url).push(taskId);
                        }
                        else { //新加载
                            //将自己的任务加入等待队列
                            this.waitList.set(url, [taskId]);
                            //请求资源
                            let content = yield request({ url: url });
                            let rObj = { type: item.type, content: content };
                            this.handleOne(url, rObj);
                            this.resources.set(url, rObj);
                            let arr = this.waitList.get(url);
                            //从等待列表移除
                            this.waitList.delete(url);
                            //唤醒任务
                            for (let tid of arr) {
                                let r = me.awake(tid);
                                if (r) {
                                    res(r);
                                }
                            }
                        }
                    }
                }));
            });
        }
        /**
         * 唤醒任务
         * @param taskId    任务id
         * @returns         加载内容数组或undefined
         */
        static awake(taskId) {
            if (!this.loadingTasks.has(taskId)) {
                return;
            }
            let resArr = this.loadingTasks.get(taskId);
            let finish = true;
            //资源内容数组
            let contents = [];
            //检查是否全部加载完成
            for (let url of resArr) {
                //一个未加载完，则需要继续等待
                if (!this.resources.has(url)) {
                    finish = false;
                    break;
                }
                //放入返回对象
                contents.push(this.resources.get(url));
            }
            //加载完成
            if (finish) {
                //从loadingTask删除
                this.loadingTasks.delete(taskId);
                return contents;
            }
        }
        /**
         * 获取url类型
         * @param url   url
         * @returns     url type
         */
        static getType(url) {
            let ind = -1;
            let type;
            if ((ind = url.lastIndexOf('.')) !== -1) {
                type = url.substr(ind + 1);
                if (type === 'htm' || type === 'html') {
                    type = 'template';
                }
            }
            return type || 'text';
        }
        /**
         * 处理一个资源获取结果
         * @param url   资源url
         * @param rObj  资源对象
         */
        static handleOne(url, rObj) {
            switch (rObj.type) {
                case 'js':
                    let head = document.querySelector('head');
                    let script = Util.newEl('script');
                    script.innerHTML = rObj.content;
                    head.appendChild(script);
                    head.removeChild(script);
                    delete rObj.content;
                    break;
                case 'template':
                    rObj.content = Compiler.compile(rObj.content);
                    break;
                case 'nd':
                    rObj.content = Serializer.deserialize(rObj.content);
                    break;
                case 'data': //数据
                    try {
                        rObj.content = JSON.parse(rObj.content);
                    }
                    catch (e) {
                        console.log(e);
                    }
            }
            this.resources.set(url, rObj);
        }
        /**
         * 预处理
         * @param reqs  [{url:**,type:**},url,...]
         * @returns     [promises(请求对象数组),urls(url数组),types(类型数组)]
         */
        static preHandle(reqs) {
            let head = document.querySelector('head');
            //预处理请求资源
            for (let i = 0; i < reqs.length; i++) {
                //url串，需要构造成object
                if (typeof reqs[i] === 'string') {
                    reqs[i] = {
                        url: reqs[i]
                    };
                }
                reqs[i].type = reqs[i].type || this.getType(reqs[i].url);
                //css 不需要加载
                if (reqs[i].type === 'css') {
                    let css = Util.newEl('link');
                    css.type = 'text/css';
                    css.rel = 'stylesheet'; // 保留script标签的path属性
                    css.href = reqs[i].url;
                    head.appendChild(css);
                    //移除
                    reqs.splice(i--, 1);
                }
            }
            return reqs;
        }
    }
    /**
     * 资源map，key为url，值为整数，1表示正在加载，2表示已加载完成
     */
    ResourceManager.resources = new Map();
    /**
     * 加载任务  任务id:资源对象，{id1:{url1:false,url2:false},id2:...}
     */
    ResourceManager.loadingTasks = new Map();
    /**
     * 资源等待列表  {资源url:[taskId1,taskId2,...]}
     */
    ResourceManager.waitList = new Map();

    /**
     * 过滤器工厂，存储模块过滤器
     */
    class ModuleFactory {
        /**
         * 添加模块到工厂
         * @param id    模块id
         * @param item  模块存储对象
         */
        static add(item) {
            this.modules.set(item.id, item);
        }
        /**
         * 获得模块
         * @param id    模块id
         */
        static get(id) {
            return this.modules.get(id);
        }
        /**
         * 获取模块实例（通过类名）
         * @param className     模块类名
         * @param moduleName    模块名
         * @param data          数据或数据url
         */
        static getInstance(className, moduleName, data) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.classes.has(className)) {
                    throw new NError('notexist1', exports.NodomMessage.TipWords['moduleClass'], className);
                }
                let cfg = this.classes.get(className);
                if (moduleName) {
                    cfg.name = moduleName;
                }
                if (!cfg.instance) {
                    if (!cfg.initing) {
                        cfg.initing = true;
                        yield this.initModule(cfg);
                    }
                    return new Promise((res, rej) => {
                        check();
                        function check() {
                            if (!cfg.initing) {
                                res(get(cfg));
                            }
                            else {
                                setTimeout(check, 0);
                            }
                        }
                    });
                }
                else {
                    return get(cfg);
                }
                function get(cfg) {
                    if (cfg.singleton) {
                        return cfg.instance;
                    }
                    else {
                        let mdl = cfg.instance.clone(moduleName);
                        //处理数据
                        if (data) {
                            //如果为url，则设置dataurl和loadnewdata标志
                            if (typeof data === 'string') {
                                mdl.setDataUrl(data);
                            }
                            else { //数据模型化
                                mdl.model = new Model$1(data, mdl);
                            }
                        }
                        return mdl;
                    }
                }
            });
        }
        /**
         * 从工厂移除模块
         * @param id    模块id
         */
        static remove(id) {
            this.modules.delete(id);
        }
        /**
         * 设置主模块
         * @param m 	模块
         */
        static setMain(m) {
            this.mainModule = m;
            m.setMain();
        }
        /**
         * 获取主模块
         * @returns 	应用的主模块
         */
        static getMain() {
            return this.mainModule;
        }
        /**
         * 添加模块类
         * @param modules
         */
        static addModules(modules) {
            return __awaiter(this, void 0, void 0, function* () {
                for (let cfg of modules) {
                    if (!cfg.path) {
                        throw new NError("paramException", 'modules', 'path');
                    }
                    if (!cfg.class) {
                        throw new NError("paramException", 'modules', 'class');
                    }
                    //lazy默认true
                    if (cfg.lazy === undefined) {
                        cfg.lazy = true;
                    }
                    //singleton默认true
                    if (cfg.singleton === undefined) {
                        cfg.singleton = true;
                    }
                    //自定义标签名
                    if (cfg.className) {
                        DefineElementManager.add(cfg.className.toLocaleUpperCase(), {
                            init: function (element, parent) {
                                element.tagName = 'div';
                                new Directive('module', cfg.class, element, parent);
                            }
                        });
                    }
                    if (!cfg.lazy) {
                        yield this.initModule(cfg);
                    }
                    //存入class工厂
                    this.classes.set(cfg.class, cfg);
                }
            });
        }
        /**
         * 初始化模块
         * @param cfg 模块类对象
         */
        static initModule(cfg) {
            return __awaiter(this, void 0, void 0, function* () {
                //增加 .js后缀
                let path = cfg.path;
                if (!path.endsWith('.js')) {
                    path += '.js';
                }
                //加载模块类js文件
                let url = Util.mergePath([Application.getPath('module'), path]);
                yield ResourceManager.getResources([{ url: url, type: 'js' }]);
                // let cls = eval(cfg.class);
                let cls = new Function('return ' + cfg.class)();
                if (cls) {
                    let instance = Reflect.construct(cls, [{
                            name: cfg.name,
                            data: cfg.data,
                            lazy: cfg.lazy
                        }]);
                    if (exports.store) {
                        instance.store = exports.store;
                    }
                    //模块初始化
                    yield instance.init();
                    cfg.instance = instance;
                    //单例，则需要保存到modules
                    if (cfg.singleton) {
                        this.modules.set(instance.id, instance);
                    }
                    //初始化完成
                    delete cfg.initing;
                }
                else {
                    throw new NError('notexist1', exports.NodomMessage.TipWords['moduleClass'], cfg.class);
                }
            });
        }
    }
    /**
     * 模块对象工厂 {moduleId:{key:容器key,className:模块类名,instance:模块实例}}
     */
    ModuleFactory.modules = new Map();
    /**
     * 模块类集合
     */
    ModuleFactory.classes = new Map();

    /**
     * 消息类
     */
    class Message {
        /**
         * @param fromModule 	来源模块id
         * @param toModule 		目标模块id或名字
         * @param content 		消息内容
         * @param parentId      父模块id
         */
        constructor(fromModule, toModule, content, parentId) {
            this.fromModule = fromModule;
            this.toModule = toModule;
            this.content = content;
            this.parentId = parentId;
        }
    }
    /**
     * 消息队列
     */
    class MessageQueue {
        /**
         * 添加消息到消息队列
         * @param fromModule 	来源模块名
         * @param toModule 		目标模块名
         * @param content 		消息内容
         * @param parentId      父模块消息
         */
        static add(from, to, data, parentId) {
            if (parentId) {
                this.noOwnerNMessages.push(new Message(from, to, data, parentId));
            }
            else {
                this.messages.push(new Message(from, to, data));
            }
        }
        /**
         * 从 no owner队列移动到 待发队列
         * @param moduleName    模块名
         * @param moduleId      模块id
         * @param parentId      父模块id
         */
        static move(moduleName, moduleId, parentId) {
            let index;
            while ((index = this.noOwnerNMessages.findIndex(item => item.parentId === parentId && moduleName === item.toModule)) !== -1) {
                let msg = this.noOwnerNMessages[index];
                //从noowner数组移除
                this.noOwnerNMessages.splice(index, 1);
                msg.toModule = moduleId;
                delete msg.parentId;
                //加入待发队列
                this.messages.push(msg);
            }
        }
        /**
         * 处理消息队列
         */
        static handleQueue() {
            for (let i = 0; i < this.messages.length; i++) {
                let msg = this.messages[i];
                let module = ModuleFactory.get(msg.toModule);
                // 模块状态未激活或激活才接受消息
                if (module && module.state >= 2) {
                    module.receive(msg.fromModule, msg.content);
                    // 清除已接受消息，或已死亡模块的消息
                    MessageQueue.messages.splice(i--, 1);
                }
            }
        }
    }
    /**
     * 消息数组
     */
    MessageQueue.messages = [];
    MessageQueue.noOwnerNMessages = [];

    /**
     * 工厂基类
     */
    class NFactory {
        /**
         * @param module 模块
         */
        constructor(module) {
            /**
             * 工厂item对象
             */
            this.items = new Map();
            if (module !== undefined) {
                this.moduleId = module.id;
            }
        }
        /**
         * 添加到工厂
         * @param name 	item name
         * @param item	item
         */
        add(name, item) {
            this.items.set(name, item);
        }
        /**
         * 获得item
         * @param name 	item name
         * @returns     item
         */
        get(name) {
            return this.items.get(name);
        }
        /**
         * 从容器移除
         * @param name 	item name
         */
        remove(name) {
            this.items.delete(name);
        }
        /**
         * 是否拥有该项
         * @param name  item name
         * @return      true/false
         */
        has(name) {
            return this.items.has(name);
        }
    }

    /**
     * 方法工厂，每个模块一个
     */
    class MethodFactory extends NFactory {
        /**
         * 调用方法
         * @param name 		方法名
         * @param params 	方法参数数组
         */
        invoke(name, params) {
            const foo = this.get(name);
            if (!Util.isFunction(foo)) {
                throw new NError(exports.NodomMessage.ErrorMsgs['notexist1'], exports.NodomMessage.TipWords['method'], name);
            }
            return Util.apply(foo, this.module.model, params);
        }
    }

    /**
     * 渲染器
     */
    class Renderer {
        /**
         * 添加到渲染列表
         * @param module 模块
         */
        static add(module) {
            //非激活状态，不进入渲染列表
            if (module.state !== 3) {
                return;
            }
            //如果已经在列表中，不再添加
            if (!this.waitList.includes(module.id)) {
                //计算优先级
                this.waitList.push(module.id);
            }
        }
        //从列表移除
        static remove(module) {
            let ind;
            if ((ind = this.waitList.indexOf(module.id)) !== -1) {
                this.waitList.splice(ind, 1);
            }
        }
        /**
         * 队列渲染
         */
        static render() {
            //调用队列渲染
            for (let i = 0; i < this.waitList.length; i++) {
                let m = ModuleFactory.get(this.waitList[i]);
                //渲染成功，从队列移除
                if (!m || m.render()) {
                    this.waitList.shift();
                    i--;
                }
            }
        }
    }
    /**
     * 等待渲染列表（模块名）
     */
    Renderer.waitList = [];

    /**
     * 模型工厂
     */
    class ModelManager$1 {
        constructor(module) {
            /**
             * 数据对象与模型映射，key为数据对象，value为model
             */
            this.dataMap = new WeakMap();
            /**
             * 模型模块映射
             * key:model proxy, value:{model:model,watchers:{key:[监听器1,监听器2,...]}}
             * 每个数据对象，可有多个监听器
             */
            this.modelMap = new WeakMap();
            this.module = module;
        }
        /**
         * 添加到 dataNModelMap
         * @param data      数据对象
         * @param model     模型
         */
        addToDataMap(data, model) {
            this.dataMap.set(data, model);
        }
        /**
      * 删除从 dataNModelMap
      * @param data      数据对象
      * @param model     模型
      */
        delToDataMap(data) {
            this.dataMap.delete(data);
        }
        /**
         * 从dataNModelMap获取model
         * @param data      数据对象
         * @returns         model
         */
        getFromDataMap(data) {
            return this.dataMap.get(data);
        }
        /**
         * 是否存在数据模型映射
         * @param data  数据对象
         * @returns     true/false
         */
        hasDataNModel(data) {
            return this.dataMap.has(data);
        }
        /**
         * 添加源模型到到模型map
         * @param model     模型代理
         * @param srcNModel  源模型
         */
        addModelToModelMap(model, srcNModel) {
            if (!this.modelMap.has(model)) {
                this.modelMap.set(model, { model: srcNModel });
            }
            else {
                this.modelMap.get(model).model = srcNModel;
            }
        }
        /**
       * 删除源模型到到模型map
       * @param model     模型代理
       * @param srcNModel  源模型
       */
        delModelToModelMap(model) {
            this.modelMap.delete(model);
        }
        /**
         * 从模型Map获取源模型
         * @param model     模型代理
         * @returns         源模型
         */
        getModelFromModelMap(model) {
            if (this.modelMap.has(model)) {
                return this.modelMap.get(model).model;
            }
            return undefined;
        }
        /**
         * 获取model监听器
         * @param model     model
         * @param key       model对应的属性
         * @param foo       监听处理方法
         * @returns         void
         */
        addWatcherToModelMap(model, key, foo) {
            // 把model加入到model map
            if (!this.modelMap.has(model)) {
                this.modelMap.set(model, {});
            }
            //添加watchers属性
            if (!this.modelMap.get(model).watchers) {
                this.modelMap.get(model).watchers = Object.create(null);
            }
            let watchers = this.modelMap.get(model).watchers;
            //添加观察器数组
            if (!watchers[key]) {
                watchers[key] = [];
            }
            //把处理函数加入观察器数组
            watchers[key].push(foo);
        }
        /**
         * 获取model监听器
         * @param model     model
         * @param key       model对应的属性
         * @param foo       监听处理方法
         * @returns         void
         */
        removeWatcherFromModelMap(model, key, foo) {
            if (!this.modelMap.has(model)) {
                return;
            }
            if (!this.modelMap.get(model).watchers) {
                return;
            }
            let watchers = this.modelMap.get(model).watchers;
            if (!watchers[key]) {
                return;
            }
            let index = watchers[key].findIndex(foo);
            //找到后移除
            if (index !== -1) {
                watchers.splice(index, 1);
            }
        }
        /**
         * 获取model监听器
         * @param model     model
         * @param key       model对应的属性
         * @returns         监听处理函数数组
         */
        getWatcherFromModelMap(model, key) {
            if (!this.modelMap.has(model)) {
                return undefined;
            }
            let watchers = this.modelMap.get(model).watchers;
            if (watchers) {
                return watchers[key];
            }
        }
        /**
         * 更新导致渲染
         * @param model     model
         * @param key       属性
         * @param oldValue  旧值
         * @param newValue  新值
         */
        update(model, key, oldValue, newValue) {
            Renderer.add(this.module);
            //处理观察器函数
            let watcher = this.getWatcherFromModelMap(model, key);
            if (watcher) {
                for (let foo of watcher) {
                    //方法名
                    if (typeof foo === 'string') {
                        if (this.module) {
                            foo = this.module.getMethod(foo);
                            if (foo) {
                                foo.call(model, oldValue, newValue);
                            }
                        }
                    }
                    else {
                        foo.call(model, oldValue, newValue);
                    }
                }
            }
        }
    }

    /**
     * 模块类
     */
    class Module {
        /**
         * 构造器
         * @param config    模块配置
         */
        constructor(config) {
            /**
             * 是否是首次渲染
             */
            this.firstRender = true;
            /**
             * 子模块id数组
             */
            this.children = [];
            /**
             * 模块创建时执行操作
             */
            this.createOps = [];
            /**
             * 状态 0 create(创建)、1 init(初始化，已编译)、2 unactive(渲染后被置为非激活) 3 active(激活，可渲染显示)
             */
            this.state = 0;
            /**
             * 需要加载新数据
             */
            this.loadNewData = false;
            /**
             * 待渲染的虚拟dom数组
             */
            this.renderDoms = [];
            /**
             * 放置模块的容器
             */
            this.container = null;
            /**
             * 子模块名id映射，如 {modulea:1}
             */
            this.moduleMap = new Map();
            this.id = Util.genId();
            // 模块名字
            if (config && config.name) {
                this.name = config.name;
            }
            else {
                this.name = 'Module' + this.id;
            }
            ModuleFactory.add(this);
            this.methodFactory = new MethodFactory(this);
            this.modelManager = new ModelManager$1(this);
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
            if (exports.store) {
                this.store = exports.store;
            }
        }
        /**
         * 初始化模块（加载和编译）
         */
        init() {
            return __awaiter(this, void 0, void 0, function* () {
                let config = this.initConfig;
                let urlArr = []; //请求url数组
                let cssPath = Application.getPath('css');
                let templatePath = Application.getPath('template');
                let jsPath = Application.getPath('js');
                //加载文件
                if (config && Util.isArray(config.requires) && config.requires.length > 0) {
                    config.requires.forEach((item) => {
                        let type;
                        let url = '';
                        if (Util.isObject(item)) { //为对象，可能是css或js
                            type = item['type'] || 'js';
                            url = item['url'];
                        }
                        else { //js文件
                            type = 'js';
                            url = item;
                        }
                        //转换路径
                        let path = type === 'js' ? jsPath : cssPath;
                        urlArr.push({ url: Util.mergePath([path, url]), type: type });
                    });
                }
                //模版串
                let templateStr = this.template;
                //模版信息
                if (config.template) {
                    config.template = config.template.trim();
                    if (config.template.startsWith('<')) { //html模版串
                        templateStr = config.template;
                    }
                    else { //文件
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
                    let registers = Reflect.apply(this.methodFactory.get('registerModule'), null, []);
                    if (Array.isArray(registers) && registers.length > 0) {
                        registers.forEach(v => {
                            const tagName = v.name.toUpperCase();
                            //重复注册
                            if (DefineElementManager.get(tagName) !== undefined) {
                                throw new Error(`The module name ${tagName}has been registered, please change the name `);
                            }
                            DefineElementManager.add(tagName, {
                                init: function (element, parent) {
                                    element.tagName = 'div';
                                    element.setProp('modulename', v.name);
                                    new Directive('module', v.class, element, parent);
                                }
                            });
                        });
                    }
                }
                //如果已存在templateStr，则直接编译
                if (!Util.isEmpty(templateStr)) {
                    this.virtualDom = Compiler.compile(templateStr);
                }
                //数据
                if (config.data) { //数据
                    if (Util.isObject(config.data)) { //数据
                        this.model = new Model$1(config.data, this);
                    }
                    else { //数据url
                        urlArr.push({
                            url: config.data,
                            type: 'data'
                        });
                        this.dataUrl = config.data;
                    }
                }
                else { //空数据
                    this.model = new Model$1({}, this);
                }
                //批量请求文件
                if (urlArr.length > 0) {
                    let rets = yield ResourceManager.getResources(urlArr);
                    for (let r of rets) {
                        if (r.type === 'template' || r.type === 'nd') {
                            this.virtualDom = r.content;
                        }
                        else if (r.type === 'data') {
                            this.model = new Model$1(r.content, this);
                        }
                    }
                }
                //处理子模块
                if (this.initConfig.modules) {
                    for (let cfg of this.initConfig.modules) {
                        let mdl = new Module(cfg);
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
                function changeState(mod) {
                    if (mod.isMain) {
                        mod.state = 3;
                        //可能不能存在数据，需要手动添加到渲染器
                        Renderer.add(mod);
                    }
                    else if (mod.parentId) {
                        mod.state = ModuleFactory.get(mod.parentId).state;
                    }
                    else {
                        mod.state = 1;
                    }
                }
            });
        }
        /**
         * 模型渲染
         * @return false 渲染失败 true 渲染成功
         */
        render() {
            //状态为2，不渲染
            if (this.state === 2) {
                return true;
            }
            //容器没就位或state不为active则不渲染，返回渲染失败
            if (this.state !== 3 || !this.virtualDom || !this.getContainer()) {
                return false;
            }
            //克隆新的树
            let root = this.virtualDom.clone();
            if (this.firstRender) {
                //model无数据，如果存在dataUrl，则需要加载数据
                if (this.loadNewData && this.dataUrl) {
                    request({
                        url: this.dataUrl,
                        type: 'json'
                    }).then((r) => {
                        this.model = new Model$1(r, this);
                        this.doFirstRender(root);
                        this.loadNewData = false;
                    });
                }
                else {
                    this.doFirstRender(root);
                }
            }
            else { //增量渲染
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
                        let dp = this.getNode(key);
                        for (let i = value.length - 1; i >= 0; i--) {
                            let index = value[i];
                            if (typeof index == 'string') {
                                let parm = index.split('|');
                                index = parm[0];
                                const vDom = root.query(parm[1]);
                                dp.insertBefore((() => {
                                    const el = vDom.getTmpParam('isSvgNode') ? Util.newSvgEl(vDom.tagName) : Util.newEl(vDom.tagName);
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
            let md = ModuleFactory.get(this.parentId);
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
        doFirstRender(root) {
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
            root.renderToHtml(this, { type: 'fresh' });
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
        clone(moduleName) {
            let me = this;
            let m = new Module({ name: moduleName });
            //克隆数据
            if (this.model) {
                let data = Util.clone(this.model, /^\$\S+/);
                m.model = new Model$1(data, m);
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
        getContainer() {
            //根模块，直接使用el
            if (this.selector) {
                this.container = document.querySelector(this.selector);
            }
            else { //非根模块，根据容器key获得
                this.container = document.querySelector("[key='" + this.containerKey + "']");
            }
            return this.container;
        }
        /**
         * 设置模块容器 key
         * @param key   模块容器key
         */
        setContainerKey(key) {
            this.containerKey = key;
        }
        /**
         * 获取模块容器 key
         * @param key   模块容器key
         */
        getContainerKey() {
            return (this.containerKey);
        }
        /**
         * 数据改变
         * @param model 	改变的model
         */
        dataChange() {
            Renderer.add(this);
        }
        /**
         * 添加子模块
         * @param moduleId      模块id
         * @param className     类名
         */
        addChild(moduleId) {
            if (!this.children.includes(moduleId)) {
                this.children.push(moduleId);
                let m = ModuleFactory.get(moduleId);
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
        send(toName, data) {
            if (typeof toName === 'number') {
                MessageQueue.add(this.id, toName, data);
                return;
            }
            let m;
            let pm = ModuleFactory.get(this.parentId);
            //1 比对父节点名
            //2 比对兄弟节点名
            //3 比对孩子节点名
            if (pm) {
                if (pm.name === toName) { //父亲
                    m = pm;
                }
                else { //兄弟
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
        broadcast(data) {
            //兄弟节点
            if (this.parentId) {
                let pmod = ModuleFactory.get(this.parentId);
                if (pmod) {
                    //父模块
                    this.send(this.parentId, data);
                    if (pmod.children) {
                        pmod.children.forEach((item) => {
                            //自己不发
                            if (item === this.id) {
                                return;
                            }
                            let m = ModuleFactory.get(item);
                            //兄弟模块
                            this.send(m.id, data);
                        });
                    }
                }
            }
            if (this.children !== undefined) {
                this.children.forEach((item) => {
                    let m = ModuleFactory.get(item);
                    this.send(m.id, data);
                });
            }
        }
        /**
         * 接受消息
         * @param fromName 		来源模块名
         * @param data 			消息内容
         */
        receive(fromName, data) {
            this.doModuleEvent('onReceive', [fromName, data]);
        }
        /**
         * 激活模块(添加到渲染器)
         */
        active() {
            return __awaiter(this, void 0, void 0, function* () {
                //激活状态不用激活，创建状态不能激活
                if (this.state === 3) {
                    return;
                }
                //未初始化，需要先初始化
                if (this.state === 0) {
                    yield this.init();
                }
                this.state = 3;
                //添加到渲染器
                Renderer.add(this);
                //孩子节点激活
                if (Util.isArray(this.children)) {
                    this.children.forEach((item) => __awaiter(this, void 0, void 0, function* () {
                        let m = ModuleFactory.get(item);
                        if (m) {
                            yield m.active();
                        }
                    }));
                }
            });
        }
        /**
         * 取消激活
         */
        unactive() {
            //主模块不允许取消
            if (this.isMain || this.state === 2) {
                return;
            }
            this.state = 2;
            //设置首次渲染标志
            this.firstRender = true;
            if (Util.isArray(this.children)) {
                this.children.forEach((item) => {
                    let m = ModuleFactory.get(item);
                    if (m) {
                        m.unactive();
                    }
                });
            }
        }
        /**
         * 模块终结
         */
        destroy() {
            if (Util.isArray(this.children)) {
                this.children.forEach((item) => {
                    let m = ModuleFactory.get(item);
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
        doModuleEvent(eventName, param) {
            const foo = this.methodFactory.get(eventName);
            if (!foo) {
                return;
            }
            //模块作为第一个参数
            if (param) {
                param.unshift(this);
            }
            else {
                param = [this];
            }
            //调用方法
            Util.apply(foo, this.model, param);
        }
        /**
         * 添加实例化后操作
         * @param foo  	操作方法
         */
        addCreateOperation(foo) {
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
        clearDontRender(dom) {
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
        getChild(name, descendant) {
            if (this.moduleMap.has(name)) {
                let mid = this.moduleMap.get(name);
                return ModuleFactory.get(mid);
            }
            else if (descendant) {
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
        getMethod(name) {
            return this.methodFactory.get(name);
        }
        /**
         * 添加方法
         * @param name  方法名
         * @param foo   方法函数
         */
        addMethod(name, foo) {
            this.methodFactory.add(name, foo);
        }
        /**
         * 移除方法
         * @param name  方法名
         */
        removeMethod(name) {
            this.methodFactory.remove(name);
        }
        /**
         * 设置数据url
         * @param url   数据url
         */
        setDataUrl(url) {
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
        getNode(key, notNull) {
            let keyName;
            let value;
            if (typeof key === 'string') { //默认为key值查找
                keyName = 'key';
                value = key;
            }
            else { //对象
                keyName = Object.getOwnPropertyNames(key)[0];
                value = key[keyName];
            }
            let qs = "[" + keyName + "='" + value + "']";
            let el = this.container ? this.container.querySelector(qs) : null;
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
        getElement(key, fromVirtualDom) {
            let tree = fromVirtualDom ? this.virtualDom : this.renderTree;
            return tree.query(key);
        }
        /**
         * 判断是否为容器key
         * @param key   element key
         */
        isContainerKey(key) {
            return this.containerKey === key;
        }
        /**
         * 设置首次渲染标志
         * @param flag  首次渲染标志true/false
         */
        setFirstRender(flag) {
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
        setSelector(selector) {
            this.selector = selector;
        }
    }

    /**
     * 路由类
     * @since 		1.0
     */
    class Router {
        /**
         * 把路径加入跳转列表(准备跳往该路由)
         * @param path 	路径
         */
        static go(path) {
            return __awaiter(this, void 0, void 0, function* () {
                for (let i = 0; i < this.waitList.length; i++) {
                    let li = this.waitList[i];
                    //相等，则不加入队列
                    if (li === path) {
                        return;
                    }
                    //父路径，不加入
                    if (li.indexOf(path) === 0 && li.substr(path.length + 1, 1) === '/') {
                        return;
                    }
                }
                this.waitList.push(path);
                this.load();
            });
        }
        /**
         * 启动加载
         */
        static load() {
            return __awaiter(this, void 0, void 0, function* () {
                //在加载，或无等待列表，则返回
                if (this.loading || this.waitList.length === 0) {
                    return;
                }
                let path = this.waitList.shift();
                this.loading = true;
                yield this.start(path);
                this.loading = false;
                this.load();
            });
        }
        /**
         * 切换路由
         * @param path 	路径
         */
        static start(path) {
            return __awaiter(this, void 0, void 0, function* () {
                let diff = this.compare(this.currentPath, path);
                //获得当前模块，用于寻找router view
                let parentModule;
                if (diff[0] === null) {
                    parentModule = findParentModule();
                }
                else {
                    if (typeof diff[0].module === 'string') {
                        parentModule = yield ModuleFactory.getInstance(diff[0].module, diff[0].moduleName, diff[0].dataUrl);
                    }
                    else {
                        parentModule = ModuleFactory.get(diff[0].module);
                    }
                }
                //父模块不存在，不继续处理
                if (!parentModule) {
                    return;
                }
                //onleave事件，从末往前执行
                for (let i = diff[1].length - 1; i >= 0; i--) {
                    const r = diff[1][i];
                    if (!r.module) {
                        continue;
                    }
                    let module = ModuleFactory.get(r.module);
                    if (Util.isFunction(this.onDefaultLeave)) {
                        this.onDefaultLeave(module.model);
                    }
                    if (Util.isFunction(r.onLeave)) {
                        r.onLeave(module.model);
                    }
                    //module置为不激活
                    module.unactive();
                }
                let showPath; //实际要显示的路径
                if (diff[2].length === 0) { //路由相同，参数不同
                    let route = diff[0];
                    let proute = diff[3];
                    if (route !== null) {
                        //如果useparentpath，则使用父路由的路径，否则使用自己的路径
                        showPath = route.useParentPath && proute ? proute.fullPath : route.fullPath;
                        //给模块设置路由参数
                        let module = ModuleFactory.get(route.module);
                        route.setLinkActive();
                        //设置首次渲染
                        module.setFirstRender(true);
                        yield module.active();
                        setRouteParamToNModel(route, module);
                    }
                }
                else { //路由不同
                    //加载模块
                    for (let ii = 0, len = diff[2].length; ii < len; ii++) {
                        let route = diff[2][ii];
                        //路由不存在或路由没有模块（空路由）
                        if (!route || !route.module) {
                            continue;
                        }
                        if (!route.useParentPath) {
                            showPath = route.fullPath;
                        }
                        let module;
                        //尚未获取module，进行初始化
                        if (typeof route.module === 'string') {
                            module = yield ModuleFactory.getInstance(route.module, route.moduleName, route.dataUrl);
                            if (!module) {
                                throw new NError('notexist1', exports.NodomMessage.TipWords['module'], route.module);
                            }
                            route.module = module.id;
                        }
                        else {
                            module = ModuleFactory.get(route.module);
                        }
                        //设置首次渲染
                        module.setFirstRender(true);
                        let routerKey = Router.routerKeyMap.get(parentModule.id);
                        //从父模块子节点中删除以此routerKey为containerKey的模块
                        for (let i = 0; i < parentModule.children.length; i++) {
                            let m = ModuleFactory.get(parentModule.children[i]);
                            if (m && m.isContainerKey(routerKey)) {
                                parentModule.children.splice(i, 1);
                                break;
                            }
                        }
                        //把此模块添加到父模块
                        parentModule.addChild(module.id);
                        module.setContainerKey(routerKey);
                        //激活模块
                        yield module.active();
                        //设置active项激活
                        route.setLinkActive();
                        //设置路由参数
                        setRouteParamToNModel(route);
                        //默认全局路由enter事件
                        if (Util.isFunction(this.onDefaultEnter)) {
                            this.onDefaultEnter(module.model);
                        }
                        //当前路由进入事件
                        if (Util.isFunction(route.onEnter)) {
                            route.onEnter(module.model);
                        }
                        parentModule = module;
                    }
                }
                //如果是history popstate，则不加入history
                if (this.startStyle !== 2 && showPath) {
                    let p = Util.mergePath([Application.getPath('route'), showPath]);
                    //子路由，替换state
                    if (this.showPath && showPath.indexOf(this.showPath) === 0) {
                        history.replaceState(path, '', p);
                    }
                    else { //路径push进history
                        history.pushState(path, '', p);
                    }
                    //设置显示路径
                    this.showPath = showPath;
                }
                //修改currentPath
                this.currentPath = path;
                //设置start类型为正常start
                this.startStyle = 0;
                /**
                 * 将路由参数放入module的model中
                 * @param route 	路由
                 * @param module    模块
                 */
                function setRouteParamToNModel(route, module) {
                    if (!route) {
                        return;
                    }
                    if (!module) {
                        module = ModuleFactory.get(route.module);
                    }
                    let o = {
                        path: route.path
                    };
                    if (!Util.isEmpty(route.data)) {
                        o['data'] = route.data;
                    }
                    if (!module.model) {
                        module.model = new Model$1({}, module);
                    }
                    module.model['$route'] = o;
                }
                /**
                 * 找到第一个带router的父模块
                 * @param pm    父模块
                 */
                function findParentModule(pm) {
                    if (!pm) {
                        pm = ModuleFactory.getMain();
                    }
                    if (Router.routerKeyMap.has(pm.id)) {
                        return pm;
                    }
                    for (let c of pm.children) {
                        let m = ModuleFactory.get(c);
                        return findParentModule(m);
                    }
                }
            });
        }
        /*
            * 重定向
            * @param path 	路径
            */
        static redirect(path) {
            this.go(path);
        }
        /**
         * 添加路由
         * @param route 	路由配置
         * @param parent 	父路由
         */
        static addRoute(route, parent) {
            //加入router tree
            if (RouterTree.add(route, parent) === false) ;
            //加入map
            this.routes.set(route.id, route);
        }
        /**
         * 获取路由
         * @param path 	路径
         * @param last 	是否获取最后一个路由,默认false
         */
        static getRoute(path, last) {
            if (!path) {
                return null;
            }
            let routes = RouterTree.get(path);
            if (routes === null || routes.length === 0) {
                return null;
            }
            //routeid 转route
            if (last) { //获取最后一个
                return [routes.pop()];
            }
            else { //获取所有
                return routes;
            }
        }
        /**
         * 比较两个路径对应的路由链
         * @param path1 	第一个路径
         * @param path2 	第二个路径
         * @returns 		[不同路由的父路由，第一个需要销毁的路由数组，第二个需要增加的路由数组，上2级路由]
         */
        static compare(path1, path2) {
            // 获取路由id数组
            let arr1 = null;
            let arr2 = null;
            if (path1) {
                arr1 = this.getRoute(path1);
            }
            if (path2) {
                arr2 = this.getRoute(path2);
            }
            let len = 0;
            if (arr1 !== null) {
                len = arr1.length;
            }
            if (arr2 !== null) {
                if (arr2.length < len) {
                    len = arr2.length;
                }
            }
            else {
                len = 0;
            }
            //需要销毁的旧路由数组
            let retArr1 = [];
            //需要加入的新路由数组
            let retArr2 = [];
            let i = 0;
            for (i = 0; i < len; i++) {
                //找到不同路由开始位置
                if (arr1[i].id === arr2[i].id) {
                    //比较参数
                    if (JSON.stringify(arr1[i].data) !== JSON.stringify(arr2[i].data)) {
                        //从后面开始更新，所以需要i+1
                        i++;
                        break;
                    }
                }
                else {
                    break;
                }
            }
            //旧路由改变数组
            if (arr1 !== null) {
                for (let j = i; j < arr1.length; j++) {
                    retArr1.push(arr1[j]);
                }
            }
            //新路由改变数组（相对于旧路由）
            if (arr2 !== null) {
                for (let j = i; j < arr2.length; j++) {
                    retArr2.push(arr2[j]);
                }
            }
            //上一级路由和上二级路由
            let p1 = null;
            let p2 = null;
            if (arr1 !== null && i > 0) {
                for (let j = i - 1; j >= 0 && (p1 === null || p2 === null); j--) {
                    if (arr1[j].module !== undefined) {
                        if (p1 === null) {
                            p1 = arr1[j];
                        }
                        else if (p2 === null) {
                            p2 = arr1[j];
                        }
                    }
                }
            }
            return [p1, retArr1, retArr2, p2];
        }
        /**
         * 修改模块active view（如果为view active为true，则需要路由跳转）
         * @param module 	模块
         * @param path 		view对应的route路径
         */
        static changeActive(module, path) {
            if (!module || !path || path === '') {
                return;
            }
            let domArr = Router.activeDomMap.get(module.id);
            if (!domArr) {
                return;
            }
            //遍历router active view，设置或取消active class
            domArr.forEach((item) => {
                let dom = module.getElement(item);
                if (!dom) {
                    return;
                }
                // dom route 路径
                let domPath = dom.getProp('path');
                if (dom.hasProp('activename')) { // active属性为表达式，修改字段值
                    let model = module.modelNFactory.get(dom.modelId);
                    if (!model) {
                        return;
                    }
                    let field = dom.getProp('activename');
                    //路径相同或参数路由路径前部分相同则设置active 为true，否则为false
                    if (path === domPath || path.indexOf(domPath + '/') === 0) {
                        model.set(field, true);
                    }
                    else {
                        model.set(field, false);
                    }
                }
            });
        }
    }
    /**
     * 加载中标志
     */
    Router.loading = false;
    /**
     * 路由map
     */
    Router.routes = new Map();
    /**
     * 当前路径
     */
    Router.currentPath = '';
    /**
     * 显示路径（useParentPath时，实际路由路径与显示路径不一致）
     */
    Router.showPath = '';
    /**
     * path等待链表
     */
    Router.waitList = [];
    /**
     * 当前路由在路由链中的index
     */
    Router.currentIndex = 0;
    /**
     * 启动方式 0:直接启动 1:由element active改变启动 2:popstate 启动
     */
    Router.startStyle = 0;
    /**
     * 激活Dom map，格式为{moduleId:[]}
     */
    Router.activeDomMap = new Map();
    /**
     * 绑定到module的router指令对应的key，即router容器对应的key，格式为 {moduleId:routerKey,...}
     */
    Router.routerKeyMap = new Map();
    /**
     * 路由类
     */
    class Route {
        /**
         *
         * @param config 路由配置项
         */
        constructor(config) {
            /**
             * 路由参数名数组
             */
            this.params = [];
            /**
             * 路由参数数据
             */
            this.data = {};
            /**
             * 子路由
             */
            this.children = [];
            //参数赋值
            for (let o in config) {
                this[o] = config[o];
            }
            if (config.path === '') {
                return;
            }
            this.id = Util.genId();
            if (!config.notAdd) {
                Router.addRoute(this, config.parent);
            }
            //子路由
            if (Util.isArray(config.routes)) {
                config.routes.forEach((item) => {
                    item.parent = this;
                    new Route(item);
                });
            }
        }
        /**
         * 设置关联标签激活状态
         */
        setLinkActive() {
            if (this.parent) {
                let pm;
                if (!this.parent.module) {
                    pm = ModuleFactory.getMain();
                }
                else {
                    pm = ModuleFactory.get(this.parent.module);
                }
                if (pm) {
                    Router.changeActive(pm, this.fullPath);
                }
            }
        }
        /**
         * 添加子路由
         * @param child
         */
        addChild(child) {
            this.children.push(child);
            child.parent = this;
        }
    }
    /**
     * 路由树类
     */
    class RouterTree {
        /**
         * 添加route到路由树
         *
         * @param route 路由
         * @return 添加是否成功 type Boolean
         */
        static add(route, parent) {
            //创建根节点
            if (!this.root) {
                this.root = new Route({ path: "", notAdd: true });
            }
            let pathArr = route.path.split('/');
            let node = parent || this.root;
            let param = [];
            let paramIndex = -1; //最后一个参数开始
            let prePath = ''; //前置路径
            for (let i = 0; i < pathArr.length; i++) {
                let v = pathArr[i].trim();
                if (v === '') {
                    pathArr.splice(i--, 1);
                    continue;
                }
                if (v.startsWith(':')) { //参数
                    if (param.length === 0) {
                        paramIndex = i;
                    }
                    param.push(v.substr(1));
                }
                else {
                    paramIndex = -1;
                    param = []; //上级路由的参数清空
                    route.path = v; //暂存path
                    let j = 0;
                    for (; j < node.children.length; j++) {
                        let r = node.children[j];
                        if (r.path === v) {
                            node = r;
                            break;
                        }
                    }
                    //没找到，创建新节点
                    if (j === node.children.length) {
                        if (prePath !== '') {
                            let r = new Route({ path: prePath, notAdd: true });
                            node.addChild(r);
                            node = node.children[node.children.length - 1];
                        }
                        prePath = v;
                    }
                }
                //不存在参数
                if (paramIndex === -1) {
                    route.params = [];
                }
                else {
                    route.params = param;
                }
            }
            //添加到树
            if (node !== undefined && node !== route) {
                route.path = prePath;
                node.addChild(route);
            }
            return true;
        }
        /**
         * 从路由树中获取路由节点
         * @param path  	路径
         */
        static get(path) {
            if (!this.root) {
                throw new NError("notexist", exports.NodomMessage.TipWords['root']);
            }
            let pathArr = path.split('/');
            let node = this.root;
            let paramIndex = 0; //参数索引
            let retArr = [];
            let fullPath = ''; //完整路径
            let preNode = this.root; //前一个节点
            for (let i = 0; i < pathArr.length; i++) {
                let v = pathArr[i].trim();
                if (v === '') {
                    continue;
                }
                let find = false;
                for (let j = 0; j < node.children.length; j++) {
                    if (node.children[j].path === v) {
                        //设置完整路径
                        if (preNode !== this.root) {
                            preNode.fullPath = fullPath;
                            preNode.data = node.data;
                            retArr.push(preNode);
                        }
                        //设置新的查找节点
                        node = node.children[j];
                        //参数清空
                        node.data = {};
                        preNode = node;
                        find = true;
                        //参数索引置0
                        paramIndex = 0;
                        break;
                    }
                }
                //路径叠加
                fullPath += '/' + v;
                //不是孩子节点,作为参数
                if (!find) {
                    if (paramIndex < node.params.length) { //超出参数长度的废弃
                        node.data[node.params[paramIndex++]] = v;
                    }
                }
            }
            //最后一个节点
            if (node !== this.root) {
                node.fullPath = fullPath;
                retArr.push(node);
            }
            return retArr;
        }
    }
    //处理popstate事件
    window.addEventListener('popstate', function (e) {
        //根据state切换module
        const state = history.state;
        if (!state) {
            return;
        }
        Router.startStyle = 2;
        Router.go(state);
    });

    /**
     * 调度器，用于每次空闲的待操作序列调度
     */
    class Scheduler {
        static dispatch() {
            Scheduler.tasks.forEach((item) => {
                if (Util.isFunction(item.func)) {
                    if (item.thiser) {
                        item.func.call(item.thiser);
                    }
                    else {
                        item.func();
                    }
                }
            });
        }
        /**
         * 启动调度器
         * @param scheduleTick 	渲染间隔
         */
        static start(scheduleTick) {
            Scheduler.dispatch();
            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(Scheduler.start);
            }
            else {
                window.setTimeout(Scheduler.start, scheduleTick || 50);
            }
        }
        /**
         * 添加任务
         * @param foo 		任务和this指向
         * @param thiser 	this指向
         */
        static addTask(foo, thiser) {
            if (!Util.isFunction(foo)) {
                throw new NError("invoke", "Scheduler.addTask", "0", "function");
            }
            Scheduler.tasks.push({ func: foo, thiser: thiser });
        }
        /**
         * 移除任务
         * @param foo 	任务
         */
        static removeTask(foo) {
            if (!Util.isFunction(foo)) {
                throw new NError("invoke", "Scheduler.removeTask", "0", "function");
            }
            let ind = -1;
            if ((ind = Scheduler.tasks.indexOf(foo)) !== -1) {
                Scheduler.tasks.splice(ind, 1);
            }
        }
    }
    Scheduler.tasks = [];

    const randomString = () => Math.random().toString(36).substring(8).split('').join('_');
    const ActionTypes = {
        INIT: `@@kayak/INIT${randomString()}`,
        REPLACE: `@@kayak/REPLACE${randomString()}`,
    };
    function isObject(action) {
        return typeof action == 'object' && action != null;
    }

    class Watcher {
        static update(key, fn) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isExec) {
                    return;
                }
                this.isExec = true;
                let extra = [];
                if (key !== undefined) {
                    extra = Watcher.keyMap.get(key) || [];
                }
                let watchers = [...Watcher.watchers, ...extra];
                yield fn();
                watchers === null || watchers === void 0 ? void 0 : watchers.forEach(fn => fn());
                this.isExec = false;
            });
        }
        static remove(fn, key) {
            let watchers = this.watchSelect(key);
            watchers === null || watchers === void 0 ? void 0 : watchers.splice(watchers.indexOf(fn), 1);
        }
        static add(fn, key) {
            var _a;
            let watchers = this.watchSelect(key);
            if (key && watchers === undefined) {
                this.keyMap.set(key, new Array());
                (_a = this.keyMap.get(key)) === null || _a === void 0 ? void 0 : _a.push(fn);
            }
            watchers === null || watchers === void 0 ? void 0 : watchers.push(fn);
        }
        static watchSelect(key) {
            return key === undefined ? Watcher.watchers : Watcher.keyMap.get(key);
        }
    }
    Watcher.watchers = [];
    Watcher.keyMap = new Map();
    Watcher.isExec = false;

    class Model {
        constructor(data, fn) {
            let proxy = new Proxy(data, {
                set: (src, key, value, receiver) => {
                    //值未变,proxy 不处理
                    if (src[key] === value) {
                        return true;
                    }
                    //不处理原型属性 
                    let excludes = ['__proto__', 'constructor'];
                    if (excludes.includes(key)) {
                        return true;
                    }
                    if (key != '$watch') {
                        Watcher.update(key, fn);
                    }
                    return Reflect.set(src, key, value, receiver);
                },
                get: (src, key, receiver) => {
                    let res = Reflect.get(src, key, receiver);
                    let data = ModelManager.getFromDataMap(src[key]);
                    if (data) {
                        return data;
                    }
                    if (typeof res === 'object' && res !== null) {
                        if (!src[key].$watch) {
                            let p = new Model(res, fn);
                            return p;
                        }
                    }
                    return res;
                },
                deleteProperty: function (src, key) {
                    if (src[key] != null && typeof src[key] === 'object') {
                        ModelManager.delToDataMap(src[key]);
                    }
                    delete src[key];
                    return true;
                }
            });
            proxy.$watch = true;
            ModelManager.addToDataMap(data, proxy);
            return proxy;
        }
    }
    class ModelManager {
        static addToDataMap(data, proxy) {
            this.dataMap.set(data, proxy);
        }
        static delToDataMap(data) {
            this.dataMap.delete(data);
        }
        static getFromDataMap(data) {
            return this.dataMap.get(data);
        }
    }
    ModelManager.dataMap = new WeakMap();

    function combineReducers(reducers) {
        const reducerKeys = Object.keys(reducers);
        const combineReducers = {};
        for (let i = 0; i < reducerKeys.length; i++) {
            const key = reducerKeys[i];
            if (typeof reducers[key] === 'function') {
                combineReducers[key] = reducers[key];
            }
            else {
                throw new Error(`${key}对应的reducer不是函数，请确保${reducers[key]}为函数,
                      Please ensure that the reducer you provide is a function
        `);
            }
        }
        const combineKeys = Object.keys(combineReducers);
        let shapeAssertionError;
        try {
            assertReducerShape(combineReducers);
        }
        catch (e) {
            shapeAssertionError = e;
        }
        return function (state = {}, action) {
            if (shapeAssertionError) {
                throw shapeAssertionError;
            }
            for (let i = 0; i < combineKeys.length; i++) {
                const key = combineKeys[i];
                const reducer = combineReducers[key];
                const previousStateForKey = state[key];
                const nextStateForKey = reducer(previousStateForKey, action);
                if (typeof nextStateForKey === 'undefined') {
                    const actionType = action && action.type;
                    throw new Error(`When called with an action of type ${actionType ? `"${String(actionType)}"` : '(unknown type)'}, the slice reducer for key "${key}" returned undefined. ` +
                        `To ignore an action, you must explicitly return the previous state. ` +
                        `If you want this reducer to hold no value, you can return null instead of undefined.`);
                }
                state[key] = nextStateForKey;
            }
        };
    }
    function assertReducerShape(reducers) {
        Object.keys(reducers).forEach(key => {
            const reducer = reducers[key];
            const initialState = reducer(undefined, { type: ActionTypes.INIT });
            if (typeof initialState === 'undefined') {
                throw new Error(`The slice reducer for key "${key}" returned undefined during initialization. ` +
                    `If the state passed to the reducer is undefined, you must ` +
                    `explicitly return the initial state. The initial state may ` +
                    `not be undefined. If you don't want to set a value for this reducer, ` +
                    `you can use null instead of undefined.`);
            }
            if (typeof reducer(undefined, {
                type: ActionTypes.INIT + '1'
            }) === 'undefined') {
                throw new Error(`The slice reducer for key "${key}" returned undefined when probed with a random type. ` +
                    `Don't try to handle '${ActionTypes.INIT}' or other actions in "redux/*" ` +
                    `namespace. They are considered private. Instead, you must return the ` +
                    `current state for any unknown actions, unless it is undefined, ` +
                    `in which case you must return the initial state, regardless of the ` +
                    `action type. The initial state may not be undefined, but can be null.`);
            }
        });
    }

    function clone(proxy, ...exc) {
        let ds = Object.getOwnPropertyNames(proxy);
        let res = new Object();
        for (let i = 0; i < ds.length; i++) {
            if (proxy.hasOwnProperty(ds[i]) && ds[i] !== '$watch' && !exc.includes(ds[i])) {
                let param = Reflect.get(proxy, ds[i]);
                Object.defineProperty(res, ds[i], {
                    value: function () {
                        if (typeof param === 'object' && param !== null) {
                            return clone(param);
                        }
                        else {
                            return param;
                        }
                    }(),
                    enumerable: true
                });
            }
        }
        return res;
    }

    /**
     *
     * @param reducer A function to process your action state
     * @returns An object that controls your state repository
     */
    function createStore(reducer) {
        /**
         * Is the scheduling Reducer method being executed
         */
        let isDispatching = false;
        /**
         *
         *  If there is only one reducer function, set the default value
         */
        let currentReducer = typeof reducer === 'function' ? reducer : combineReducers(reducer);
        /**
         *
            初始化数据
            Initialization data
         */
        let data = {
            'currentState': undefined
        };
        /**
         * 初始化代理对象返回的proxy
         * Initializes the proxy returned by the proxy object
         */
        let proxy;
        let combine = typeof reducer === 'function' ? false : true;
        /**
         *
         * @param action Action对象，要求传入type,
         *              Action object. Type is required
         */
        function dispatch(action) {
            if (!isObject(action)) {
                throw new Error(`Actions must be a objects. Instead, the actual type was: '${typeof action}'`);
            }
            if (typeof action.type === 'undefined') {
                throw new Error('Actions may not have an undefined "type" property. You may have misspelled an action type string constant.');
            }
            let currentState = data.currentState;
            try {
                isDispatching = true;
                if (combine) {
                    currentReducer(proxy, action);
                }
                else {
                    proxy['currentState'] = currentReducer(currentState, action);
                }
            }
            finally {
                isDispatching = false;
            }
        }
        function subscribe(listener, key) {
            if (typeof listener !== 'function') {
                throw new Error(`Expected the listener to be a function. Instead, received: '${typeof (listener)}'`);
            }
            if (isDispatching) {
                throw new Error('You may not call store.subscribe() while the reducer is executing. ' +
                    'If you would like to be notified after the store has been updated, subscribe from a ' +
                    'component and invoke store.getState() in the callback to access the latest state. ' +
                    'See https://redux.js.org/api/store#subscribelistener for more details.');
            }
            let isSubscribed = true;
            key !== undefined ? Watcher.add(listener, key) : Watcher.add(listener);
            return function unsubscribe() {
                if (!isSubscribed) {
                    return;
                }
                if (isDispatching) {
                    throw new Error('You may not unsubscribe from a store listener while the reducer is executing. ');
                }
                Watcher.remove(listener, key);
                isSubscribed = false;
            };
        }
        function getState() {
            if (isDispatching) {
                throw new Error('You may not call store.getState() while the reducer is executing. ' +
                    'The reducer has already received the state as an argument. ' +
                    'Pass it down from the top reducer instead of reading it from the store.' +
                    'reducer还在执行中');
            }
            /**
             * get clone object
             */
            const res = combine ? clone(data, 'currentState') : clone(data);
            return combine ? res : res['currentState'];
        }
        /**
         *
         * @param newReducer A new Reducer replaces the original reducer function
         * @returns store
         */
        function replace(newReducer) {
            if (typeof newReducer !== 'function') {
                throw new Error(`Expected the nextReducer to be a function. Instead, received: '${typeof newReducer}`);
            }
            currentReducer = newReducer;
            dispatch({ type: ActionTypes.REPLACE });
            return store;
        }
        function update() {
            isDispatching = false;
        }
        /**
         *   proxy Initialize data
         */
        proxy = new Model(data, update);
        /**
         * state get default data
         */
        dispatch({ type: ActionTypes.INIT });
        const store = {
            dispatch: dispatch,
            subscribe,
            getState,
            replace,
        };
        return store;
    }

    /**
     * 新建store方法
     */
    const newStore = createStore;
    /**
     * nodom提示消息
     */
    exports.NodomMessage = void 0;
    exports.store = void 0;
    /**
     * 新建一个App
     * @param config 应用配置
     */
    function app(config) {
        return __awaiter(this, void 0, void 0, function* () {
            if (window['NodomConfig']) {
                config = Util.merge({}, window['NodomConfig'], config);
            }
            let lang = config && config.language;
            if (!lang) {
                lang = navigator.language ? navigator.language.substr(0, 2) : 'zh';
            }
            //  NodomMessage = eval('(NodomMessage_' + lang + ')');     
            exports.NodomMessage = new Function('return window.nodom.NodomMessage_' + lang)();
            if (!config || !config.module) {
                throw new NError('config', exports.NodomMessage.TipWords['application']);
            }
            Application.setPath(config.path);
            //模块数组初始化
            if (config.modules) {
                yield ModuleFactory.addModules(config.modules);
            }
            //消息队列消息处理任务
            Scheduler.addTask(MessageQueue.handleQueue, MessageQueue);
            //渲染器启动渲染
            Scheduler.addTask(Renderer.render, Renderer);
            //启动调度器
            Scheduler.start(config.scheduleCircle);
            //加载状态管理实例对象
            if (Util.isObject(config.store)) {
                exports.store = config.store;
            }
            //存在类名
            let module;
            if (config.module.class) {
                module = yield ModuleFactory.getInstance(config.module.class, config.module.name, config.module.data);
                module.setSelector(config.module.el);
            }
            else {
                module = new Module(config.module);
            }
            //设置主模块
            ModuleFactory.setMain(module);
            yield module.active();
            if (config.routes) {
                this.createRoute(config.routes);
            }
            return module;
        });
    }
    /**
     * 暴露的创建路由方法
     * @param config  数组或单个配置
     */
    function createRoute(config) {
        if (Util.isArray(config)) {
            for (let item of config) {
                new Route(item);
            }
        }
        else {
            return new Route(config);
        }
    }
    /**
     * 创建指令
     * @param name      指令名
     * @param priority  优先级（1最小，1-10为框架保留优先级）
     * @param init      初始化方法
     * @param handler   渲染时方法
     */
    function createDirective(name, priority, init, handler) {
        return DirectiveManager.addType(name, priority, init, handler);
    }
    /**
     * 创建模块
     * @param modules 模块配置数组
     */
    function addModules(modules) {
        ModuleFactory.addModules(modules);
    }
    /**
     * ajax 请求
     * @param config    object 或 string
     *                  如果为string，则直接以get方式获取资源
     *                  object 项如下:
     *                  参数名|类型|默认值|必填|可选值|描述
     *                  -|-|-|-|-|-
     *                  url|string|无|是|无|请求url
     *					method|string|GET|否|GET,POST,HEAD|请求类型
     *					params|Object/FormData|{}|否|无|参数，json格式
     *					async|bool|true|否|true,false|是否异步
     *  				timeout|number|0|否|无|请求超时时间
     *                  type|string|text|否|json,text|
     *					withCredentials|bool|false|否|true,false|同源策略，跨域时cookie保存
     *                  header|Object|无|否|无|request header 对象
     *                  user|string|无|否|无|需要认证的请求对应的用户名
     *                  pwd|string|无|否|无|需要认证的请求对应的密码
     *                  rand|bool|无|否|无|请求随机数，设置则浏览器缓存失效
     */
    function request(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (typeof config === 'string') {
                    config = {
                        url: config
                    };
                }
                config.params = config.params || {};
                //随机数
                if (config.rand) { //针对数据部分，仅在app中使用
                    config.params.$rand = Math.random();
                }
                let url = config.url;
                const async = config.async === false ? false : true;
                const req = new XMLHttpRequest();
                //设置同源策略
                req.withCredentials = config.withCredentials;
                //类型默认为get
                const method = (config.method || 'GET').toUpperCase();
                //超时，同步时不能设置
                req.timeout = async ? config.timeout : 0;
                req.onload = () => {
                    if (req.status === 200) {
                        let r = req.responseText;
                        if (config.type === 'json') {
                            try {
                                r = JSON.parse(r);
                            }
                            catch (e) {
                                reject({ type: "jsonparse" });
                            }
                        }
                        resolve(r);
                    }
                    else {
                        reject({ type: 'error', url: url });
                    }
                };
                req.ontimeout = () => reject({ type: 'timeout' });
                req.onerror = () => reject({ type: 'error', url: url });
                //上传数据
                let data = null;
                switch (method) {
                    case 'GET':
                        //参数
                        let pa;
                        if (Util.isObject(config.params)) {
                            let ar = [];
                            Util.getOwnProps(config.params).forEach(function (key) {
                                ar.push(key + '=' + config.params[key]);
                            });
                            pa = ar.join('&');
                        }
                        if (pa !== undefined) {
                            if (url.indexOf('?') !== -1) {
                                url += '&' + pa;
                            }
                            else {
                                url += '?' + pa;
                            }
                        }
                        break;
                    case 'POST':
                        if (config.params instanceof FormData) {
                            data = config.params;
                        }
                        else {
                            let fd = new FormData();
                            for (let o in config.params) {
                                fd.append(o, config.params[o]);
                            }
                            data = fd;
                        }
                        break;
                }
                req.open(method, url, async, config.user, config.pwd);
                //设置request header
                if (config.header) {
                    Util.getOwnProps(config.header).forEach((item) => {
                        req.setRequestHeader(item, config.header[item]);
                    });
                }
                req.send(data);
            }).catch((re) => {
                switch (re.type) {
                    case "error":
                        throw new NError("notexist1", exports.NodomMessage.TipWords['resource'], re.url);
                    case "timeout":
                        throw new NError("timeout");
                    case "jsonparse":
                        throw new NError("jsonparse");
                }
            });
        });
    }

    /**
     * 异常处理类
     * @since       1.0.0
     */
    class NError extends Error {
        constructor(errorName, p1, p2, p3, p4) {
            super(errorName);
            let msg = exports.NodomMessage.ErrorMsgs[errorName];
            if (msg === undefined) {
                this.message = "未知错误";
                return;
            }
            //复制请求参数
            let params = [msg];
            for (let i = 1; i < arguments.length; i++) {
                params.push(arguments[i]);
            }
            this.message = Util.compileStr.apply(null, params);
        }
    }

    /**
     * 表达式类
     */
    class Expression {
        /**
         * @param exprStr	表达式串
         */
        constructor(exprStr) {
            this.fields = []; // 字段数组
            this.id = Util.genId();
            let execStr;
            if (exprStr) {
                execStr = this.compile(exprStr);
            }
            if (execStr) {
                let v = this.fields.length > 0 ? ',' + this.fields.join(',') : '';
                execStr = 'function($module' + v + '){return ' + execStr + '}';
                this.execFunc = (new Function('return ' + execStr))();
            }
        }
        /**
         * 克隆
         */
        clone() {
            return this;
        }
        /**
         * 初始化，把表达式串转换成堆栈
         * @param exprStr 	表达式串
         */
        compile(exprStr) {
            //替代字符串的正则数组
            let stringReg = [/\\"/g, /\\'/g, /\\`/g, /\".*?\"/g, /'.*?'/g, /`.*?`/g];
            let replaceMap = new Map();
            const TMPStr = '##TMP';
            //替换字符串
            stringReg.forEach(reg => {
                if (reg.test(exprStr)) {
                    exprStr.match(reg).forEach((text) => {
                        let index = exprStr.indexOf(text);
                        replaceMap.set(TMPStr + index, text);
                        exprStr = exprStr.substring(0, index) + (TMPStr + index) + exprStr.substring(index + text.length);
                    });
                }
            });
            exprStr = exprStr.trim().replace(/([w]\s)|instanceof|\s+/g, (w, index) => {
                if (index)
                    return index;
                else {
                    if (w === 'instanceof') {
                        return ' ' + w + ' ';
                    }
                    return '';
                }
            });
            //首尾指针
            let [first, last] = [0, 0];
            let [braces, fields, funArr, filters] = [[], [], [], []];
            //括号数组 字段数组 函数数组 存过滤器需要的值
            let filterString = '';
            //特殊字符
            let special = /[\?\:\,\!\|\*\/\+\-><=&%]/;
            //返回的串
            let express = '';
            //函数名
            let funName;
            let isInBrace = false;
            let isInFun = false;
            while (last < exprStr.length) {
                let lastStr = exprStr[last];
                if (lastStr == '(') {
                    if (isInFun) {
                        //函数里存函数名
                        funName = exprStr.substring(funArr.pop(), last);
                        express += funName;
                        first = last;
                    }
                    else {
                        if (!isInBrace) { //不在函数里外面也不在括号里
                            //取data内函数
                            let mt = exprStr.substring(first, last).match(/^[\$\w]+/);
                            if (mt) {
                                fields.push(mt[0]);
                            }
                            express += exprStr.substring(first, last);
                            first = last;
                        }
                    }
                    braces.push(last++);
                    isInBrace = true;
                }
                else if (lastStr == ')') {
                    let tmpStr = exprStr.substring(braces.pop(), last);
                    filters.push(tmpStr);
                    if (/[\,\!\|\*\/\+\-><=&%]/.test(tmpStr)) { //字段截取需要的字母集
                        let fieldItem = tmpStr.match(/[\w\$^\.]+/g);
                        fields = fields.concat(fieldItem);
                    }
                    else {
                        if (tmpStr.substr(1).match(/[\$\w]+/) && tmpStr.substr(1).match(/[\$\w]+/)[0].length == tmpStr.substr(1).length) { //括号里没有特殊符号
                            fields.push(tmpStr.substr(1));
                        }
                        else if (tmpStr.substr(1).startsWith('...')) { //拓展运算符
                            fields.push(tmpStr.substr(4));
                        }
                    }
                    //外面没有括号
                    if (braces.length == 0) {
                        isInBrace = false;
                        express += tmpStr;
                    }
                    //处理函数串
                    if (isInFun) {
                        replaceMethod();
                        isInFun = false;
                    }
                    first = last++;
                }
                else if (lastStr == '$') {
                    isInFun = true;
                    funArr.push(last++);
                }
                else if (special.test(lastStr) && !isInBrace) {
                    express += exprStr.substring(first, last) + lastStr;
                    //特殊字符处理
                    fields = fields.concat(exprStr.substring(first, last).match(/[\$\#\w^\.]+/g));
                    if (lastStr == '=' || lastStr == '|' || lastStr == '&') { //处理重复字符，和表达式
                        if (lastStr == '|' && exprStr[last + 1] != '|') { //表达式处理
                            let str = filters[filters.length - 1] ? filters[filters.length - 1] : exprStr.substring(first, last);
                            if (!filters.length) {
                                filterString = str;
                            }
                            let res = handFilter();
                            let index = express.indexOf(str);
                            //')'和'|'
                            express = express.substring(0, index) + res.str + express.substring(index + str.length + 2);
                            first = last += res.length + 1;
                            continue;
                        }
                        while (exprStr[last + 1] == lastStr) { //处理重复字符
                            express += exprStr[++last];
                        }
                    }
                    first = ++last;
                }
                else {
                    last++;
                }
            }
            let endStr = exprStr.substring(first);
            if (endStr.indexOf(' ') === -1 && !endStr.startsWith('##TMP') && !endStr.startsWith(')')) {
                let str = endStr.match(/[A-za-z$]+/);
                if (str !== null) {
                    fields.push(str[0]);
                }
            }
            express += endStr;
            if (express.indexOf('instanceof') !== -1) {
                fields.push(express.split(' ')[0]);
            }
            let exclude = ['.', '$module', '##TMP', 'TMP', 'this'];
            fields = [...(new Set(fields))].filter((v) => {
                return v != null && exclude.reduce((sum, value) => {
                    return sum === 0 ? 0 : (!v.startsWith(value) ? 1 : 0);
                }, 1) === 1 && isNaN(parseInt(v, 10));
            });
            if (replaceMap.size) {
                replaceMap.forEach((value, key) => {
                    express = express.substring(0, express.indexOf(key)) + value + express.substring(express.indexOf(key) + key.length);
                });
            }
            fields.forEach(field => {
                this.addField(field);
            });
            return express;
            /**
            * @returns {
             * str:过滤器串
             * length:编译跳过的长度
             */
            function handFilter() {
                //逻辑运算
                if (/\d+/.test(exprStr[last + 1])) {
                    return;
                }
                last++;
                let tmpStr = exprStr.substr(last).split(/[\)\(\+\-\*><=&%]/)[0];
                //多个过滤器
                let filterStr = tmpStr.split('|');
                let filterObj = {};
                let value = filters.length > 0 ? filters.pop() + ')' : filterString;
                let length = 0;
                for (let i = 0; i < filterStr.length; i++) {
                    let fString = filterStr[i];
                    let args = [];
                    if (fString.indexOf(':') != -1) { //有过滤器格式
                        args = fString.split(/[\:\+\-\*><=&%]/);
                    }
                    if (args.length == 0) { //如果没有过滤器参数
                        let filterName = fString.match(/^\w+/)[0];
                        filterObj[filterName] = [];
                        length += filterName.length - 1;
                        continue;
                    }
                    for (let i = 1; i < args.length; i++) {
                        if (args[i].startsWith('##TMP')) { //字符串还原
                            let deleteKey = args[i];
                            args[i] = replaceMap.get(args[i]);
                            replaceMap.delete(deleteKey);
                        }
                        length += args[i].length;
                    }
                    length += args.length + args[0].length;
                    let params = args.slice(1);
                    filterObj[args[0]] = params;
                }
                return {
                    str: 'nodom.FilterManager.exec($module,' + JSON.stringify(filterObj) + ',' + value + ')',
                    length: length,
                };
            }
            function replaceMethod() {
                express = express.replace(/\$[^(]+?\(/, () => {
                    return '$module.methodFactory.get("' + funName.substr(1) + '").call($module,';
                });
            }
        }
        /**
         * 表达式计算
         * @param model 	模型 或 fieldObj对象
         * @returns 		计算结果
         */
        val(model) {
            let module = ModuleFactory.get(model.$moduleId);
            if (!model)
                model = module.model;
            let valueArr = [];
            this.fields.forEach((field) => {
                valueArr.push(getFieldValue(module, model, field));
            });
            //module作为第一个参数
            valueArr.unshift(module);
            let v;
            try {
                v = this.execFunc.apply(module, valueArr);
            }
            catch (e) {
            }
            return v === undefined || v === null ? '' : v;
            /**
             * 获取字段值
             * @param module    模块
             * @param dataObj   数据对象
             * @param field     字段名
             * @return          字段值
             */
            function getFieldValue(module, dataObj, field) {
                if (dataObj.hasOwnProperty(field)) {
                    return dataObj[field];
                }
                //从根查找
                return module.model.$query(field);
            }
        }
        /**
        * 添加字段到fields
        * @param field 	字段
        * @returns         true/false
        */
        addField(field) {
            //js 保留字
            const jsKeyWords = ['true', 'false', 'undefined', 'null', 'typeof',
                'Object', 'Function', 'Array', 'Number', 'Date',
                'instanceof', 'NaN', 'new'];
            if (field === '' || jsKeyWords.includes(field) || Util.isNumberString(field) || field.startsWith('Math') || field.startsWith('Object')) {
                return false;
            }
            //多级字段只保留第一级，如 x.y只保留x
            let ind;
            if ((ind = field.indexOf('.')) !== -1) {
                if (ind == 0) {
                    field = field.substr(1);
                }
                else {
                    field = field.substr(0, ind);
                }
            }
            if (!this.fields.includes(field)) {
                this.fields.push(field);
            }
            return true;
        }
    }

    class LocalStore {
        constructor() {
            /**
             * all topic  subscribers
             */
            this.subscribers = new Map();
        }
        /**
         *
         * @param type  register a topic
         * @param fn    create a function to subscribe to topics
         * @returns     A function to unsubscribe from this topic
         */
        subscribe(type, fn) {
            if (!Util.isFunction(fn)) {
                throw new Error(`${fn} should be a function`);
            }
            const { subscribers } = this;
            const fnArrays = subscribers.get(type) === undefined ?
                subscribers.set(type, new Array()).get(type) :
                subscribers.get(type);
            fnArrays.push(fn);
            return () => {
                const index = fnArrays.indexOf(fn);
                if (index === -1) {
                    return;
                }
                fnArrays.splice(index, 1);
            };
        }
        /**
         *
         * @param type  publish a topic
         * @param data Sent data
         * @returns 当前主题是否已经被注册
         */
        publish(type, data) {
            const { subscribers } = this;
            const fnArrays = subscribers.get(type) === undefined ?
                [] :
                subscribers.get(type);
            if (fnArrays.length > 0) {
                fnArrays.forEach((fn) => {
                    try {
                        fn(type, data);
                    }
                    catch (e) {
                        throw new Error(`Function:${fn} execution error`);
                    }
                });
                return true;
            }
            else {
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

    /**
     * 基础服务库
     * @since       1.0.0
     */
    class Util {
        //唯一主键
        static genId() {
            return this.generatedId++;
        }
        /**
         *
         * @param paModule 父模块
         * @param module 当前模块
         * @param dom 当前dom
         * @returns void
         */
        static handlesDatas(paModule, module, dom) {
            return __awaiter(this, void 0, void 0, function* () {
                const { datas } = dom;
                const { model } = module;
                const { dataType, name, id } = paModule;
                if (datas === undefined || !Util.isObject(datas)) {
                    return;
                }
                //datas属性
                const dataNames = Object.getOwnPropertyNames(datas);
                for (let i = 0; i < dataNames.length; i++) {
                    paModule.subscribes = paModule.subscribes || new LocalStore();
                    let prop = dataNames[i], subscribes = paModule.subscribes, data = datas[prop], dependencies, objModel, valStr;
                    //表达式
                    let exp = new Expression(data[0]);
                    //处理依赖
                    handlesDependencies(data[0]);
                    //默认值
                    dependencies.obj = dependencies.obj || paModule.model;
                    //获取的到数据对象
                    if (dependencies.obj !== '') {
                        updated(dependencies);
                    }
                    else {
                        let unSubScribe = subscribes.subscribe('@dataTry' + id, () => {
                            handlesDependencies(data[0]);
                            if (dependencies.obj !== '') {
                                updated(dependencies);
                                //取消订阅
                                unSubScribe();
                            }
                        });
                    }
                    //找到依赖对象以后进行进一步操作
                    function updated(Dependence) {
                        Dependence.obj = Dependence.obj || paModule.model;
                        const { key, obj, moduleName } = Dependence;
                        let expData = (valStr || exp).val(objModel);
                        //预留 数据类型验证
                        if (dataType != undefined && Object.keys(dataType).indexOf(prop) !== -1) {
                            if (dataType[prop].type !== typeof expData && (dataType[prop].type == 'array' && !Array.isArray(expData))) {
                                return;
                            }
                        }
                        model[prop] = expData;
                        //双向绑定
                        if (data[1]) {
                            model.$watch(prop, (oldValue, newValue) => __awaiter(this, void 0, void 0, function* () {
                                //防止栈溢出
                                obj[key] = yield newValue;
                            }));
                        }
                        let tid;
                        if (name == moduleName) {
                            tid = id;
                        }
                        else {
                            //获取模块
                            let subscribeMd = paModule.getChild(moduleName);
                            if (subscribeMd !== null) {
                                tid = subscribeMd.id;
                                if (subscribeMd.subscribes == undefined) {
                                    subscribes = subscribeMd.subscribes = new LocalStore();
                                }
                            }
                        }
                        let change = false;
                        //单向绑定基本数据类型
                        obj && obj.$watch(key, () => __awaiter(this, void 0, void 0, function* () {
                            change = true;
                        }));
                        //订阅,反作用
                        subscribes.subscribe('@data' + tid, () => {
                            //基本数据类型可以做到双向绑定，对象为单向数据流
                            if (Util.isObject(obj[key]) || change) {
                                model[prop] = obj[key];
                                change = false;
                            }
                        });
                    }
                    //处理依赖关系
                    function handlesDependencies(execStr) {
                        let index = execStr.lastIndexOf('.');
                        let keyFunc, objFunc, keyArray, 
                        //数据源模块
                        objMd;
                        if (index !== -1) {
                            dependencies = {
                                obj: execStr.substring(0, index),
                                key: execStr.substring(index + 1),
                                moduleName: execStr.substring(0, execStr.indexOf('.'))
                            };
                            let { key, moduleName } = dependencies;
                            let keys = [];
                            //key有关键词
                            if (exp.fields.reduce((pre, v) => {
                                if (key.indexOf(v) !== -1) {
                                    keys.push(v);
                                    return pre + 1;
                                }
                            }, 0)) {
                                keyFunc = new Function(`return function(${keys.join(',')}  ){return  ${key}  }`)();
                                keyArray = keys;
                            }
                            valStr = new Expression(execStr.replace(moduleName + '.', ''));
                        }
                        else {
                            dependencies = {
                                key: execStr,
                                obj: '',
                                moduleName: ''
                            };
                        }
                        let { obj, moduleName } = dependencies;
                        if (dependencies.moduleName === '') {
                            //赋值模块名
                            dependencies.moduleName = paModule.name;
                            objMd = paModule;
                        }
                        else {
                            dependencies.obj = obj.replace(moduleName, 'this');
                            objMd = paModule.getChild(moduleName) || module;
                            objFunc = new Function(`return function(${exp.fields.join(',')}  ){return  ${dependencies.obj}  }`)();
                        }
                        objModel = objMd.model;
                        if (keyFunc !== undefined) {
                            dependencies['key'] = keyFunc.apply(objMd, keyArray.map(field => {
                                if (objModel.hasOwnProperty(field)) {
                                    return objModel[field];
                                }
                                return objModel.$query(field);
                            }));
                        }
                        dependencies['obj'] = objFunc ? objFunc.apply(objModel, exp.fields.map(field => {
                            if (objModel.hasOwnProperty(field)) {
                                return objModel[field];
                            }
                            return objModel.$query(field);
                        })) : undefined;
                    }
                }
            });
        }
        /******对象相关******/
        /**
         * 对象复制
         * @param srcObj    源对象
         * @param expKey    不复制的键正则表达式或名
         * @param extra     clone附加参数
         * @returns         复制的对象
         */
        static clone(srcObj, expKey, extra) {
            let me = this;
            let map = new WeakMap();
            // let map: Map<Object, any> = new Map();
            return clone(srcObj, expKey, extra);
            /**
             * clone对象
             * @param src   待clone对象
             * @param extra clone附加参数
             * @returns     克隆后的对象
             */
            function clone(src, expKey, extra) {
                //非对象或函数，直接返回            
                if (!src || typeof src !== 'object' || Util.isFunction(src)) {
                    return src;
                }
                let dst;
                //带有clone方法，则直接返回clone值
                if (src.clone && Util.isFunction(src.clone)) {
                    return src.clone(extra);
                }
                else if (me.isObject(src)) {
                    dst = new Object();
                    //把对象加入map，如果后面有新克隆对象，则用新克隆对象进行覆盖
                    map.set(src, dst);
                    Object.getOwnPropertyNames(src).forEach((prop) => {
                        //不克隆的键
                        if (expKey) {
                            if (expKey.constructor === RegExp && expKey.test(prop) //正则表达式匹配的键不复制
                                || Util.isArray(expKey) && expKey.includes(prop) //被排除的键不复制
                            ) {
                                return;
                            }
                        }
                        dst[prop] = getCloneObj(src[prop], expKey, extra);
                    });
                }
                else if (me.isMap(src)) {
                    dst = new Map();
                    //把对象加入map，如果后面有新克隆对象，则用新克隆对象进行覆盖
                    src.forEach((value, key) => {
                        //不克隆的键
                        if (expKey) {
                            if (expKey.constructor === RegExp && expKey.test(key) //正则表达式匹配的键不复制
                                || expKey.includes(key)) { //被排除的键不复制
                                return;
                            }
                        }
                        dst.set(key, getCloneObj(value, expKey, extra));
                    });
                }
                else if (me.isArray(src)) {
                    dst = new Array();
                    //把对象加入map，如果后面有新克隆对象，则用新克隆对象进行覆盖
                    src.forEach(function (item, i) {
                        dst[i] = getCloneObj(item, expKey, extra);
                    });
                }
                return dst;
            }
            /**
             * 获取clone对象
             * @param value     待clone值
             * @param expKey    排除键
             * @param extra     附加参数
             */
            function getCloneObj(value, expKey, extra) {
                if (typeof value === 'object' && !Util.isFunction(value)) {
                    let co = null;
                    if (!map.has(value)) { //clone新对象
                        co = clone(value, expKey, extra);
                    }
                    else { //从map中获取对象
                        co = map.get(value);
                    }
                    return co;
                }
                return value;
            }
        }
        /**
         * 合并多个对象并返回
         * @param   参数数组
         * @returns 返回对象
         */
        static merge(o1, o2, o3, o4, o5, o6) {
            let me = this;
            for (let i = 0; i < arguments.length; i++) {
                if (!this.isObject(arguments[i])) {
                    throw new NError('invoke', 'Util.merge', i + '', 'object');
                }
            }
            let retObj = Object.assign.apply(null, arguments);
            subObj(retObj);
            return retObj;
            //处理子对象
            function subObj(obj) {
                for (let o in obj) {
                    if (me.isObject(obj[o]) || me.isArray(obj[o])) { //对象或数组
                        retObj[o] = me.clone(retObj[o]);
                    }
                }
            }
        }
        /**
         * 把obj2对象所有属性赋值给obj1
         */
        static assign(obj1, obj2) {
            if (Object.assign) {
                Object.assign(obj1, obj2);
            }
            else {
                this.getOwnProps(obj2).forEach(function (p) {
                    obj1[p] = obj2[p];
                });
            }
            return obj1;
        }
        /**
         * 获取对象自有属性
         */
        static getOwnProps(obj) {
            if (!obj) {
                return [];
            }
            return Object.getOwnPropertyNames(obj);
        }
        /**************对象判断相关************/
        /**
         * 是否为函数
         * @param foo   检查的对象
         * @returns     true/false
         */
        static isFunction(foo) {
            return foo !== undefined && foo !== null && foo.constructor === Function;
        }
        /**
         * 是否为数组
         * @param obj   检查的对象
         * @returns     true/false
         */
        static isArray(obj) {
            return Array.isArray(obj);
        }
        /**
         * 判断是否为map
         * @param obj
         */
        static isMap(obj) {
            return obj !== null && obj !== undefined && obj.constructor === Map;
        }
        /**
         * 是否为对象
         * @param obj   检查的对象
         * @returns true/false
         */
        static isObject(obj) {
            return obj !== null && obj !== undefined && obj.constructor === Object;
        }
        /**
         * 判断是否为整数
         * @param v 检查的值
         * @returns true/false
         */
        static isInt(v) {
            return Number.isInteger(v);
        }
        /**
         * 判断是否为number
         * @param v 检查的值
         * @returns true/false
         */
        static isNumber(v) {
            return typeof v === 'number';
        }
        /**
         * 判断是否为boolean
         * @param v 检查的值
         * @returns true/false
         */
        static isBoolean(v) {
            return typeof v === 'boolean';
        }
        /**
         * 判断是否为字符串
         * @param v 检查的值
         * @returns true/false
         */
        static isString(v) {
            return typeof v === 'string';
        }
        /**
         * 是否为数字串
         * @param v 检查的值
         * @returns true/false
         */
        static isNumberString(v) {
            return /^\d+\.?\d*$/.test(v);
        }
        /**
         * 对象/字符串是否为空
         * @param obj   检查的对象
         * @returns     true/false
         */
        static isEmpty(obj) {
            if (obj === null || obj === undefined)
                return true;
            let tp = typeof obj;
            if (this.isObject(obj)) {
                let keys = Object.keys(obj);
                if (keys !== undefined) {
                    return keys.length === 0;
                }
            }
            else if (tp === 'string') {
                return obj === '';
            }
            return false;
        }
        /***********************对象相关******************/
        /**
         * 找到符合符合属性值条件的对象（深度遍历）
         * @param obj       待查询对象
         * @param props     属性值对象
         * @param one       是否满足一个条件就可以，默认false
         */
        static findObjByProps(obj, props, one) {
            if (!this.isObject(obj)) {
                throw new NError('invoke', 'this.findObjByProps', '0', 'Object');
            }
            //默认false
            one = one || false;
            let ps = this.getOwnProps(props);
            let find = false;
            if (one === false) { //所有条件都满足
                find = true;
                for (let i = 0; i < ps.length; i++) {
                    let p = ps[i];
                    if (obj[p] !== props[p]) {
                        find = false;
                        break;
                    }
                }
            }
            else { //一个条件满足
                for (let i = 0; i < ps.length; i++) {
                    let p = ps[i];
                    if (obj[p] === props[p]) {
                        find = true;
                        break;
                    }
                }
            }
            if (find) {
                return obj;
            }
            //子节点查找
            for (let p in obj) {
                let o = obj[p];
                if (o !== null) {
                    if (this.isObject(o)) { //子对象
                        //递归查找
                        let oprops = this.getOwnProps(o);
                        for (let i = 0; i < oprops.length; i++) {
                            let item = o[oprops[i]];
                            if (item !== null && this.isObject(item)) {
                                let r = this.findObjByProps(item, props, one);
                                if (r !== null) {
                                    return r;
                                }
                            }
                        }
                    }
                    else if (this.isArray(o)) { //数组对象
                        for (let i = 0; i < o.length; i++) {
                            let item = o[i];
                            if (item !== null && this.isObject(item)) {
                                let r = this.findObjByProps(item, props, one);
                                if (r !== null) {
                                    return r;
                                }
                            }
                        }
                    }
                }
            }
            return null;
        }
        /**********dom相关***********/
        /**
         * 获取dom节点
         * @param selector  选择器
         * @param findAll   是否获取所有，默认为false
         * @param pview     父html element
         * @returns         html element/null 或 nodelist或[]
         */
        static get(selector, findAll, pview) {
            pview = pview || document;
            if (findAll === true) {
                return pview.querySelectorAll(selector);
            }
            return pview.querySelector(selector);
        }
        /**
         * 是否为element
         * @param el    传入的对象
         * @returns     true/false
         */
        static isEl(el) {
            return el instanceof HTMLElement || el instanceof SVGElement;
        }
        /**
         * 是否为node
         * @param node 传入的对象
         * @returns true/false
         */
        static isNode(node) {
            return node !== undefined && node !== null && (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE);
        }
        /**
         * 新建dom
         * @param tagName   标签名
         * @param config    属性集合
         * @param text      innerText
         * @returns         新建的elelment
         */
        static newEl(tagName, config, text) {
            if (!this.isString(tagName) || this.isEmpty(tagName)) {
                throw new NError('invoke', 'this.newEl', '0', 'string');
            }
            let el = document.createElement(tagName);
            if (this.isObject(config)) {
                this.attr(el, config);
            }
            else if (this.isString(text)) {
                el.innerHTML = text;
            }
            return el;
        }
        /**
         * 新建svg element
         * @param tagName   标签名
         * @returns         svg element
         */
        static newSvgEl(tagName, config) {
            let el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
            if (this.isObject(config)) {
                this.attr(el, config);
            }
            return el;
        }
        /**
         * 把srcNode替换为nodes
         * @param srcNode       源dom
         * @param nodes         替换的dom或dom数组
         */
        static replaceNode(srcNode, nodes) {
            if (!this.isNode(srcNode)) {
                throw new NError('invoke', 'this.replaceNode', '0', 'Node');
            }
            if (!this.isNode(nodes) && !this.isArray(nodes)) {
                throw new NError('invoke1', 'this.replaceNode', '1', 'Node', 'Node Array');
            }
            let pnode = srcNode.parentNode;
            let bnode = srcNode.nextSibling;
            if (pnode === null) {
                return;
            }
            pnode.removeChild(srcNode);
            const nodeArr = this.isArray(nodes) ? nodes : [nodes];
            nodeArr.forEach(function (node) {
                if (bnode === undefined || bnode === null) {
                    pnode.appendChild(node);
                }
                else {
                    pnode.insertBefore(node, bnode);
                }
            });
        }
        /**
         * 清空子节点
         * @param el
         */
        static empty(el) {
            const me = this;
            if (!me.isEl(el)) {
                throw new NError('invoke', 'this.empty', '0', 'Element');
            }
            let nodes = el.childNodes;
            for (let i = nodes.length - 1; i >= 0; i--) {
                el.removeChild(nodes[i]);
            }
        }
        /**
         * 删除节点
         * @param node html node
         */
        static remove(node) {
            const me = this;
            if (!me.isNode(node)) {
                throw new NError('invoke', 'this.remove', '0', 'Node');
            }
            if (node.parentNode !== null) {
                node.parentNode.removeChild(node);
            }
        }
        /**
         * 获取／设置属性
         * @param el    element
         * @param param 属性名，设置多个属性时用对象
         * @param value 属性值，获取属性时不需要设置
         * @returns     属性值
         */
        static attr(el, param, value) {
            const me = this;
            if (!me.isEl(el)) {
                throw new NError('invoke', 'this.attr', '0', 'Element');
            }
            if (this.isEmpty(param)) {
                throw new NError('invoke', 'this.attr', '1', 'string', 'object');
            }
            if (value === undefined || value === null) {
                if (this.isObject(param)) { //设置多个属性
                    this.getOwnProps(param).forEach(function (k) {
                        if (k === 'value') {
                            el[k] = param[k];
                        }
                        else {
                            el.setAttribute(k, param[k]);
                        }
                    });
                }
                else if (this.isString(param)) { //获取属性
                    if (param === 'value') {
                        return param[value];
                    }
                    return el.getAttribute(param);
                }
            }
            else { //设置属性
                if (param === 'value') {
                    el[param] = value;
                }
                else {
                    el.setAttribute(param, value);
                }
            }
        }
        /******日期相关******/
        /**
         * 日期格式化
         * @param srcDate   时间戳串
         * @param format    日期格式
         * @returns          日期串
         */
        static formatDate(srcDate, format) {
            //时间戳
            let timeStamp;
            if (this.isString(srcDate)) {
                //排除日期格式串,只处理时间戳
                let reg = /^\d+$/;
                if (reg.test(srcDate) === true) {
                    timeStamp = parseInt(srcDate);
                }
            }
            else if (this.isNumber(srcDate)) {
                timeStamp = srcDate;
            }
            else {
                throw new NError('invoke', 'this.formatDate', '0', 'date string', 'date');
            }
            //得到日期
            let date = new Date(timeStamp);
            // invalid date
            if (isNaN(date.getDay())) {
                return '';
            }
            let o = {
                "M+": date.getMonth() + 1,
                "d+": date.getDate(),
                "h+": date.getHours() % 12 === 0 ? 12 : date.getHours() % 12,
                "H+": date.getHours(),
                "m+": date.getMinutes(),
                "s+": date.getSeconds(),
                "q+": Math.floor((date.getMonth() + 3) / 3),
                "S": date.getMilliseconds() //毫秒
            };
            //年
            if (/(y+)/.test(format)) {
                format = format.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
            }
            //月日
            this.getOwnProps(o).forEach(function (k) {
                if (new RegExp("(" + k + ")").test(format)) {
                    format = format.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
                }
            });
            //星期
            if (/(E+)/.test(format)) {
                format = format.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "/u661f/u671f" : "/u5468") : "") + exports.NodomMessage.WeekDays[date.getDay() + ""]);
            }
            return format;
        }
        /******字符串相关*****/
        /**
         * 编译字符串，把{n}替换成带入值
         * @param str 待编译的字符串
         * @param args1,args2,args3,... 待替换的参数
         * @returns 转换后的消息
         */
        static compileStr(src, p1, p2, p3, p4, p5) {
            let reg;
            let args = arguments;
            let index = 0;
            for (;;) {
                if (src.indexOf('\{' + index + '\}') !== -1) {
                    reg = new RegExp('\\{' + index + '\\}', 'g');
                    src = src.replace(reg, args[index + 1]);
                    index++;
                }
                else {
                    break;
                }
            }
            return src;
        }
        /**
         * 函数调用
         * @param foo   函数
         * @param obj   this指向
         * @param args  参数数组
         */
        static apply(foo, obj, args) {
            if (!foo) {
                return;
            }
            return Reflect.apply(foo, obj || null, args);
        }
        /**
         * 合并并修正路径，即路径中出现'//','///','\/'的情况，统一置换为'/'
         * @param paths 待合并路径数组
         * @returns     返回路径
         */
        static mergePath(paths) {
            return paths.join('/').replace(/(\/{2,})|\\\//g, '\/');
        }
    }
    Util.generatedId = 1;

    /**
     * 指令管理器
     */
    class DirectiveManager {
        /**
         * 创建指令类型
         * @param name 		    指令类型名
         * @param config 	    配置对象{order:优先级,init:初始化函数,handler:渲染处理函数}
         */
        static addType(name, prio, init, handle) {
            this.directiveTypes.set(name, new DirectiveType(name, prio, init, handle));
        }
        /**
         * 移除过滤器类型
         * @param name  过滤器类型名
         */
        static removeType(name) {
            this.directiveTypes.delete(name);
        }
        /**
         * 获取类型
         * @param name  指令类型名
         * @returns     指令或undefined
         */
        static getType(name) {
            return this.directiveTypes.get(name);
        }
        /**
         * 是否有某个过滤器类型
         * @param type 		过滤器类型名
         * @returns 		true/false
         */
        static hasType(name) {
            return this.directiveTypes.has(name);
        }
        /**
         * 指令初始化
         * @param directive     指令
         * @param dom           虚拟dom
         * @param parent        父虚拟dom
         */
        static init(directive, dom, parent) {
            let dt = directive.type;
            if (dt) {
                return dt.init(directive, dom, parent);
            }
        }
        /**
         * 执行指令
         * @param directive     指令
         * @param dom           虚拟dom
         * @param module        模块
         * @param parent        父dom
         * @returns             指令执行结果
         */
        static exec(directive, dom, module, parent) {
            //调用
            return Util.apply(directive.type.handle, null, [directive, dom, module, parent]);
        }
    }
    /**
     * 指令类型集合
     */
    DirectiveManager.directiveTypes = new Map();

    /**
     * filter类型命名规则：以小写字母a-z命名，其它字母不允许
     */
    class FilterManager {
        /**
         * 创建过滤器类型
         * @param name 		过滤器类型名
         * @param handler 	过滤器类型处理函数{init:foo1,handler:foo2}
         */
        static addType(name, handler) {
            if (!/^[a-zA-Z]+$/.test(name)) {
                throw new NError('namedinvalid', exports.NodomMessage.TipWords['filterType'], name);
            }
            if (this.filterTypes.has(name)) {
                throw new NError('exist1', exports.NodomMessage.TipWords['filterType'], name);
            }
            if (!Util.isFunction(handler)) {
                throw new NError('invoke', 'FilterManager.addType', '1', 'Function');
            }
            this.filterTypes.set(name, handler);
        }
        /**
         * 移除过滤器类型
         * @param name  过滤器类型名
         */
        static removeType(name) {
            if (!this.filterTypes.has(name)) {
                throw new NError('notexist1', exports.NodomMessage.TipWords['filterType'], name);
            }
            this.filterTypes.delete(name);
        }
        /**
         * 是否有某个过滤器类型
         * @param type 		过滤器类型名
         * @return 			true/false
         */
        static hasType(name) {
            return this.filterTypes.has(name);
        }
        /**
         * 执行过滤器
         * @param module 	模块
         * @param type 		类型
         * @param arguments 参数数组  0模块 1过滤器类型名 2待处理值 3-n处理参数
         * @returns 		过滤器执行结果
         */
        static exec(module, type) {
            if (typeof type === 'string') {
                let params = new Array();
                for (let i = 2; i < arguments.length; i++) {
                    params.push(arguments[i]);
                }
                if (!FilterManager.filterTypes.has(type)) {
                    throw new NError('notexist1', exports.NodomMessage.TipWords['filterType'], type);
                }
                //调用
                return Util.apply(FilterManager.filterTypes.get(type), module, params);
            }
            else {
                //多个过滤器
                return Object.keys(type).reduce((pre, v) => {
                    if (!FilterManager.filterTypes.has(v)) {
                        throw new NError('notexist1', exports.NodomMessage.TipWords['filterType'], v);
                    }
                    return Util.apply(FilterManager.filterTypes.get(v), module, [pre, ...type[v]]);
                }, arguments[2]);
            }
        }
        /**
         * 解析过滤器串为数组
         * @param src 	源字符串，格式为filtertype:param1:param2:...
         * @returns 	解析后的过滤器数组参数
         */
        static explain(src) {
            let startStr;
            let startObj = false;
            let strings = "\"'`"; //字符串开始和结束标志
            let splitCh = ':'; //分隔符
            let retArr = new Array();
            let tmp = ''; //临时串
            for (let i = 0; i < src.length; i++) {
                let ch = src[i];
                //字符串开始或结束
                if (strings.indexOf(ch) !== -1) {
                    if (ch === startStr) { //字符串结束
                        startStr = undefined;
                    }
                    else { //字符串开始
                        startStr = ch;
                    }
                }
                else if (startStr === undefined) { //非字符串开始情况检查对象
                    if (ch === '}' && startObj) { //对象结束
                        startObj = false;
                    }
                    else if (ch === '{') { //对象开始
                        startObj = true;
                    }
                }
                //分割开始
                if (ch === splitCh && startStr === undefined && !startObj && tmp !== '') {
                    retArr.push(handleObj(tmp));
                    tmp = '';
                    continue;
                }
                tmp += ch;
            }
            //最后一个
            if (tmp !== '') {
                retArr.push(handleObj(tmp));
            }
            return retArr;
            /**
             * 转化字符串为对象
             */
            function handleObj(s) {
                s = s.trim();
                if (s.charAt(0) === '{') { //转换为对象
                    // s = eval('(' + s + ')');
                    s = new Function('return ' + s)();
                }
                return s;
            }
        }
    }
    /**
     * 过滤类型
     */
    FilterManager.filterTypes = new Map();

    /**
     * 过滤器类
     */
    class Filter {
        /**
         * 构造方法
         * @param src 		源串，或explain后的数组
         */
        constructor(src) {
            if (src) {
                let arr = Util.isString(src) ? FilterManager.explain(src) : src;
                if (arr) {
                    this.type = arr[0];
                    this.params = arr.slice(1);
                }
            }
        }
        /**
         * 过滤器执行
         * @param value 	待过滤值
         * @param module 	模块
         * @returns 		过滤结果
         */
        exec(value, module) {
            let args = [module, this.type, value].concat(this.params);
            return Util.apply(FilterManager.exec, module, args);
        }
        /**
         * 克隆
         */
        clone() {
            let filter = new Filter();
            filter.type = this.type;
            if (this.params) {
                filter.params = Util.clone(this.params);
            }
            return filter;
        }
    }

    /**
     * 指令类
     */
    class Directive {
        /**
         * 构造方法
         * @param type  	类型名
         * @param value 	指令值
         * @param dom       指令对应的dom
         * @param filters   过滤器字符串或过滤器对象,如果为过滤器串，则以｜分割
         * @param notSort   不排序
         */
        constructor(type, value, dom, parent, filters, notSort) {
            this.id = Util.genId();
            this.type = DirectiveManager.getType(type);
            if (Util.isString(value)) {
                value = value.trim();
            }
            this.value = value;
            if (filters) {
                this.filters = [];
                if (typeof filters === 'string') {
                    let fa = filters.split('|');
                    for (let f of fa) {
                        this.filters.push(new Filter(f));
                    }
                }
                else if (Util.isArray(filters)) {
                    for (let f of filters) {
                        if (typeof f === 'string') {
                            this.filters.push(new Filter(f));
                        }
                        else if (f instanceof Filter) {
                            this.filters.push(f);
                        }
                    }
                }
            }
            if (type !== undefined && dom) {
                DirectiveManager.init(this, dom, parent);
                dom.addDirective(this, !notSort);
            }
        }
        /**
         * 执行指令
         * @param module    模块
         * @param dom       指令执行时dom
         * @param parent    父虚拟dom
         */
        exec(module, dom, parent) {
            return __awaiter(this, void 0, void 0, function* () {
                return DirectiveManager.exec(this, dom, module, parent);
            });
        }
        /**
         * 克隆
         * @param dst   目标dom
         * @returns     新指令
         */
        clone(dst) {
            let dir = new Directive(this.type.name, this.value);
            if (this.filters) {
                dir.filters = [];
                for (let f of this.filters) {
                    dir.filters.push(f.clone());
                }
            }
            if (this.params) {
                dir.params = Util.clone(this.params);
            }
            if (this.extra) {
                dir.extra = Util.clone(this.extra);
            }
            DirectiveManager.init(dir, dst);
            return dir;
        }
    }

    /**
     * 改变的dom类型
     * 用于比较需要修改渲染的节点属性存储
     */
    class ChangedDom {
        /**
         *
         * @param node      虚拟节点
         * @param type      修改类型  add(添加节点),del(删除节点),upd(更新节点),rep(替换节点),text(修改文本内容)
         * @param parent    父虚拟dom
         * @param index     在父节点中的位置索引
         */
        constructor(node, type, parent, index) {
            this.node = node;
            this.type = type;
            this.parent = parent;
            this.index = index;
        }
    }
    const selfClosingTag = [
        "area",
        "base",
        "basefont",
        "br",
        "col",
        "embed",
        "frame",
        "hr",
        "img",
        "input",
        "keygen",
        "link",
        "meta",
        "param",
        "source",
        "track",
    ];

    /**
     * 虚拟dom
     */
    class Element {
        /**
         * @param tag 标签名
         */
        constructor(tag) {
            /**
             * 指令集
             */
            this.directives = [];
            /**
             * 直接属性 不是来自于attribute，而是直接作用于html element，如el.checked,el.value等
             */
            this.assets = new Map();
            /**
             * 静态属性(attribute)集合
             * {prop1:value1,...}
             */
            this.props = {};
            /**
             * 含表达式的属性集合
             * {prop1:value1,...}
             */
            this.exprProps = {};
            /**
             * 事件集合,{eventName1:nodomNEvent1,...}
             * 一个事件名，可以绑定多个事件方法对象
             */
            this.events = new Map();
            /**
             * 表达式+字符串数组，用于textnode
             */
            this.expressions = [];
            /**
             * 子element
             */
            this.children = [];
            /**
             * 不渲染标志，单次渲染有效
             */
            this.dontRender = false;
            /**
             * 渲染前（获取model后）执行方法集合,可以是方法名（在module的methods中定义），也可以是函数
             * 函数的this指向element的model，参数为(element,module)
             */
            this.beforeRenderOps = [];
            /**
             * 渲染后（renderToHtml前）执行方法集合，可以是方法名（在module的methods中定义），也可以是函数
             * 函数的this指向element的model，参数为(element,module)
             */
            this.afterRenderOps = [];
            /**
             * 临时参数 map
             */
            this.tmpParamMap = new Map();
            this.tagName = tag; //标签
            //检查是否为svg
            if (tag && tag.toLowerCase() === 'svg') {
                this.setTmpParam('isSvgNode', true);
                // this.isSvgNode = true;
            }
            //key
            this.key = Util.genId() + '';
        }
        /**
         * 渲染到virtualdom树
         * @param module 	模块
         * @param parent 	父节点
         * @returns         渲染成功（dontRender=false） true,否则false
         */
        render(module, parent) {
            if (this.dontRender) {
                this.doDontRender();
                return false;
            }
            // 设置父对象
            if (parent) {
                // 设置modelId
                if (!this.model) {
                    this.model = parent.model;
                }
                this.parent = parent;
                this.parentKey = parent.key;
            }
            //设置model为模块model
            if (!this.model) {
                this.model = module.model;
            }
            //先执行model指令
            if (this.hasDirective('model')) {
                let d = this.getDirective('model');
                d.exec(module, this, this.parent);
            }
            //前置方法集合执行
            this.doRenderOp(module, 'before');
            if (this.tagName !== undefined) { //element
                if (!this.handleDirectives(module)) {
                    this.doDontRender();
                    return false;
                }
                this.handleProps(module);
            }
            else { //textContent
                this.handleTextContent(module);
            }
            //子模块渲染
            if (!this.hasDirective('module')) {
                for (let i = 0; i < this.children.length; i++) {
                    let item = this.children[i];
                    if (!item.render(module, this)) {
                        item.doDontRender();
                        this.children.splice(i--, 1);
                    }
                }
            }
            //后置方法集执行
            this.doRenderOp(module, 'after');
            return true;
        }
        /**
         * 恢复到渲染前
         */
        recover() {
            //删除parent
            delete this.parent;
            //删除model
            delete this.model;
            //删除dontRender
            delete this.dontRender;
        }
        /**
         * 渲染到html element
         * @param module 	模块
         * @param params 	配置对象{}
         *          type 		类型
         *          parent 	父虚拟dom
         */
        renderToHtml(module, params) {
            let el;
            let el1;
            let type = params.type;
            let parent = params.parent;
            //重置dontRender
            //构建el
            if (type === 'fresh' || type === 'add' || type === 'text') {
                if (parent) {
                    el = module.getNode(parent.key);
                }
                else {
                    el = module.getContainer();
                }
            }
            else if (this.tagName !== undefined) { //element节点才可以查找
                el = module.getNode(this.key);
                this.handleAssets(el);
            }
            if (!el) {
                return;
            }
            switch (type) {
                case 'fresh': //首次渲染
                    if (this.tagName) {
                        el1 = newEl(this, null, el);
                        //首次渲染需要生成子孙节点
                        genSub(el1, this);
                    }
                    else {
                        el1 = newText(this.textContent, this);
                    }
                    el.appendChild(el1);
                    break;
                case 'text': //文本更改
                    if (!parent || !parent.children) {
                        break;
                    }
                    let indexArr = [];
                    parent.children.forEach(v => [
                        indexArr.push(v.key)
                    ]);
                    let ind = indexArr.indexOf(this.key);
                    if (ind !== -1) {
                        //element或fragment
                        if (this.type === 'html') {
                            let div = document.querySelector("[key='" + this.key + "']");
                            if (div !== null) {
                                div.innerHTML = '';
                                div.appendChild(this.textContent);
                            }
                            else {
                                let div = newText(this.textContent);
                                Util.replaceNode(el.childNodes[ind], div);
                            }
                        }
                        else {
                            el.childNodes[ind].textContent = this.textContent;
                        }
                    }
                    break;
                case 'upd': //修改属性
                    //删除属性
                    if (params.removeProps) {
                        params.removeProps.forEach((p) => {
                            el.removeAttribute(p);
                        });
                    }
                    //修改属性
                    if (params.changeProps) {
                        params.changeProps.forEach((p) => {
                            el.setAttribute(p['k'], p['v']);
                        });
                    }
                    //修改直接绑定el上的属性（不是attribute）
                    if (params.changeAssets) {
                        params.changeAssets.forEach((p) => {
                            el[p['k']] = p['v'];
                        });
                    }
                    break;
                case 'rep': //替换节点
                    el1 = newEl(this, parent);
                    Util.replaceNode(el, el1);
                    break;
                case 'add': //添加
                    if (this.tagName) {
                        el1 = newEl(this, parent, el);
                        genSub(el1, this);
                    }
                    else {
                        el1 = newText(this.textContent);
                    }
                    if (params.index === el.childNodes.length) {
                        el.appendChild(el1);
                    }
                    else {
                        el.insertBefore(el1, el.childNodes[params.index]);
                    }
            }
            /**
             * 新建element节点
             * @param vdom 		虚拟dom
             * @param parent 	父虚拟dom
             * @param parentEl 	父element
             * @returns 		新的html element
             */
            function newEl(vdom, parent, parentEl) {
                //创建element
                let el;
                if (vdom.getTmpParam('isSvgNode')) { //如果为svg node，则创建svg element
                    el = Util.newSvgEl(vdom.tagName);
                }
                else {
                    el = Util.newEl(vdom.tagName);
                }
                //设置属性
                Util.getOwnProps(vdom.props).forEach((k) => {
                    if (typeof vdom.props[k] != 'function')
                        el.setAttribute(k, vdom.props[k]);
                });
                el.setAttribute('key', vdom.key);
                vdom.handleNEvents(module, el, parent, parentEl);
                vdom.handleAssets(el);
                return el;
            }
            /**
             * 新建文本节点
             */
            function newText(text, dom) {
                if (!text) {
                    text = '';
                    dom = null;
                }
                if (dom && 'html' === dom.type) { //html fragment 或 element
                    let div = Util.newEl('div');
                    div.setAttribute('key', dom.key);
                    div.appendChild(text);
                    return div;
                }
                else {
                    return document.createTextNode(text);
                }
            }
            /**
             * 生成子节点
             * @param pEl 	父节点
             * @param vNode 虚拟dom父节点
             */
            function genSub(pEl, vNode) {
                if (vNode.children && vNode.children.length > 0) {
                    vNode.children.forEach((item) => {
                        let el1;
                        if (item.tagName) {
                            el1 = newEl(item, vNode, pEl);
                            genSub(el1, item);
                        }
                        else {
                            el1 = newText(item.textContent, item);
                        }
                        pEl.appendChild(el1);
                    });
                }
            }
        }
        /**
         * 克隆
         * changeKey    是否更改key，主要用于创建时克隆，渲染时克隆不允许修改key
         */
        clone(changeKey) {
            let dst = new Element();
            //不直接拷贝的属性
            let notCopyProps = ['parent', 'directives', 'defineEl', 'children', 'model'];
            //简单属性
            Util.getOwnProps(this).forEach((p) => {
                if (notCopyProps.includes(p)) {
                    return;
                }
                if (typeof this[p] === 'object') {
                    dst[p] = Util.clone(this[p]);
                }
                else {
                    dst[p] = this[p];
                }
            });
            //表示clone后进行新建节点
            if (changeKey) {
                dst.key = Util.genId() + '';
            }
            //define element复制
            if (this.defineEl) {
                if (changeKey) {
                    dst.defineEl = this.defineEl.clone(dst);
                }
                else {
                    dst.defineEl = this.defineEl;
                }
            }
            //指令复制
            for (let d of this.directives) {
                if (changeKey) {
                    d = d.clone(dst);
                }
                dst.directives.push(d);
            }
            //孩子节点
            for (let c of this.children) {
                dst.add(c.clone(changeKey));
            }
            return dst;
        }
        /**
         * 处理指令
         * @param module    模块
         */
        handleDirectives(module) {
            for (let d of this.directives.values()) {
                //model指令已经执行，不再执行
                if (d.type.name === 'model') {
                    continue;
                }
                d.exec(module, this, this.parent);
                //指令可能改变render标志
                if (this.dontRender) {
                    return false;
                }
            }
            return true;
        }
        /**
         * 表达式处理，添加到expression计算队列
         * @param exprArr   表达式或字符串数组
         * @param module    模块
         */
        handleExpression(exprArr, module) {
            let model = this.model;
            let value = '';
            if (exprArr.length === 1 && typeof exprArr[0] !== 'string') {
                let v1 = exprArr[0].val(model);
                return v1 !== undefined ? v1 : '';
            }
            exprArr.forEach((v) => {
                if (v instanceof Expression) { //处理表达式
                    let v1 = v.val(model);
                    value += v1 !== undefined ? v1 : '';
                }
                else {
                    value += v;
                }
            });
            return value;
        }
        /**
          * 处理属性（带表达式）
          * @param module    模块
          */
        handleProps(module) {
            for (let k of Util.getOwnProps(this.exprProps)) {
                //属性值为数组，则为表达式
                if (Util.isArray(this.exprProps[k])) {
                    let pv = this.handleExpression(this.exprProps[k], module);
                    //class可叠加
                    if (k === 'class') {
                        this.addClass(pv);
                    }
                    else if (k === 'style') {
                        this.addStyle(pv);
                    }
                    else {
                        this.props[k] = pv;
                    }
                }
                else if (this.exprProps[k] instanceof Expression) { //单个表达式
                    if (k === 'class') {
                        this.addClass(this.exprProps[k].val(this.model));
                    }
                    else if (k === 'style') {
                        this.addStyle(this.exprProps[k].val(this.model));
                    }
                    else {
                        this.props[k] = this.exprProps[k].val(this.model);
                    }
                }
            }
        }
        /**
         * 处理asset，在渲染到html时执行
         * @param el    dom对应的html element
         */
        handleAssets(el) {
            if (!this.tagName || !el) {
                return;
            }
            for (let key of this.assets) {
                el[key[0]] = key[1];
            }
        }
        /**
         * 处理文本（表达式）
         * @param module    模块
         */
        handleTextContent(module) {
            if (this.expressions !== undefined && this.expressions.length > 0) {
                this.textContent = this.handleExpression(this.expressions, module) || '';
            }
        }
        /**
         * 处理事件
         * @param module    模块
         * @param el        html element
         * @param parent    父virtual dom
         * @param parentEl  父html element
         */
        handleNEvents(module, el, parent, parentEl) {
            if (this.events.size === 0) {
                return;
            }
            for (let evt of this.events.values()) {
                if (Util.isArray(evt)) {
                    for (let evo of evt) {
                        evo.bind(module, this, el, parent, parentEl);
                    }
                }
                else {
                    evt.bind(module, this, el, parent, parentEl);
                }
            }
        }
        /**
         * 移除指令
         * @param directives 	待删除的指令类型数组或指令类型
         */
        removeDirectives(directives) {
            if (typeof directives === 'string') {
                let ind;
                if ((ind = this.directives.findIndex(item => item.type.name === directives)) !== -1) {
                    this.directives.splice(ind, 1);
                }
                return;
            }
            for (let d of directives) {
                let ind;
                if ((ind = this.directives.findIndex(item => item.type.name === d)) !== -1) {
                    this.directives.splice(ind, 1);
                }
            }
        }
        /**
         * 添加指令
         * @param directive     指令对象
         * @param sort          是否排序
         */
        addDirective(directive, sort) {
            let finded = false;
            for (let i = 0; i < this.directives.length; i++) {
                //如果存在相同类型，则直接替换
                if (this.directives[i].type === directive.type) {
                    this.directives[i] = directive;
                    finded = true;
                    break;
                }
            }
            if (!finded) {
                this.directives.push(directive);
            }
            //指令按优先级排序
            if (sort) {
                if (this.directives.length > 1) {
                    this.directives.sort((a, b) => {
                        return a.type.prio - b.type.prio;
                    });
                }
            }
        }
        /**
         * 是否有某个类型的指令
         * @param directiveType 	指令类型名
         * @return true/false
         */
        hasDirective(directiveType) {
            return this.directives.findIndex(item => item.type.name === directiveType) !== -1;
        }
        /**
         * 获取某个类型的指令
         * @param directiveType 	指令类型名
         * @return directive
         */
        getDirective(directiveType) {
            return this.directives.find(item => item.type.name === directiveType);
        }
        /**
         * 添加子节点
         * @param dom 	子节点
         */
        add(dom) {
            if (Array.isArray(dom)) {
                dom.forEach(v => {
                    v.parentKey = this.key;
                    //将parent也附加上，增量渲染需要
                    v.parent = this;
                });
                this.children.push(...dom);
            }
            else {
                dom.parentKey = this.key;
                this.children.push(dom);
                dom.parent = this;
            }
        }
        /**
         * 从虚拟dom树和html dom树删除自己
         * @param module 	模块
         * @param delHtml 	是否删除html element
         */
        remove(module, delHtml) {
            // 从父树中移除
            let parent = this.getParent(module);
            if (parent) {
                parent.removeChild(this);
            }
            // 删除html dom节点
            if (delHtml && module) {
                let el = module.getNode(this.key);
                if (el !== null) {
                    Util.remove(el);
                }
            }
        }
        /**
         * 从html删除
         */
        removeFromHtml(module, textNode) {
            // if (textNode) {
            //     let parent = module.getNode(this.parentKey);
            //     if (parent !== null) {
            //         let content = Array.prototype.findIndex.call(parent.childNodes, (v) => {
            //             if (v.nodeType == 3) {
            //                 return this.textContent == v.textContent;
            //             } else {
            //                 return false;
            //             }
            //         });
            //         if(content!=-1)
            //         parent.removeChild(parent.childNodes[content]);
            //     }
            // }
            let el = module.getNode(this.key);
            if (el !== null) {
                Util.remove(el);
            }
        }
        /**
         * 移除子节点
         * @param dom   子dom
         */
        removeChild(dom) {
            let ind;
            // 移除
            if (Util.isArray(this.children) && (ind = this.children.indexOf(dom)) !== -1) {
                this.children.splice(ind, 1);
            }
        }
        /**
         * 获取parent
         * @param module 模块
         * @returns      父element
         */
        getParent(module) {
            if (!module) {
                throw new NError('invoke', 'Element.getParent', '0', 'Module');
            }
            if (this.parent) {
                return this.parent;
            }
            if (this.parentKey) {
                return module.getElement(this.parentKey);
            }
        }
        /**
         * 替换目标节点
         * @param dst 	目标节点
         */
        replace(dst) {
            if (!dst.parent) {
                return false;
            }
            let ind = dst.parent.children.indexOf(dst);
            if (ind === -1) {
                return false;
            }
            //替换
            dst.parent.children.splice(ind, 1, this);
            return true;
        }
        /**
         * 是否包含节点
         * @param dom 	包含的节点
         */
        contains(dom) {
            for (; dom !== undefined && dom !== this; dom = dom.parent)
                ;
            return dom !== undefined;
        }
        /**
         * 是否存在某个class
         * @param cls   classname
         * @return      true/false
         */
        hasClass(cls) {
            let clazz = this.props['class'];
            if (!clazz) {
                return false;
            }
            else {
                return clazz.trim().split(/\s+/).includes(cls);
            }
        }
        /**
         * 添加css class
         * @param cls class名
         */
        addClass(cls) {
            let clazz = this.props['class'];
            if (!clazz) {
                this.props['class'] = cls;
            }
            else {
                let sa = clazz.trim().split(/\s+/);
                if (!sa.includes(cls)) {
                    sa.push(cls);
                    clazz = sa.join(' ');
                    this.props['class'] = clazz;
                }
            }
        }
        /**
         * 删除css class
         * @param cls class名
         */
        removeClass(cls) {
            let clazz = this.props['class'];
            if (!clazz) {
                return;
            }
            else {
                let sa = clazz.trim().split(/\s+/);
                let index;
                if ((index = sa.indexOf(cls)) !== -1) {
                    sa.splice(index, 1);
                    clazz = sa.join(' ');
                }
            }
            this.props['class'] = clazz;
        }
        /**
             * 查询style
             * @param styStr style字符串
             */
        hasStyle(styStr) {
            let styleStr = this.props['style'];
            if (!styleStr) {
                return false;
            }
            else {
                return styleStr.trim().split(/;\s+/).includes(styStr);
            }
        }
        /**
         * 添加style
         *  @param styStr style字符串
         */
        addStyle(styStr) {
            let styleStr = this.props['style'];
            if (!styleStr) {
                this.props['style'] = styStr;
            }
            else {
                let sa = styleStr.trim().split(/;\s+/);
                if (!sa.includes(styStr)) {
                    sa.push(styStr);
                    styleStr = sa.join(';');
                    this.props['style'] = styleStr;
                }
            }
        }
        /**
         * 删除style
         * @param styStr style字符串
         */
        removeStyle(styStr) {
            let styleStr = this.props['style'];
            if (!styleStr) {
                return;
            }
            else {
                let sa = styleStr.trim().split(/;\s+/);
                let index;
                if ((index = sa.indexOf(styStr)) !== -1) {
                    sa.splice(index, 1);
                    styleStr = sa.join(';');
                }
            }
            this.props['style'] = styleStr;
        }
        /**
         * 是否拥有属性
         * @param propName  属性名
         */
        hasProp(propName) {
            return this.props.hasOwnProperty(propName) || this.exprProps.hasOwnProperty(propName);
        }
        /**
         * 获取属性值
         * @param propName  属性名
         */
        getProp(propName, isExpr) {
            if (isExpr) {
                return this.exprProps[propName];
            }
            else {
                return this.props[propName];
            }
        }
        /**
         * 设置属性值
         * @param propName  属性名
         * @param v         属性值
         * @param isExpr    是否是表达式属性 默认false
         */
        setProp(propName, v, isExpr) {
            if (isExpr) {
                this.exprProps[propName] = v;
            }
            else {
                this.props[propName] = v;
            }
        }
        /**
         * 删除属性
         * @param props     属性名或属性名数组
         */
        delProp(props) {
            if (Util.isArray(props)) {
                for (let p of props) {
                    delete this.exprProps[p];
                }
                for (let p of props) {
                    delete this.props[p];
                }
            }
            else {
                delete this.exprProps[props];
                delete this.props[props];
            }
        }
        /**
         * 设置asset
         * @param assetName     asset name
         * @param value         asset value
         */
        setAsset(assetName, value) {
            this.assets.set(assetName, value);
        }
        /**
         * 删除asset
         * @param assetName     asset name
         */
        delAsset(assetName) {
            this.assets.delete(assetName);
        }
        /**
         * 查找子孙节点
         * @param key 	element key
         * @returns		虚拟dom/undefined
         */
        query(key) {
            //defineEl
            if (typeof key === 'object' && key != null) {
                let res = true;
                for (const [attr, value] of Object.entries(key)) {
                    if (attr !== 'type' && (this.getProp(attr.toLocaleLowerCase()) || this[attr]) != value) {
                        res = false;
                        break;
                    }
                }
                if (res) {
                    return key.hasOwnProperty('type') && key['type'] !== 'element' ? this.defineEl : this;
                }
            }
            else {
                if (this.key === key)
                    return this;
            }
            for (let i = 0; i < this.children.length; i++) {
                let dom = this.children[i].query(key);
                if (dom) {
                    return dom;
                }
            }
        }
        /**
         * 比较节点
         * @param dst 	待比较节点
         * @returns	{type:类型 text/rep/add/upd,node:节点,parent:父节点,
         * 			changeProps:改变属性,[{k:prop1,v:value1},...],removeProps:删除属性,[prop1,prop2,...],changeAssets:改变的asset}
         */
        compare(dst, retArr, deleteMap, parentNode) {
            if (!dst) {
                return;
            }
            let re = new ChangedDom();
            let change = false;
            if (this.tagName === undefined) { //文本节点
                if (dst.tagName === undefined) {
                    if (this.textContent !== dst.textContent) {
                        re.type = 'text';
                        change = true;
                    }
                }
                else { //节点类型不同
                    addDelKey(this, 'rep');
                }
            }
            else { //element节点
                if (this.tagName !== dst.tagName) { //节点类型不同
                    addDelKey(this, 'rep');
                }
                else { //节点类型相同，可能属性不同
                    //检查属性，如果不同则放到changeProps
                    re.changeProps = [];
                    re.changeAssets = [];
                    //待删除属性
                    re.removeProps = [];
                    //删除或增加的属性
                    Util.getOwnProps(dst.props).forEach((k) => {
                        if (!this.hasProp(k)) {
                            re.removeProps.push(k);
                        }
                    });
                    //修改后的属性
                    Util.getOwnProps(this.props).forEach((k) => {
                        let v1 = dst.props[k];
                        if (this.props[k] !== v1) {
                            re.changeProps.push({ k: k, v: this.props[k] });
                        }
                    });
                    //修改后的asset
                    for (let kv of this.assets) {
                        let v1 = dst.assets.get(kv[0]);
                        if (kv[0] !== v1) {
                            re.changeAssets.push({ k: kv[0], v: kv[1] });
                        }
                    }
                    // props assets 改变或删除，加入渲染
                    if (re.changeProps.length > 0 || re.changeAssets.length > 0 || re.removeProps.length > 0) {
                        change = true;
                        re.type = 'upd';
                    }
                }
            }
            //改变则加入数据
            if (change) {
                re.node = this;
                if (parentNode) {
                    re.parent = parentNode;
                }
                retArr.push(re);
            }
            //子节点处理
            if (!this.children || this.children.length === 0) {
                // 旧节点的子节点全部删除
                if (dst.children && dst.children.length > 0) {
                    dst.children.forEach(item => addDelKey(item));
                }
            }
            else {
                //全部新加节点
                if (!dst.children || dst.children.length === 0) {
                    this.children.forEach(item => retArr.push(new ChangedDom(item, 'add', this)));
                }
                else { //都有子节点
                    //子节点对比策略
                    let [oldStartIdx, oldStartNode, oldEndIdx, oldEndNode] = [0, dst.children[0], dst.children.length - 1, dst.children[dst.children.length - 1]];
                    let [newStartIdx, newStartNode, newEndIdx, newEndNode] = [0, this.children[0], this.children.length - 1, this.children[this.children.length - 1]];
                    let [newMap, newKeyMap] = [new Map(), new Map()];
                    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
                        if (sameKey(oldStartNode, newStartNode)) {
                            newStartNode.compare(oldStartNode, retArr, deleteMap, this);
                            newStartNode = this.children[++newStartIdx];
                            oldStartNode = dst.children[++oldStartIdx];
                        }
                        else if (sameKey(oldEndNode, newEndNode)) {
                            newEndNode.compare(oldEndNode, retArr, deleteMap, this);
                            newEndNode = this.children[--newEndIdx];
                            oldEndNode = dst.children[--oldEndIdx];
                        }
                        else if (sameKey(newStartNode, oldEndNode)) {
                            newStartNode.compare(oldEndNode, retArr, deleteMap, this);
                            newStartNode = this.children[++newStartIdx];
                            oldEndNode = dst.children[--oldEndIdx];
                        }
                        else if (sameKey(newEndNode, oldStartNode)) {
                            newEndNode.compare(oldStartNode, retArr, deleteMap, this);
                            newEndNode = this.children[--newEndIdx];
                            oldStartNode = dst.children[++oldStartIdx];
                        }
                        else {
                            newMap.set(newStartIdx, newStartNode);
                            newKeyMap.set(newStartNode.key, newStartIdx);
                            newStartNode = this.children[++newStartIdx];
                        }
                    }
                    if (oldStartIdx <= oldEndIdx || newStartIdx <= newEndIdx) {
                        if (newStartIdx <= newEndIdx) { //新增节点
                            for (let i = newStartIdx; i <= newEndIdx; i++)
                                retArr.push(new ChangedDom(this.children[i], 'add', this, i));
                        }
                        else { //有老节点
                            for (let i = oldStartIdx; i <= oldEndIdx; i++) {
                                let oldKey = dst.children[i].key;
                                if (newKeyMap.has(oldKey)) {
                                    newMap.get(newKeyMap.get(oldKey)).compare(dst.children[i], retArr, deleteMap, this);
                                    newMap.delete(newKeyMap.get(oldKey));
                                    newKeyMap.delete(oldKey);
                                }
                                else {
                                    addDelKey(dst.children[i]);
                                }
                            }
                        }
                    }
                    if (newMap.size) {
                        newMap.forEach((v, k) => {
                            retArr.push(new ChangedDom(v, 'add', this, k));
                        });
                    }
                }
            }
            function sameKey(newElement, oldElement) {
                return newElement.key === oldElement.key;
            }
            //添加刪除替換的key
            function addDelKey(element, type) {
                let pKey = element.parentKey;
                if (!deleteMap.has(pKey)) {
                    deleteMap.set(pKey, new Array());
                }
                deleteMap.get(pKey).push(type == 'rep' ? element.parent.children.indexOf(element) + '|' + this.key : element.parent.children.indexOf(element));
            }
        }
        /**
         * 添加事件
         * @param event         事件对象
         */
        addEvent(event) {
            //如果已经存在，则改为event数组，即同名event可以多个执行方法
            if (this.events.has(event.name)) {
                let ev = this.events.get(event.name);
                let evs;
                if (Util.isArray(ev)) {
                    evs = ev;
                }
                else {
                    evs = [ev];
                }
                evs.push(event);
                this.events.set(event.name, evs);
            }
            else {
                this.events.set(event.name, event);
            }
        }
        /**
         * 执行不渲染关联操作
         * 关联操作，包括:
         *  1 节点(子节点)含有module指令，需要unactive
         */
        doDontRender() {
            if (this.hasDirective('module')) {
                let d = this.getDirective('module');
                if (d.extra && d.extra.moduleId) {
                    let mdl = ModuleFactory.get(d.extra.moduleId);
                    if (mdl) {
                        mdl.unactive();
                    }
                }
            }
            //子节点递归
            for (let c of this.children) {
                c.doDontRender();
            }
            this.recover();
        }
        /**
         * 设置临时参数
         * @param key       参数名
         * @param value     参数值
         */
        setTmpParam(key, value) {
            this.tmpParamMap.set(key, value);
        }
        /**
         * 获取临时参数
         * @param key       参数名
         * @returns         参数值
         */
        getTmpParam(key) {
            return this.tmpParamMap.get(key);
        }
        /**
         * 删除临时参数
         * @param key       参数名
         */
        removeTmpParam(key) {
            this.tmpParamMap.delete(key);
        }
        /**
         * 是否有临时参数
         * @param key       参数名
         */
        hasTmpParam(key) {
            return this.tmpParamMap.has(key);
        }
        /**
         * 添加渲染附加操作
         * @param method    方法名
         * @param type      类型 before,after
         */
        addRenderOp(method, type) {
            if (type === 'before') {
                this.beforeRenderOps.push(method);
            }
            else {
                this.afterRenderOps.push(method);
            }
        }
        /**
         * 执行渲染附加操作
         * @param module    模块
         * @param type      类型 before,after
         */
        doRenderOp(module, type) {
            // 否则执行注册在element上的前置渲染方法
            let arr = type === 'before' ? this.beforeRenderOps : this.afterRenderOps;
            for (let m of arr) {
                //可能是字符串
                if (typeof m === 'string') {
                    m = module.getMethod(m);
                }
                if (m) {
                    m.apply(this.model, [this, module]);
                }
            }
        }
        /**
         * 获取datas
         * @returns datas
         */
        getDatas() {
            return this.datas;
        }
        /**
         * 添加datas
         * @param key 属性名
         * @param data [原对象.数据名,bindingFlag]
         * @returns
         */
        addDatas(key, data) {
            if (!this.datas) {
                this.datas = new Object();
            }
            this.datas[key] = data;
        }
        /**
         * 删除datas
         * @param key 待删除的key
         * @returns
         */
        removeDatas(key) {
            if (!this.datas)
                return;
            delete this.datas[key];
        }
    }

    /**
     * 事件类
     * @remarks
     * 事件分为自有事件和代理事件
     * 自有事件绑定在view上
     * 代理事件绑定在父view上，存储于事件对象的events数组中
     * 如果所绑定对象已存在该事件名对应的事件，如果是代理事件，则添加到子事件队列，否则替换view自有事件
     * 事件执行顺序，先执行代理事件，再执行自有事件
     *
     * @author      yanglei
     * @since       1.0
     */
    class NEvent {
        /**
         * @param eventName     事件名
         * @param eventStr      事件串或事件处理函数,以“:”分割,中间不能有空格,结构为: 方法名[:delg(代理到父对象):nopopo(禁止冒泡):once(只执行一次):capture(useCapture)]
         *                      如果为函数，则替代第三个参数
         * @param handler       事件执行函数，如果方法不在module methods中定义，则可以直接申明，eventStr第一个参数失效，即eventStr可以是":delg:nopopo..."
         */
        constructor(eventName, eventStr, handler) {
            this.id = Util.genId();
            this.name = eventName;
            //如果事件串不为空，则不需要处理
            if (eventStr) {
                let tp = typeof eventStr;
                if (tp === 'string') {
                    let eStr = eventStr.trim();
                    eStr.split(':').forEach((item, i) => {
                        item = item.trim();
                        if (i === 0) { //事件方法
                            this.handler = item;
                        }
                        else { //事件附加参数
                            switch (item) {
                                case 'delg':
                                    this.delg = true;
                                    break;
                                case 'nopopo':
                                    this.nopopo = true;
                                    break;
                                case 'once':
                                    this.once = true;
                                    break;
                                case 'capture':
                                    this.capture = true;
                                    break;
                            }
                        }
                    });
                }
                else if (tp === 'function') {
                    handler = eventStr;
                }
            }
            //新增事件方法（不在methods中定义）
            if (handler) {
                this.handler = handler;
            }
            //设备类型  1:触屏，2:非触屏	
            let dtype = 'ontouchend' in document ? 1 : 2;
            //触屏事件根据设备类型进行处理
            if (dtype === 1) { //触屏设备
                switch (this.name) {
                    case 'click':
                        this.name = 'tap';
                        break;
                    case 'mousedown':
                        this.name = 'touchstart';
                        break;
                    case 'mouseup':
                        this.name = 'touchend';
                        break;
                    case 'mousemove':
                        this.name = 'touchmove';
                        break;
                }
            }
            else { //转非触屏
                switch (this.name) {
                    case 'tap':
                        this.name = 'click';
                        break;
                    case 'touchstart':
                        this.name = 'mousedown';
                        break;
                    case 'touchend':
                        this.name = 'mouseup';
                        break;
                    case 'touchmove':
                        this.name = 'mousemove';
                        break;
                }
            }
        }
        /**
         * 事件触发
         * @param e     事件
         * @param el    html element
         */
        fire(e, el) {
            const module = ModuleFactory.get(this.moduleId);
            if (!module.getContainer()) {
                return;
            }
            let dom = module.getElement(this.domKey);
            const model = dom.model;
            //如果capture为true，则先执行自有事件，再执行代理事件，否则反之
            if (this.capture) {
                handleSelf(this, e, model, module, dom, el);
                handleDelg(this, e, dom);
            }
            else {
                if (handleDelg(this, e, dom)) {
                    handleSelf(this, e, model, module, dom, el);
                }
            }
            //判断是否清除事件
            if (this.events !== undefined &&
                this.events.has(this.name) &&
                this.events.get(this.name).length === 0 &&
                this.handler === undefined) {
                if (!el) {
                    el = module.getNode(this.domKey);
                }
                if (ExternalNEvent.touches[this.name]) {
                    ExternalNEvent.unregist(this, el);
                }
                else {
                    if (el !== null) {
                        el.removeEventListener(this.name, this.handleListener);
                    }
                }
            }
            /**
             * 处理自有事件
             * @param eObj      nodom event对象
             * @param e         事件
             * @param dom       虚拟dom
             * @returns         true 允许冒泡 false 禁止冒泡
             */
            function handleDelg(eObj, e, dom) {
                //代理事件执行
                if (eObj.events === undefined) {
                    return true;
                }
                //事件target对应的key
                let eKey = e.target.getAttribute('key');
                let arr = eObj.events.get(eObj.name);
                if (Util.isArray(arr)) {
                    if (arr.length > 0) {
                        for (let i = 0; i < arr.length; i++) {
                            let sdom = dom.query(arr[i].domKey);
                            if (!sdom) {
                                continue;
                            }
                            // 找到对应的子事件执行
                            if (eKey === sdom.key || sdom.query(eKey)) {
                                //执行
                                arr[i].fire(e);
                                //执行一次，需要移除
                                if (arr[i].once) {
                                    eObj.removeChild(arr[i]);
                                }
                                //禁止冒泡
                                if (arr[i].nopopo) {
                                    return false;
                                }
                            }
                        }
                    }
                    else { //删除该事件
                        eObj.events.delete(eObj.name);
                    }
                }
                return true;
            }
            /**
             * 处理自有事件
             * @param eObj      NEvent对象
             * @param e         事件
             * @param model     模型
             * @param module    模块
             * @param dom       虚拟dom
             */
            function handleSelf(eObj, e, model, module, dom, el) {
                if (typeof eObj.handler === 'string') {
                    eObj.handler = module.getMethod(eObj.handler);
                }
                if (!eObj.handler) {
                    return;
                }
                //禁止冒泡
                if (eObj.nopopo) {
                    e.stopPropagation();
                }
                Util.apply(eObj.handler, dom.model, [dom, module, e, el]);
                //事件只执行一次，则删除handler
                if (eObj.once) {
                    delete eObj.handler;
                }
            }
        }
        /**
         * 绑定事件
         * @param module    模块
         * @param dom       虚拟dom
         * @param el        html element
         * @param parent    父dom
         * @param parentEl  对应htmlelement的父html element
         */
        bind(module, dom, el, parent, parentEl) {
            this.moduleId = module.id;
            this.domKey = dom.key;
            if (this.delg && parent) { //代理到父对象
                this.delegateTo(module, dom, el, parent, parentEl);
            }
            else {
                this.bindTo(el);
            }
        }
        /**
         * 绑定到el
         * @param el    目标html element
         */
        bindTo(el) {
            //触屏事件
            if (ExternalNEvent.touches[this.name]) {
                ExternalNEvent.regist(this, el);
            }
            else {
                this.handleListener = (e) => {
                    this.fire(e, el);
                };
                el.addEventListener(this.name, this.handleListener, this.capture);
            }
        }
        /**
         *
         * 事件代理到父对象
         * @param module    模块
         * @param vdom      虚拟dom
         * @param el        事件作用的html element
         * @param parent    父虚拟dom
         * @param parentEl  父element
         */
        delegateTo(module, vdom, el, parent, parentEl) {
            this.domKey = vdom.key;
            this.moduleId = module.id;
            //如果不存在父对象，则用body
            if (!parentEl) {
                parentEl = document.body;
            }
            //父节点如果没有这个事件，则新建，否则直接指向父节点相应事件
            if (!parent.events.has(this.name)) {
                let ev = new NEvent(this.name);
                ev.bindTo(parentEl);
                parent.events.set(this.name, ev);
            }
            //为父对象事件添加子事件
            let evt = parent.events.get(this.name);
            let ev;
            if (Util.isArray(evt) && evt.length > 0) {
                ev = evt[0];
            }
            else {
                ev = evt;
            }
            if (ev) {
                ev.addChild(this);
            }
        }
        /**
         * 添加子事件
         * @param ev    事件
         */
        addChild(ev) {
            if (!this.events) {
                this.events = new Map();
            }
            //事件类型对应的数组
            if (!this.events.has(this.name)) {
                this.events.set(this.name, new Array());
            }
            this.events.get(this.name).push(ev);
        }
        /**
         * 移除子事件
         * @param ev    子事件
         */
        removeChild(ev) {
            if (this.events === undefined || this.events[ev.name] === undefined) {
                return;
            }
            let ind = this.events[ev.name].indexOf(ev);
            if (ind !== -1) {
                this.events[ev.name].splice(ind, 1);
                if (this.events[ev.name].length === 0) {
                    this.events.delete(ev.name);
                }
            }
        }
        /**
         * 克隆
         */
        clone() {
            let evt = new NEvent(this.name);
            let arr = ['delg', 'once', 'nopopo', 'capture', 'handler'];
            arr.forEach((item) => {
                evt[item] = this[item];
            });
            return evt;
        }
        /**
         * 获取event 的domkey
         */
        getDomKey() {
            return this.domKey;
        }
        /**
         * 设置附加参数值
         * @param key       参数名
         * @param value     参数值
         */
        setExtraParam(key, value) {
            if (!this.extraParamMap) {
                this.extraParamMap = new Map();
            }
            this.extraParamMap.set(key, value);
        }
        /**
         * 获取附加参数值
         * @param key   参数名
         * @returns     参数值
         */
        getExtraParam(key) {
            return this.extraParamMap.get(key);
        }
    }
    /**
     * 扩展事件
     */
    class ExternalNEvent {
        /**
         * 注册事件
         * @param evtObj    event对象
         */
        static regist(evtObj, el) {
            //触屏事件组
            let touchEvts = ExternalNEvent.touches[evtObj.name];
            //如果绑定了，需要解绑
            if (!Util.isEmpty(evtObj.touchListeners)) {
                this.unregist(evtObj);
            }
            // el不存在
            if (!el) {
                const module = ModuleFactory.get(evtObj.moduleId);
                el = module.getNode(evtObj.getDomKey());
            }
            evtObj.touchListeners = new Map();
            if (touchEvts && el !== null) {
                // 绑定事件组
                Util.getOwnProps(touchEvts).forEach(function (ev) {
                    //先记录下事件，为之后释放
                    evtObj.touchListeners[ev] = function (e) {
                        touchEvts[ev](e, evtObj);
                    };
                    el.addEventListener(ev, evtObj.touchListeners[ev], evtObj.capture);
                });
            }
        }
        /**
         * 取消已注册事件
         * @param evtObj    event对象
         * @param el        事件绑定的html element
         */
        static unregist(evtObj, el) {
            const evt = ExternalNEvent.touches[evtObj.name];
            if (!el) {
                const module = ModuleFactory.get(evtObj.moduleId);
                el = module.getNode(evtObj.getDomKey());
            }
            if (evt) {
                // 解绑事件
                if (el !== null) {
                    Util.getOwnProps(evtObj.touchListeners).forEach(function (ev) {
                        el.removeEventListener(ev, evtObj.touchListeners[ev]);
                    });
                }
            }
        }
    }
    /**
     * 触屏事件
     */
    ExternalNEvent.touches = {};
    /**
     * 触屏事件
     */
    ExternalNEvent.touches = {
        tap: {
            touchstart: function (e, evtObj) {
                let tch = e.touches[0];
                evtObj.setExtraParam('pos', { sx: tch.pageX, sy: tch.pageY, t: Date.now() });
            },
            touchmove: function (e, evtObj) {
                let pos = evtObj.getExtraParam('pos');
                let tch = e.touches[0];
                let dx = tch.pageX - pos.sx;
                let dy = tch.pageY - pos.sy;
                //判断是否移动
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    pos.move = true;
                }
            },
            touchend: function (e, evtObj) {
                let pos = evtObj.getExtraParam('pos');
                let dt = Date.now() - pos.t;
                //点下时间不超过200ms
                if (pos.move === true || dt > 200) {
                    return;
                }
                evtObj.fire(e);
            }
        },
        swipe: {
            touchstart: function (e, evtObj) {
                let tch = e.touches[0];
                let t = Date.now();
                evtObj.setExtraParam('swipe', {
                    oldTime: [t, t],
                    speedLoc: [{ x: tch.pageX, y: tch.pageY }, { x: tch.pageX, y: tch.pageY }],
                    oldLoc: { x: tch.pageX, y: tch.pageY }
                });
            },
            touchmove: function (e, evtObj) {
                let nt = Date.now();
                let tch = e.touches[0];
                let mv = evtObj.getExtraParam('swipe');
                //50ms记录一次
                if (nt - mv.oldTime > 50) {
                    mv.speedLoc[0] = { x: mv.speedLoc[1].x, y: mv.speedLoc[1].y };
                    mv.speedLoc[1] = { x: tch.pageX, y: tch.pageY };
                    mv.oldTime[0] = mv.oldTime[1];
                    mv.oldTime[1] = nt;
                }
                mv.oldLoc = { x: tch.pageX, y: tch.pageY };
            },
            touchend: function (e, evtObj) {
                let mv = evtObj.getExtraParam('swipe');
                let nt = Date.now();
                //取值序号 0 或 1，默认1，如果释放时间与上次事件太短，则取0
                let ind = (nt - mv.oldTime[1] < 30) ? 0 : 1;
                let dx = mv.oldLoc.x - mv.speedLoc[ind].x;
                let dy = mv.oldLoc.y - mv.speedLoc[ind].y;
                let s = Math.sqrt(dx * dx + dy * dy);
                let dt = nt - mv.oldTime[ind];
                //超过300ms 不执行事件
                if (dt > 300 || s < 10) {
                    return;
                }
                let v0 = s / dt;
                //速度>0.1,触发swipe事件
                if (v0 > 0.05) {
                    let sname = '';
                    if (dx < 0 && Math.abs(dy / dx) < 1) {
                        e.v0 = v0; //添加附加参数到e
                        sname = 'swipeleft';
                    }
                    if (dx > 0 && Math.abs(dy / dx) < 1) {
                        e.v0 = v0;
                        sname = 'swiperight';
                    }
                    if (dy > 0 && Math.abs(dx / dy) < 1) {
                        e.v0 = v0;
                        sname = 'swipedown';
                    }
                    if (dy < 0 && Math.abs(dx / dy) < 1) {
                        e.v0 = v0;
                        sname = 'swipeup';
                    }
                    if (evtObj.name === sname) {
                        evtObj.fire(e);
                    }
                }
            }
        }
    };
    //swipe事件
    ExternalNEvent.touches['swipeleft'] = ExternalNEvent.touches['swipe'];
    ExternalNEvent.touches['swiperight'] = ExternalNEvent.touches['swipe'];
    ExternalNEvent.touches['swipeup'] = ExternalNEvent.touches['swipe'];
    ExternalNEvent.touches['swipedown'] = ExternalNEvent.touches['swipe'];

    class Compiler {
        /**
        * 编译
        * @param elementStr    待编译html串
        * @returns             虚拟dom
        */
        static compile(elementStr) {
            // 这里是把模板串通过正则表达式匹配 生成AST
            let ast = this.compileTemplateToAst(elementStr);
            let oe = new Element('div');
            // 将AST编译成抽象语法树
            this.compileAST(oe, ast);
            return oe;
        }
        /**
         * 把AST编译成虚拟dom
         * @param oe 虚拟dom的根容器
         * @param ast 抽象语法树也就是JSON对象
         * @returns oe 虚拟dom的根容器
         */
        static compileAST(oe, ast) {
            if (!ast)
                return;
            for (const a of ast) {
                switch (a.tagName) {
                    case 'text': //文本节点
                        this.handleAstText(oe, a);
                        break;
                    case 'comment': // 注释不处理
                        break;
                    default:
                        if (a.tagName !== 'svg') {
                            // let chlid = new Element(a.tagName);
                            this.handleAstNode(oe, a);
                        }
                        break;
                }
            }
            return oe;
        }
        /**
         * 编译text类型的ast到虚拟dom
         * @param parent 父虚拟dom节点
         * @param ast 虚拟dom树
         */
        static handleAstText(parent, astObj) {
            let text = new Element();
            parent.children.push(text);
            // 处理属性
            this.handleAstAttrs(text, astObj.attrs, parent);
            // text 类型的节点不需要处理子节点。
            text.expressions = astObj.expressions;
            text.textContent = astObj.textContent;
        }
        /**
         *
         * @param oe 虚拟dom
         * @param astObj
         */
        static handleAstNode(parent, astObj) {
            // let de = PluginManager.get(astObj.tagName.toUpperCase());
            let de = DefineElementManager.get(astObj.tagName.toUpperCase());
            let child = new Element(astObj.tagName);
            parent.add(child);
            this.handleAstAttrs(child, astObj.attrs, parent);
            this.compileAST(child, astObj.children);
            if (de) {
                de.init(child, parent);
            }
        }
        /**
         * 编译ast 到虚拟dom
         * @param oe        虚拟dom
         * @param attrs     需要编译成虚拟dom的attrs
         * @param parent    父虚拟dom节点
         */
        static handleAstAttrs(oe, attrs, parent) {
            //指令数组 先处理普通属性在处理指令
            let directives = [];
            if (!attrs) {
                return;
            }
            for (const attr of attrs) {
                // 统一吧属性名转换成小写
                attr.propName = attr.propName.toLocaleLowerCase();
                if (attr.propName.startsWith("x-")) {
                    //指令
                    directives.push(attr);
                }
                else if (attr.propName.startsWith("e-")) {
                    // 事件
                    let e = attr.propName.substr(2);
                    oe.addEvent(new NEvent(e, attr.value.trim()));
                }
                else if (attr.propName.startsWith("d-")) {
                    // 数据
                    let tempArr = attr.propName.split(':');
                    let bindFlag = false;
                    if (tempArr.length == 2) {
                        bindFlag = tempArr[1] == 'true' ? true : false;
                    }
                    let name = tempArr[0].split('-')[1];
                    if (/\{\{.+?\}\}/.test(attr.value) === false) {
                        throw new NError('数据必须是由双大括号包裹');
                    }
                    let value = attr.value.substring(2, attr.value.length - 2);
                    // 变量别名，变量名（原对象.变量名)，双向绑定标志
                    let data = [value, bindFlag];
                    oe.addDatas(name, data);
                }
                else {
                    // 普通属性 如class 等
                    let isExpr = false;
                    let v = attr.value.trim();
                    if (v !== '') {
                        let ra = this.compileExpression(v);
                        if (Util.isArray(ra)) {
                            oe.setProp(attr.propName, ra, true);
                            isExpr = true;
                        }
                    }
                    if (!isExpr) {
                        oe.setProp(attr.propName, v);
                    }
                }
            }
            //处理属性
            for (let attr of directives) {
                new Directive(attr.propName.substr(2), attr.value.trim(), oe, parent, null, true);
            }
            if (directives.length > 1) {
                //指令排序
                oe.directives.sort((a, b) => {
                    return a.type.prio - b.type.prio;
                });
            }
        }
        /**
         * 处理属性字符串
         * @param attrString 属性字符串
         * @returns attrs数组
         */
        static parseAttrString(attrString) {
            if (attrString == undefined || attrString.length === 0)
                return [];
            attrString = attrString.trim();
            // 引号栈处理引号嵌套
            let yinghaoStack = [];
            //引号flag 当前是否在引号内
            let yinhaoFlag = false;
            // 断点
            let point = 0;
            let result = [];
            for (let i = 0; i < attrString.length; i++) {
                let s = attrString[i];
                if (/[\"\']/.test(s)) {
                    // 遇到引号
                    if (yinghaoStack.length != 0) {
                        // 引号栈不空
                        if (s === yinghaoStack[yinghaoStack.length - 1]) {
                            // 判断是不是匹配栈顶
                            yinghaoStack.pop();
                            if (yinghaoStack.length == 0)
                                yinhaoFlag = false;
                        }
                        else {
                            // 不匹配栈顶直接入栈
                            yinghaoStack.push(s);
                        }
                    }
                    else {
                        // 引号栈空 入栈
                        yinghaoStack.push(s);
                        yinhaoFlag = true;
                    }
                    // yinhaoFlag = !yinhaoFlag;
                }
                else if (/\s/.test(s) && !yinhaoFlag) {
                    //遇到空格并且不在引号中
                    if (!/^\s*?$/.test(attrString.substring(point, i))) {
                        result.push(attrString.substring(point, i).trim());
                        point = i;
                    }
                }
            }
            let lastAttr = attrString.substring(point).trim();
            // 判断最后一个属性是不是自定义标签的'/' 如果是则不把他当作标签。
            if (lastAttr !== '/') {
                //循环结束之后还剩一个属性没加进去，因为可能最后一个属性后面没有空格
                result.push(attrString.substring(point).trim());
            }
            result = result.map((item) => {
                // 如果match为空说明属性串里面没有“”也就是自定义的只有属性名没有属性值得属性，这种直接给他的value字段设置为空就行了
                const o = item.match(/^(.+)=[\'|\"]([\s\S]*)[\'|\"]$/) || [, item];
                const e = item.match(/^(.+)=(\{\{[\s\S]*\}\})$/);
                if (e) {
                    return {
                        propName: e[1],
                        value: e[2] ? e[2] : '',
                    };
                }
                else {
                    return {
                        propName: o[1],
                        value: o[2] ? o[2] : '',
                    };
                }
            });
            return result;
        }
        /**
         * 将模板字符串转换成AST抽象语法树结构
         * @param elementStr 模板字符串
         * @returns AST对象数组
         */
        static compileTemplateToAst(elementStr) {
            let templateStr = elementStr.trim();
            // 准备栈空间
            let stack1 = [];
            let stack2 = [{ tagName: undefined, children: [], attrs: [] }];
            let index = 0;
            // 开始标签的正则表达式 
            let startRegExp = /^\<(\s*)([a-z\-]*[0-9]?)((?:"(?:[^"]*)"+|'(?:[^']*)'+|(?:[^<>"'/]*)+)*)*(\s*\/)?(\s*)\>/;
            // /^\<(\s*)([a-z\-]*[0-9]?)((?:\s+\w+\-?\w+(?:\=[\"\']?[\s\S]*?[\"\']?)?)*)*(\s*\/)?(\s*)\>/
            // 匹配结束标签的正则表达式
            let endRegExp = /^\<(\s*)\/(\s*)([a-z\-]*[0-9]?)(\s*)\>/;
            // /^\<(\s*)\/(\s*)([a-z]+[1-6]?|ui\-[a-z]+[1-6]?)(\s*)\>/;
            // 匹配开始标签和结束标签之间的文字的正则表达式 
            let wordRegExp = /^([\s\S]+?)(?=\<(?:!--)?(?:\s*\/?\s*(?:[a-z\-]*[0-9]?)(?:(?:\s+\w+\-?\w+\=?[\"\']?[\s\S]*?[\"\']?)*)*|(?:[\s\S]+?))(?:--)?\>)/;
            // /^([\s\S]+?)(?=\<(!--)?(?:(\s*)\/?(\s*)(?:[a-z]+[1-6]?|ui\-[a-z]+[1-6]?)(?:(?:\s+.+?[\"\'](?:[\s\S]*?)[\"\']|.*))?(\s*)|(?:[\s\S]+?))(--)?\>)/
            // 匹配裸字符串，全字符匹配配合wordRegExp标签判断是不是裸字符串
            let onlyWordRegExp = /^([\s\S]+)/;
            // 匹配注释
            let commentRegExp = /^\s*\<!--[\s\S]+?--\>/;
            // pre结束标签。
            let preEndTagRegExp = /^([\s\S]+)(?=\<(\s*)\/(\s*)pre(?:\s.+?)?(\s*)\>)/;
            // pre标签标志，遇到pre标签要把标签里面的内容当成文本节点。
            let preFlag = false;
            // 匹配到字符串末尾
            while (index < templateStr.length - 1) {
                let rest = templateStr.substring(index);
                if (preFlag) {
                    // 现在进入到pre标签里面了 直接搜索</pre>结束标签
                    let text = rest.match(preEndTagRegExp) ? rest.match(preEndTagRegExp)[1] : null;
                    if (text) {
                        stack2[stack2.length - 1].children.push({ textContent: text, tagName: 'text' });
                        index += text.length;
                        preFlag = false;
                    }
                    else {
                        throw new Error("pre标签未闭合");
                    }
                }
                else if (startRegExp.test(rest)) {
                    // 识别遍历到的字符是不是一个开始标签
                    // beforeSpaceString:左尖括号与标签名之间的空格
                    // tagName:标签名  
                    // attrString:标签里的属性字符串 
                    // selfCloseStr: 自闭合标签的反斜杠
                    // afterSpaceString:属性与右尖括号之间的空格
                    let [, beforeSpaceString, tagName, attrString, selfCloseStr, afterSpaceString] = rest.match(startRegExp);
                    const beforeSpaceLenght = beforeSpaceString ? beforeSpaceString.length : 0;
                    const tagNameLenght = tagName ? tagName.length : 0;
                    const atttLenght = attrString ? attrString.length : 0;
                    const selfCloseLenght = selfCloseStr ? selfCloseStr.length : 0;
                    const afterSpaceLenght = afterSpaceString ? afterSpaceString.length : 0;
                    if (tagName === 'pre') {
                        // pre标签
                        preFlag = true;
                    }
                    if (selfClosingTag.indexOf(tagName) !== -1) {
                        // 这个标签是自闭合标签
                        stack2[stack2.length - 1].children.push({
                            tagName,
                            children: [],
                            attrs: this.parseAttrString(attrString)
                        });
                    }
                    else {
                        // 这个标签是普通的标签
                        // 开始标签入栈
                        stack1.push(tagName);
                        // AST入栈
                        stack2.push({
                            tagName,
                            children: [],
                            attrs: this.parseAttrString(attrString)
                        });
                        // 需要跳过的长度 = 2个尖括号 + 左尖括号与标签名之间的空格长度 + 标签名长度 + 属性长度 + 属性与右尖括号之间的空格长度
                    }
                    index += 2 + beforeSpaceLenght + tagNameLenght + atttLenght + selfCloseLenght + afterSpaceLenght;
                }
                else if (endRegExp.test(rest)) {
                    // 识别结束标记
                    // let tagName = rest.match(endRegExp)[1];
                    // beforeSpaceString: / 之前的空格
                    // afterSpaceString: / 之后的空格
                    // tagName: 标签名字
                    // endSpaceString: 标签之后的空格
                    let [, beforeSpaceString, afterSpaceString, tagName, endSpaceString] = rest.match(endRegExp);
                    const beforeSpaceLenght = beforeSpaceString ? beforeSpaceString.length : 0;
                    const afterSpaceLenght = afterSpaceString ? afterSpaceString.length : 0;
                    const tagNameLenght = tagName ? tagName.length : 0;
                    const endSpaceLenght = endSpaceString ? endSpaceString.length : 0;
                    // 这时候tag一定和栈顶是相同的，因为html需要闭合，如果不相同哪么说明有标签没闭合
                    if (tagName != stack1[stack1.length - 1]) {
                        throw new Error(stack1[stack1.length - 1] + "标签没有封闭");
                    }
                    else {
                        stack1.pop();
                        let pop_arr = stack2.pop();
                        if (stack2.length > 0) {
                            stack2[stack2.length - 1].children.push(pop_arr);
                        }
                    }
                    index += beforeSpaceLenght + afterSpaceLenght + tagNameLenght + endSpaceLenght + 3;
                }
                else if (commentRegExp.test(rest)) {
                    // 识别注释
                    index += rest.match(commentRegExp)[0].length;
                }
                //wordRegExp.test(rest)   rest.match(wordRegExp) || rest.match(onlyWordRegExp)
                else if (rest.match(wordRegExp) || rest.match(onlyWordRegExp)) {
                    //识别为文本节点 
                    // wordRegExp 匹配标签前面的字符，如果字符后面没有标签，匹配结果是null
                    //当wordRegExp匹配结果是null的时候说明再节点之后有一个裸文本标签（由onlyWordRegExp匹配）
                    //再处理之前我们要判断一下当前栈1是否为空，防止有标签没闭合的情况。
                    if (!rest.match(wordRegExp) && rest.match(onlyWordRegExp)) {
                        //这里要处理一下可能标签没闭合 如:<div>123
                        if (stack1.length !== 0) {
                            throw new Error(stack1[stack1.length - 1] + '标签没闭合');
                        }
                    }
                    // 这里要把裸字符串的情况与后面有标签的字符串（标签之间的字符串）分开处理
                    let word = rest.match(wordRegExp) ? rest.match(wordRegExp)[1] : rest.match(onlyWordRegExp)[1];
                    // 看word是不是全是空
                    if (!/^\s+$/.test(word)) {
                        // 不全是空
                        // 改变栈顶元素
                        // 编译一下看是否有双大括号表达式
                        let expr = this.compileExpression(word);
                        if (typeof expr === 'string') {
                            // 返回的是字符串说明没有双大括号表达式，把属性放进textContent
                            stack2[stack2.length - 1].children.push({ textContent: expr, tagName: 'text' });
                        }
                        else {
                            // 返回的是数组说明是有双大括号表达式的，编译了之后放进expressions属性
                            stack2[stack2.length - 1].children.push({ expressions: expr, tagName: 'text' });
                        }
                    }
                    index += word.length;
                }
                else {
                    // 这里处理一下只有纯文本的形式
                    index++;
                }
            }
            return stack2[0].children;
        }
        /**
         * 处理表达式串
         * @param exprStr   含表达式的串
         * @return          处理后的字符串和表达式数组
         */
        static compileExpression(exprStr) {
            if (/\{\{.+?\}\}/.test(exprStr) === false) {
                return exprStr;
            }
            let reg = /\{\{.+?\}?\s*\}\}/g;
            let retA = new Array();
            let re;
            let oIndex = 0;
            while ((re = reg.exec(exprStr)) !== null) {
                let ind = re.index;
                //字符串
                if (ind > oIndex) {
                    let s = exprStr.substring(oIndex, ind);
                    retA.push(s);
                }
                //实例化表达式对象
                let exp = new Expression(re[0].substring(2, re[0].length - 2));
                //加入工厂
                retA.push(exp);
                oIndex = ind + re[0].length;
            }
            //最后的字符串
            if (oIndex < exprStr.length - 1) {
                retA.push(exprStr.substr(oIndex));
            }
            return retA;
        }
    }

    /**
     * 插件，插件为自定义元素方式实现
     */
    class DefineElement {
        constructor(params) {
            if (params instanceof Element) {
                this.element = params;
            }
        }
        /**
         * 初始化 子类必须实现init方法
         * @param dom       dom插件所属节点
         * @param parent    父节点
         */
        init(dom, parent) { }
        /**
         * 前置渲染方法(dom render方法中获取modelId和parentKey后执行)
         * @param uidom     虚拟dom
         * @param  module    模块
         */
        beforeRender(uidom, module) {
            let me = uidom.defineEl;
            me.element = uidom;
            me.moduleId = module.id;
            // 如果需要改绑model，则改绑model
            if (me.parentDataName && me.parentDataName != '') {
                uidom.model = uidom.model[me.parentDataName];
            }
            if (!me.model || uidom.key !== me.key) {
                me.key = uidom.key;
                // 插件默认把model绑定在根model上
                me.model = uidom.model;
                //添加到模块
                if (uidom.hasProp('name')) {
                    // module.addNPlugin(uidom.getProp('name'),this);       
                    me.name = uidom.getProp('name');
                }
                me.needPreRender = true;
            }
            else {
                me.needPreRender = false;
            }
        }
        /**
         * 后置渲染方法(dom render结束后，渲染到html之前)
         * @param module    模块
         * @param uidom     虚拟dom
         */
        // public afterRender(uidom: Element, module: Module) { }
        /**
         * 克隆
         */
        clone(dst) {
            // return Reflect.construct(this.constructor, [dst]);
            let plugin = Reflect.construct(this.constructor, []);
            // // 不拷贝属性
            let excludeProps = ['key', 'element', 'modelId', 'moduleId'];
            Util.getOwnProps(this).forEach((prop) => {
                if (excludeProps.includes(prop)) {
                    return;
                }
                plugin[prop] = Util.clone(this[prop]);
            });
            if (dst) {
                plugin.element = dst;
            }
            return plugin;
        }
        /**
         * 获取model
         */
        getModel() {
            let module = ModuleFactory.get(this.moduleId);
            if (!module) {
                return null;
            }
            return this.model || null;
        }
    }

    /**
     * module 元素
     */
    DefineElementManager.add('NMODULE', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //类名
            let clazz = element.getProp('classname');
            if (!clazz) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NMODULE', 'classname');
            }
            //模块名
            let moduleName = element.getProp('name');
            if (moduleName) {
                clazz += '|' + moduleName;
            }
            new Directive('module', clazz, element, parent);
        }
    });
    /**
     * for 元素
     */
    DefineElementManager.add('NFOR', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NFOR', 'condition');
            }
            new Directive('repeat', cond, element, parent);
        }
    });
    /**
     * recur 元素
     */
    DefineElementManager.add('NRECUR', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NRECUR', 'condition');
            }
            new Directive('recur', cond, element, parent);
        }
    });
    /**
     * if 元素
     */
    DefineElementManager.add('NIF', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NIF', 'condition');
            }
            new Directive('if', cond, element, parent);
        }
    });
    /**
     * else 元素
     */
    DefineElementManager.add('NELSE', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            new Directive('else', null, element, parent);
        }
    });
    /**
     * elseif 元素
     */
    DefineElementManager.add('NELSEIF', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NELSEIF', 'condition');
            }
            new Directive('elseif', cond, element, parent);
        }
    });
    /**
     * endif 元素
     */
    DefineElementManager.add('NENDIF', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            new Directive('endif', null, element, parent);
        }
    });
    /**
     * switch 元素
     */
    DefineElementManager.add('NSWITCH', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NSWITCH', 'condition');
            }
            new Directive('switch', cond, element, parent);
        }
    });
    /**
     * case 元素
     */
    DefineElementManager.add('NCASE', {
        init: function (element, parent) {
            //tagname 默认div
            if (element.hasProp('tag')) {
                element.tagName = element.getProp('tag');
                element.delProp('tag');
            }
            else {
                element.tagName = 'div';
            }
            //条件
            let cond = element.getProp('condition');
            if (!cond) {
                throw new NError('itemnotempty', exports.NodomMessage.TipWords['element'], 'NCASE', 'condition');
            }
            new Directive('case', cond, element, parent);
        }
    });
    DefineElementManager.add('SLOT', {
        init: function (element, parent) {
            element.tagName = 'div';
            if (element.hasProp('name'))
                element.setTmpParam('slotName', element.getProp('name'));
        }
    });

    ((function () {
        /**
         *  指令类型初始化
         *  每个指令类型都有一个init和handle方法，init和handle都可选
         *  init 方法在编译时执行，包含两个参数 directive(指令)、dom(虚拟dom)，无返回
         *  handle方法在渲染时执行，包含四个参数 directive(指令)、dom(虚拟dom)、module(模块)、parent(父虚拟dom)
         */
        /**
         * module 指令
         * 用于指定该元素为模块容器，表示该模块的子模块
         * 用法
         *   x-module='moduleclass|modulename|dataurl'
         *   moduleclass 为模块类名
         *   modulename  为模块对象名，可选
         * 可增加 data 属性，用于指定数据url
         * 可增加 name 属性，用于设置模块name，如果x-module已设置，则无效
         */
        DirectiveManager.addType('module', 0, (directive, dom) => {
            let value = directive.value;
            let valueArr = value.split('|');
            directive.value = valueArr[0];
            //设置dom role
            dom.setProp('role', 'module');
            //设置module name
            if (valueArr.length > 1) {
                dom.setProp('modulename', valueArr[1]);
            }
            directive.extra = {};
        }, (directive, dom, module, parent) => __awaiter(this, void 0, void 0, function* () {
            const ext = directive.extra;
            let needNew = ext.moduleId === undefined;
            let subMdl;
            //没有moduleId或与容器key不一致，需要初始化模块
            if (ext && ext.moduleId) {
                subMdl = ModuleFactory.get(ext.moduleId);
                needNew = subMdl.getContainerKey() !== dom.key;
            }
            if (needNew) {
                let m = yield ModuleFactory.getInstance(directive.value, dom.getProp('modulename'), dom.getProp('data'));
                if (m) {
                    //保存绑定moduleid
                    m.setContainerKey(dom.key);
                    //修改virtualdom的module指令附加参数moduleId
                    let dom1 = module.getElement(dom.key, true);
                    if (dom1) {
                        let dir = dom1.getDirective('module');
                        dir.extra.moduleId = m.id;
                    }
                    module.addChild(m.id);
                    //传props值
                    m.props = Util.clone(dom.props);
                    //处理dates
                    if (module.subscribes === undefined) {
                        module.subscribes = new LocalStore();
                    }
                    //传入父模块，当前模块，当前dom
                    Util.handlesDatas(module, m, dom);
                    //插槽
                    if (dom.children.length > 0) {
                        let slotMap = new Map();
                        dom.children.forEach((v) => {
                            if (v.hasProp('slotName')) {
                                slotMap.set(v.getProp('slotName'), v.clone(true));
                            }
                        });
                        //有指令
                        if (slotMap.size > 0) {
                            let oldMap = findSlot(m.virtualDom);
                            //原模块
                            oldMap.forEach(obj => {
                                const { index, slotName, pd } = obj;
                                if (slotMap.has(slotName)) {
                                    pd.children.splice(index, 1, slotMap.get(slotName));
                                }
                            });
                        }
                    }
                    yield m.active();
                }
            }
            else if (subMdl && subMdl.state !== 3) {
                yield subMdl.active();
            }
            //插槽
            function findSlot(dom, res = new Array()) {
                if (dom.hasTmpParam('slotName')) {
                    res.push({
                        index: dom.parent.children.indexOf(dom),
                        slotName: dom.getTmpParam('slotName'),
                        pd: dom.parent
                    });
                    return;
                }
                dom.children.forEach(v => {
                    findSlot(v, res);
                });
                return res;
            }
        }));
        /**
         *  model指令
         */
        DirectiveManager.addType('model', 1, (directive, dom) => {
            let value = directive.value;
            //处理以.分割的字段，没有就是一个
            if (Util.isString(value)) {
                // //从根数据获取
                // if(value.startsWith('$$')){
                //     directive.extra = 1;
                //     value = value.substr(2);
                // }
                directive.value = value;
            }
        }, (directive, dom, module, parent) => {
            let model = dom.model;
            if (directive.value == '$$') {
                model = module.model;
            }
            else {
                model = model.$query(directive.value);
            }
            if (!model) {
                model = module.model.$query(directive.value);
            }
            if (model) {
                dom.model = model;
            }
        });
        /**
         * 指令名 repeat
         * 描述：重复指令
         */
        DirectiveManager.addType('repeat', 2, (directive, dom) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-repeat");
            }
            let modelName;
            let fa = value.split('|');
            modelName = fa[0];
            //有过滤器
            if (fa.length > 1) {
                directive.filters = [];
                for (let i = 1; i < fa.length; i++) {
                    directive.filters.push(new Filter(fa[i]));
                }
            }
            // //模块全局数据
            // if(modelName.startsWith('$$')){
            //     modelName = modelName.substr(2);
            // }
            directive.value = modelName;
        }, (directive, dom, module, parent) => {
            let model = dom.model;
            //可能数据不存在，先设置dontrender
            dom.dontRender = true;
            if (!model) {
                return;
            }
            //得到rows数组的model
            let rows = model.$query(directive.value);
            // 无数据，不渲染
            if (!Util.isArray(rows) || rows.length === 0) {
                return;
            }
            dom.dontRender = false;
            //有过滤器，处理数据集合
            if (directive.filters && directive.filters.length > 0) {
                for (let f of directive.filters) {
                    rows = f.exec(rows, module);
                }
            }
            let chds = [];
            let key = dom.key;
            // 移除指令
            dom.removeDirectives(['repeat']);
            for (let i = 0; i < rows.length; i++) {
                let node = dom.clone();
                //设置modelId
                node.model = rows[i];
                //设置key
                if (rows[i].$key) {
                    setKey(node, key, rows[i].$key);
                }
                else {
                    setKey(node, key, Util.genId());
                }
                rows[i].$index = i;
                chds.push(node);
            }
            //找到并追加到dom后
            if (chds.length > 0) {
                for (let i = 0, len = parent.children.length; i < len; i++) {
                    if (parent.children[i] === dom) {
                        chds = [i + 1, 0].concat(chds);
                        Array.prototype.splice.apply(parent.children, chds);
                        break;
                    }
                }
            }
            // 不渲染该节点
            dom.dontRender = true;
            function setKey(node, key, id) {
                node.key = key + '_' + id;
                node.children.forEach((dom) => {
                    setKey(dom, dom.key, id);
                });
            }
        });
        /**
         * 递归指令
         * 作用：在dom内部递归，即根据数据层复制节点作为前一层的子节点
         * 数据格式：
         * data:{
         *     recurItem:{
        *          title:'第一层',
        *          recurItem:{
        *              title:'第二层',
        *              recurItem:{...}
        *          }
        *      }
         * }
         * 模版格式：
         * <div x-recursion='items'><span>{{title}}</span></div>
         */
        DirectiveManager.addType('recur', 3, (directive, dom, parent) => {
        }, (directive, dom, module, parent) => {
            let model = dom.model;
            if (!model) {
                return;
            }
            let data = model[directive.value];
            // 渲染时，去掉model指令，避免被递归节点使用
            dom.removeDirectives('model');
            //处理内部递归节点
            if (data) {
                if (Array.isArray(data)) { //为数组，则遍历生成多个节点
                    // 先克隆一个用作基本节点，避免在循环中为基本节点增加子节点
                    let node = dom.clone(true);
                    for (let d of data) {
                        let nod = node.clone(true);
                        nod.model = d;
                        //作为当前节点子节点
                        dom.add(nod);
                    }
                }
                else {
                    let node = dom.clone(true);
                    node.model = data;
                    //作为当前节点子节点
                    dom.add(node);
                }
            }
        });
        /**
         * 指令名 if
         * 描述：条件指令
         */
        DirectiveManager.addType('if', 10, (directive, dom, parent) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-if");
            }
            //value为一个表达式
            let expr = new Expression(value);
            directive.value = expr;
            //设置if组
            directive.extra = {
                groups: [dom]
            };
            if (!parent) {
                return;
            }
            parent.setTmpParam('ifnode', dom);
        }, (directive, dom, module, parent) => {
            dom.dontRender = true;
            let target = -1;
            for (let i = 0; i < directive.extra.groups.length; i++) {
                let node = directive.extra.groups[i];
                let dir = node.getDirective('if') || node.getDirective('elseif') || node.getDirective('else');
                if (dir.value) { //if elseif指令
                    let v = dir.value.val(dom.model, dom);
                    if (v && v !== 'false') {
                        target = i;
                        break;
                    }
                }
            }
            let tNode;
            if (target === 0) { //if 节点
                dom.dontRender = false;
            }
            else if (target > 0) { //elseif 节点
                tNode = directive.extra.groups[target];
            }
            else if (directive.extra.groups.length > 1) { //else 节点
                tNode = directive.extra.groups[directive.extra.groups.length - 1];
            }
            if (tNode) {
                //添加到指定位置
                let index = parent.children.indexOf(dom);
                if (index !== -1) {
                    parent.children.splice(index + 1, 0, tNode);
                }
            }
        });
        /**
         * 指令名 else
         * 描述：else指令
         */
        DirectiveManager.addType('else', 10, (directive, dom, parent) => {
            if (!parent) {
                return;
            }
            let ifNode = parent.getTmpParam('ifnode');
            if (ifNode) {
                let dir = ifNode.getDirective('if');
                dir.extra.groups.push(dom);
                parent.removeChild(dom);
            }
        }, (directive, dom, module, parent) => {
            return;
        });
        /**
         * elseif 指令
         */
        DirectiveManager.addType('elseif', 10, (directive, dom, parent) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-elseif");
            }
            //value为一个表达式
            let expr = new Expression(value);
            directive.value = expr;
            if (!parent) {
                return;
            }
            let ifNode = parent.getTmpParam('ifnode');
            if (ifNode) {
                let dir = ifNode.getDirective('if');
                dir.extra.groups.push(dom);
                parent.removeChild(dom);
            }
        }, (directive, dom, module, parent) => {
        });
        /**
         * endif 指令
         */
        DirectiveManager.addType('endif', 10, (directive, dom, parent) => {
            if (!parent) {
                return;
            }
            let ifNode = parent.getTmpParam('ifnode');
            if (ifNode) {
                parent.removeChild(dom);
                //移除ifnode临时参数
                parent.removeTmpParam('ifnode');
            }
        }, (directive, dom, module, parent) => {
        });
        /**
         * switch指令
         */
        DirectiveManager.addType('switch', 10, (directive, dom) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-switch");
            }
        }, (directive, dom, module, parent) => {
            let hasTrue = false;
            for (let node of dom.children) {
                node.dontRender = true;
                let dir = node.getDirective('case');
                //已经出现为true的node，不用再计算条件值
                if (hasTrue) {
                    node.dontRender = true;
                    continue;
                }
                let v = dir.value.val(dom.model, dom);
                hasTrue = v && v !== 'false';
                node.dontRender = !hasTrue;
            }
        });
        /**
         *  case 指令
         */
        DirectiveManager.addType('case', 10, (directive, dom, parent) => {
            if (!directive.value) {
                throw new NError("paramException", "x-case");
            }
            if (!parent) {
                return;
            }
            let dir = parent.getDirective('switch');
            //组合 switch 变量=case值
            let value = dir.value + ' == "' + directive.value + '"';
            let expr = new Expression(value);
            directive.value = expr;
        }, (directive, dom, module, parent) => {
            return;
        });
        /**
         * 指令名 show
         * 描述：显示指令
         */
        DirectiveManager.addType('show', 10, (directive, dom) => {
            if (typeof directive.value === 'string') {
                let value = directive.value;
                if (!value) {
                    throw new NError("paramException", "x-show");
                }
                let expr = new Expression(value);
                directive.value = expr;
            }
        }, (directive, dom, module, parent) => {
            let model = dom.model;
            let v = directive.value.val(model, dom);
            //渲染
            if (v && v !== 'false') {
                dom.dontRender = false;
            }
            else { //不渲染
                dom.dontRender = true;
            }
        });
        /**
         * 指令名
         * 描述：显示指令
         */
        DirectiveManager.addType('animation', 9, (directive, dom) => {
            let arr = directive.value.trim().split('|');
            let privateName = ['fade', 'scale-fixtop', 'scale-fixleft', 'scale-fixbottom', 'scale-fixright', 'scale-fixcenterX', 'scale-fixcenterY'];
            if (privateName.includes(arr[0].trim())) {
                arr[0] = arr[0].trim();
            }
            else {
                arr[0] = new Expression(arr[0].trim());
            }
            // 渲染标志
            if (arr[1]) {
                arr[1] = new Expression(arr[1].trim());
            }
            else {
                // 如果没有传入渲染标志，则说明只需要在元素渲染的时候启用动画。直接吧渲染标志设置成true
                arr[1] = true;
            }
            directive.value = arr;
        }, (directive, dom, module, parent) => {
            var _a, _b, _c, _d, _e, _f;
            let arr = directive.value;
            let cls = dom.getProp('class');
            let model = dom.model;
            if (Util.isString(cls) && !Util.isEmpty(cls)) {
                cls.trim().split(/\s+/);
            }
            let confObj = arr[0];
            if (arr[0] instanceof Expression) {
                confObj = confObj.val(model, dom);
            }
            else {
                confObj = {
                    name: confObj
                };
            }
            if (!Util.isObject(confObj)) {
                return new NError('未找到animation配置对象');
            }
            let renderFlag = arr[1];
            let nameEnter = ((_a = confObj.name) === null || _a === void 0 ? void 0 : _a.enter) || confObj.name;
            let nameLeave = ((_b = confObj.name) === null || _b === void 0 ? void 0 : _b.leave) || confObj.name;
            let hiddenMode = confObj.hiddenMode || 'display';
            let durationEnter = ((_c = confObj.duration) === null || _c === void 0 ? void 0 : _c.enter) || '0.3s';
            let durationLeave = ((_d = confObj.duration) === null || _d === void 0 ? void 0 : _d.leave) || '0.3s';
            let delayEnter = ((_e = confObj.delay) === null || _e === void 0 ? void 0 : _e.enter) || '0s'; // 如果不配置则默认不延迟
            let delayLeave = ((_f = confObj.delay) === null || _f === void 0 ? void 0 : _f.leave) || '0s'; // 如果不配置则默认不延迟
            if (renderFlag instanceof Expression) {
                renderFlag = renderFlag.val(model);
            }
            let el = document.querySelector(`[key='${dom.key}']`);
            // 定义动画结束回调。
            let handler = () => {
                // 离开动画结束之后隐藏元素
                if (!renderFlag || renderFlag === 'false') {
                    if (hiddenMode && hiddenMode == 'visibility') {
                        el.style.visibility = 'hidden';
                    }
                    else {
                        el.style.display = 'none';
                    }
                }
                el.classList.remove("nd-animation-" + nameEnter + "-enter");
                el.classList.remove("nd-animation-" + nameLeave + "-leave");
                el.removeEventListener('animationend', handler);
            };
            if (!renderFlag || renderFlag === 'false') {
                // 从显示切换到隐藏。
                if (el) {
                    if (el.style.visibility == 'hidden' || el.style.display == 'none') {
                        // 当前处于隐藏，没有必要播放动画
                        if (hiddenMode && hiddenMode == 'visibility') {
                            el.style.visibility = 'hidden';
                            dom.addStyle('visibility:hidden');
                        }
                        else {
                            el.style.display = 'none';
                            dom.addStyle('display:none');
                        }
                        return;
                    }
                    // 为了触发动画
                    //  1. 删除原来的动画属性
                    el.classList.remove("nd-animation-" + nameEnter + "-enter");
                    // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                    dom.removeClass("nd-animation-" + nameEnter + "-enter");
                    //  2.重新定位一次元素。 本来是el.offsetWidth=el.offsetWidth的
                    //    下面是严格模式下的替代方案
                    void el.offsetWidth;
                    // 控制播放时间
                    el.style.animationDuration = durationLeave;
                    el.style.animationDelay = delayLeave;
                    dom.addStyle(`animation-duration:${durationEnter};animation-delay:${delayEnter}`);
                    //  3.添加新的动画
                    el.classList.add("nd-animation-" + nameLeave + "-leave");
                    // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                    dom.addClass("nd-animation-" + nameLeave + "-leave");
                    // 添加动画结束监听
                    el.addEventListener('animationend', handler);
                }
                else {
                    // 不显示，并且也没有el 比如poptip
                    if (hiddenMode && hiddenMode == 'visibility') {
                        dom.addStyle("visibility:hidden");
                    }
                    else {
                        dom.addStyle("display:none");
                    }
                    dom.dontRender = false;
                }
            }
            else {
                // 从隐藏切换到显示
                if (el) {
                    if (el.style.visibility == 'hidden' || el.style.display == 'none') {
                        // 当前处于隐藏
                        // 手动设置延时
                        let delay = parseFloat(delayEnter) * 1000;
                        // 因为下面是异步执行,所有这一次不能让元素先展示出来
                        if (hiddenMode && hiddenMode == 'visibility') {
                            el.style.visibility = 'hidden';
                            dom.addStyle('visibility:hidden');
                        }
                        else {
                            el.style.display = 'none';
                            dom.addStyle('display:none');
                        }
                        // 进入动画要手动设置延时.否则通过animation-delay属性会先显示元素,然后计算延时,然后再播放动画.
                        setTimeout(() => {
                            // 先切换成显示状态,再触发动画
                            if (hiddenMode && hiddenMode == 'visibility') {
                                el.style.visibility = 'visible';
                            }
                            else {
                                el.style.display = '';
                            }
                            //  1. 删除原来的动画属性
                            el.classList.remove("nd-animation-" + nameLeave + "-leave");
                            // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                            dom.removeClass("nd-animation-" + nameLeave + "-leave");
                            //  2.重新定位一次元素。 本来是el.offsetWidth=el.offsetWidth的
                            //    下面是严格模式下的替代方案
                            void el.offsetWidth;
                            // 控制播放时间
                            el.style.animationDuration = durationEnter;
                            // 动画延时播放时间
                            el.style.animationDelay = "0s";
                            dom.addStyle(`animation-duration:${durationEnter};animation-delay:0s`); //
                            //  3.添加新的动画
                            el.classList.add("nd-animation-" + nameEnter + "-enter");
                            // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                            dom.addClass('nd-animation-' + nameEnter + '-enter');
                            // 添加动画结束监听
                            el.addEventListener('animationend', handler);
                        }, delay);
                    }
                    else {
                        // 当前处于显示状态 
                        // 为了不重复播放显示动画，这里直接返回
                        dom.addClass('nd-animation-' + nameEnter + '-enter');
                        return;
                    }
                }
                else {
                    dom.addClass('nd-animation-' + nameEnter + '-enter');
                    dom.dontRender = false;
                }
            }
        });
        /**
         * 指令名 class
         * 描述：class指令
         */
        DirectiveManager.addType('class', 10, (directive, dom) => {
            if (typeof directive.value === 'string') {
                //转换为json数据
                let obj = new Function('return ' + directive.value)();
                if (!Util.isObject(obj)) {
                    return;
                }
                let robj = {};
                Util.getOwnProps(obj).forEach(function (key) {
                    if (Util.isString(obj[key])) {
                        //如果是字符串，转换为表达式
                        robj[key] = new Expression(obj[key]);
                    }
                    else {
                        robj[key] = obj[key];
                    }
                });
                directive.value = robj;
            }
        }, (directive, dom, module, parent) => {
            let obj = directive.value;
            let clsArr = [];
            let cls = dom.getProp('class');
            let model = dom.model;
            if (Util.isString(cls) && !Util.isEmpty(cls)) {
                clsArr = cls.trim().split(/\s+/);
            }
            Util.getOwnProps(obj).forEach(function (key) {
                let r = obj[key];
                if (r instanceof Expression) {
                    r = r.val(model);
                }
                let ind = clsArr.indexOf(key);
                if (!r || r === 'false') {
                    //移除class
                    if (ind !== -1) {
                        clsArr.splice(ind, 1);
                    }
                }
                else if (ind === -1) { //添加class
                    clsArr.push(key);
                }
            });
            //刷新dom的class
            dom.setProp('class', clsArr.join(' '));
        });
        /**
         * 指令名 field
         * 描述：字段指令
         */
        DirectiveManager.addType('field', 10, (directive, dom) => {
            dom.setProp('name', directive.value);
            //默认text
            let type = dom.getProp('type') || 'text';
            let eventName = dom.tagName === 'input' && ['text', 'checkbox', 'radio'].includes(type) ? 'input' : 'change';
            //增加value表达式
            if (!dom.hasProp('value') && ['text', 'number', 'date', 'datetime', 'datetime-local', 'month', 'week', 'time', 'email', 'password', 'search', 'tel', 'url', 'color', 'radio'].includes(type)
                || dom.tagName === 'TEXTAREA') {
                dom.setProp('value', new Expression(directive.value), true);
            }
            dom.addEvent(new NEvent(eventName, function (dom, module, e, el) {
                if (!el) {
                    return;
                }
                let type = dom.getProp('type');
                let field = dom.getDirective('field').value;
                let v = el.value;
                //根据选中状态设置checkbox的value
                if (type === 'checkbox') {
                    if (dom.getProp('yes-value') == v) {
                        v = dom.getProp('no-value');
                    }
                    else {
                        v = dom.getProp('yes-value');
                    }
                }
                else if (type === 'radio') {
                    if (!el.checked) {
                        v = undefined;
                    }
                }
                //修改字段值,需要处理.运算符
                let temp = this;
                let arr = field.split('.');
                if (arr.length === 1) {
                    this[field] = v;
                }
                else {
                    for (let i = 0; i < arr.length - 1; i++) {
                        temp = temp[arr[i]];
                    }
                    temp[arr[arr.length - 1]] = v;
                }
                //修改value值，该节点不重新渲染
                if (type !== 'radio') {
                    dom.setProp('value', v);
                    el.value = v;
                }
            }));
        }, (directive, dom, module, parent) => {
            const type = dom.getProp('type');
            const tgname = dom.tagName.toLowerCase();
            const model = dom.model;
            if (!model) {
                return;
            }
            let dataValue = model.$query(directive.value);
            //变为字符串
            if (dataValue !== undefined && dataValue !== null) {
                dataValue += '';
            }
            //无法获取虚拟dom的value，只能从对应的element获取
            let el = module.getNode(dom.key);
            let value = el ? el.value : undefined;
            if (type === 'radio') {
                if (dataValue + '' === value) {
                    dom.assets.set('checked', true);
                    dom.setProp('checked', 'checked');
                }
                else {
                    dom.assets.set('checked', false);
                    dom.delProp('checked');
                }
            }
            else if (type === 'checkbox') {
                //设置状态和value
                let yv = dom.getProp('yes-value');
                //当前值为yes-value
                if (dataValue + '' === yv) {
                    dom.setProp('value', yv);
                    dom.assets.set('checked', true);
                }
                else { //当前值为no-value
                    dom.setProp('value', dom.getProp('no-value'));
                    dom.assets.set('checked', false);
                }
            }
            else if (tgname === 'select') { //下拉框
                if (!directive.extra || !directive.extra.inited) {
                    setTimeout(() => {
                        directive.extra = { inited: true };
                        dom.setProp('value', dataValue);
                        dom.setAsset('value', dataValue);
                        Renderer.add(module);
                    }, 0);
                }
                else {
                    if (dataValue !== value) {
                        dom.setProp('value', dataValue);
                        dom.setAsset('value', dataValue);
                    }
                }
            }
            else {
                dom.assets.set('value', dataValue === undefined || dataValue === null ? '' : dataValue);
            }
        });
        /**
         * 指令名 validity
         * 描述：字段指令
         */
        DirectiveManager.addType('validity', 10, (directive, dom) => {
            let ind, fn, method;
            let value = directive.value;
            //处理带自定义校验方法
            if ((ind = value.indexOf('|')) !== -1) {
                fn = value.substr(0, ind);
                method = value.substr(ind + 1);
            }
            else {
                fn = value;
            }
            directive.extra = { initEvent: false };
            directive.value = fn;
            directive.params = {
                enabled: false //不可用
            };
            //如果有方法，则需要存储
            if (method) {
                directive.params.method = method;
            }
            //如果没有子节点，添加一个，需要延迟执行
            if (dom.children.length === 0) {
                let vd1 = new Element();
                vd1.textContent = '';
                dom.add(vd1);
            }
            else { //子节点
                dom.children.forEach((item) => {
                    if (item.children.length === 0) {
                        let vd1 = new Element();
                        vd1.textContent = '   ';
                        item.add(vd1);
                    }
                });
            }
        }, (directive, dom, module, parent) => {
            setTimeout(() => {
                const el = module.getNode({ name: directive.value });
                if (!directive.extra.initEvent) {
                    directive.extra.initEvent = true;
                    //添加focus和blur事件
                    el.addEventListener('focus', function () {
                        setTimeout(() => { directive.params.enabled = true; }, 0);
                    });
                    el.addEventListener('blur', function () {
                        Renderer.add(module);
                    });
                }
            }, 0);
            //未获取focus，不需要校验
            if (!directive.params.enabled) {
                dom.dontRender = true;
                return;
            }
            const el = module.getNode({ name: directive.value });
            if (!el) {
                return;
            }
            let chds = [];
            //找到带rel的节点
            dom.children.forEach((item) => {
                if (item.tagName !== undefined && item.hasProp('rel')) {
                    chds.push(item);
                }
            });
            let resultArr = [];
            //自定义方法校验
            if (directive.params.method) {
                const foo = module.getMethod(directive.params.method);
                if (Util.isFunction(foo)) {
                    let r = foo.call(module.model, el.value);
                    if (!r) {
                        resultArr.push('custom');
                    }
                }
            }
            let vld = el.validity;
            if (!vld.valid) {
                // 查找校验异常属性
                for (var o in vld) {
                    if (vld[o] === true) {
                        resultArr.push(o);
                    }
                }
            }
            if (resultArr.length > 0) {
                //转换成ref对应值
                let vn = handle(resultArr);
                //单个校验
                if (chds.length === 0) {
                    setTip(dom, vn, el);
                }
                else { //多个校验
                    for (let i = 0; i < chds.length; i++) {
                        let rel = chds[i].getProp('rel');
                        if (rel === vn) {
                            setTip(chds[i], vn, el);
                        }
                        else { //隐藏
                            chds[i].dontRender = true;
                        }
                    }
                }
            }
            else {
                dom.dontRender = true;
            }
            /**
             * 设置提示
             * @param vd    虚拟dom节点
             * @param vn    验证结果名
             * @param el    验证html element
             */
            function setTip(vd, vn, el) {
                //子节点不存在，添加一个
                let text = vd.children[0].textContent.trim();
                if (text === '') { //没有提示内容，根据类型提示
                    text = Util.compileStr(exports.NodomMessage.FormMsgs[vn], el.getAttribute(vn));
                }
                vd.children[0].textContent = text;
            }
            /**
             * 验证名转换
             */
            function handle(arr) {
                for (var i = 0; i < arr.length; i++) {
                    switch (arr[i]) {
                        case 'valueMissing':
                            return 'required';
                        case 'typeMismatch':
                            return 'type';
                        case 'tooLong':
                            return 'maxLength';
                        case 'tooShort':
                            return 'minLength';
                        case 'rangeUnderflow':
                            return 'min';
                        case 'rangeOverflow':
                            return 'max';
                        case 'patternMismatch':
                            return 'pattern';
                        default:
                            return arr[i];
                    }
                }
            }
        });
        /**
         * 增加route指令
         */
        DirectiveManager.addType('route', 10, (directive, dom) => {
            let value = directive.value;
            if (Util.isEmpty(value)) {
                return;
            }
            //a标签需要设置href
            if (dom.tagName === 'A') {
                dom.setProp('href', 'javascript:void(0)');
            }
            // 表达式处理
            if (typeof value === 'string' && /^\{\{.+\}\}$/.test(value)) {
                value = new Expression(value.substring(2, value.length - 2));
            }
            //表达式，则需要设置为exprProp
            if (value instanceof Expression) {
                dom.setProp('path', value, true);
                directive.value = value;
            }
            else {
                dom.setProp('path', value);
            }
            //处理active 属性
            if (dom.hasProp('activename')) {
                let an = dom.getProp('activename');
                dom.setProp('active', new Expression(an), true);
                if (dom.hasProp('activeclass')) {
                    new Directive('class', "{" + dom.getProp('activeclass') + ":'" + an + "'}", dom);
                }
            }
            //添加click事件
            dom.addEvent(new NEvent('click', (dom, module, e) => {
                let path = dom.getProp('path');
                if (Util.isEmpty(path)) {
                    return;
                }
                Router.go(path);
            }));
        }, (directive, dom, module, parent) => {
            let path = dom.getProp('path');
            //添加到router的activeDomMap
            let domArr = Router.activeDomMap.get(module.id);
            if (!domArr) {
                Router.activeDomMap.set(module.id, [dom.key]);
            }
            else {
                if (!domArr.includes(dom.key)) {
                    domArr.push(dom.key);
                }
            }
            if (!path || path === Router.currentPath) {
                return;
            }
            //active需要跳转路由（当前路由为该路径对应的父路由）
            if (dom.hasProp('active') && dom.getProp('active') && (!Router.currentPath || path.indexOf(Router.currentPath) === 0)) {
                //可能router尚未渲染出来
                setTimeout(() => { Router.go(path); }, 0);
            }
        });
        /**
         * 增加router指令
         */
        DirectiveManager.addType('router', 10, (directive, dom) => {
            //修改节点role
            dom.setProp('role', 'module');
        }, (directive, dom, module, parent) => {
            Router.routerKeyMap.set(module.id, dom.key);
        });
        /**
         * 增加ignore指令
         * 只渲染子节点到dom树
         */
        DirectiveManager.addType('ignoreself', 10, (directive, dom) => {
            dom.dontRenderSelf = true;
        }, (directive, dom, module, parent) => {
        });
        /**
         * 粘指令，粘在前一个dom节点上，如果前一个节点repeat了多个分身，则每个分身都粘上
         * 如果未指定model，则用被粘节点的model
         */
        DirectiveManager.addType('stick', 10, (directive, dom) => {
        }, (directive, dom, module, parent) => {
        });
        /**
         * 插槽指令
         * 配合slot标签使用
         */
        DirectiveManager.addType('slot', 3, (directive, dom) => {
            dom.setProp('slotName', directive.value);
        }, (directive, dom, module, parent) => {
        });
    })());

    /// <reference path="../nodom.ts" />
    ((function () {
        /**
         * 过滤器类型初始化
         */
        /**
         * 格式化日期
         * @param format    日期格式
         */
        FilterManager.addType('date', (value, param) => {
            if (Util.isEmpty(value)) {
                return '';
            }
            //去掉首尾" '
            if (/[\'\"\`]/.test(param)) {
                param = param.substr(1, param.length - 2);
            }
            return Util.formatDate(value, param);
        });
        /**
         * 转换为货币
         * @param sign  货币符号¥ $ 等，默认 ¥
         */
        FilterManager.addType('currency', (value, sign) => {
            if (isNaN(value)) {
                return '';
            }
            sign = sign || '¥';
            if (typeof value === 'string') {
                value = parseFloat(value);
            }
            return sign + ((value * 100 + 0.5 | 0) / 100);
        });
        /**
         * 格式化，如果为字符串，转换成数字，保留小数点后位数
         * @param digits    小数点后位数
         */
        FilterManager.addType('number', (value, param) => {
            let digits = param || 0;
            if (isNaN(value) || digits < 0) {
                return '';
            }
            if (typeof value === 'string') {
                value = parseFloat(value);
            }
            let x = 1;
            for (let i = 0; i < digits; i++) {
                x *= 10;
            }
            return ((value * x + 0.5) | 0) / x;
        });
        /**
         * 转换为小写字母
         */
        FilterManager.addType('tolowercase', (value) => {
            if (Util.isEmpty(value)) {
                return '';
            }
            if (!Util.isString(value) || Util.isEmpty(value)) {
                throw new NError('invoke1', exports.NodomMessage.TipWords['filter'] + ' tolowercase', '0', 'string');
            }
            return value.toLowerCase();
        });
        /**
         * 转换为大写字母
         */
        FilterManager.addType('touppercase', (value) => {
            if (Util.isEmpty(value)) {
                return '';
            }
            if (!Util.isString(value) || Util.isEmpty(value)) {
                throw new NError('invoke1', exports.NodomMessage.TipWords['filter'] + ' touppercase', '0', 'string');
            }
            return value.toUpperCase();
        });
        /**
         * 数组排序
         * @param arr       数组
         * @param param
         *     用法: orderby:字段:desc/asc
         */
        FilterManager.addType('orderby', function () {
            let args = arguments;
            let arr = args[0]; //数组
            let field = args[1]; //比较字段
            let odr = args[2] || 'asc'; //升序或降序,默认升序
            if (!Util.isArray(arr)) {
                throw new NError('invoke1', exports.NodomMessage.TipWords['filter'] + ' orderby', '0', 'array');
            }
            //复制数组
            let ret = arr.concat([]);
            if (field && Util.isObject(arr[0])) { //对象数组
                if (odr === 'asc') {
                    ret.sort((a, b) => a[field] >= b[field] ? 1 : -1);
                }
                else {
                    ret.sort((a, b) => a[field] <= b[field] ? 1 : -1);
                }
            }
            else { //值数组
                if (odr === 'asc') {
                    ret.sort((a, b) => a >= b ? 1 : -1);
                }
                else {
                    ret.sort((a, b) => a <= b ? 1 : -1);
                }
            }
            return ret;
        });
        /**
         * 数组过滤
         * 用法: 无参数select:odd 带参数 select:range:1:5
         * odd      奇数，返回索引号为奇数的数组元素
         * even     偶数，返回索引号为偶数的数组元素
         * value    返回值中含有指定字符的数组元素
         *          {prop1:v1,prop2:v2,...} 满足所有属性prop的值中含有对应字符或相等值的数组元素
         * func     自定义函数过滤
         * range    数组范围1:5 返回索引1到5的数组元素
         * index    数组索引序列1:2:3 返回索引1，2，3的元素
         */
        FilterManager.addType('select', function () {
            if (!Util.isArray(arguments[0])) {
                throw new NError('invoke1', exports.NodomMessage.TipWords['filter'] + ' filter', '0', 'array');
            }
            let params = new Array();
            for (let i = 0; i < arguments.length; i++) {
                params.push(arguments[i]);
            }
            //内部处理方法对象
            let handler = {
                //奇数索引过滤
                odd: function () {
                    let arr = arguments[0];
                    let ret = [];
                    for (let i = 0; i < arr.length; i++) {
                        if (i % 2 === 1) {
                            ret.push(arr[i]);
                        }
                    }
                    return ret;
                },
                //偶数索引过滤
                even: function () {
                    let arr = arguments[0];
                    let ret = [];
                    for (let i = 0; i < arr.length; i++) {
                        if (i % 2 === 0) {
                            ret.push(arr[i]);
                        }
                    }
                    return ret;
                },
                //索引区域过滤
                range: function () {
                    let args = arguments;
                    let arr = args[0];
                    //第一个索引,第二个索引
                    let first = args[1];
                    let last = args[2];
                    if (isNaN(first)) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter range');
                    }
                    if (!Util.isNumber(first)) {
                        first = parseInt(first);
                    }
                    //判断数字
                    if (isNaN(last)) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter range');
                    }
                    //字符串转数字
                    if (!Util.isNumber(last)) {
                        last = parseInt(last);
                    }
                    if (first > last) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter range');
                    }
                    return arr.slice(first, last + 1);
                },
                //索引过滤
                index: function () {
                    let args = arguments;
                    let arr = args[0];
                    if (!Util.isArray(args[0])) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter index');
                    }
                    let ret = [];
                    //读取所有index
                    if (arr.length > 0) {
                        for (let i = 1; i < args.length; i++) {
                            if (isNaN(args[i])) {
                                continue;
                            }
                            let k = parseInt(args[i]);
                            if (k < arr.length) {
                                ret.push(arr[k]);
                            }
                        }
                    }
                    return ret;
                },
                //函数过滤
                func: function (arr, param) {
                    if (!Util.isArray(arr) || Util.isEmpty(param)) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter func');
                    }
                    //自定义函数
                    let foo = this.methodFactory.get(param);
                    if (Util.isFunction(foo)) {
                        return Util.apply(foo, this, [arr]);
                    }
                    return arr;
                },
                //值过滤
                value: function (arr, param) {
                    if (!Util.isArray(arr) || Util.isEmpty(param)) {
                        throw new NError('paramException', exports.NodomMessage.TipWords['filter'], 'filter value');
                    }
                    //属性值对象，所有属性值满足才过滤出来
                    if (Util.isObject(param)) {
                        let keys = Util.getOwnProps(param);
                        return arr.filter(function (item) {
                            for (let i = 0; i < keys.length; i++) {
                                let v = item[keys[i]];
                                let v1 = param[keys[i]];
                                //找不到属性值，或者不相等并且是字符串且不包含的情况都返回false
                                if (v === undefined || v !== v1 || typeof v === 'string' && v.indexOf(v1) === -1) {
                                    return false;
                                }
                            }
                            //都匹配则返回true
                            return true;
                        });
                    }
                    else { //字符串
                        return arr.filter(function (item) {
                            let props = Util.getOwnProps(item);
                            for (let i = 0; i < props.length; i++) {
                                let v = item[props[i]];
                                if (Util.isString(v) && v.indexOf(param) !== -1) {
                                    return item;
                                }
                            }
                        });
                    }
                }
            };
            let type;
            //类型匹配并处理
            if (Util.isString(params[1])) {
                type = params[1].trim();
                if (handler.hasOwnProperty(type)) {
                    //去掉type
                    params.splice(1, 1);
                }
                else { //默认为value
                    type = 'value';
                }
            }
            else { //默认为value，值对象
                type = 'value';
            }
            //校验输入参数是否为空
            if (type === 'range' || type === 'index' || type === 'func') {
                if (params.length < 2) {
                    throw new NError('paramException', exports.NodomMessage.TipWords['filter']);
                }
            }
            //方法调用
            return Util.apply(handler[type], this, params);
        });
    })());

    /*
     * 消息js文件 中文文件
     */
    const NodomMessage_en = {
        /**
         * tip words
         */
        TipWords: {
            application: "Application",
            system: "System",
            module: "Module",
            moduleClass: 'ModuleClass',
            model: "Model",
            directive: "Directive",
            directiveType: "Directive-type",
            expression: "Expression",
            event: "Event",
            method: "Method",
            filter: "Filter",
            filterType: "Filter-type",
            data: "Data",
            dataItem: 'Data-item',
            route: 'Route',
            routeView: 'Route-container',
            plugin: 'Plugin',
            resource: 'Resource',
            root: 'Root',
            element: 'Element'
        },
        /**
         * error info
         */
        ErrorMsgs: {
            unknown: "unknown error",
            paramException: "{0} '{1}' parameter error，see api",
            invoke: "method {0} parameter {1} must be {2}",
            invoke1: "method {0} parameter {1} must be {2} or {3}",
            invoke2: "method {0} parameter {1} or {2} must be {3}",
            invoke3: "method {0} parameter {1} not allowed empty",
            exist: "{0} is already exist",
            exist1: "{0} '{1}' is already exist",
            notexist: "{0} is not exist",
            notexist1: "{0} '{1}' is not exist",
            notupd: "{0} not allow to change",
            notremove: "{0} not allow to delete",
            notremove1: "{0} {1} not allow to delete",
            namedinvalid: "{0} {1} name error，see name rules",
            initial: "{0} init parameter error",
            jsonparse: "JSON parse error",
            timeout: "request overtime",
            config: "{0} config parameter error",
            config1: "{0} config parameter '{1}' error",
            itemnotempty: "{0} '{1}' config item '{2}' not allow empty",
            itemincorrect: "{0} '{1}' config item '{2}' error"
        },
        /**
         * form info
         */
        FormMsgs: {
            type: "please input valid {0}",
            unknown: "input error",
            required: "is required",
            min: "min value is {0}",
            max: "max value is {0}"
        },
        WeekDays: {
            "0": "Sun",
            "1": "Mon",
            "2": "Tue",
            "3": "Wed",
            "4": "Thu",
            "5": "Fri",
            "6": "Sat"
        }
    };

    /*
     * 消息js文件 中文文件
     */
    const NodomMessage_zh = {
        /**
         * 提示单词
         */
        TipWords: {
            application: "应用",
            system: "系统",
            module: "模块",
            moduleClass: '模块类',
            model: "模型",
            directive: "指令",
            directiveType: "指令类型",
            expression: "表达式",
            event: "事件",
            method: "方法",
            filter: "过滤器",
            filterType: "过滤器类型",
            data: "数据",
            dataItem: '数据项',
            route: '路由',
            routeView: '路由容器',
            plugin: '插件',
            resource: '资源',
            root: '根',
            element: '元素'
        },
        /**
         * 异常信息
         */
        ErrorMsgs: {
            unknown: "未知错误",
            paramException: "{0}'{1}'方法参数错误，请参考api",
            invoke: "{0}方法调用参数{1}必须为{2}",
            invoke1: "{0}方法调用参数{1}必须为{2}或{3}",
            invoke2: "{0}方法调用参数{1}或{2}必须为{3}",
            invoke3: "{0}方法调用参数{1}不能为空",
            exist: "{0}已存在",
            exist1: "{0}'{1}'已存在",
            notexist: "{0}不存在",
            notexist1: "{0}'{1}'不存在",
            notupd: "{0}不可修改",
            notremove: "{0}不可删除",
            notremove1: "{0}{1}不可删除",
            namedinvalid: "{0}{1}命名错误，请参考用户手册对应命名规范",
            initial: "{0}初始化参数错误",
            jsonparse: "JSON解析错误",
            timeout: "请求超时",
            config: "{0}配置参数错误",
            config1: "{0}配置参数'{1}'错误",
            itemnotempty: "{0} '{1}' 配置项 '{2}' 不能为空",
            itemincorrect: "{0} '{1}' 配置项 '{2}' 错误"
        },
        /**
         * 表单信息
         */
        FormMsgs: {
            type: "请输入有效的{0}",
            unknown: "输入错误",
            required: "不能为空",
            min: "最小输入值为{0}",
            max: "最大输入值为{0}"
        },
        WeekDays: {
            "0": "日",
            "1": "一",
            "2": "二",
            "3": "三",
            "4": "四",
            "5": "五",
            "6": "六"
        }
    };

    exports.Application = Application;
    exports.ChangedDom = ChangedDom;
    exports.Compiler = Compiler;
    exports.DefineElement = DefineElement;
    exports.DefineElementManager = DefineElementManager;
    exports.Directive = Directive;
    exports.DirectiveManager = DirectiveManager;
    exports.DirectiveType = DirectiveType;
    exports.Element = Element;
    exports.Expression = Expression;
    exports.ExternalNEvent = ExternalNEvent;
    exports.Filter = Filter;
    exports.FilterManager = FilterManager;
    exports.LocalStore = LocalStore;
    exports.Message = Message;
    exports.MessageQueue = MessageQueue;
    exports.MethodFactory = MethodFactory;
    exports.Model = Model$1;
    exports.ModelManager = ModelManager$1;
    exports.Module = Module;
    exports.ModuleFactory = ModuleFactory;
    exports.NError = NError;
    exports.NEvent = NEvent;
    exports.NFactory = NFactory;
    exports.NodomMessage_en = NodomMessage_en;
    exports.NodomMessage_zh = NodomMessage_zh;
    exports.Renderer = Renderer;
    exports.ResourceManager = ResourceManager;
    exports.Route = Route;
    exports.Router = Router;
    exports.Scheduler = Scheduler;
    exports.Serializer = Serializer;
    exports.Util = Util;
    exports.addModules = addModules;
    exports.app = app;
    exports.createDirective = createDirective;
    exports.createRoute = createRoute;
    exports.modelCloneExpKey = modelCloneExpKey;
    exports.newStore = newStore;
    exports.request = request;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

}({}));
//# sourceMappingURL=nodom.js.map

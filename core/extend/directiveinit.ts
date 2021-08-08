import { Directive } from "../directive";
import { DirectiveManager } from "../directivemanager";
import { Element } from "../element";
import { NError } from "../error";
import { NEvent } from "../event";
import { Expression } from "../expression";
import { Filter } from "../filter";
import { Model } from "../model";
import { Module } from "../module";
import { ModuleFactory } from "../modulefactory";
import { NodomMessage } from "../nodom";
import { Renderer } from "../renderer";
import { Router } from "../router";
import { Util } from "../util";

export default (function () {

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
    DirectiveManager.addType('module', 0,
        (directive: Directive, dom: Element) => {
            let value: string = <string>directive.value;
            let valueArr: string[] = value.split('|');
            directive.value = valueArr[0];
            //设置dom role
            dom.setProp('role', 'module');
            //设置module name
            if (valueArr.length > 1) {
                dom.setProp('modulename', valueArr[1]);
            }
            directive.extra = {};
        },

        async (directive: Directive, dom: Element, module: Module, parent: Element) => {
            const ext = directive.extra;
            let needNew: boolean = ext.moduleId === undefined;
            let subMdl: Module;
            //没有moduleId或与容器key不一致，需要初始化模块
            if (ext && ext.moduleId) {
                subMdl = ModuleFactory.get(ext.moduleId);
                needNew = subMdl.getContainerKey() !== dom.key;
            }
            if (needNew) {
                let m: Module = await ModuleFactory.getInstance(directive.value, dom.getProp('modulename'), dom.getProp('data'));

                if (m) {
                    //保存绑定moduleid
                    m.setContainerKey(dom.key);
                    //修改virtualdom的module指令附加参数moduleId
                    let dom1: Element = module.getElement(dom.key, true);
                    if (dom1) {
                        let dir: Directive = dom1.getDirective('module');
                        dir.extra.moduleId = m.id;
                    }
                    module.addChild(m.id);
                    //传props值
                    m.props = Util.clone(dom.props);


                    //插槽
                    if (dom.children.length > 0) {
                        let slotMap: Map<string, Element> = new Map();
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
                            })
                        }
                    }

                    await m.active();
                }
            } else if (subMdl && subMdl.state !== 3) {
                await subMdl.active();
            }
            function findSlot(dom: Element, res = new Array()) {
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
                })
                return res;
            }
        }
    );


    /**
     *  model指令
     */
    DirectiveManager.addType('model',
        1,
        (directive: Directive, dom: Element) => {
            let value: string = <string>directive.value;
            //处理以.分割的字段，没有就是一个
            if (Util.isString(value)) {
                // //从根数据获取
                // if(value.startsWith('$$')){
                //     directive.extra = 1;
                //     value = value.substr(2);
                // }
                directive.value = value;
            }
        },

        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let model: Model = dom.model;
            if (directive.value == '$$') {
                model = module.model;
            } else {
                model = model.$query(directive.value);
            }
            if (!model) {
                model = module.model.$query(directive.value);
            }
            if (model) {
                dom.model = model;
            }
        }
    );

    /**
     * 指令名 repeat
     * 描述：重复指令
     */
    DirectiveManager.addType('repeat',
        2,
        (directive: Directive, dom: Element) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-repeat");
            }

            let modelName: string;
            let fa: string[] = value.split('|');
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
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
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
        }
    );

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
    DirectiveManager.addType('recur',
        3,
        (directive: Directive, dom: Element, parent: Element) => {
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
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
                    let node: Element = dom.clone(true);
                    for (let d of data) {
                        let nod: Element = node.clone(true);
                        nod.model = d;
                        //作为当前节点子节点
                        dom.add(nod);
                    }
                } else {
                    let node: Element = dom.clone(true);
                    node.model = data;
                    //作为当前节点子节点
                    dom.add(node);
                }
            }
        }
    );

    /**
     * 指令名 if
     * 描述：条件指令
     */
    DirectiveManager.addType('if',
        10,
        (directive: Directive, dom: Element, parent: Element) => {
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
            }
            if (!parent) {
                return;
            }
            parent.setTmpParam('ifnode', dom);
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            dom.dontRender = true;
            let target: number = -1;

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
            } else if (target > 0) { //elseif 节点
                tNode = directive.extra.groups[target];
            } else if (directive.extra.groups.length > 1) {  //else 节点
                tNode = directive.extra.groups[directive.extra.groups.length - 1];
            }
            if (tNode) {
                //添加到指定位置
                let index = parent.children.indexOf(dom);
                if (index !== -1) {
                    parent.children.splice(index + 1, 0, tNode);
                }
            }

        }
    );

    /**
     * 指令名 else
     * 描述：else指令
     */
    DirectiveManager.addType('else',
        10,
        (directive: Directive, dom: Element, parent: Element) => {
            if (!parent) {
                return;
            }
            let ifNode = parent.getTmpParam('ifnode');
            if (ifNode) {
                let dir = ifNode.getDirective('if');
                dir.extra.groups.push(dom);
                parent.removeChild(dom);
            }
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            return;
        }
    );

    /**
     * elseif 指令
     */
    DirectiveManager.addType('elseif', 10,
        (directive: Directive, dom: Element, parent: Element) => {
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
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {

        }
    );

    /**
     * endif 指令
     */
    DirectiveManager.addType('endif', 10,
        (directive: Directive, dom: Element, parent: Element) => {
            if (!parent) {
                return;
            }
            let ifNode = parent.getTmpParam('ifnode');
            if (ifNode) {
                parent.removeChild(dom);
                //移除ifnode临时参数
                parent.removeTmpParam('ifnode');
            }
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {

        }
    );
    /**
     * switch指令
     */
    DirectiveManager.addType('switch',
        10,
        (directive: Directive, dom: Element) => {
            let value = directive.value;
            if (!value) {
                throw new NError("paramException", "x-switch");
            }
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let hasTrue: boolean = false;
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
        }
    );


    /**
     *  case 指令
     */
    DirectiveManager.addType('case',
        10,
        (directive: Directive, dom: Element, parent: Element) => {
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
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            return;
        }
    );
    /**
     * 指令名 show
     * 描述：显示指令
     */
    DirectiveManager.addType('show',
        10,
        (directive: Directive, dom: Element) => {
            if (typeof directive.value === 'string') {
                let value = directive.value;
                if (!value) {
                    throw new NError("paramException", "x-show");
                }
                let expr = new Expression(value);
                directive.value = expr;
            }
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let model = dom.model;
            let v = directive.value.val(model, dom);
            //渲染
            if (v && v !== 'false') {
                dom.dontRender = false;
            } else { //不渲染
                dom.dontRender = true;
            }
        }
    );
    /**
     * 指令名 
     * 描述：显示指令
     */
    DirectiveManager.addType('animation',
        9,
        (directive: Directive, dom: Element) => {
            let arr = directive.value.trim().split('|');
            let privateName = ['fade', 'scale-fixtop', 'scale-fixleft', 'scale-fixbottom', 'scale-fixright', 'scale-fixcenterX', 'scale-fixcenterY']
            if (privateName.includes(arr[0].trim())) {
                arr[0] = arr[0].trim();
            } else {
                arr[0] = new Expression(arr[0].trim());
            }
            // 渲染标志
            if (arr[1]) {
                arr[1] = new Expression(arr[1].trim());
            } else {
                // 如果没有传入渲染标志，则说明只需要在元素渲染的时候启用动画。直接吧渲染标志设置成true
                arr[1] = true;
            }
            directive.value = arr;
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let arr = directive.value;
            let clsArr: Array<string> = [];
            let cls: string = dom.getProp('class');
            let model = dom.model;
            if (Util.isString(cls) && !Util.isEmpty(cls)) {
                clsArr = cls.trim().split(/\s+/);
            }

            let confObj = arr[0];
            if (arr[0] instanceof Expression) {
                confObj = confObj.val(model, dom);
            } else {
                confObj = {
                    name: confObj
                }
            }

            if (!Util.isObject(confObj)) {
                return new NError('未找到animation配置对象');
            }
            let renderFlag = arr[1];
            let nameEnter = confObj.name?.enter || confObj.name;
            let nameLeave = confObj.name?.leave || confObj.name;
            let hiddenMode = confObj.hiddenMode || 'display';
            let durationEnter = confObj.duration?.enter || '0.3s';
            let durationLeave = confObj.duration?.leave || '0.3s';
            let delayEnter = confObj.delay?.enter || '0s'; // 如果不配置则默认不延迟
            let delayLeave = confObj.delay?.leave || '0s';// 如果不配置则默认不延迟
            if (renderFlag instanceof Expression) {
                renderFlag = renderFlag.val(model, dom);
            }
            let el: HTMLElement = document.querySelector(`[key='${dom.key}']`)
            // 定义动画结束回调。
            let handler = () => {
                // 离开动画结束之后隐藏元素
                if (!renderFlag || renderFlag === 'false') {
                    if (hiddenMode && hiddenMode == 'visibility') {
                        el.style.visibility = 'hidden';
                    } else {
                        el.style.display = 'none';
                    }
                }
                el.classList.remove("nd-animation-" + nameEnter + "-enter");
                el.classList.remove("nd-animation-" + nameLeave + "-leave");
                el.removeEventListener('animationend', handler);
            }
            if (!renderFlag || renderFlag === 'false') {
                // 从显示切换到隐藏。
                if (el) {
                    if (el.style.visibility == 'hidden' || el.style.display == 'none') {
                        // 当前处于隐藏，没有必要播放动画
                        if (hiddenMode && hiddenMode == 'visibility') {
                            el.style.visibility = 'hidden';
                            dom.addStyle('visibility:hidden');
                        } else {
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
                    void el.offsetWidth
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
                } else {
                    // 不显示，并且也没有el 比如poptip
                    if (hiddenMode && hiddenMode == 'visibility') {
                        dom.addStyle("visibility:hidden");
                    } else {
                        dom.addStyle("display:none");
                    }
                    dom.dontRender = false;
                }
            } else {
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
                        } else {
                            el.style.display = 'none';
                            dom.addStyle('display:none');
                        }
                        // 进入动画要手动设置延时.否则通过animation-delay属性会先显示元素,然后计算延时,然后再播放动画.
                        setTimeout(() => {
                            // 先切换成显示状态,再触发动画
                            if (hiddenMode && hiddenMode == 'visibility') {
                                el.style.visibility = 'visible';
                            } else {
                                el.style.display = '';
                            }
                            //  1. 删除原来的动画属性
                            el.classList.remove("nd-animation-" + nameLeave + "-leave");
                            // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                            dom.removeClass("nd-animation-" + nameLeave + "-leave");
                            //  2.重新定位一次元素。 本来是el.offsetWidth=el.offsetWidth的
                            //    下面是严格模式下的替代方案
                            void el.offsetWidth
                            // 控制播放时间
                            el.style.animationDuration = durationEnter;
                            // 动画延时播放时间
                            el.style.animationDelay = "0s";
                            dom.addStyle(`animation-duration:${durationEnter};animation-delay:0s`);//
                            //  3.添加新的动画
                            el.classList.add("nd-animation-" + nameEnter + "-enter");
                            // 操作了真实dom，虚拟dom也要做相应的变化，否则可能导致第二次渲染属性不一致
                            dom.addClass('nd-animation-' + nameEnter + '-enter');
                            // 添加动画结束监听
                            el.addEventListener('animationend', handler);
                        }, delay);

                    } else {
                        // 当前处于显示状态 
                        // 为了不重复播放显示动画，这里直接返回
                        dom.addClass('nd-animation-' + nameEnter + '-enter');
                        return;
                    }
                } else {
                    dom.addClass('nd-animation-' + nameEnter + '-enter');
                    dom.dontRender = false;
                }
            }
        }
    );

    /**
     * 指令名 class
     * 描述：class指令
     */
    DirectiveManager.addType('class',
        10,
        (directive: Directive, dom: Element) => {
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
                    } else {
                        robj[key] = obj[key];
                    }
                });
                directive.value = robj;
            }
        },
        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let obj = directive.value;
            let clsArr: Array<string> = [];
            let cls: string = dom.getProp('class');
            let model = dom.model;

            if (Util.isString(cls) && !Util.isEmpty(cls)) {
                clsArr = cls.trim().split(/\s+/);
            }

            Util.getOwnProps(obj).forEach(function (key) {
                let r = obj[key];
                if (r instanceof Expression) {
                    r = r.val(model, dom);
                }
                let ind = clsArr.indexOf(key);
                if (!r || r === 'false') {
                    //移除class
                    if (ind !== -1) {
                        clsArr.splice(ind, 1);
                    }
                } else if (ind === -1) { //添加class
                    clsArr.push(key);
                }
            });
            //刷新dom的class
            dom.setProp('class', clsArr.join(' '));
        }
    );

    /**
     * 指令名 field
     * 描述：字段指令
     */
    DirectiveManager.addType('field',
        10,
        (directive: Directive, dom: Element) => {
            dom.setProp('name', directive.value);
            //默认text
            let type = dom.getProp('type') || 'text';
            let eventName = dom.tagName === 'input' && ['text', 'checkbox', 'radio'].includes(type) ? 'input' : 'change';
            //增加value表达式
            if (!dom.hasProp('value') && ['text', 'number', 'date', 'datetime', 'datetime-local', 'month', 'week', 'time', 'email', 'password', 'search', 'tel', 'url', 'color', 'radio'].includes(type)
                || dom.tagName === 'TEXTAREA') {
                dom.setProp('value', new Expression(directive.value), true);
            }

            dom.addEvent(new NEvent(eventName,
                function (dom, module, e, el) {
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
                        } else {
                            v = dom.getProp('yes-value');
                        }
                    } else if (type === 'radio') {
                        if (!el.checked) {
                            v = undefined;
                        }
                    }
                    //修改字段值,需要处理.运算符
                    let temp = this;
                    let arr = field.split('.')
                    if (arr.length === 1) {
                        this[field] = v;
                    } else {
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
                }
            ));
        },

        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            const type: string = dom.getProp('type');
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
            let el: any = module.getNode(dom.key);
            let value = el ? el.value : undefined;

            if (type === 'radio') {
                if (dataValue + '' === value) {
                    dom.assets.set('checked', true);
                    dom.setProp('checked', 'checked');
                } else {
                    dom.assets.set('checked', false);
                    dom.delProp('checked');
                }
            } else if (type === 'checkbox') {
                //设置状态和value
                let yv = dom.getProp('yes-value');
                //当前值为yes-value
                if (dataValue + '' === yv) {
                    dom.setProp('value', yv);
                    dom.assets.set('checked', true);
                } else { //当前值为no-value
                    dom.setProp('value', dom.getProp('no-value'));
                    dom.assets.set('checked', false);
                }
            } else if (tgname === 'select') { //下拉框
                if (!directive.extra || !directive.extra.inited) {
                    setTimeout(() => {
                        directive.extra = { inited: true };
                        dom.setProp('value', dataValue);
                        dom.setAsset('value', dataValue);
                        Renderer.add(module);
                    }, 0);
                } else {
                    if (dataValue !== value) {
                        dom.setProp('value', dataValue);
                        dom.setAsset('value', dataValue);
                    }
                }
            } else {
                dom.assets.set('value', dataValue === undefined || dataValue === null ? '' : dataValue);
            }
        }
    );

    /**
     * 指令名 validity
     * 描述：字段指令
     */
    DirectiveManager.addType('validity',
        10,
        (directive: Directive, dom: Element) => {
            let ind, fn, method;
            let value = directive.value;
            //处理带自定义校验方法
            if ((ind = value.indexOf('|')) !== -1) {
                fn = value.substr(0, ind);
                method = value.substr(ind + 1);
            } else {
                fn = value;
            }
            directive.extra = { initEvent: false };
            directive.value = fn;

            directive.params = {
                enabled: false //不可用
            }
            //如果有方法，则需要存储
            if (method) {
                directive.params.method = method;
            }
            //如果没有子节点，添加一个，需要延迟执行
            if (dom.children.length === 0) {
                let vd1 = new Element();
                vd1.textContent = '';
                dom.add(vd1);
            } else { //子节点
                dom.children.forEach((item) => {
                    if (item.children.length === 0) {
                        let vd1 = new Element();
                        vd1.textContent = '   ';
                        item.add(vd1);
                    }
                });
            }
        },

        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            setTimeout(() => {
                const el: HTMLInputElement = <HTMLInputElement>module.getNode({ name: directive.value });
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

            const el: HTMLInputElement = <HTMLInputElement>module.getNode({ name: directive.value });
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
                } else { //多个校验
                    for (let i = 0; i < chds.length; i++) {
                        let rel = chds[i].getProp('rel');
                        if (rel === vn) {
                            setTip(chds[i], vn, el);
                        } else { //隐藏
                            chds[i].dontRender = true;
                        }
                    }
                }
            } else {
                dom.dontRender = true;
            }

            /**
             * 设置提示
             * @param vd    虚拟dom节点
             * @param vn    验证结果名
             * @param el    验证html element
             */
            function setTip(vd: Element, vn: string, el?: HTMLElement) {
                //子节点不存在，添加一个
                let text = (<string>vd.children[0].textContent).trim();
                if (text === '') { //没有提示内容，根据类型提示
                    text = Util.compileStr(NodomMessage.FormMsgs[vn], el.getAttribute(vn));
                }
                vd.children[0].textContent = text;
            }

            /**
             * 验证名转换
             */
            function handle(arr: Array<string>) {
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
        }
    );

    /**
     * 增加route指令
     */
    DirectiveManager.addType('route',
        10,
        (directive: Directive, dom: Element) => {
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
            } else {
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
            dom.addEvent(new NEvent('click',
                (dom, module, e) => {
                    let path: string = dom.getProp('path');
                    if (Util.isEmpty(path)) {
                        return;
                    }
                    Router.go(path);
                }
            ));
        },

        (directive: Directive, dom: Element, module: Module, parent: Element) => {
            let path: string = dom.getProp('path');
            //添加到router的activeDomMap
            let domArr: string[] = Router.activeDomMap.get(module.id);
            if (!domArr) {
                Router.activeDomMap.set(module.id, [dom.key]);
            } else {
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
                setTimeout(() => { Router.go(path) }, 0);
            }
        }
    );

    /**
     * 增加router指令
     */
    DirectiveManager.addType('router',
        10,
        (directive, dom) => {
            //修改节点role
            dom.setProp('role', 'module');
        },
        (directive, dom, module, parent) => {
            Router.routerKeyMap.set(module.id, dom.key);
        }
    );

    /**
     * 增加ignore指令
     * 只渲染子节点到dom树
     */
    DirectiveManager.addType('ignoreself',
        10,
        (directive, dom) => {
            dom.dontRenderSelf = true;
        },
        (directive, dom, module, parent) => {

        }
    );

    /**
     * 粘指令，粘在前一个dom节点上，如果前一个节点repeat了多个分身，则每个分身都粘上
     * 如果未指定model，则用被粘节点的model
     */
    DirectiveManager.addType('stick',
        10,
        (directive, dom: Element) => {
        },
        (directive, dom, module, parent) => {
        }
    );
    /**
     * 插槽指令
     * 配合slot标签使用
     */
    DirectiveManager.addType('slot',
        3,
        (directive, dom: Element) => {
            dom.setProp('slotName', directive.value);
        },
        (directive, dom, module, parent) => {
        }
    );
}())

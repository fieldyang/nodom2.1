import { Application } from "./application";
import { DirectiveManager } from "./directivemanager";
import { NError } from "./error";
import { MessageQueue } from "./messagequeue";
import { Module } from "./module";
import { ModuleFactory } from "./modulefactory";
import { Renderer } from "./renderer";
import { Route } from "./router";
import { Scheduler } from "./scheduler";
import { IAppCfg, IRouteCfg, IMdlClassObj, ITipMessage } from "./types";
import { Util } from "./util";

export class Nodom{
    static tipMessage:ITipMessage;
    /**
     * 新建一个App
     * @param config 应用配置
     */
    static async newApp(config?:IAppCfg):Promise<Module>{
        if(window['NodomConfig']){
            config = Util.merge({},window['NodomConfig'],config);
        }

        let lang:string = config&&config.language;
        if(!lang){
            lang = navigator.language?navigator.language.substr(0,2):'zh';
        }
        this.tipMessage = eval('(nodom.TipMessagee_' + lang + ')');
        
        if(!config || !config.module){
            throw new NError('config',Nodom.tipMessage.TipWords['application']);
        }

        Application.setPath(config.path);
        
        //模块数组初始化
        if(config.modules){
            await ModuleFactory.addModules(config.modules);
        }

        //消息队列消息处理任务
        Scheduler.addTask(MessageQueue.handleQueue,MessageQueue);
        //渲染器启动渲染
        Scheduler.addTask(Renderer.render,Renderer);
        //启动调度器
        Scheduler.start(config.scheduleCircle);
        
        //存在类名
        let module:Module;
        if(config.module.class){
            module = await ModuleFactory.getInstance(config.module.class,config.module.name,config.module.data);
            module.setSelector(config.module.el);
        }else{
            module = new Module(config.module);
        }
        //设置主模块
        ModuleFactory.setMain(module);
        await module.active();

        if(config.routes){
            this.createRoute(config.routes);
        }
        return module;
    }

    /**
     * 暴露的创建路由方法
     * @param config  数组或单个配置
     */
    static createRoute(config:IRouteCfg|Array<IRouteCfg>):Route {
        if (Util.isArray(config)) {
            for(let item of <Array<IRouteCfg>>config){
                new Route(item);
            }
        } else {
            return new Route(<IRouteCfg>config);
        }
    }

    /**
     * 创建指令
     * @param name      指令名 
     * @param priority  优先级（1最小，1-10为框架保留优先级）
     * @param init      初始化方法
     * @param handler   渲染时方法
     */
    static createDirective(name:string,priority:number,init:Function,handler:Function){
        return DirectiveManager.addType(name,
            priority,
            init,
            handler
        );
    }

    /**
     * 创建模块
     * @param modules 模块配置数组
     */
    static addModules(modules:Array<IMdlClassObj>){
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
    static request(config):Promise<any>{
        return new Promise((resolve, reject) => {
            if(typeof config === 'string'){
                config = {
                    url:config
                }
            }
            config.params = config.params || {};
            //随机数
            if(config.rand) { //针对数据部分，仅在app中使用
                config.params.$rand = Math.random();
            }
            let url:string = config.url;
            const async:boolean = config.async === false ? false : true;
            const req:XMLHttpRequest = new XMLHttpRequest();
            //设置同源策略
            req.withCredentials = config.withCredentials;
            //类型默认为get
            const method:string = (config.method || 'GET').toUpperCase();
            //超时，同步时不能设置
            req.timeout = async ?config.timeout: 0;

            req.onload = () => {
                if (req.status === 200) {
                    let r = req.responseText;
                    if (config.type === 'json') {
                        try {
                            r = JSON.parse(r);
                        } catch (e) {
                            reject({ type: "jsonparse" });
                        }
                    }
                    resolve(r);
                } else {
                    reject({ type: 'error', url: url });
                }
            }

            req.ontimeout = () => reject({ type: 'timeout' });
            req.onerror = () => reject({ type: 'error', url: url });
            //上传数据
            let data = null;
            switch (method) {
            case 'GET':
                //参数
                let pa:string;
                if (Util.isObject(config.params)) {
                    let ar:string[] = [];
                    Util.getOwnProps(config.params).forEach(function (key) {
                        ar.push(key + '=' + config.params[key]);
                    });
                    pa = ar.join('&');
                }
                if (pa !== undefined) {
                    if (url.indexOf('?') !== -1) {
                        url += '&' + pa;
                    } else {
                        url += '?' + pa;
                    }
                }
                
                break;
            case 'POST':
                if(config.params instanceof FormData){
                    data = config.params;
                }else{ 
                    let fd:FormData = new FormData();
                    for (let o in config.params) {
                        fd.append(o, config.params[o]);
                    }
                    data = fd;
                }
                break;
            }

            req.open(method, url, async, config.user, config.pwd);
            //设置request header
            if(config.header){
                Util.getOwnProps(config.header).forEach((item)=>{
                    req.setRequestHeader(item,config.header[item]);
                })
            }
            req.send(data);
        }).catch((re) => {
            switch (re.type) {
            case "error":
                throw new NError("notexist1", Nodom.tipMessage.TipWords['resource'], re.url);
            case "timeout":
                throw new NError("timeout");
            case "jsonparse":
                throw new NError("jsonparse");
            }
        });
    }
}

var nodom = Nodom;
var $ = nodom;
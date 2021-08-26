/**
 * 模块A
 */
class ModuleA extends nodom.Module {
    constructor(cfg) {
        let config = nodom.Util.merge(cfg, {
            template: `
                <slot name='title'></slot>
                <slot name='btn1'>
                <button e-click='sendMsg'>发送</button>
                </slot>
                <slot name='picture'> picture</slot>  
                <ul>
                    <li x-repeat='foods' class='item'>{{name}}</li>
                </ul>
                <div>  title:{{add}}</div>
            `,
            requires:[{type:'css',url:'index.css'}],
            methods: {
                addData: function (dom,module) {
                    if(module.renderTree.props.peak){
                        const {peak} =module.renderTree.props;
                        peak(3);
                    }
                    console.log(module.renderTree.props);
                    // model.data.foods.push({ id: 4, name: '烤羊蹄', price: '58' });
                },
                sendMsg: function (dom, model, module) {
                   this.add++;
                },
                onFirstRender:function(module){
                   
                  
                 
                },
                addStore:function(dom,module){
                    const {
                        store
                    } = module;

                    store.dispatch({
                        type: 'add'
                    });


                },
                delStore:function(dom,module){
                    const {
                        store
                    } = module;

                    store.dispatch({
                        type: 'del'
                    });
                },
                subscribe:function(){
                    console.log('订阅了消息');
                    nodom.MessageManager.subscribe('add',(type,data)=>{
                        this['add']=data;
                    });
                },
                add(){
                    console.log('add',this);
                },
                onBeforeFirstRender:function(){
                   
                 },
            },
            data:{
                foods:[
                    {name:'duck'},
                    {name:'fish'}
                ],
                add:0
            }
        });
        super(config);
    }
    add=()=>{
        console.log(this);
    }
}
//# sourceMappingURL=modulea.js.map

/**
 * 模块A
 */
 class Store extends nodom.Module {
    constructor(cfg) {
        let config = nodom.Util.merge(cfg, {
            template: `
                <span>我是Store模块</span>
                <button e-click='add'>Store模块:加计数</button>
                <button e-click='del'>Store模块:减计数</button>
                {{add}}
                <button e-click='click'>点击</button>
                <slot  name='props'></slot>
            `,
            // requires:[{type:'css',url:'index.css'}],
            methods: {
                onBeforeFirstRender:function(){
                   nodom.MessageManager.subscribe('add',(type,data)=>{
                    this['add']=data;
                });
                },
                add(dom,module){
                   const {store} = module;
                   store.dispatch({
                       type:'add'
                   })
                },
                del(dom,module){
                    const {store} = module;
                    store.dispatch({
                        type:'del'
                    })
                 },
                 click(dom,module){
                     console.log(this,dom,module);
                 },
                 showProps(dom,module){
                   const {title,num} =  module.props;
                   console.log('title:'+title,'num:'+num);
                 },
                 add(dom,module){
                    const {add} =  module.props;
                    add(this.add);
                 }
            },
            data:{
                foods:[
                    {name:'duck'},
                    {name:'fish'}
                ],
                add:2
            }
        });
        super(config);
    }
    add=()=>{
        console.log(this);
    }
}
//# sourceMappingURL=modulea.js.map
/**
 * 模块A
 */
class ModuleA extends nodom.Module {
    constructor(cfg) {
        let config = nodom.Util.merge(cfg, {
            template: `
                <slot name='title'></slot>
                <slot name='btn1'>
                <button e-click='sendMsg'> 发送</button></slot>
                <button e-click='addData'>添加</button>
                <slot name='picture'> picture</slot>  
                <ul>
                    <li x-repeat='foods' class='item'>{{name}}</li>
                </ul>
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
                    module.send('modb1', 'hello',1);
                },
                onFirstRender:function(module){
                   
                    // if(module.renderTree.props.peak){
                    //     const {peak} =module.renderTree.props; 
                    //     peak(1);
                    // }
                 
                },
                add(){
                    console.log('add',this);
                }
            },
            data:{
                foods:[
                    {name:'duck'},
                    {name:'fish'}
                ]
            }
        });
        super(config);
    }
    add=()=>{
        console.log(this);
    }
}
//# sourceMappingURL=modulea.js.map
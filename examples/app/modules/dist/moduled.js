/**
 * 模块A
 */
class ModuleD extends nodom.Module {
    constructor(cfg) {
        let config = nodom.Util.merge(cfg, {
            template: `
                <button e-click='addData'>添加</button>
                <ul>
                    <li x-repeat='foods'>{{name}}</li>
                </ul>
            `,
            methods: {
                addData: function (model) {
                    model.data.foods.push({ id: 4, name: '烤羊蹄', price: '58' });
                },
                onBeforeFirstRender:function(){
                    nodom.MessageManager.subscribe(TYPE_ADD||'add',(type,data)=>{
                     this['add']=data;
                 });
                 },
            }
        });
        super(config);
    }
}
//# sourceMappingURL=moduled.js.map
/**
 * 模块A
 */
class ModuleC extends nodom.Module {
    constructor(cfg) {
        let config = nodom.Util.merge(cfg, {
            template: 'c.html',
            data: {
                from: '',
                msg: '发送消息',
                msg1: '',
            },
            methods: {
                sendMsg: function (dom, model, module) {
                    console.log(this.name);
                   
                     this.type++;
                     this.data++;
                     this.name++;
                     setTimeout(() => {
                         this.keys='as';
                     }, 2000);
                   
                },
                sendParent: function (dom, module) {
                    // module.send('modb1', model.data.msg,2);
                    console.log(module.renderTree.props);
                    if(module.renderTree.props.update){
                        const {update} =module.renderTree.props;
                        update('我来自c模块');
                    }
                },
                onReceive: function (model, from, msg) {
                    console.log(model);
                    model.set('msg1', msg);
                    model.set('from', from);
                }
            }
        });
        super(config);
    }
}
//# sourceMappingURL=modulec.js.map
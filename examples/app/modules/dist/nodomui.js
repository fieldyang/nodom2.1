var nodomui = (function (exports, nodom) {
	"use strict";

	// import { Compiler, DefineElementManager, Directive, Element } from 'nodom';
	// /**
	//  let ui = new UIText({
	//             dataName: 'data',
	//             icon: 'search',
	//             iconpos: ICONPOS.RIGHT
	//         })
	//  */
	// interface IUIText extends Object {
	//     /**
	//    * select绑定的数据字段名
	//    */
	//     dataName: string;
	//     /**
	//      * 图标
	//      */
	//     icon?: string;
	//     /**
	//      * 图标位置 left,right
	//      */
	//     iconpos?: ICONPOS;
	// }
	// export class UIText extends pluginBase {
	//     tagName: string = 'UI-TEXT'
	//     /**
	//      * select绑定的数据字段名
	//      */
	//     dataName: string;
	//     /**
	//      * 绑定的value值
	//      */
	//     value: string;
	//     /**
	//      * 图标
	//      */
	//     icon: string;
	//     /**
	//      * 图标位置 left,right
	//      */
	//     iconpos: ICONPOS;
	//     constructor(params: Element | IUIText, parent?: Element) {
	//         super(params);
	//         let element = new Element();
	//         if (params instanceof Element) {
	//             element = params;
	//             UITool.handleUIParam(element, this,
	//                 ['icon', 'iconpos'],
	//                 ['icon', 'iconPos'],
	//                 ['', 'left']
	//             );
	//             this.generate(element, true);
	//         } else {
	//             Object.keys(params).forEach(key => {
	//                 this[key] = params[key]
	//             })
	//             this.generate(element, false);
	//         }
	//         element.tagName = 'div';
	//         element.defineEl = this;
	//         this.element = element;
	//     }
	//     /**
	//     * 生成插件的内容
	//     * @param rootDom 插件产生的虚拟dom
	//     * @param genMode 生成虚拟dom的方式，true:ast编译的模板的方式，false:传入配置对象的方式
	//     */
	//     private generate(element: Element, genMode: boolean) {
	//         element.addClass('nd-text');
	//         let input: Element = new Element('input');
	//         input.setProp('type', 'text');
	//         element.add(input);
	//         if (genMode === false) {
	//             let field = this.dataName;
	//             new Directive('field', field, input);
	//             if (this.value && this.value !== '') {
	//                 let expr = Compiler.compileExpression(this.value);
	//                 if (typeof expr === 'string') {
	//                     input.setProp('value', expr);
	//                 } else {
	//                     input.setProp('value', expr, true);
	//                 }
	//             }
	//         } else {
	//             let field = element.getDirective('field');
	//             new Directive('field', field.value, input);
	//             // 设置value值
	//             let vProp = element.getProp('value');
	//             if (!vProp) {
	//                 vProp = element.getProp('value', true);
	//                 input.setProp('value', vProp, true);
	//             } else {
	//                 input.setProp('value', vProp);
	//             }
	//         }
	//         //清除rootDom的指令和事件
	//         element.removeDirectives(['field']);
	//         element.events.clear();
	//         if (this.icon !== '') {
	//             let icon: Element = new Element('b');
	//             icon.addClass('nd-icon-' + this.icon);
	//             if (this.iconpos === 'left') {
	//                 icon.addClass('nd-text-iconleft');
	//                 element.children.unshift(icon);
	//             } else {
	//                 element.add(icon);
	//             }
	//         }
	//     }
	// }
	// DefineElementManager.add('UI-TEXT', {
	//     init: function (element: Element, parent?: Element) {
	//         new UIText(element, parent);
	//     }
	// })
	class UIText extends nodom.Module {
		constructor(cfg) {
			super(
				nodom.Util.merge(cfg, {
					template: `
                <input class='nd-text' x-field='value' />
            `,
					data: {
						onBeforeFirstRender: function (module) {
							if (module.props.value) {
								this.value = module.props.value;
							} else {
								throw new nodom.NError("没有传递名字为value的props");
							}
						},
					},
				})
			);
		}
	}
	nodom.DefineElementManager.add("UI-TEXT", {
		init: function (element, parent) {
			new nodom.Directive("module", "UIText", element, parent);
		},
	});

	exports.UIText = UIText;

	Object.defineProperty(exports, "__esModule", { value: true });

	return exports;
})({}, nodom);
//# sourceMappingURL=nodomui.js.map

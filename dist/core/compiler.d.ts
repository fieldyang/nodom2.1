import { Element } from "./element";
import { ASTObj } from "./types";
export declare class Compiler {
    /**
    * 编译
    * @param elementStr    待编译html串
    * @returns             虚拟dom
    */
    static compile(elementStr: string): Element;
    /**
     * 把AST编译成虚拟dom
     * @param oe 虚拟dom的根容器
     * @param ast 抽象语法树也就是JSON对象
     * @returns oe 虚拟dom的根容器
     */
    static compileAST(oe: Element, ast: Array<ASTObj>): Element;
    /**
     * 编译text类型的ast到虚拟dom
     * @param parent 父虚拟dom节点
     * @param ast 虚拟dom树
     */
    private static handleAstText;
    /**
     *
     * @param oe 虚拟dom
     * @param astObj
     */
    static handleAstNode(parent: Element, astObj: ASTObj): void;
    /**
     * 编译ast 到虚拟dom
     * @param oe        虚拟dom
     * @param attrs     需要编译成虚拟dom的attrs
     * @param parent    父虚拟dom节点
     */
    static handleAstAttrs(oe: Element, attrs: Array<{
        propName: string;
        value: any;
    }>, parent: Element): void;
    /**
     * 处理属性字符串
     * @param attrString 属性字符串
     * @returns attrs数组
     */
    private static parseAttrString;
    /**
     * 将模板字符串转换成AST抽象语法树结构
     * @param elementStr 模板字符串
     * @returns AST对象数组
     */
    private static compileTemplateToAst;
    /**
     * 处理表达式串
     * @param exprStr   含表达式的串
     * @return          处理后的字符串和表达式数组
     */
    static compileExpression(exprStr: string): string | any[];
}

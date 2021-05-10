import { FilterManager } from "./filtermanager";
import { ModuleFactory } from "./modulefactory";
import { Util } from "./util";
/**
 * 表达式类
 */
export class Expression {
    /**
     * @param exprStr	表达式串
     */
    constructor(exprStr) {
        /**
         * 字符串替换map
         */
        this.replaceMap = new Map();
        this.fields = []; // 字段数组
        this.id = Util.genId();
        let execStr;
        if (exprStr) {
            execStr = this.compile(exprStr);
        }
        if (execStr) {
            let v = this.fields.length > 0 ? ',' + this.fields.join(',') : '';
            execStr = 'function($module' + v + '){return ' + execStr + '}';
            this.execFunc = eval('(' + execStr + ')');
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
        //字符串正则表达式
        let stringReg = [/\".*?\"/, /'.*?'/, /`.*?`/];
        let quotReg = [/\\"/g, /\\'/g, /\\`/g];
        let quotStr = ['$$$$NODOM_QUOT1', '$$$$NODOM_QUOT2', '$$$$NODOM_QUOT3'];
        //字符串替换map {$$NODOM_TMPSTRn:str,...}
        let srcStr = exprStr;
        let replaceIndex = 0;
        //去掉内部 \" \' \`
        for (let i = 0; i < 3; i++) {
            srcStr = srcStr.replace(quotReg[i], quotStr[i]);
        }
        //替换字符串
        for (;;) {
            let r;
            for (let reg of stringReg) {
                let r1 = reg.exec(srcStr);
                if (!r1) {
                    continue;
                }
                if (!r || r.index > r1.index) {
                    r = r1;
                }
            }
            if (!r) {
                break;
            }
            let sTmp = Expression.REP_STR + replaceIndex++;
            //存入map
            this.replaceMap.set(sTmp, r[0]);
            //用替代串替换源串内容srcStr
            srcStr = srcStr.substr(0, r.index) + sTmp + srcStr.substr(r.index + r[0].length);
        }
        //去掉空格
        srcStr = srcStr.replace(/\s+/g, '');
        //按操作符分组
        //操作数数组
        let arrOperator = srcStr.split(/[\(\)\!\|\*\/\+\-><=&%]/);
        //操作符数组
        let arrOperand = [];
        let index = 0;
        for (let sp of arrOperator) {
            index += sp.length;
            let ch = srcStr.charAt(index++);
            if (ch !== '') {
                arrOperand.push(ch);
            }
        }
        return this.genExecStr(arrOperator, arrOperand);
    }
    /**
     * 生成执行串
     * @param arrOperator   操作数数组
     * @param arrOperand    操作符数组
     * @returns             指令执行字符串
     */
    genExecStr(arrOperator, arrOperand) {
        let retStr = '';
        for (; arrOperator.length > 1;) {
            //操作数
            let opr = arrOperator.pop();
            //操作符
            let opd = arrOperand.pop();
            let r;
            let handled = false;
            if (opd === '(') {
                r = this.judgeAndHandleFunc(arrOperator);
                if (r !== undefined) {
                    //模块方法,挨着方法名的那个括号不需要
                    if (r.startsWith('$module')) {
                        opd = '';
                    }
                    if (opr !== '' && !this.addField(opr)) {
                        opr = this.recoveryString(opr);
                    }
                    retStr = r + opd + opr + retStr;
                    //函数作为一个整体操作数，把前一个操作符补上
                    if (arrOperand.length > 0) {
                        retStr = arrOperand.pop() + retStr;
                    }
                    handled = true;
                }
            }
            else if (opd === '|') {
                r = this.judgeAndHandleFilter(arrOperator, arrOperand, opr);
                if (r !== undefined) {
                    retStr = (arrOperand.length > 0 ? arrOperand.pop() : '') + r + retStr;
                    handled = true;
                }
            }
            if (!handled) {
                if (!this.addField(opr)) {
                    //还原字符串
                    opr = this.recoveryString(opr);
                }
                retStr = opd + opr + retStr;
            }
        }
        //第一个
        if (arrOperator.length > 0) {
            let opr = arrOperator.pop();
            if (opr !== '') {
                if (!this.addField(opr)) {
                    //还原字符串
                    opr = this.recoveryString(opr);
                }
                retStr = opr + retStr;
            }
        }
        return retStr;
    }
    /**
 * 还原字符串
 * 从$$NODOM_TMPSTR还原为源串
 * @param str   待还原字符串
 * @returns     还原后的字符串
 */
    recoveryString(str) {
        if (str.startsWith(Expression.REP_STR)) {
            if (this.replaceMap.has(str)) {
                str = this.replaceMap.get(str);
                str = str.replace(/\$\$NODOM_QUOT1/g, '\\"');
                str = str.replace(/\$\$NODOM_QUOT2/g, "\\'");
                str = str.replace(/\$\$NODOM_QUOT3/g, '\\`');
            }
        }
        return str;
    }
    /**
     * 判断并处理函数
     * @param arrOperator   操作数数组
     * @returns             转换后的串
     */
    judgeAndHandleFunc(arrOperator) {
        let sp = arrOperator[arrOperator.length - 1];
        if (sp && sp !== '') {
            //字符串阶段
            arrOperator.pop();
            //module 函数
            if (sp.startsWith('$')) {
                return '$module.methodNFactory.get("' + sp.substr(1) + '").call($module,';
            }
            else {
                return sp;
            }
        }
    }
    /**
     * 判断并处理过滤器
     * @param arrOperator   操作数数组
     * @param arrOperand    操作符数组
     * @param srcOp         前操作数
     * @returns             过滤器串
     */
    judgeAndHandleFilter(arrOperator, arrOperand, srcOp) {
        //判断过滤器并处理
        if (srcOp.startsWith(Expression.REP_STR) || Util.isNumberString(srcOp)) {
            return;
        }
        let sa = FilterManager.explain(srcOp);
        //过滤器
        if (sa.length > 1 || FilterManager.hasType(sa[0])) {
            let ftype = sa[0];
            sa.shift();
            //参数如果不是数字，需要加上引号
            sa.forEach((v, i) => {
                v = this.recoveryString(v);
                if (!Util.isNumberString(v)) {
                    sa[i] = '"' + v.replace(/"/g, '\\"') + '"';
                }
            });
            //过滤器参数串
            let paramStr = sa.length > 0 ? ',' + sa.join(',') : '';
            //过滤器待处理区域
            let filterValue = '';
            let opr = arrOperator[arrOperator.length - 1];
            if (opr !== '') { //过滤字段或常量
                if (!this.addField(opr)) {
                    opr = this.recoveryString(opr);
                }
                filterValue = opr;
                arrOperator.pop();
            }
            else if (arrOperand.length > 2 && arrOperand[arrOperand.length - 1] === ')') { //过滤器待处理部分带括号
                let quotNum = 1;
                let a1 = [arrOperator.pop()];
                let a2 = [arrOperand.pop()];
                for (let i = arrOperand.length - 1; i >= 0; i--) {
                    if (arrOperand[i] === '(') {
                        quotNum--;
                    }
                    else if (arrOperand[i] === ')') {
                        quotNum++;
                    }
                    a1.unshift(arrOperator.pop());
                    a2.unshift(arrOperand.pop());
                    if (quotNum === 0) {
                        //函数名
                        a1.unshift(arrOperator.pop());
                        break;
                    }
                }
                filterValue = this.genExecStr(a1, a2);
            }
            return 'nodom.FilterManager.exec($module,"' + ftype + '",' + filterValue + paramStr + ')';
        }
    }
    /**
     * 表达式计算
     * @param model 	模型 或 fieldObj对象
     * @returns 		计算结果
     */
    val(model) {
        let module = ModuleFactory.get(model.$moduleId);
        if (!model) {
            model = module.model;
        }
        let valueArr = [];
        this.fields.forEach((field) => {
            valueArr.push(getFieldValue(module, model, field));
        });
        //module作为第一个参数
        valueArr.unshift(module);
        let v;
        try {
            v = this.execFunc.apply(null, valueArr);
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
            'instanceof', 'NaN'];
        if (field === '' || jsKeyWords.includes(field) || field.startsWith(Expression.REP_STR) || Util.isNumberString(field)) {
            return false;
        }
        //多级字段只保留第一级，如 x.y只保留x
        let ind;
        if ((ind = field.indexOf('.')) !== -1) {
            field = field.substr(0, ind);
        }
        if (!this.fields.includes(field)) {
            this.fields.push(field);
        }
        return true;
    }
}
//替代串
Expression.REP_STR = '$$NODOM_TMPSTR';
//# sourceMappingURL=expression.js.map
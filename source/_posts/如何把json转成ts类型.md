---
title: 如何把json转成ts类型
date: 2022-07-04 10:05:11
tags:
  - 工具
  - 源码
---

Github: https://github.com/ChpShy/json2ts  
体验地址：https://chpshy.github.io/json2ts/index.html

## 介绍
在项目慢慢接入`vue3`之后，面临了一个问题，要不要定义 ts 类型呢，还是快乐的做一个 as 开发人员。用吧，类型太多，定义起来开发效率太低；不用吧，很多提示又没了，而且以后别人维护起来，不利于代码阅读(全是any)。本着负责任(装逼)的态度，还是想着加上。

但是后端接口返回的咋办呢？他们倒是有接口文档，但是有些字段实在是多，copy起来也累呀。想着找一个直接能把后端文档里的 json 直接转成 ts 类型的工具。但是找了几个都太依赖 json 格式了，比如 key 值必须带双引号，而且很多不能解析数组。这让不规范的后端文档转换起来太难了，还得检查一番格式，全加上双引号。。。

所以就想着自己开发一个玩玩吧。整体思路是，通过`编译原理`把 json 先转成 `ast` ，在 `trasform` 成想要的格式，最后`生成`代码。

![json2ts.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/54014a1a02bc486c8db4b4c0622a9cc7~tplv-k3u1fbpfcp-watermark.image?)

项目使用了[vitest](https://github.com/vitest-dev/vitest) 做测试工具，确实非常好用

## 特点

- 支持`null`、`undefined`、`boolean`、`string`、`number`、`object`、`array`
- 支持`key`值带双引号、单引号或不带任何符号
- 支持对象抽离
- ...

为了更好的解析后端文档的数据模型，甚至 `value` 值后面没有逗号也行！

## 实现方案

### parse
首先是要将数据模型解析成`ast`。首先是入口，开始解析`{xxx}`
```javascript
function parseChildren(context: ParserContext) {
  const nodes: AstChildNode[] = [];
  while(!isEnd(context)) {
    advanceSpaces(context);
    const s = context.source;
    // 新的一行
    if (s[0] === '{') {
      advanceBy(context, 1);
    } else if (s[0] === '}') {
      advanceBy(context, 1);
      advanceSpaces(context);
      return nodes;
    } else if (s[0] === '/') {
        // 解析注释， 因为有行内注释和换行注释，所以需要判断下解析完注释之后行数和上一个key: value数据的结尾行是不是一样。
      if (s[1] === '/') {
        const lastNode = nodes[nodes.length - 1];
        let lastLine = -1;
        if (lastNode) {
          lastLine = lastNode.loc.end.line;
        }
        const currLine = getCursor(context).line;
        nodes.push(parseComment(context, currLine === lastLine));
        advanceSpaces(context);
      } else {
        throw new Error('错误的备注')
      }
    } else {
      // 解析key: value 模型
      nodes.push(parseData(context));
    }
  }
  return nodes;
}
```
`parseData`主要是把 `key: value`数据解析成`{key: 'key', value: 'value', type: 'string'}`
```javascript
function parseData(context: ParserContext, keyName?: string) {
  advanceSpaces(context);
  const start = getCursor(context);
  const key = keyName || parseKey(context);
  const { value, type } = parseValue(context);
  const loc = getLoc(context, start);
  advanceSpaces(context);
  if (context.source[0] === ',') {
    advanceBy(context, 1);
    advanceSpaces(context);
  }
  return {key, value, type, loc: loc};
}

function parseKey(context: ParserContext) {
  const s = context.source[0];
  let match = [];
  // "xxx" 类型的key
  if (s === '"') {
    match = /^"(.[^"]*)/i.exec(context.source);
  } else if (s === `'`) {
    // 'xxx' 类型的key
    match = /^'(.[^']*)/i.exec(context.source);
  } else {
    // xxx:  类型的key
    match = /(.[^:]*)/i.exec(context.source);
    match[1] = match[1].trim();
  }
  // 去掉末尾的" 或 ' 或 :
  advanceBy(context, match[0].length + 1);
  advanceSpaces(context);
  // 去掉 " 和 ' 后面的冒号
  if (context.source[0] === ':') {
    advanceBy(context, 1);
    advanceSpaces(context);
  }
  return match[1];
}

function parseValue(context: ParserContext) {
  let value = null;
  let type = null;
  let code = context.source[0];
  if (/^[0-9]/.test(code)) {
   // number 类型
    value = parseNumber(context);
    type = NUMBER_TYPE;
  } else if (code === '"' || code === '\'') {
  // sring类型
    value = parseString(context);
    type = STRING_TYPE;
  } else if (code === '[') {
  // 数组类型
    advanceBy(context, 1);
    value = parseArray(context);
    type = ARRAY_TYPE;
  } else if (code === '{') {
  // 对象类型，使用递归继续解析
    value = parseChildren(context);
    type = OBJECT_TYPE;
  } else if (context.source.indexOf('null') === 0) {
  // null 类型
    value = parseNull(context);
    type = NULL_TYPE;
  } else if (context.source.indexOf('true') === 0 || context.source.indexOf('false') === 0) {
  // 布尔类型
    value = parseBoolean(context);
    type = BOOLEAN_TYPE;
  } else if (context.source.indexOf('undefined') === 0) {
  // undefined类型
    value = parseUndefined(context);
    type = UNDEFINED_TYPE;
  }
  return {
    value,
    type
  }
}
```
不同类型的具体处理方法就不列出来了。大家感兴趣的话可以去源码里看。最后生成下列格式的`ast`。
```javascript

{
  "a": 123,
  "b": {
    "c": "123"
  },
  d: [1, 2, 3]
} 

=>

{
    "key": "root",
    "type": "Root",
    "value": [
    {
        "key": "a",
        "value": "123",
        "type": "number",
        "loc": { ... }
    },
    {
        "key": "b",
        "value": [{
            "key": "c",
            "value": "123",
            "type": "string",
            "loc": { ... }
        }],
        "type": "Object",
        "loc": { ... }
    },
    {
        "key": "d",
        "value": [{
            "key": "$ARRAY_ITEM$",
            "value": "1",
            "type": "number",
            "loc": { ... }
        },
        {
            "key": "$ARRAY_ITEM$",
            "value": "2",
            "type": "number",
            "loc": { ... }
        },
        {
            "key": "$ARRAY_ITEM$",
            "value": "3",
            "type": "number",
            "loc": { ... }
        }],
        "type": "Array",
        "loc": { ... }
    }]
}
```
### transform
因为最后`generate`是需要把各个`type`递归组合成`code`，所以`transform`主要是对type做了一层提取和简单的处理，如数组的重复类型去除。

先写一个`traverser`函数，通过`visitor`模式去访问`ast`。visitor的格式为：`{ string: { entry(node, parent) {}, exit(node, parent){} } }`
```javascript
function traverser(ast: AstChildNode, visiter: Visiter) {
  let root = visiter.Root;
  if (root) {
    root.entry && root.entry(ast, null);
  }
  traverseNode((ast.value as AstChildNode[]), ast, visiter);
  if (root) {
    root.exit && root.exit(ast, null);
  }
  return ast;
}
function traverseNode(nodes: AstChildNode[], parent: AstChildNode, visiter: Visiter) {
  nodes.forEach(node => {
    let visit = visiter[node.type];
    if (visit) {
      visit.entry && visit.entry(node, parent);
    }
    if (isArray(node.value)) {
      traverseNode(node.value, node, visiter);
    }
    if (visit) {
      visit.exit && visit.exit(node, parent);
    }
  })
}
```
然后就是对不同类型做提取和处理，这里利用对象引用类型特性，生成类型树`typeValue`，绑定在`ast`的根节点上:
```javascript
function transform(ast: AstChildNode, options?: CompileOptions) {
  traverser(ast, {
    [STRING_TYPE]: {
      entry(node, parent) {
        if (node.key === ARRAY_ITEM) {
          parent.typeValue = parent.typeValue || [];
          (parent.typeValue as Array<string | Object>).push(node.type);
        } else {
          parent.typeValue = parent.typeValue || {};
          parent.typeValue[node.key] = node.type;
        }
      }
    },
    [OBJECT_TYPE]: {
      entry(node, parent) {
        if (node.key === ARRAY_ITEM) {
          parent.typeValue = parent.typeValue || [];
          node.typeValue = {};
          (parent.typeValue as Array<string | Object>).push(node.typeValue);
        } else {
          parent.typeValue = parent.typeValue || {};
          parent.typeValue[node.key] = node.typeValue = {};
        }
      }
    },
    [ARRAY_TYPE]: {
      entry(node, parent) {
        if (node.key === ARRAY_ITEM) {
          parent.typeValue = parent.typeValue || [];
          node.typeValue = [];
          (parent.typeValue as Array<string | Object>).push(node.typeValue);
        } else {
          parent.typeValue = parent.typeValue || {};
          parent.typeValue[node.key] = node.typeValue = [];
        }
      }
    },
    ...
  });
  return ast;
}
```
`transform`之后的`ast`为：
```javascript
{
    key: "root",
    type: "Root",
    
    typeValue: {
      a: "number",
      b: { c: "string" },
      d: [ "number", "number", "number" ]
    },
    
    value: [ ... ]
  }
```

### generate
最后就是`typeValue`生成最后代码：
```javascript
function gen(typeValue: Record<string, string | Object> | Array<string | Object>) {
    let code = `{\n`;
    for (const key in typeValue) {
      const type = typeValue[key];
      code += this.genKey(key);
      if (isObject(type)) {
      // 处理对象
        code += this.genObjcet(key, type);
      } else if (isArray(type)) {
      // 处理数组
        code += this.options.parseArray ? this.genArray(key, type) : 'Array<any>';
      } else {
        code += type;
      }
      if (this.options.semicolon) {
        code += ';';
      }
      code += '\n';
    }
    code += `}\n`;
    return code;
  }
  // 处理对象
 function genObjcet(key:string, type: Record<string, string | Object>) {
    let code = '';
    // 递归gen
    const objType = this.gen(type);
    if (this.options.spiltType) {
    // 这里是分离splitType的配置，即是否把子对象抽离成单独的 type 类型，抽离出来的类型会放在vars，给code绑定的只是变量名，如 type NameType = { ... }; type Result = { name: NameType }
      const varName = this.genName(key);
      this.vars += `type ${varName} = ${objType};\n`;
      code += varName;
    } else {
      code += objType;
    }
    return code;
  }
// 处理数组
 function genArray(key: string, types: Array<any>) {
    let code = `Array< `;
    // 使用 set 过滤重复类型
    const arrTypes = new Set();
    types.forEach(type => {
      if (isArray(type)) {
      // 递归数组
        arrTypes.add(this.genArray(key, type));
      } if (isObject(type)) {
      // 递归对象
        arrTypes.add(this.genObjcet(key, type));
      } else {
      // 普通类型
        arrTypes.add(type);
      }
    });
    code += Array.from(arrTypes).join(' | ');
    code += ' >';
    return code;
  }
```

## 最后
目前基本满足了常见的数据转换生成，但是仍然还有许多功能需要继续完善，部分列在了github的`todolist.md`中，欢迎大家一起来完善。

也欢迎大家在评论区留下你们的建议和想法。



---
title: vue3-新特性
date: 2022-07-04 10:02:09
tags:
  - vue3
  - 源码
---

## 前言

vue3.0出了很多新的特性，也做了很多优化。就光性能这块，尤大大直播的时候就给出了数据，update性能提升了1.3-2倍，ssr提升了2-3倍。本篇总结了比较突出的一些新的特性，同时会带上其实现原理

## 新的响应式

vue3使用了`proxy`重写了响应式这部分，除了解决原`Object.defineProperty`不支持的部分，也做了一个懒递归的优化。

详情可看[vue3.0系列—响应式](https://juejin.cn/post/6934575738678951949)

## tree-shaking

vue3源码中export的不再是一个`vue`，而是一个个功能函数：

``` js
export { computed } from './apiComputed'
```

ES6 module 特点：
- 只能作为模块顶层的语句出现
- import 的模块名只能是字符串常量
- import binding 是 immutable的

ES6模块依赖关系是确定的，和运行时的状态无关，可以进行可靠的静态分析，这就是tree-shaking的基础。

利用以上特性，结合编译工具即可实现`tree-shaking`

关于`tree-shaking`的原理，推荐去看下这篇文章，讲的很细: [Tree-Shaking性能优化实践 - 原理篇
](https://juejin.cn/post/6844903544756109319)

## composition api

`composition api`意为组合式api，也是讨论最热的一个功能～

原来所有内容都写在`options`中，`data`中放入数据，`methods`放入方法等等。

现在所有的内容都可以写在`setup`函数中，例如以下写法：
``` js
setup() {
      //todos相关代码
      const state = reactive({
        todos: [
          {id: '1', title: '111', compoleted: true},
          {id: '2', title: '222', compoleted: false},
          {id: '3', title : '333', compoleted: false}
        ],
      })
      function add() {
        state.todos = [
          {id: '2', title: '222', compoleted: false},
          {id: '1', title: '111', compoleted: true},
          {id: '3', title : '333', compoleted: false}
        ]
      }
      
      //num相关代码
      const num = ref(0);
      function addNum() {
       num.value++;
      }
      
      //生命周期相关代码
      onBeforeMount(function() {
        console.log(this, 'app onBeforeMount')
      })
      
      return {state, num, add, addNum}
  }
```
可以看出来，代码层次很清晰，想找一个部分的代码，不需要跳到其他地方去。即解决了**反复横跳**的问题

同时对于公共模块的抽离更加清晰:

``` js
//addTodo.js
import {reactive} from 'vue';

export default function(state) {
    let addFlag = reactive({
        added: true
    })
    function addTodo() {
        state.todos.push({
            id: 4,
            title: '444'
        })
    }
    return {addTodo, addFlag}
}

// app.vue
import addTodo from './addTodo';

setup() {
      //todos相关代码
      const state = reactive({
        todos: [
          {id: '1', title: '111', compoleted: true},
          {id: '2', title: '222', compoleted: false},
          {id: '3', title : '333', compoleted: false}
        ],
      })
      const {addTodo, addFlag} = addTodo();
      function add() {
        state.todos = [
          {id: '2', title: '222', compoleted: false},
          {id: '1', title: '111', compoleted: true},
          {id: '3', title : '333', compoleted: false}
        ]
      }
      
      //num相关代码
      const num = ref(0);
      function addNum() {
       num.value++;
      }
      
      //生命周期相关代码
      onBeforeMount(function() {
        console.log(this, 'app onBeforeMount')
      })
      
      return {state, num, add, addNum, addTodo, addFlag}
  }
```

**相对于vue2中的`mixin`，这种写法更加能清晰的看出数据的来源**

### 实现原理

- 统一入口，`setup`，这是前提
- 在执行`setup`之前，会缓存当前实例，执行完之后清空。所以`setup`里面的函数执行是可以获取到组件实例的。因为生命周期函数是异步的，所以生命周期函数会用闭包原理持久化缓存当前实例
- 将`setup`执行结果赋值在`instance.ctx`上：`instance.ctx.setupState = new Proxy({state, num, add, addNum, addTodo, addFlag}, xxx)`
- 配置`instance.ctx`的响应式代理。例如，获取`ctx.num`时，ctx的代理会检测到这个值在`setupState`上，则返回。修改值也是如此

## 性能优化

尤大大说，vue3的update性能提升了1.3-2倍。主要是因为以下三点：
- 编译优化
    - 编译时添加静态标记
    - 动态props
- 静态提升
- 静态缓存

比如以下的代码:

``` js
//template
<div>
  <div>222</div>
  <div @click=“click">{{name}}</div>
  <div :name="name" ss="sss">{{name}}</div>
</div>
```
[vue3的编译结果](https://vue-next-template-explorer.netlify.app/#%7B%22src%22%3A%22%3Cdiv%3E%5Cn%20%20%3Cp%3Emmmm%3C%2Fp%3E%5Cn%20%20%3Cp%20v-for%3D%5C%22item%20in%20list%5C%22%20%3Akey%3D%5C%22item%5C%22%3EM%3C%2Fp%3E%5Cn%20%20%3Cp%20v-if%3D%5C%22show%5C%22%3EM%3C%2Fp%3E%5Cn%20%20%20%3Cp%20v-else%3Emmmm%3C%2Fp%3E%5Cn%3C%2Fdiv%3E%22%2C%22ssr%22%3Afalse%2C%22options%22%3A%7B%22mode%22%3A%22module%22%2C%22prefixIdentifiers%22%3Afalse%2C%22optimizeImports%22%3Atrue%2C%22hoistStatic%22%3Atrue%2C%22cacheHandlers%22%3Atrue%2C%22scopeId%22%3Anull%2C%22inline%22%3Afalse%2C%22ssrCssVars%22%3A%22%7B%20color%20%7D%22%2C%22bindingMetadata%22%3A%7B%22TestComponent%22%3A%22setup-const%22%2C%22setupRef%22%3A%22setup-ref%22%2C%22setupConst%22%3A%22setup-const%22%2C%22setupLet%22%3A%22setup-let%22%2C%22setupMaybeRef%22%3A%22setup-maybe-ref%22%2C%22setupProp%22%3A%22props%22%2C%22vMySetupDir%22%3A%22setup-const%22%7D%2C%22optimizeBindings%22%3Afalse%7D%7D):

``` js
import { createVNode, renderList, Fragment, openBlock, createBlock, createCommentVNode } from "vue"

// Binding optimization for webpack code-split
const _createVNode = createVNode, _renderList = renderList, _Fragment = Fragment, _openBlock = openBlock, _createBlock = createBlock, _createCommentVNode = createCommentVNode

const _hoisted_1 = /*#__PURE__*/_createVNode("p", null, "mmmm", -1 /* HOISTED */)
const _hoisted_2 = { key: 0 }
const _hoisted_3 = { key: 1 }

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createBlock("div", null, [
    _hoisted_1,
    (_openBlock(true), _createBlock(_Fragment, null, _renderList(_ctx.list, (item) => {
      return (_openBlock(), _createBlock("p", { key: item }, "M"))
    }), 128 /* KEYED_FRAGMENT */)),
    (_ctx.show)
      ? (_openBlock(), _createBlock("p", _hoisted_2, "M"))
      : (_openBlock(), _createBlock("p", _hoisted_3, "mmmm"))
  ]))
}

// Check the console for the AST
```

大致步骤如下：
- `openBlock`创建一个`currentBlock`数组
- 执行子节点的`createVNode`方法，创建`vnode`，传入`patchFlag`(-1为静态节点，不需要pacth)和`dynamicProps`(动态props)，如果为动态节点，则将该`vnode`存入`currentBlock`中；`dynamicProps`放入`vnode`
- 最后执行`createBlock`，调用`createVNode`创建父节点的`vnode`，将`currentBlock`赋值给该`vnode`的`dynamicChildren`

后续做update的时候，只需要patch `vnode` 的`dynamicChildren`即可。同样的，在patchProps的时候，也只需要处理`dynamicProps`上的值即可

下面看一下相关代码:

**openBlock**
``` js
//openBlock
function openBlock(disableTracking = false) {
  blockStack.push((currentBlock = disableTracking ? null : []))
}
```
**closeBlock**
``` js
//closeBlock
function closeBlock() {
  blockStack.pop()
  currentBlock = blockStack[blockStack.length - 1] || null
}
```
**createVNode**
``` js
//createVNode  去掉了多余的代码
function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  patchFlag: number = 0,
  dynamicProps: string[] | null = null,
  isBlockNode = false
): VNode {

  // encode the vnode type information into a bitmap
  const shapeFlag = isString(type)
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0

  const vnode: VNode = {
    __v_isVNode: true,
    [ReactiveFlags.SKIP]: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    children: null,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  }
  normalizeChildren(vnode, children)
  if (
    shouldTrack > 0 &&
    // avoid a block node from tracking itself
    !isBlockNode &&
    // has current parent block
    currentBlock &&
    // presence of a patch flag indicates this node needs patching on updates.
    // component nodes also should always be patched, because even if the
    // component doesn't need to update, it needs to persist the instance on to
    // the next vnode so that it can be properly unmounted later.
    (patchFlag > 0 || shapeFlag & ShapeFlags.COMPONENT) &&
    // the EVENTS flag is only for hydration and if it is the only flag, the
    // vnode should not be considered dynamic due to handler caching.
    patchFlag !== PatchFlags.HYDRATE_EVENTS
  ) {
    //这里会把vnode放入currentBlock
    currentBlock.push(vnode)
  }
  return vnode
}
```
**createBlock**
``` js
//createBlock
function createBlock(
  type: VNodeTypes | ClassComponent,
  props?: Record<string, any> | null,
  children?: any,
  patchFlag?: number,
  dynamicProps?: string[]
): VNode {
  const vnode = createVNode(
    type,
    props,
    children,
    patchFlag,
    dynamicProps,
    true /* isBlock: prevent a block from tracking itself */
  )
  //将动态节点缓存在dynamicChildren
  vnode.dynamicChildren = currentBlock || (EMPTY_ARR as any)
  //这里会回到上一个父节点的currentBlock，结合下面的代码，指的是
  //该节点如果有动态子节点，那么它自己也肯定是动态节点，所以会将
  //该节点放到它的父节点的blcok中，即作为其父节点的一个动态子节点
  closeBlock()
  if (shouldTrack > 0 && currentBlock) {
    currentBlock.push(vnode)
  }
  return vnode
}
```

## diff算法

vue3中对diff算法这部分也重写了，从vue2的双指针遍历变成了单指针遍历，再加上递增子序列的算法得出最优的move步骤

详见: [diff算法](https://juejin.cn/post/6934706558655791118#heading-5)

## teleport

意为传送，其子节点会传送到对应的节点(`to`指定的节点)内

加了`disabled`会渲染在当前文档流中

``` js
//mmmmm会渲染在body中
<div id="parent">
    <teleport to="body">mmmmm</teleport>
</div>

//mmmmm会渲染在parent中
<div id="parent">
    <teleport to="body" disabled>mmmmm</teleport>
</div>
```

## suspense

意为悬念，配合异步组件使用，渲染内容随异步加载的过程变化

在`AsyncComponent`加载完成之前会渲染`fallback`中的内容，加载完成之后，会渲染`default`的内容

``` js
const AsyncComponent = defineAsyncComponent(() => import('./AsyncComponent'));

<template>
  <Suspense>
    <template #default>
      <AsyncComponent />
    </template>
    <template #fallback>
      Loading ...
    </template>
  </Suspense>
</template>
```
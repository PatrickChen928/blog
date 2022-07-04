---
title: vue3-渲染流程
date: 2022-07-04 10:01:33
tags:
  - vue3
  - 源码
---

> 以下解析基于 vue@3.0.2 版本

**文末有整体的思维导图**

## 前言

渲染器可以说是vue最核心的部分，也是非常复杂的一部分，包括element的渲染、component的渲染、文本的渲染等等，同时vue3也引用了teleport和suspense。本文主要介绍了以下代码最终是如何渲染到浏览器中的。

``` js
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp({
    template: '<div>demo</div><App />',
    components: {App}
})
```

在介绍渲染逻辑之前，先说明一点，vue3.0已经将dom的操作，包括dom上prop的处理(class, style, event, attr)都已经提取到了runtime-dom模块中，而核心的渲染逻辑在runtime-core中，这使得vue3.0很容易在除了浏览器以外的平台渲染，例如小程序，RN等.

## 整体流程

这里简要介绍下前面的流程，详细可结合最后的思维导图去查看源码

- 执行createApp, 创建app实例，包含了use、component、provide等全局方法
- 执行app.mount, 为template创建vnode
- 执行patch

## patch

patch是一切渲染的入口，可以看下相关的代码

- `n1`: 旧的vnode，初次渲染为null，update时需要对比n1 和 n2
- `n2`: 待渲染的新vnode
- `container`: 渲染的容器
- `anchor`: 渲染的相邻节点，n2会渲染在anchor上面，用于定位

``` js
const patch: PatchFn = (n1,n2,container,anchor = null,parentComponent = null,parentSuspense = null,isSVG = false,optimized = false
  ) => {
    // n1存在，且不是相同节点，则卸载n1，直接渲染n2
    if (n1 && !isSameVNodeType(n1, n2)) {
      anchor = getNextHostNode(n1)
      unmount(n1, parentComponent, parentSuspense, true)
      n1 = null
    }

    if (n2.patchFlag === PatchFlags.BAIL) {
      optimized = false
      n2.dynamicChildren = null
    }

    const { type, ref, shapeFlag } = n2
    switch (type) {
      case Text:
        processText(n1, n2, container, anchor)
        break
      case Comment:
        processCommentNode(n1, n2, container, anchor)
        break
      case Static:
        if (n1 == null) {
          mountStaticNode(n2, container, anchor, isSVG)
        } else if (__DEV__) {
          patchStaticNode(n1, n2, container, isSVG)
        }
        break
      case Fragment:
        processFragment(
          n1,
          n2,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponent(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
          ;(type as typeof TeleportImpl).process(
            n1 as TeleportVNode,
            n2 as TeleportVNode,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized,
            internals
          )
        } else if (__FEATURE_SUSPENSE__ && shapeFlag & ShapeFlags.SUSPENSE) {
          ;(type as typeof SuspenseImpl).process(
            n1,
            n2,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized,
            internals
          )
        }
    }
  }
```  

这里主要是根据不同类型调用不同的渲染函数。分为:

- `processText`: 处理文本
- `processCommentNode`: 处理注释
- `mountStaticNode`和`patchStaticNode`，这个主要是渲染通过compile生成的静态html的，用于ssr渲染
- `processFragment`: 处理Fragment
- `processElement`: 处理节点
- `processComponent`: 处理组件
- `type.process`: 处理teleport和suspense

这里主要介绍下`processFragment`、`processElement`、`processComponent`和`teleport`的实现

先列出编译后的代码的样子

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3627d1f1a1a94b70b4e97ed14f2f557c~tplv-k3u1fbpfcp-watermark.image)

## processFragment

`dynamicChildren`是vue3.0新加的特性，在编译过程中，会将动态的children放入dynamicChildren属性中，在patch时，只需要对dynamicChildren中的节点进行patch，而不用管静态节点。比如上面的`_hoisted_1`会跳过patch，具体实现可以参考下一篇文章

``` js
const processFragment = (
    n1: VNode | null,
    n2: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    parentComponent: ComponentInternalInstance | null,
    parentSuspense: SuspenseBoundary | null,
    isSVG: boolean,
    optimized: boolean
  ) => {
    // fragment的开始节点，空的text
    const fragmentStartAnchor = (n2.el = n1 ? n1.el : hostCreateText(''))!
     // fragment的结束节点，空的text。fragment的children会渲染在该区间内
    const fragmentEndAnchor = (n2.anchor = n1 ? n1.anchor : hostCreateText(''))!
    //上图红色标注的就是patchFlag，如果为小于代表是静态节点，不需要patch，dynamicChildren是动态节点
    let { patchFlag, dynamicChildren } = n2
    if (patchFlag > 0) {
      optimized = true
    }
    
    if (n1 == null) {
    // n1 == null，则渲染节点
      hostInsert(fragmentStartAnchor, container, anchor)
      hostInsert(fragmentEndAnchor, container, anchor)
      //这里就是再对每一个child执行patch
      mountChildren(
        n2.children as VNodeArrayChildren,
        container,
        fragmentEndAnchor,
        parentComponent,
        parentSuspense,
        isSVG,
        optimized
      )
    } else {
    //需要patch，且带动态节点，则只需要patch动态节点即可，这是vue3的优化
      if (
        patchFlag > 0 &&
        patchFlag & PatchFlags.STABLE_FRAGMENT &&
        dynamicChildren
      ) {
      // 对每一个动态节点做patch
        patchBlockChildren(
          n1.dynamicChildren!,
          dynamicChildren,
          container,
          parentComponent,
          parentSuspense,
          isSVG
        )
      if (
          n2.key != null ||
          (parentComponent && n2 === parentComponent.subTree)
        ) {
        //这里主要是因为只patch动态节点，那n2的静态节点没有el，后续mount的时候会报错，所以将n1的el赋值给n2.el
          traverseStaticChildren(n1, n2, true /* shallow */)
        }
      } else {
        //v-for生成的fragment是没有dynamicChildren的，因为vue认为每个节点都是block，每个都要做patch
        patchChildren(
          n1,
          n2,
          container,
          fragmentEndAnchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
      }
    }
  }
```

上述过程主要创建了空的text节点，然后将children渲染在空text节点直接，接下来主要看下`patchChildren`的实现

### patchChildren

``` js
const patchChildren: PatchChildrenFn = (
    n1,
    n2,
    container,
    anchor,
    parentComponent,
    parentSuspense,
    isSVG,
    optimized = false
  ) => {
    const c1 = n1 && n1.children
    const prevShapeFlag = n1 ? n1.shapeFlag : 0
    const c2 = n2.children

    const { patchFlag, shapeFlag } = n2
    //patchFlag大于0则代表需要做patch
    if (patchFlag > 0) {
      if (patchFlag & PatchFlags.KEYED_FRAGMENT) {
        //设置了key，则执行diff算法
        patchKeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        return
      } else if (patchFlag & PatchFlags.UNKEYED_FRAGMENT) {
        // 没有key很简单，对每一个child按顺序遍历过去，如果是同一个节点，则做patch，否则卸载旧节点，渲染新节点。
        patchUnkeyedChildren(
          c1 as VNode[],
          c2 as VNodeArrayChildren,
          container,
          anchor,
          parentComponent,
          parentSuspense,
          isSVG,
          optimized
        )
        return
      }
    }
    
    //这里不明白为什么会继续下面的比较，暂时没想到场景
    // children has 3 possibilities: text, array or no children.
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // text children fast path
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        unmountChildren(c1 as VNode[], parentComponent, parentSuspense)
      }
      if (c2 !== c1) {
        hostSetElementText(container, c2 as string)
      }
    } else {
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // prev children was array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // two arrays, cannot assume anything, do full diff
          patchKeyedChildren(
            c1 as VNode[],
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        } else {
          // no new children, just unmount old
          unmountChildren(c1 as VNode[], parentComponent, parentSuspense, true)
        }
      } else {
        // prev children was text OR null
        // new children is array OR null
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          hostSetElementText(container, '')
        }
        // mount new if array
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          mountChildren(
            c2 as VNodeArrayChildren,
            container,
            anchor,
            parentComponent,
            parentSuspense,
            isSVG,
            optimized
          )
        }
      }
    }
  }

```
`todo`: 这里不明白为什么会patchFlag>0后面为什么会继续做判断，暂时没想到场景。有大佬想到对应的场景指导下～

### diff算法

在`patchKeyedChildren`中会进行diff算法，这里和vue2也不太一样，因为代码过多，就补贴代码了，文字表达一下流程

#### vue2.x

vue2采用的是双指针遍历

- 旧children的首节点和新children的首节点是否相同，相同则patch
- 旧尾节点和新尾节点是否相同，相同则patch
- 旧尾节点和新首节点是否相同，相同则patch
- 旧首节点和新尾节点是否相同，相同则patch
- 新节点的key是否在旧的children中。在的话，是否是相同的节点，是的话，就patch，否则创建新的节点；不在的话，创建新节点
- 旧节点或者新节点是否遍历完成，没有的话继续上面的流程
- 遍历完成之后，插入新choldren中未处理的节点和删除旧children多余的节点

#### vue3.x

vue3采用了单指针遍历 + 最长递增子序列的算法

- 头部n个节点相同, 则patch相同的节点
- 尾部n个节点相同，patch尾部相同的节点
- 没有差异节点，且新节点有多余，则mount新节点
- 没有差异节点，且旧节点有多余，则unmount多余的旧节点
- 中间有差异节点
    - 建立新差异节点的key: i（key值和所属下标）的map对象
    - 从左到右遍历旧的差异节点，如果没有在新的差异节点中匹配到则卸载，否则对匹配到的节点做patch。同时生成新差异节点到对应的旧差异节点的index的数组 
    - 新的差异节点和旧的差异节点匹配的节点是按照顺序来的，则不需要移动节点，直接从右往左渲染新节点(根据上一步生成的新旧节点index的对象是否能匹配到旧节点来确认是否是新节点)
    - 如果顺序不匹配，则根据新旧节点的index映射数组，获得最长递增子序列，该递增子序列上的节点不需要移动
    - 从右往左遍历新差异节点的个数，如果该index不在递增子序列中，则代表需要移动，将对应的旧节点移动到该位置

举个例子：

n1:  n k a b c d e f g m

n2:  n k e b a d f c g m

1. patch `n` 和 `k`
2. patch `g` 和 `m`
3. 创建map对象: keyToNewIndexMap = {e: 2, b: 3, a: 4, d: 5, f: 6, c: 7}
4. 对 `a` `b` `c` `d` `e` `f`做patch(节点位置还是还是原来的，只是将节点的属性做更新)。创建数组：newIndexToOldIndexMap = [7, 4, 3, 6, 8, 5]
5. newIndexToOldIndexMap不是递增序列，则算出最长递增子序列：[4, 6, 8], 即`b` `d` `f`三个节点的位置不需要变
6. 然后n2从右往左开始移动节点。
    1. 先将c的位置从5(`b`的后面)挪到`g`的前面；
    2. 因为`f`在递增子序列中，所以`f`不需要动；
    3. 因为`d`在递增子序列中，所以`d`不需要动；
    4. 将`a`挪到`d`的前面
    5. 因为`b`在递增子序列中，所以`b`不需要动；
    6. 最后将`e`挪到`b`的前面即可

## processElement

`processElement`中主要调用了`mountElement`和`patchElement`，前者为渲染过程，后者为更新过程

### mountElement

这块代码比较简单，主要列一下其步骤

- 创建对应的el
- 设置el的content，如果content是文本，则创建文件插入el，如果是数组，则patch每一个child，再次走判断逻辑
- 触发directive的created钩子
- 处理el的props，包括class，style，event等
- 设置el的scopedId
- 触发directive的beforeMount钩子
- 执行transition.beforeEnter(el)
- 将el插入到页面中
- 执行transition.enter(el)
- 触发directive的mounted钩子

### patchElement

- 触发directive的beforeUpdate钩子
- patchProp
    - 这里有一个优化，因为编译时标记了动态prop。可以根据class、style、prop等去特定patch。如果是full_props（存在动态key）则需要做以下全部的patch
- 如果有动态节点，则`patchBlockChildren`，否则需要的话就去`patchChildren`

## processComponent 

这里也分为`mountComponent` 和 `updateComponent`。内容太多，就补贴源码啦

### mountComponent

- createComponentInstance, 创建组件实例。这里会实时绑定emit函数，instance.emit = emit.bind(null, instance)
- setupComponent(instance)，安装组件
    - initProps(instance, props, isStateful, isSSR)
        - 处理prop，赋值到instance.prop和instance.attrs, 没有声明的属性活着emit事件会放到attrs中
        - >这里会对props做响应式处理。在production模式下，这个props会传入到setup的第一个参数中(dev模式会用readonly再包一层)，所以直接在setup中修改props也会触发当前组件的更新，但是不会触发父组件的更新，父组件的值也不会改变
    - initSlots(instance, children), 主要是将slot的内容绑定到instance实例上
    - 创建ctx  (_: instance)的代理， 包含了props、setupResult、data、$开头的内容等的读写代理。
    - 执行setup函数，获得结果。如果结果是函数，则赋值instance.render = setupResult，作为渲染函数。如果是对象，则instance.setupState = proxyRefs(setupResult)。代理结果，做unref处理
- finishComponentSetup
    - 如果还没有render函数，则执行compile，生成render函数
    - applyOptions，这里会处理option的兼容，主要是用新的api去重写 
- setupRenderEffect(`instance.update = effect(function componentEffect() {})`), effect原理可参考[响应式篇](https://juejin.cn/post/6934575738678951949s)
    - 用effect包装渲染函数,如果组件未渲染。走渲染逻辑;如果组件已渲染，走update逻辑

## teleport

- 获取to标记的节点，target
- 在该容器中插入空的text节点，targetAnchor, 同时在teleport原来的位置插入空的text节点mainAnchor
- 如果teleport不是disabled，则将teleport里面的children渲染在target中的targetAnchor之前
- 否则将内容渲染在原来的位置

## 思维导图

![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ba411a899ea74d338b51eeb5633655fe~tplv-k3u1fbpfcp-watermark.image)



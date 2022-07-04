---
title: vue3-插槽
date: 2022-07-04 10:03:55
tags:
  - vue3
  - 源码
---

## 使用方法

用于只有一个插槽的情况：

```html
<!-- todo-button 组件模板 -->
<button class="btn-primary">
  <slot></slot>
</button>

<todo-button>
  <!-- 添加一个Font Awesome 图标 -->
  <i class="fas fa-plus"></i>
  Add todo
</todo-button>
```

### 具名插槽

用于多个插槽的情况：

```html
<!--组件模版-->
<div class="container">
  <header>
    <slot name="header"></slot>
  </header>
  <main>
    <slot></slot>
  </main>
  <footer>
    <slot name="footer"></slot>
  </footer>
</div>

<!--用法-->
<base-layout>
  <template v-slot:header>
    <h1>Here might be a page title</h1>
  </template>

  <template v-slot:default>
    <p>A paragraph for the main content.</p>
    <p>And another one.</p>
  </template>

  <template v-slot:footer>
    <p>Here's some contact info</p>
  </template>
</base-layout>
```

`v-slot`也可简写成`#`

```html
<base-layout>
  <template #header>
    <h1>Here might be a page title</h1>
  </template>

  <template #default>
    <p>A paragraph for the main content.</p>
    <p>And another one.</p>
  </template>

  <template #footer>
    <p>Here's some contact info</p>
  </template>
</base-layout>
```

### 作用域插槽

`作用域插槽`可以给插槽传入组件的作用域参数

```html
<!-- 组件模版 -->
<ul>
  <li v-for="( item, index ) in items">
    <slot :item="item" :index="index" :another-attribute="anotherAttribute"></slot>
  </li>
</ul>

<!-- 调用组件 -->
<todo-list>
  <template v-slot:default="slotProps">
    <i class="fas fa-check"></i>
    <span class="green">{{ slotProps.item }}</span>
  </template>
</todo-list>
```
也可使用es6的解构语法解构插槽

```html
<!-- 默认 -->
<todo-list v-slot="{ item }">
  <i class="fas fa-check"></i>
  <span class="green">{{ item }}</span>
</todo-list>

<!-- 重命名 -->
<todo-list v-slot="{ item: todo }">
  <i class="fas fa-check"></i>
  <span class="green">{{ todo }}</span>
</todo-list>

<!-- 默认值 -->
<todo-list v-slot="{ item = 'Placeholder' }">
  <i class="fas fa-check"></i>
  <span class="green">{{ item }}</span>
</todo-list>
```

也可用动态插槽名

```html
<base-layout>
  <template v-slot:[dynamicSlotName]>
    ...
  </template>
</base-layout>
```

**v-slot 或 # 只能写在template上，除非只有一个默认插槽，可以写在组件标签上**

```html
<base-layout #default>
  <h1>Here might be a page title</h1>
</base-layout>
```

## 底层实现

先看下下面代码[生成的render函数](https://vue-next-template-explorer.netlify.app/#%7B%22src%22%3A%22%3Clayout%3E%5Cn%20%20%3Ctemplate%20v-slot%3Aheader%3E%5Cn%20%20%20%3Ch1%3E%7B%7BslotScope.item%7D%7D%3C%2Fh1%3E%5Cn%20%20%3C%2Ftemplate%3E%5Cn%20%20%3Ctemplate%20v-slot%3Adefault%3E%5Cn%20%20%20%20%3Cp%3E%7B%7B%20main%20%7D%7D%3C%2Fp%3E%5Cn%20%20%20%20%5Cn%20%20%3C%2Ftemplate%3E%5Cn%20%20%3Ctemplate%20v-slot%3Afooter%3E%5Cn%20%20%20%20%3Cp%3E%7B%7B%20footer%20%7D%7D%3C%2Fp%3E%5Cn%20%20%3C%2Ftemplate%3E%5Cn%3C%2Flayout%3E%22%2C%22ssr%22%3Afalse%2C%22options%22%3A%7B%22mode%22%3A%22module%22%2C%22filename%22%3A%22Foo.vue%22%2C%22prefixIdentifiers%22%3Afalse%2C%22hoistStatic%22%3Atrue%2C%22cacheHandlers%22%3Atrue%2C%22scopeId%22%3Anull%2C%22inline%22%3Afalse%2C%22ssrCssVars%22%3A%22%7B%20color%20%7D%22%2C%22compatConfig%22%3A%7B%22MODE%22%3A3%7D%2C%22whitespace%22%3A%22condense%22%2C%22bindingMetadata%22%3A%7B%22TestComponent%22%3A%22setup-const%22%2C%22setupRef%22%3A%22setup-ref%22%2C%22setupConst%22%3A%22setup-const%22%2C%22setupLet%22%3A%22setup-let%22%2C%22setupMaybeRef%22%3A%22setup-maybe-ref%22%2C%22setupProp%22%3A%22props%22%2C%22vMySetupDir%22%3A%22setup-const%22%7D%2C%22optimizeImports%22%3Atrue%2C%22optimizeBindings%22%3Afalse%7D%7D)

```html
<layout>
  <template v-slot:header="slotScope">
   <h1>{{slotScope.item}}</h1>
  </template>
  <template v-slot:default>
    <p>{{ main }}</p>
    
  </template>
  <template v-slot:footer>
    <p>{{ footer }}</p>
  </template>
</layout>  
```

```javascript
import { toDisplayString, createVNode, resolveComponent, withCtx, openBlock, createBlock } from "vue"

// Binding optimization for webpack code-split
const _toDisplayString = toDisplayString, _createVNode = createVNode, _resolveComponent = resolveComponent, _withCtx = withCtx, _openBlock = openBlock, _createBlock = createBlock

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_layout = _resolveComponent("layout")

  return (_openBlock(), _createBlock(_component_layout, null, {
    header: _withCtx(() => [
      _createVNode("h1", null, _toDisplayString(_ctx.slotScope.item), 1 /* TEXT */)
    ]),
    default: _withCtx(() => [
      _createVNode("p", null, _toDisplayString(_ctx.main), 1 /* TEXT */)
    ]),
    footer: _withCtx(() => [
      _createVNode("p", null, _toDisplayString(_ctx.footer), 1 /* TEXT */)
    ]),
    _: 1 /* STABLE */
  }))
}
```
从生成代码中可以看到使用`createBlock`构建`layout`组件的时候，第三个参数是一个对象。

而`createBlock`实际调用的是`createVNode`，`createVNode`内部会对`children`做格式化处理：

```javascript
function normalizeChildren(vnode: VNode, children: unknown) {
  let type = 0
  const { shapeFlag } = vnode
  ...
  if (typeof children === 'object') {
   ...
   type = ShapeFlags.SLOTS_CHILDREN
   ...
  } else if (isFunction(children)) {
    ...
  } else {
    ...
  }
  vnode.children = children as VNodeNormalizedChildren
  vnode.shapeFlag |= type
}
```

此时将`layout`的`vnode.shapeFlag`和`ShapeFlags.SLOTS_CHILDREN`执行了或操作(后续可以根据`SLOTS_CHILDREN`做类型匹配)：

再来看下组件的渲染流程： 

![vue3组件渲染逻辑.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2fd68cba619240ed90c4cb44ade7bf2a~tplv-k3u1fbpfcp-watermark.image)

在创建完vnode之后，因为`layout`是一个component，所以后续`patch`过程会走到`processComponent`方法中, 从上图可以看出会在`setupComponent`过程中执行`initSlots`

```javascript
const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeNormalizedChildren
) => {
// 这里就是createVNode处理的shapeFlag
  if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    const type = (children as RawSlots)._
    if (type) {
      instance.slots = children as InternalSlots
    } else {
      normalizeObjectSlots(children as RawSlots, (instance.slots = {}))
    }
  } else {
   ...
  }
}
```
`initSlots`很简单，就是把`children`赋值给`instance.slots`

然后看下`layout`组件的内容：

```html
<div class="layout">
  <header>
    <slot name="header"></slot>
  </header>
  <main>
    <slot></slot>
  </main>
  <footer>
    <slot name="footer"></slot>
  </footer>
</div>
```

[render函数](https://vue-next-template-explorer.netlify.app/#%7B%22src%22%3A%22%3Cdiv%20class%3D%5C%22layout%5C%22%3E%5Cn%20%20%3Cheader%3E%5Cn%20%20%20%20%3Cslot%20name%3D%5C%22header%5C%22%3E%3C%2Fslot%3E%5Cn%20%20%3C%2Fheader%3E%5Cn%20%20%3Cmain%3E%5Cn%20%20%20%20%3Cslot%3E%3C%2Fslot%3E%5Cn%20%20%3C%2Fmain%3E%5Cn%20%20%3Cfooter%3E%5Cn%20%20%20%20%3Cslot%20name%3D%5C%22footer%5C%22%3E%3C%2Fslot%3E%5Cn%20%20%3C%2Ffooter%3E%5Cn%3C%2Fdiv%3E%22%2C%22ssr%22%3Afalse%2C%22options%22%3A%7B%22mode%22%3A%22module%22%2C%22filename%22%3A%22Foo.vue%22%2C%22prefixIdentifiers%22%3Afalse%2C%22hoistStatic%22%3Atrue%2C%22cacheHandlers%22%3Atrue%2C%22scopeId%22%3Anull%2C%22inline%22%3Afalse%2C%22ssrCssVars%22%3A%22%7B%20color%20%7D%22%2C%22compatConfig%22%3A%7B%22MODE%22%3A3%7D%2C%22whitespace%22%3A%22condense%22%2C%22bindingMetadata%22%3A%7B%22TestComponent%22%3A%22setup-const%22%2C%22setupRef%22%3A%22setup-ref%22%2C%22setupConst%22%3A%22setup-const%22%2C%22setupLet%22%3A%22setup-let%22%2C%22setupMaybeRef%22%3A%22setup-maybe-ref%22%2C%22setupProp%22%3A%22props%22%2C%22vMySetupDir%22%3A%22setup-const%22%7D%2C%22optimizeImports%22%3Atrue%2C%22optimizeBindings%22%3Afalse%7D%7D):

```javascript
import { renderSlot, createVNode, openBlock, createBlock } from "vue"

// Binding optimization for webpack code-split
const _renderSlot = renderSlot, _createVNode = createVNode, _openBlock = openBlock, _createBlock = createBlock

const _hoisted_1 = { class: "layout" }

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createBlock("div", _hoisted_1, [
    _createVNode("header", null, [
      _renderSlot(_ctx.$slots, "header")
    ]),
    _createVNode("main", null, [
      _renderSlot(_ctx.$slots, "default")
    ]),
    _createVNode("footer", null, [
      _renderSlot(_ctx.$slots, "footer")
    ])
  ]))
}
```

这里会执行`renderSlot`渲染slot的内容。(这个`_ctx.$slots`就是`instance.slots`，是在`setupStatefulComponent`处做的代理访问)

```javascript
function renderSlot(
  slots: Slots,
  name: string,
  props: Data = {},
  fallback?: () => VNodeArrayChildren
): VNode {
  let slot = slots[name]

  isRenderingCompiledSlot++
  const rendered = (openBlock(),
  createBlock(
    Fragment,
    { key: props.key },
    slot ? slot(props) : fallback ? fallback() : [],
    (slots as RawSlots)._ === SlotFlags.STABLE
      ? PatchFlags.STABLE_FRAGMENT
      : PatchFlags.BAIL
  ))
  isRenderingCompiledSlot--
  return rendered
}
```

`renderSlot`调用了`createBlock`创建了slot的vnode节点，后续通过`processFragment`将slot的内容渲染在子组件对应的节点中。

## 作用域控制

我们都知道，插槽中访问的是父组件的作用域，这个是怎么实现的呢？

在上面可以看到，父组件生成render的时候，通过`_withCtx`对slot的`createVNode`做了一个包装，看一下`_withCtx`做了什么：

```javascript
function withCtx(
  fn: Slot,
  ctx: ComponentInternalInstance | null = currentRenderingInstance
) {
  if (!ctx) return fn
  const renderFnWithContext = (...args: any[]) => {
    if (!isRenderingCompiledSlot) {
      openBlock(true /* null block that disables tracking */)
    }
    // 暂存子组件的实例
    const owner = currentRenderingInstance
    // 将当前渲染的instance设置为父组件的实例
    setCurrentRenderingInstance(ctx)
    // 执行slot，此时获取到的instace为父组件的实例
    const res = fn(...args)
    // 还原当前渲染的instance
    setCurrentRenderingInstance(owner)
    if (!isRenderingCompiledSlot) {
      closeBlock()
    }
    return res
  }
  renderFnWithContext._c = true
  return renderFnWithContext
}
```

很简单，在创建slot的vnode之前，当前渲染的instance已经被赋值成了父组件的instance，在创建完之后还原。

## 作用域插槽实现原理

同样的：

```html
<layout>
  <template v-slot:header="slotScope">
   <h1>{{slotScope.item}}</h1>
  </template>
</layout>
```

[render函数](https://vue-next-template-explorer.netlify.app/#%7B%22src%22%3A%22%3Clayout%3E%5Cn%20%20%3Ctemplate%20v-slot%3Aheader%3D%5C%22slotScope%5C%22%3E%5Cn%20%20%20%3Ch1%3E%7B%7BslotScope.item%7D%7D%3C%2Fh1%3E%5Cn%20%20%3C%2Ftemplate%3E%5Cn%3C%2Flayout%3E%22%2C%22ssr%22%3Afalse%2C%22options%22%3A%7B%22mode%22%3A%22module%22%2C%22filename%22%3A%22Foo.vue%22%2C%22prefixIdentifiers%22%3Afalse%2C%22hoistStatic%22%3Atrue%2C%22cacheHandlers%22%3Atrue%2C%22scopeId%22%3Anull%2C%22inline%22%3Afalse%2C%22ssrCssVars%22%3A%22%7B%20color%20%7D%22%2C%22compatConfig%22%3A%7B%22MODE%22%3A3%7D%2C%22whitespace%22%3A%22condense%22%2C%22bindingMetadata%22%3A%7B%22TestComponent%22%3A%22setup-const%22%2C%22setupRef%22%3A%22setup-ref%22%2C%22setupConst%22%3A%22setup-const%22%2C%22setupLet%22%3A%22setup-let%22%2C%22setupMaybeRef%22%3A%22setup-maybe-ref%22%2C%22setupProp%22%3A%22props%22%2C%22vMySetupDir%22%3A%22setup-const%22%7D%2C%22optimizeImports%22%3Atrue%2C%22optimizeBindings%22%3Afalse%7D%7D)

```javascript
...

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_layout = _resolveComponent("layout")

  return (_openBlock(), _createBlock(_component_layout, null, {
    header: _withCtx((slotScope) => [
      _createVNode("h1", null, _toDisplayString(slotScope.item), 1 /* TEXT */)
    ]),
    _: 1 /* STABLE */
  }))
}
```

多了一个`slotScope`的入参

再看一下`layout`组件:

```html
<div class="layout">
  <header>
    <slot name="header" :item="item"></slot>
  </header>
</div>
```

[render函数](https://vue-next-template-explorer.netlify.app/#%7B%22src%22%3A%22%3Cdiv%20class%3D%5C%22layout%5C%22%3E%5Cn%20%20%3Cheader%3E%5Cn%20%20%20%20%3Cslot%20name%3D%5C%22header%5C%22%20%3Aitem%3D%5C%22item%5C%22%3E%3C%2Fslot%3E%5Cn%20%20%3C%2Fheader%3E%5Cn%3C%2Fdiv%3E%22%2C%22ssr%22%3Afalse%2C%22options%22%3A%7B%22mode%22%3A%22module%22%2C%22filename%22%3A%22Foo.vue%22%2C%22prefixIdentifiers%22%3Afalse%2C%22hoistStatic%22%3Atrue%2C%22cacheHandlers%22%3Atrue%2C%22scopeId%22%3Anull%2C%22inline%22%3Afalse%2C%22ssrCssVars%22%3A%22%7B%20color%20%7D%22%2C%22compatConfig%22%3A%7B%22MODE%22%3A3%7D%2C%22whitespace%22%3A%22condense%22%2C%22bindingMetadata%22%3A%7B%22TestComponent%22%3A%22setup-const%22%2C%22setupRef%22%3A%22setup-ref%22%2C%22setupConst%22%3A%22setup-const%22%2C%22setupLet%22%3A%22setup-let%22%2C%22setupMaybeRef%22%3A%22setup-maybe-ref%22%2C%22setupProp%22%3A%22props%22%2C%22vMySetupDir%22%3A%22setup-const%22%7D%2C%22optimizeImports%22%3Atrue%2C%22optimizeBindings%22%3Afalse%7D%7D)

```javascript
import { renderSlot, createVNode, openBlock, createBlock } from "vue"

// Binding optimization for webpack code-split
const _renderSlot = renderSlot, _createVNode = createVNode, _openBlock = openBlock, _createBlock = createBlock

const _hoisted_1 = { class: "layout" }

export function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (_openBlock(), _createBlock("div", _hoisted_1, [
    _createVNode("header", null, [
      _renderSlot(_ctx.$slots, "header", { item: _ctx.item })
    ])
  ]))
}
```

可以看到，`_renderSlot`中多了一个`{ item: _ctx.item }`,这时候`_ctx`就是`layout`组件的实例

## 总结

1. slot的内容是在子组件渲染的时候才开始创建vnode节点的，然后渲染在子组件的对应节点中。
2. 通过对创建slot内容的vnode函数通过withCtx包装，实现slot中访问的是父组件的作用域
3. `作用域插槽原理`：因为子组件渲染的时候才会开始执行创建slot的vnode，所以在创建slot的vnode时，将子组件的实例作为参数传进去，则slot中可以访问到子组件作用域的数据

---
title: vue3-issue
date: 2022-07-04 10:02:51
tags:
  - vue3
  - 源码
---

## 前言

这个其实不算是vue3的内容，是在vue2版本的一个isse。是在阅读vue3源码的时候发现的issue，但是觉得比较有趣，就在这里记录下

链接：[issue](https://github.com/vuejs/vue/issues/6566)

## 问题

代码如下：

``` js
 <div class="box1" v-if="expand">
    <i @click="expand = false, countA++">Expand is True</i>
  </div>
  <div class="box2" v-if="!expand" @click="expand = true, countB++">
    <i>Expand is False</i>
  </div>
  <div>
    countA: {{countA}}
  </div>
  <div>
    countB: {{countB}}
  </div>
```

正常情况:

- 点击`box1`的`i`标签，`expand`变成`fasle`，`box1`隐藏，`box2`显示，`countA`+1
- 然后点击`box2`，`expand`变成`true`，`box2`隐藏，`box1`显示，`countB`+1

真实情况:

- 点击`box1`的`i`标签，`expand`变成`true`，`box1`显示，`box2`隐藏，`countA`+1，`countB`+1
- 继续点击，还是上面的情况


可以去该链接实际操作一下: [Reproduction link](https://jsbin.com/qejofexedo/edit?html,js,output)

## 产生原因

从上面的结果上看，仿佛点击一次，`box1`和`box2`的click事件都触发了。这个是为什么呢？

尤大大在该issue回答到：

``` !
So, this happens because:

The inner click event on <i> fires, triggering a 1st update on nextTick (microtask)

The microtask is processed before the event bubbles to the outer div. During the update, a click listener is added to the outer div.

Because the DOM structure is the same, both the outer div and the inner element are reused.

The event finally reaches outer div, triggers the listener added by the 1st update, in turn triggering a 2nd update.

This is quite tricky in fix, and other libs that leverages microtask for update queueing also have this problem (e.g. Preact). React doesn't seem to have this problem because they use a synthetic event system (probably due to edge cases like this).

To work around it, you can simply give the two outer divs different keys to force them to be replaced during updates. This would prevent the bubbled event to be picked up
```

啥意思呢，就是，

点击`i`标签之后，事件会向上冒泡，冒泡到`box1`标签，

但是**冒泡也是微任务**，甚至这个微任务执行还在`nextTick`之后。

然后在vue做`update`的时候，发现`box1`和`box2`标签的type一样，且没有`key`，就复用了`box1`的dom，再将`box1`的`props`和`children`换成box2的，则`box2`的click事件也重新绑定到了`box1`上。

接下来事件冒泡到`box1`的dom上，触发click事件。所以造成了上面的现象。

所以可以通过加key处理这个问题。

可以看下vue3中判断是否为同一节点的代码:

``` js
 function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}
```

## 解决方案

在vue3中其实不会有这个问题了，因为vue3会为v-if添加默认的key，也就不会复用节点。

那在vue2中怎么解决的呢？

vue会为event回调包装一层，返回一个`invoke`，后续移除事件也是移除的包装函数:

``` js
function createInvoker(
  initialValue: EventValue,
  instance: ComponentInternalInstance | null
) {
  const invoker: Invoker = (e: Event) => {
    const timeStamp = e.timeStamp || _getNow()
    if (timeStamp >= invoker.attached - 1) {
      callWithAsyncErrorHandling(
        patchStopImmediatePropagation(e, invoker.value),
        instance,
        ErrorCodes.NATIVE_EVENT_HANDLER,
        [e]
      )
    }
  }
  invoker.value = initialValue
  invoker.attached = getNow()
  return invoker
}
```

`initialValue`就是绑定的事件回调。

可以看到`invoke`函数有一个`attached`的变量，这个变量的值是vue在做**渲染或者更新时的时间戳**

在触发事件回调的时候，会判断事件触发的时间戳是否大于缓存的时间戳，大于则触发回调。

如果是冒泡的事件，因为**捕获-触发-冒泡一系列过程，事件的时间戳是不变的**，而vue触发update是会重新执行`patchEvent`的，创建新的`invoke`包装函数。也就会更新`ttached`的值，从而冒泡的时间戳会小于`invoke`缓存的事件戳，即不会重复触发事件。

## 总结

从这个issue上，可以更好的理解下面三个知识点

1. vue在更新时会尽量复用节点
2. 事件捕获-冒泡是微任务
3. 事件捕获-触发-冒泡的一系列过程中，e是同一个

这应该是vue3.0系列的最后一篇了，后续有想法再做补充。也总算是完成对vue3.0源码阅读后的总结了。

也欢迎大家指出问题，提出建议。
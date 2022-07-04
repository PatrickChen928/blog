---
title: vue3 响应式
date: 2022-07-04 10:00:25
tags:
  - vue3
  - 源码
---

## 优点

vue3.0中已经将响应式完全重写了，虽然设计思想和vue2基本一致，只是将`Object.defineProperty`用es6的`proxy`重写了，但是也来带了以下几点好处

- 可以监听到对象的新增和删除，而不需要额外的api支持
- 可以监听到数组的变化，无需额外对push、splice等进行重写
- 支持对map、set、WeakMap、WeakSet集合类型进行监听
- 使用了懒递归的方式。vue2使用的是强制递归的方式对嵌套中的对象进行监听。而vue3是在读取对象内部的嵌套的对象时，才会为其建立代理

## 原理解析

![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14b3e5d5b5ad48c6b160f702a00857e8~tplv-k3u1fbpfcp-watermark.image)

以下主要分析`reactive`、`track`、`trigger`、`effect`

proxy相关知识可参考：[阮一峰 proxy](https://es6.ruanyifeng.com/#docs/proxy)

### reactive

创建响应式对象，为对象配置set、get、has等。

由于篇幅问题这里只保留了关键代码，去掉了一些校验的代码。

全部代码在: `vue-next/packages/reactivity/src/reactive.ts`

``` js
function reactive(target: object) {
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers
  )
} 
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  proxyMap.set(target, proxy)
  return proxy
}
```

其中`collectionHandlers`是对集合(Map,Set,WeakMap,WeakSet)的代理，`baseHandlers`是对对象和数组的代理，这里主要看下`baseHandlers`中的`set`和`get`

#### get

``` js 
//vue-next/packages/reactivity/src/baseHandlers.ts

function get(target: Target, key: string | symbol, receiver: object) {
    const targetIsArray = isArray(target)
    //这里主要对arrayInstrumentations的方法进行了重写，有2个作用：
    //1. 如果是['includes', 'indexOf', 'lastIndexOf'], 会对array里面的每一项都做track，因为每一项改变都可能会使以上的值变化；
    //2. 如果是['push', 'pop', 'shift', 'unshift', 'splice']，会在执行过程中暂停触发track，因为push会触发两次set，一次设置值，一次修改length，可能会导致无限递归[详细参考这个issue](https://github.com/vuejs/vue-next/issues/2137)
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }

    const res = Reflect.get(target, key, receiver)

    if (
      isSymbol(key)
        ? builtInSymbols.has(key as symbol)
        : key === `__proto__` || key === `__v_isRef`
    ) {
      return res
    }
    //这里会收集effect
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }
    
    if (shallow) {
      return res
    }
    
    //unref处理，返回ref的实际值
    if (isRef(res)) {
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      return shouldUnwrap ? res.value : res
    }
    //懒递归，在get的时候去代理res
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
```

#### set

``` js
//vue-next/packages/reactivity/src/baseHandlers.ts

function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    const oldValue = (target as any)[key]
 
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    if (target === toRaw(receiver)) {
    //这里触发更新
      if (!hadKey) {
      //如果是新的key，则是add
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
      //否则是修改
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}
```

### track

收集依赖，存入全局的map对象中，在get时触发。

格式为:

``` js

{
    target: {
        key: [effect1, effect1, ...]
    }
}

```

其中`activeEffect`在执行effect创建副作用函数时赋值的。

``` js
//vue-next/packages/reactivity/src/effect.ts

const targetMap = new WeakMap<any, KeyToDepMap>()

function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}
```

### trigger

``` js
//vue-next/packages/reactivity/src/effect.ts

function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
//获取对应的依赖
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  const effects = new Set<ReactiveEffect>()
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect || effect.allowRecurse) {
          effects.add(effect)
        }
      })
    }
  }

  if (type === TriggerOpTypes.CLEAR) {
    //如果是清除，则所有key对应的依赖都要更新
    depsMap.forEach(add)
  } else if (key === 'length' && isArray(target)) {
    // 如果是length，则只有代码里有依赖arr.length或超过新的length的依赖需要更新。
    //例如： oldArr: [1, 2, 3] oldArr.length = 2; 则依赖了3的值需要更新依赖
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        add(dep)
      }
    })
  } else {
     // 添加key对应的依赖
    if (key !== void 0) {
      add(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
        //这里是获取集合的依赖的
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          //同样的如果oldArr: [1,2,3] oldArr[3] = 4 则会触发legth的依赖
          add(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
        //获取集合的依赖
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
      //获取集合的依赖
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }
    //这里会挨个执行依赖，vue3的依赖更新是微任务，而且也有判断待执行依赖队列中是否有相同的，没有才会添加，所以不会更新多次。(主要配置在runtime-core/src/scheduler.ts中)
  const run = (effect: ReactiveEffect) => {
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }

  effects.forEach(run)
}
```

### effect

`effect`是连接上面方法的核心。一切的响应式都是在这里开始注入的。

先看下其代码实现：

``` js
//vue-next/packages/reactivity/src/effect.ts

function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  if (isEffect(fn)) {
    fn = fn.raw
  }
  const effect = createReactiveEffect(fn, options)
  //computed则为lazy，不会立刻触发，只有在get的时候才会触发获取对应的值
  if (!options.lazy) {
    effect()
  }
  return effect
}

function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    if (!effect.active) {
      return options.scheduler ? undefined : fn()
    }
    if (!effectStack.includes(effect)) {
        //这里把effect的deps清除，主要是防止重复缓存
      cleanup(effect)
      try {
        enableTracking()
        effectStack.push(effect)
        //缓存activeEffect，在get的时候存入depTarget
        activeEffect = effect
        //执行注入的render函数
        return fn()
      } finally {
        effectStack.pop()
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  //双向缓存，目前没发现什么用处，估计为了调试？
  effect.deps = []
  effect.options = options
  return effect
}
```

在vue渲染过程中

``` js
instance.update = effect(function componentEffect() {
    ...
    //这里会执行render函数，这时候模版会获取reactive、ref等响应式包装的值，从而收集componentEffect包装后的effect，在重新设置data的时候，触发set，更新effect, 更新组件
    const subTree = (instance.subTree = renderComponentRoot(instance))
    ...
}, {
  scheduler: queueJob,
  allowRecurse: true
})
```

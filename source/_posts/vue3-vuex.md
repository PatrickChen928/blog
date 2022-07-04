---
title: vue3-vuex
date: 2022-07-04 10:04:27
tags:
  - vue3
  - vuex
  - 源码
---

vuex是vue专用的状态管理工具，内部实现强制和vue做了绑定。在项目中，常常用来做全局或多个不确定组件的状态管理，比如登录状态的token，用户信息等。

在vue3出来之后，vuex也做了相应的升级，主要在响应式方面。

> 以下内容基于vuex@4.0.2版本，用于vue3.x版本

## 使用方式

初始化

```javascript
// main.js
import { createApp } from "vue";
import App from "./App.vue";
import store from "./store";

createApp(App).use(store).mount("#app");

// store.js
import { createStore } from "vuex";

export default createStore({
  strict: false,
  state: {
    num: 0,
  },
  getters: {
    getCount(state) {
      return state.num;
    }
  },
  mutations: {
    addM(state) {
      state.num++;
    }
  },
  actions: {
    add(store) {
      store.commit('addM');
    }
  },
  modules: {
    a: {}
  },
});
```

引用store

```javascript
// vuex中使用了provide传递 store 实例，可以直接通过useStore使用store，
// 因为setup中没有this，无法直接获取$store
// 也可以使用 import store from 'store.js' 方式引入
import { useStore } from 'vuex';
export default {
  setup() {
    let store = useStore();
    function add() {
      store.dispatch('add');
    }
    return {
      add
    }
  }
}
```

## 流程图

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a0b8c0240584430ba11c1cf2dfe9344b~tplv-k3u1fbpfcp-watermark.image)

vuex维护了一个全局的state对象，主要原理在于对这个state对象做响应式的处理。通过commit更改state时(或者dispatch提交commit)，触发数据响应，更新依赖的组件。

主要的功能点有state、mutaion、action、modules和plugin。或者还有一个strict。具体怎么用就不介绍了，可以看下官网 => [vuex官网](https://next.vuex.vuejs.org/)

下面主要介绍一下核心的一些实现。

## 核心功能

### 初始化

```javascript
class Store {
  constructor (options = {}) {
    const {
      plugins = [],
      strict = false,
      devtools
    } = options

    // store internal state
    this._committing = false
    this._actions = Object.create(null)
    this._actionSubscribers = []
    this._mutations = Object.create(null)
    this._wrappedGetters = Object.create(null)
    this._modules = new ModuleCollection(options)
    this._modulesNamespaceMap = Object.create(null)
    this._subscribers = []
    this._makeLocalGettersCache = Object.create(null)
    this._devtools = devtools

    // bind commit and dispatch to self
    const store = this
    const { dispatch, commit } = this
    // 通过call绑定dispatch的this
    this.dispatch = function boundDispatch (type, payload) {
      return dispatch.call(store, type, payload)
    }
    // 通过call绑定commit的this
    this.commit = function boundCommit (type, payload, options) {
      return commit.call(store, type, payload, options)
    }

    // strict mode
    this.strict = strict

    const state = this._modules.root.state
    
    // 处理module
    installModule(this, state, [], this._modules.root)
    
    // 处理store的state
    resetStoreState(this, state)

    // 执行插件
    plugins.forEach(plugin => plugin(this))
  }
}
```

初始化主要做了以下几件事：

- 初始化各种状态，包括action集合、mutatuon集合，getter的集合等
- 创建和安装模块，这块主要是处理module，后面会介绍
- 处理store的state，也是最核心的内容，对state和getter做了响应式处理
- 执行插件，入参时store的实例，可以通过插件对数据做监听和处理

### module

这一步主要的功能如下：

- 将module内容复制到最外层的state中，如`{state: {a: {state: {xxx}}}}`，所以我们可以通过`this.$store.state.a.xxx`获取到模块中的state
- 将所有的mutatuon维护在全局`_mutations`中
- 将所有的action维护在全局`_actions`中
- 将所有的getter维护在全局`_wrappedGetters`中


#### 创建module集合

```javascript
class ModuleCollection {
  constructor (rawRootModule) {
    // register root module (Vuex.Store options)
    this.register([], rawRootModule, false)
  }

  get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }

  getNamespace (path) {
    let module = this.root
    return path.reduce((namespace, key) => {
      module = module.getChild(key)
      return namespace + (module.namespaced ? key + '/' : '')
    }, '')
  }
  
  register (path, rawModule, runtime = true) {
    const newModule = new Module(rawModule, runtime)
    if (path.length === 0) {
      this.root = newModule
    } else {
      const parent = this.get(path.slice(0, -1))
      parent.addChild(path[path.length - 1], newModule)
    }

    // register nested modules
    if (rawModule.modules) {
      forEachValue(rawModule.modules, (rawChildModule, key) => {
        this.register(path.concat(key), rawChildModule, runtime)
      })
    }
  }
}
```

这里会递归为每个module生成一个module对象，对象内部维护了一个children，用于存该module的子module。再将module的key值，存入path对象中，递归每个module。最终数据结构如下：

```javascript
{
    root: {
        _rawModule: {},
        _children: {
            a: {
                _rawModule: {},
                _children: {
                    a1: moduleA1,
                    a2: moduleA2
                }
            },
            b: {
                 _rawModule: {},
                _children: {
                    b1: moduleB1,
                    b2: moduleB2
                }
            }
        }
    }
}
```

**这里有一个比较值得学习的一个处理，就是获取parent的操作, 通过reduce递归往下找。**

```javascript
const parent = this.get(path.slice(0, -1))
parent.addChild(path[path.length - 1], newModule)
```

例如层级为a->b->c->d，即b是a的module，c是b的module，d是c的module。要将d加入c的children中，此时的path是[a, b, c, d]，然后通过reduce一层一层往下找，找到c的module，优雅～:
```javascript
get (path) {
    return path.reduce((module, key) => {
      return module.getChild(key)
    }, this.root)
  }
```

#### 安装module

这里主要做了两件事：

- 将module的state放入父模块的state中，形成格式： `state: { a: {state: {a1: {state: {}}}}}`,层级嵌套。所以我们可以通过this.$store.a.state获取a模块的state。**如果module的名字和父模块的state属性名重复了，会覆盖掉state的属性，所以命名一定要注意⚠️**
- 将getter、mutation、action放入全局map对象中维护，如果设置了namespaced为true，则在全局的map中的key会加上模块的key值，例如:
```javascript
{
    modules: {
        a: {
            namespaced: true,
            getters: {getA: () => {}},
            modules: {
                a1: {
                    namespaced: true,
                    getters: {getA1: () => {}},
                },
                a2: {
                    getters: {getA2: () => {}},
                }
            }
        },
        b: {
            getters: {getB: () => {}},
            modules: {
                b1: {
                    getters: {getB1: () => {}},
                },
                b2: {
                    getters: {getB2: () => {}},
                }
            }
        }
    }
}

=>

getters: {
    a/getA: () => {},
    a/a1/getA1: () => {},
    a/getA2: () => {},
    getB1: () => {},
    getB2: () => {},
}
```

所以在使用了module的情况下，要注意module和内部的属性命名。

### state数据响应式处理

在处理完module之后，就需要对state做响应式的处理了，主要在`resetStoreState`方法中

```javascript
function resetStoreState (store, state, hot) {
  const oldState = store._state

  store.getters = {}
  store._makeLocalGettersCache = Object.create(null)
  // 这是在安装模块时提取的全局getter集合
  const wrappedGetters = store._wrappedGetters
  const computedObj = {}
  forEachValue(wrappedGetters, (fn, key) => {
    computedObj[key] = partial(fn, store)
    Object.defineProperty(store.getters, key, {
      get: () => computedObj[key](),
      enumerable: true // for local getters
    })
  })

  store._state = reactive({
    data: state
  })
}
```

- 通过`reactive`将state的数据响应式处理
- 将全局的getters的值通过`Object.defineProperty`映射到`store.getters`上

**在vue在effect函数中获取store的state值时，会将该组件实例放到track依赖中，在commit修改state时，触发依赖的更新**

### commit

- 执行mutation中匹配的函数
- 执行订阅函数

```javascript
commit (_type, _payload, _options) {
    // check object-style commit
    const {
      type,
      payload,
      options
    } = unifyObjectStyle(_type, _payload, _options)

    const mutation = { type, payload }
    //从全局中获取匹配的mutation
    const entry = this._mutations[type]
    if (!entry) {
      return
    }
    this._withCommit(() => {
    // 开始执行mutation的函数
      entry.forEach(function commitIterator (handler) {
        handler(payload)
      })
    })
    
    // 这里会执行订阅者，devtool可以通过订阅，在每次state改变的时候，可以监听到数据的变更，做数据流的记录
    this._subscribers
      .slice()
      .forEach(sub => sub(mutation, this.state))
  }
```

### dispatch

dispatch和commit类似，主要将action的返回用promise包了一层，在resolve的时候返回，所以dispatch中可以执行异步函数

同样的在执行action之前，会先执行action的订阅函数

```javascript
dispatch (_type, _payload) {
    // check object-style dispatch
    const {
      type,
      payload
    } = unifyObjectStyle(_type, _payload)

    const action = { type, payload }
    const entry = this._actions[type]
    if (!entry) {
      return
    }

    try {
    // 执行action的订阅函数，主要时devtool通过subscribe方法订阅的
      this._actionSubscribers
        .slice()
        .filter(sub => sub.before)
        .forEach(sub => sub.before(action, this.state))
    } catch (e) {
      if (__DEV__) {
        console.warn(`[vuex] error in before action subscribers: `)
        console.error(e)
      }
    }
    
    const result = entry.length > 1
      ? Promise.all(entry.map(handler => handler(payload)))
      : entry[0](payload)
    //  将result包在promise中，所以dispatch中可以执行异步函数
    return new Promise((resolve, reject) => {
      result.then(res => {
        try {
          this._actionSubscribers
            .filter(sub => sub.after)
            .forEach(sub => sub.after(action, this.state))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in after action subscribers: `)
            console.error(e)
          }
        }
        resolve(res)
      }, error => {
        try {
          this._actionSubscribers
            .filter(sub => sub.error)
            .forEach(sub => sub.error(action, this.state, error))
        } catch (e) {
          if (__DEV__) {
            console.warn(`[vuex] error in error action subscribers: `)
            console.error(e)
          }
        }
        reject(error)
      })
    })
  }
```

### vuex为什么不建议直接更改state   

> 你不能直接改变 store 中的状态。改变 store 中的状态的唯一途径就是显式地提交 (commit) mutation。这样使得我们可以方便地跟踪每一个状态的变化，从而让我们能够实现一些工具帮助我们更好地了解我们的应用。

这个并不是强制性的，如果我们直接修改state也能生效。

只是通过action提交commit，通过commit更改state，按照这个流程去做状态管理，可以让一些工具能完整记录下数据流向。例如上面commit和dispatch中介绍的，在变更数据的同时，也会执行订阅函数，通知状态变更。

### vuex是如何知道数据不是通过commit提交的

如果数据不是通过commit更改的，会提示`do not mutate vuex store state outside mutation handlers.`，这是如何控制的呢？

在执行commit 的时候，会将mutation的方法放在_withCommit中，
```javascript
 // commit
this._withCommit(() => {
  entry.forEach(function commitIterator (handler) {
    handler(payload)
  })
})

_withCommit (fn) {
    const committing = this._committing
    this._committing = true
    fn()
    this._committing = committing
}
```
vuex中如果开了`strict`，则会通过watch监听state的变更。
```javascript
function enableStrictMode (store) {
  watch(() => store._state.data, () => {
    if (__DEV__) {
      assert(store._committing, `do not mutate vuex store state outside mutation handlers.`)
    }
  }, { deep: true, flush: 'sync' })
}
```

如果数据变更了，且此时commiting不是true，则发出提示。

### vue3.x和vue2.x的区别

vue3.x开始依赖了vuex@4.x版本，主要是在数据响应的处理上不一致

在vuex@4.x之前，通过new Vue处理state的响应式，在vue获取state的值时，把当前组件实例存入deps的依赖中，数据变更，执行依赖。

```javascript
function resetStoreVM (store, state, hot) {
  const wrappedGetters = store._wrappedGetters
  const computed = {}
  forEachValue(wrappedGetters, (fn, key) => {
    computed[key] = partial(fn, store)
    Object.defineProperty(store.getters, key, {
      get: () => store._vm[key],
      enumerable: true // for local getters
    })
  })
  // 
  store._vm = new Vue({
    data: {
      $$state: state
    },
    computed
  })

  if (store.strict) {
    enableStrictMode(store)
  }
}
```

还有在getters的处理也变了，在vuex4.x版本中，不再用computed包裹getters，而是直接在函数中执行getter中的方法，在render执行的时候，实时获取最新的。

## 总结

1. module处理过程主要是将所有的getter、mutation、action放入全局维护，同时对namespaced进行处理，如果namespaced: true，会在全局对象的key中加入模块的key，形式`"a/b/getCount"`
2. 通过reactive建立响应式state，绑定vue
3. dispatch会将执行结果通过promise包装，所以dispatch可以执行异步函数
4. commit和dispatch在执行匹配的方法之前，都会先执行订阅列表中的函数，也就是devTool可以跟踪到数据流变化的原因，所以建议通过commit更改state，而不是直接修改或者state
---
title: webpack5.x编译流程
date: 2022-07-04 09:49:26
tags: 
	- webpack
	- 工程化
	- 源码
---

> 以下内容基于webpack@^5.12.3版本

## 简略流程图

**文末有详细流程图**

![](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/653eb0f6e51948ddae2f32ff1cfc6596~tplv-k3u1fbpfcp-watermark.image)


## webpack函数

这快的代码比较简单就不贴了，讲下大致流程

- 归一化options，将部分配置转换成webpack需要的格式
- 创建context上下文，取的是process.cwd()
- 创建compiler实例
- 初始化流插件
- 初始化用户配置的插件，注册插件钩子
- 进一步优化options，给一些配置赋上默认值
- 初始化webpack内部插件，例如js解析器、缓存插件、添加入口的插件等。

## 缓存机制

以下介绍下webpack4.x和webpack5.x缓存实现的区别

### webpack 5.x

这里大致介绍下webpack的两种缓存机制`memory`: 内存缓存和`filesystem`: 持久缓存。上个步骤讲到webpack函数执行的时候会初始化缓存插件，这时候会根据配置的`cache.type`是`memory`还是`filesystem`执行不同的操作

- `memory` 存储在内存中，用于热更新，对重新编译不起作用。实现插件为`MemoryCachePlugin`，存储方式为Map对象
- `filesystem` 会生成本地文件, 编译过程中只会创建延时写入队列，在编译完之后才会循坏该队列，写入文件。缓存文件默认保存在`node_modules/.cache`中，一个chunk生成一个缓存文件。实现插件为`IdleFileCachePlugin`。并且如果配置`filesystem`做永久化储存，webpack还是会同时使用`memory`存储，用于watch模式，`MemoryCachePlugin`插件执行顺序在`IdleFileCachePlugin`插件之前。

### webpack4.x

在webpack中，只有内存缓存，在compilation实例中，有一个实例属性cache，为对象类型, 所有的内容皆缓存在这里。 

具体实现如下：
1. 在webpack函数执行的时候初始化`CachePlugin`插件, 这里会初始化`compilation.cache`, 在watch模式下，可以直接取到上次编译缓存的内容

``` js
//webpack.js
compiler.options = new WebpackOptionsApply().process(options, compiler);

//WebpackOptionsApply.js
if (options.cache) {
	const CachePlugin = require("./CachePlugin");
	new CachePlugin(
		typeof options.cache === "object" ? options.cache : null
	).apply(compiler);
}

//CachePlugin.js

compiler.hooks.thisCompilation.tap("CachePlugin", compilation => {
	compilation.cache = cache;
	compilation.hooks.childCompiler.tap(
		"CachePlugin",
		(childCompiler, compilerName, compilerIndex) => {
			let childCache;
			if (!cache.children) {
				cache.children = {};
			}
			if (!cache.children[compilerName]) {
				cache.children[compilerName] = [];
			}
			if (cache.children[compilerName][compilerIndex]) {
				childCache = cache.children[compilerName][compilerIndex];
			} else {
				cache.children[compilerName].push((childCache = {}));
			}
			registerCacheToCompiler(childCompiler, childCache);
		}
	);
});
```
2. 编译过程中，通过`compilation.cache`获取和存储内容

``` js
//compilation.js

class Compilation extends Tapable {

    constructor(compiler) {
        ...
        this.cache = null;
    }
    
    addModule() {
        ...
        if (this.cache && this.cache[cacheName]) {
			const cacheModule = this.cache[cacheName];
			...
		}
    }
}
```

当然，webpack5.0之前也可以通过`hard-source-webpack-plugin`实现持久化缓存的。具体原理，其实通过上面内存缓存过程的的说明，也很清晰了，只要注册适当的钩子，去做读取`compilation.cache`即可。

## 构建过程

在webpack函数执行完之后，就会执行compiler.run了，然后触发一堆钩子函数(具体钩子函数可看最下方的详细流程)开始执行compiler.compile，这里贴一下代码。

### 构建入口

``` js
compile(callback) {

        //初始化构建需要的模块插件
		const params = this.newCompilationParams();
		this.hooks.beforeCompile.callAsync(params, err => {
			if (err) return callback(err);

			this.hooks.compile.call(params);
            //创建构建实例，构建过程的内容都会保存在compilation中
			const compilation = this.newCompilation(params);

			const logger = compilation.getLogger("webpack.Compiler");

			logger.time("make hook");
			//开始构建模块
			this.hooks.make.callAsync(compilation, err => {
				logger.timeEnd("make hook");
				if (err) return callback(err);

				logger.time("finish make hook");
				//模块构建完成
				this.hooks.finishMake.callAsync(compilation, err => {
					logger.timeEnd("finish make hook");
					if (err) return callback(err);

					process.nextTick(() => {
						logger.time("finish compilation");
						//做一些模块的错误和警告的处理
						compilation.finish(err => {
							logger.timeEnd("finish compilation");
							if (err) return callback(err);

							logger.time("seal compilation");
							//封装模块开始
							compilation.seal(err => {
								logger.timeEnd("seal compilation");
								if (err) return callback(err);

								logger.time("afterCompile hook");
							    //编译完成	this.hooks.afterCompile.callAsync(compilation, err => {
									logger.timeEnd("afterCompile hook");
									if (err) return callback(err);
                                    //执行onCompiled回调
									return callback(null, compilation);
								});
							});
						});
					});
				});
			});
		});
	}
```

整个方法看着超级简单，50行不到的代码就把编译过程做完了。那么，webpack是怎么开始构建的呢？

在webpack函数执行的时候，有初始化内部插件的步骤，其中会初始化一个叫`EntryPlugin`的插件

``` js
class EntryPlugin {
	constructor(context, entry, options) {
		this.context = context;
		this.entry = entry;
		this.options = options || "";
	}
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"EntryPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					EntryDependency,
					normalModuleFactory
				);
			}
		);

		compiler.hooks.make.tapAsync("EntryPlugin", (compilation, callback) => {
			const { entry, options, context } = this;

			const dep = EntryPlugin.createDependency(entry, options);
			compilation.addEntry(context, dep, options, err => {
				callback(err);
			});
		});
	}
}

```

这里监听了2个钩子：`hooks.compilation` 和 `hooks.make`。

在`compilation`钩子中，会为compilation实例注入normalModuleFactory参数，这个是在`this.newCompilationParams()`的时候创建的，包含了创建模块的方法。

在`make`钩子中，会创建编译入口，然后执行`compilation.addEntry`，这个方法才是真正构建的开始。

### 构建开始

> 以下内容主要在compilation.js文件内完成

1. 执行`_addEntryItem`将入口文件存入`this.entries`，后续构建chunk遍历的是该map对象
2. 执行`addModuleTree`, 获取在`EntryPlugin`存入的dependencyFactories中的`moduleFactory`
3. 执行`handleModuleCreation`，开始创建模块实例
4. 执行`moduleFactory.create`创建模块，这里主要做了三件事
    - 执行`factory.hooks.factorize.call`钩子，然后会调用`ExternalModuleFactoryPlugin`中注册的钩子，用于配置外部文件的模块加载方式， 例如fs,  http, events等node原生方法
    - 使用`enhanced-resolve`解析模块和loader真实绝对路径
    - `new NormalModule()`创建module实例
5. 执行`addModule`，存储`module`
6. `buildModule`，构建模块, 这里会调用`normalModule中`的`build`开启构建。主要过程为：
    - 创建loader上下文
    - `runLoaders`，通过`enhanced-resolve`解析得到的模块和loader的路径获取函数，执行loader
    - 调用`JavascriptParser.js`将loader执行完的源码解析成ast(使用了acorn工具)，这步会生成当前模块的以来集合
    - 生成模块的hash
    - 缓存解析完的module至`_modulesCache`，此时已经有`_source`(解析后的源码)
7. 执行`processModuleDependencies`，获得模块依赖，重复第3步

以上，所有模块已经构建完成，生成了模块的集合。

### 产物封装

执行`compilation.seal`进行产物的封装。

1. 循环遍历`entrys`(在构建第一步添加的this.entries)，生成chunks
2. 执行`buildChunkGraph`，这里会将import()、require.ensure等方法生成的动态模块添加到chunks中
3. 后续就是一堆优化模块和chunks等的钩子
4. 执行`hooks.optimizeChunkModules`的钩子，这里开始进行代码生成和封装
    - 同样的是触发各种钩子函数
    - 执行`createModuleHashes`更新模块hash
    - 执行`codeGeneration`生成模块代码，这里会遍历modules，创建构建任务，循环使用`JabascriptGenerator`构建代码，这时会使用不同的依赖处理，将import等模块引入方式替换为`__webpack_require__`等，并将生成结果存入缓存
    - 执行`processRuntimeRequirements`，根据生成的内容所使用到的`webpack_require`的函数，增加添加对应的代码,例如`__webpack_require__`、`__webpack_require__.n`、`__webpack_require__.r`等
    - 执行`createHash`创建chunk的hash
    - 执行`clearAssets`清除chunk的`files`和`auxiliary`，这里缓存的是生成的chunk的文件名，应该是为了热更新模式把，防止残留上次构建的遗弃内容
    - `createModuleAssets`这步如果`module.buildInfo.assets`也会将该内容存入`compilation.assets`，暂时不知道怎么触发这个场景的
    - `createChunkAssets`生成`render`函数,执行`render`函数，将chunk内容缓存在`compilation.assets`对象中，会把生成的chunk文件名缓存至`chunk.files`或`chunk.auxiliary`中

到这里所有产物内容已经生成了，但是还没有正式生成产物文件

### 产物生成

这里会回到compiler的进程中，执行onCompiled回调：

1. 触发`shouldEmit`钩子函数，这里是最后能优化产物的钩子了
2. 写入本地文件，用的是webpack函数执行时初始化的文件流工具
3. 执行`done`钩子函数，这里会执行`compiler.run`的回调当中，再执行`compiler.close`，然后执行永久化存储(前提是使用的`filesystem`缓存模式)

## compiler和compilation

我们在开发插件时常常会用到`compiler`和`compilation`，那么`compiler`和`compilation`到底有啥区别呢？

结合上述流程介绍和末尾的详细流程图其实能很清晰的看出来：

`compiler`: 覆盖编译的整个生命周期，包括初始化、启动、暂停、开始解析、开始封装等等，可以看作是编译过程的`推手`。理所当然，在整个编译过程只有有一个`compiler`实例。

`compilation`: 每个编译过程都会生成一个`compilation`实例。这里的每个编译过程可以看作是watch模式下的文件修改引发的重新编译。原因也很简单，上面指出了，每次watch都会执行`compiler.run`方法，而初始化`compilation`是在这之后的。而`compilation`主要负责的是构建，包括模块的解析、代码生成和封装。

## module、chunk和bundle

`module`: 这个很简单，import一个模块就是一个module。

`chunk`: 一个入口文件会生成一个chunk，代码分割也会生成chunk。
 
`bundle`: 最终的产物，一个产物就是一个bundle。
 
 两者的关系是，一个chunk可能对应一个或多个bundle。
 
 找了一张图来对比下：
 
 ![](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d36399a366e24cef821d22091f019bb6~tplv-k3u1fbpfcp-watermark.image)
 
``` js
  entry: {
        index: "../index.js",
        utils: '../utils.js',
    }
```
 
 其中`utils.js`和`index.js`是两个入口文件，所以是两个chunk。分离css，所以生成了3个bundle: index.bundle.css、index.bundle.js和utils.bundle.js。前两个属于chunk 0 ，最后一个属于chunk 1。

## 结语


总算结束了，很多细节其实还是没搞懂意思的，例如missingDependenices是什么？ensureChunkConditionsPlugin、RemoveEmptyChunksPlugin等插件干嘛用的,为什么生成了module的hash只会还要执行createModuleHashes？基本下列详细流程图中没有注释的除非太简单了，不然就是没完全搞明白作用的 ==!

以上。有任何错误和补充，欢迎留言。

## 详细流程图

- `黄色`标注代表重要节点
- `绿色`标注代表compiler的钩子函数
- `蓝色`标注代表compilation的钩子函数，因为太多了，后续一些产物生成的钩子可能不是很全。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3a99a60bf7f4496281c2e171c3d8e5f5~tplv-k3u1fbpfcp-watermark.image)
/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 20:59:07
 * @LastEditTime: 2022-06-19 23:16:20
 * @LastEditors: your name
 */
console.log("5.3=============index");

// 存储副作用函数的桶
const bucket = new WeakMap();

// 原始数据
const data = { foo: 1 };

// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// effect栈
const effectStack = [];
// effect函数用于注册副作用函数
function effect(fn, options = {}) {
  const effectFn = () => {
    // 调用cleanup函数完成清除工作
    cleanup(effectFn);
    // 当effectFn执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    // 在调用副作用按时之前将当副作用函数压入栈中
    effectStack.push(effectFn);
    // 将fn的执行结果存储到res中
    const res = fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    // 将res作为effectFn的返回值
    return res;
  };
  // 将options挂载到effectFn上
  effectFn.options = options;
  // activeEffect.deps用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 只有非lazy的时候，才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }
  // 将副作用函数作为返回值返回
  return effectFn;
}

// 代理对象
const p51 = new Proxy(data, {
  // 拦截读取操作，接收第三个参数receiver
  get(target, key, receiver) {
    console.log(p51 === receiver, target === data);
    // 将副作用函数activeEffect添加到存储副作用函数的桶中
    track(target, key);
    // 使用Relect.get返回读取到的属性值
    return Reflect.get(target, key, receiver);
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置属性值
    target[key] = newVal;
    // 把副作用函数从桶里取出并执行
    trigger(target, key);
  },
});

// 在get拦截函数内调用track函数追踪变化
function track(target, key) {
  // 没有activeEffect，直接return
  if (!activeEffect) return;
  // 根据target从“桶”中取得depsMap，它也是一个Map类型：key --> effects
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  // 再根据key从depsMap中取得deps，它是一个Set类型，
  // 里面存储着所有与当前key想关联的副作用函数：effects
  let deps = depsMap.get(key);
  if (!deps) {
    // 如果deps不存在，同样新建一个Set并与key关联
    depsMap.set(key, (deps = new Set()));
  }
  // 最后将当前激活的副作用函数添加到“桶”里
  deps.add(activeEffect);
  // deps就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps.push(deps);
}

// 在set拦截函数内调用trigger函数触发变化
function trigger(target, key, type) {
  // 根据target从桶中取得depsMap，它是key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key取得所有副作用函数effects
  const effects = depsMap.get(key);

  // 避免无限循环，使用新的set集合
  const effectsToRun = new Set();

  effects &&
    effects.forEach((effectFn) => {
      // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  // 只有当操作类型为'ADD' 或 'DELETE' 时
  if (type === "ADD" || type === "DELETE") {
    // 取得与ITERATE_KEY相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 将与ITERATE_KEY相关联的副作用函数也添加到effectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  // 执行副作用函数
  effectsToRun.forEach((effectFn) => {
    // 如果一个副作用函数存在调度器，则调用该调度器，并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      // 否则直接执行副作用函数（之前的默认行为）
      effectFn();
    }
  });
}

function cleanup(effectFn) {
  // 遍历effectFn.deps数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps是依赖集合
    const deps = effectFn.deps[i];
    // 将effectFn从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重置effectFn.deps数组
  effectFn.deps.length = 0;
}

// effect(() => {
//   console.log(obj.foo);
// });

// 定义一个任务队列
const jobQueue = new Set();
// 使用Promise.resolve()创建一个promise实例，我们用它将一个任务添加到微任务队列
const p = Promise.resolve();

// 一个标志代表是否正在刷新队列
let isFlushing = false;
function flushJob() {
  // 如果队列正在刷新，则什么都不做
  if (isFlushing) return;
  // 设置为true，代表正在刷新
  isFlushing = true;
  // 在微任务队列中刷新jobQueue队列
  p.then(() => {
    jobQueue.forEach((job) => job());
  }).finally(() => {
    // 结束后重置isFlushing
    isFlushing = false;
  });
}

// const effectFn = effect(
//   // getter返回obj.foo与obj.bar的和
//   () => obj.foo + obj.bar,
//   // options
//   {
//     lazy: true,
//   }
// );

// value 是getter的返回值
// const value = effectFn();

// obj.foo++;

function computed(getter) {
  // value用来缓存上一次计算的值
  let value;
  // dirty标志，用来标识是否需要重新计算值，为true则意味着“脏”，需要计算
  let dirty = true;
  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将dirty重置为true
    scheduler() {
      if (!dirty) {
        dirty = true;
        // 当计算属性依赖的响应式数据变化时，手动调用trigger函数触发响应
        trigger(obj, "value");
      }
    },
  });

  const obj = {
    get value() {
      // 只有“脏”时才计算值，并将得到的值缓存到value中
      if (dirty) {
        value = effectFn();
        // 将dirty设置为false，下一次访问直接使用缓存到value中的值
        dirty = false;
      }
      // 当读取value时，手动调用track函数进行跟踪
      track(obj, "value");
      return value;
    },
  };

  return obj;
}

function watch(source, cb, options = {}) {
  // getter函数
  let getter;
  // 如果source是函数，说明用户传递的是getter，所以直接把source赋值给getter
  if (typeof source === "function") {
    getter = source;
  } else {
    // 否则按照原来的实现调用traverse递归地读取
    getter = () => traverse(source);
  }
  // 定义旧值与新值
  let oldValue, newValue;

  // cleanup用来存储用户注册的过期回调
  let cleanup;

  function onInvalidate(fn) {
    // 将过期回调存储在cleanup中
    cleanup = fn;
  }

  // 提取schedular调度函数为一个独立的job函数
  const job = () => {
    // 在schedular中重新执行副作用函数，得到的是新值
    newValue = effectFn();
    // 在调用回调函数cb之前，先调用过期回调
    if (cleanup) {
      cleanup();
    }
    // 将onInvalidate作为回调函数的第三个参数，以便用户使用
    cb(newValue, oldValue, onInvalidate);
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue;
  };

  const effectFn = effect(
    // 执行getter
    () => getter(),
    {
      // 使用job函数作为调度器函数
      scheduler: () => {
        // 在调度函数中判断flush是否为'post'，如果是，将其放到微任务队列中执行
        if (options.flush === "post") {
          const p = Promise.resolve();
          p.then(job);
        } else {
          job();
        }
      },
    }
  );

  if (options.immediate) {
    // 当immediate为true时立即执行job，从而触发回调执行
    job();
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}

function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== "object" || value === null || seen.has(value)) return;
  // 将数据添加到seen中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.has(value);
  // 暂时不考虑数组等其他结构
  // 假设value就是一个对象，使用for...in读取对象的每一个值，并递归地调用traverse进行处理
  for (const k in value) {
    traverse(value[k], seen);
  }

  return value;
}

const obj = { foo: 1 };

const p53 = new Proxy(obj, {
  has(target, key) {
    track(target, key);
    return Reflect.get(target, key);
  },
});

effect(() => {
  console.log("in-------", "foo" in p53);
});

"foo" in p53;

// 拦截for...in循环
console.log("拦截for...in循环===================");

const obj1 = { foo: 1 };
const ITERATE_KEY = Symbol();

const p1 = new Proxy(obj, {
  ownKeys(target) {
    // 将副作用函数与ITERTE_KEY关联
    track(target, ITERATE_KEY);
    return Reflect.ownKeys(target);
  },
  // 拦截设置操作
  set(target, key, newVal, receiver) {
    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? "SET"
      : "ADD";
    // 设置属性值
    const res = Reflect.set(target, key, newVal, receiver);
    // 把副作用函数从桶里取出并执行
    trigger(target, key, type);
    return res;
  },
  deleteProperty(target, key) {
    // 检查被操作的属性是否是对象自己的属性
    const hadKey = Object.prototype.hasOwnProperty.call(target, key);
    // 使用Reflect.deleteProperty完成属性的删除
    const res = Reflect.deleteProperty(target, key);

    if (res && hadKey) {
      // 只有当被删除的属性是对象自己的属性并且成功删除时，才触发更新
      trigger(target, key, "DELETE");
    }
    return res;
  },
});

delete p1.foo;

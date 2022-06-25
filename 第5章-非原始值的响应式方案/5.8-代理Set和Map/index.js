/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 20:59:07
 * @LastEditTime: 2022-06-25 11:03:46
 * @LastEditors: your name
 */
console.log("5.8=============index");

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
  // 当禁止跟踪时，直接返回
  if (!activeEffect || !shouldTrack) return;
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
function trigger(target, key, type, newVal) {
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
  if (
    type === "ADD" ||
    type === "DELETE" ||
    // 如果操作类型是SET，并且目标对象是Map类型的数据
    // 也应该触发那些与ITERATE_KEY相关联的副作用函数重新执行
    (type === "SET" &&
      Object.prototype.toString.call(target) === "[object Map]")
  ) {
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

  // 当操作类型为'ADD' 或 'DELETE' 时
  if (
    (type === "ADD" || type === "DELETE") &&
    // 并且目标对象是Map类型的数据
    Object.prototype.toString.call(target) === "[object Map]"
  ) {
    // 取得与MAP_KEY_ITERATE_KEY相关联的副作用函数
    const iterateEffects = depsMap.get(MAP_KEY_ITERATE_KEY);
    // 将与MAP_KEY_ITERATE_KEY相关联的副作用函数也添加到effectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 当操作类型为ADD并且目标对象是数组时，应该取出并执行那些与length属性相关联的副作用函数
  if (type === "ADD" && Array.isArray(target)) {
    // 取出与length相关联的副作用函数
    const lengthEffects = depsMap.get("length");
    // 将这些副作用函数添加到effectsToRun中，并执行
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 如果操作目标是数组，并且修改了数组的length属性
  if (Array.isArray(target) && key === "length") {
    // 对于索引值大于或等于新的length值的元素，
    // 需要把索引相关联的副作用函数取出并添加到effectToRun中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
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

const p1 = new Proxy(obj, {
  // 拦截设置操作
  set(target, key, newVal, receiver) {
    // 先获取旧值
    const oldVal = target[key];

    const type = Object.prototype.hasOwnProperty.call(target, key)
      ? "SET"
      : "ADD";
    // 设置属性值
    const res = Reflect.set(target, key, newVal, receiver);
    // 比较新值与旧值，只要当不全等，并且都不是NaN的时候才触发响应
    if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
      // 把副作用函数从桶里取出并执行
      trigger(target, key, type);
    }
    return res;
  },
});

// 封装createReactive函数，接收一个参数isShadow代表是否为浅响应，默认为false，即非浅响应
// 增加第三个参数isReadonly，代表是否只读，默认为false，即非只读
function createReactive(obj, isShadow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过raw属性访问原始数据
      if (key === "raw") {
        return target;
      }

      // 如果操作目标是数组，并且key存在于arrayInstrumentations上，
      // 那么返回定义在arrayInstrumentations上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      // 非只读的时候才需要建立响应联系
      // 添加判断，如果key的类型是symbol，则不进行跟踪
      if (!isReadonly && typeof key !== "symbol") {
        console.log("get-key", key);
        track(target, key);
      }
      // 得到原始值结果
      const res = Reflect.get(target, key, receiver);
      // 如果是浅响应，直接返回原始值
      if (isShadow) {
        return res;
      }
      if (typeof res === "object" && res !== null) {
        return createReactive(res, false, isReadonly);
      }
      // 返回res
      return res;
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
      // 先获取旧值
      const oldVal = target[key];

      // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
        ? // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，
          // 如果是，则视作SET操作，否则是ADD操作
          Number(key) < target.length
          ? "SET"
          : "ADD"
        : Object.prototype.hasOwnProperty.call(target, key)
        ? "SET"
        : "ADD";
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
      // target === receiver.raw 说明receiver就是target的代理对象
      if (target === receiver.raw) {
        // 比较新值与旧值，只要当不全等，并且都不是NaN的时候才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 增加第四个参数，即触发响应的新值
          trigger(target, key, type, newVal);
        }
      }
      return res;
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性${key}是只读的`);
        return true;
      }
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
    ownKeys(target) {
      // 如果操作目标target是数组，则使用length属性作为key并建立联系
      track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
  });
}

const arrayInstrumentations = {};

["includes", "indexOf", "lastIndexOf"].forEach((method) => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // this是代理对象，先在代理对象中查找，将结果存储到res中
    let res = originMethod.apply(this, args);

    if (res === false) {
      // res为false说明没找到，通过this.raw拿到原始数组，再去其中查找并更新res值
      res = originMethod.apply(this.raw, args);
    }

    // 返回最终结果
    return res;
  };
});

// 一个标记变量，代表是否进行追踪。默认值为true，即允许追踪
let shouldTrack = true;

// 重写数组的push、pop、shift、unshift以及splice方法
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
  // 取得原始push方法
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function (...args) {
    // 在调用原始方法之前，禁止跟踪
    shouldTrack = false;
    // push方法的默认行为
    let res = originMethod.apply(this, args);
    // 在调用原始方法之后，恢复原来的行为，即允许追踪
    shouldTrack = true;
    return res;
  };
});

// 定义一个Map实例，存储原始对象到代理对象的映射
const reactiveMap = new Map();

// 深响应
function reactive(obj) {
  // 优先通过原始对象obj寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(obj);
  if (existionProxy) return existionProxy;

  // 否则，创建新的代理对象
  const proxy = createReactive58(obj);
  // 存储到Map中，从而帮忙重复创建
  reactiveMap.set(obj, proxy);
  return proxy;
}

// 浅响应
function shadowReactive(obj) {
  return createReactive(obj, true);
}

// 深只读
function readonly(obj) {
  return createReactive(obj, false, true);
}

// 浅只读
function shadowReadonly(obj) {
  return createReactive(obj, true, true);
}

const ITERATE_KEY = Symbol();

const arr = reactive(["foo"]);

effect(() => {
  for (const key in arr) {
    console.log(key);
  }
});

setTimeout(() => {
  arr.length = 0;
}, 2000);

console.log("for...of...");

const objForOf = {
  val: 0,
  [Symbol.iterator]() {
    return {
      next() {
        return {
          value: objForOf.val++,
          done: objForOf.val > 10 ? true : false,
        };
      },
    };
  },
};

for (const value of objForOf) {
  console.log(value);
}

const arrIterator = [1, 2, 3, 4, 5];
// 获取并调用数组内建的迭代器方法
const itr = arrIterator[Symbol.iterator]();

console.log(itr.next());
console.log(itr.next());
console.log(itr.next());
console.log(itr.next());
console.log(itr.next());
console.log(itr.next());

for (const val of arrIterator) {
  console.log(val);
}

console.log("array customizeiterator============");

arrIterator[Symbol.iterator] = function () {
  const target = this;
  const len = target.length;
  let index = 0;

  return {
    next() {
      return {
        value: index < len ? target[index] : undefined,
        done: index++ >= len,
      };
    },
  };
};

console.log("5.8start ===================");

const s = new Set([1, 2, 3]);
const p581 = new Proxy(s, {
  get(target, key, receiver) {
    if (key === "size") {
      // 如果读取的是size属性
      // 通过指定第三个参数receiver为原始对象target从而修复问题
      return Reflect.get(target, key, target);
    }
    // 将方法与原始数据对象target绑定后返回
    return target[key].bind(target);
  },
});

console.log(p581.delete(1));

// 抽离为独立的函数，便于复用
function iterationMethod() {
  // 获取原始数据对象target
  const target = this.raw;
  // 获取原始迭代器方法
  const itr = target[Symbol.iterator]();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  // 调用track函数建立响应联系
  track(target, ITERATE_KEY);

  // 返回自定义的迭代器
  return {
    next() {
      // 调用原始迭代器的next方法获取value和key
      const { value, done } = itr.next();
      return {
        // 如果value不是undefined，则对其进行包裹
        value: value ? [wrap(value[0]), wrap(value[1])] : value,
        done,
      };
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}

// 抽离为独立的函数，便于复用
function valuesIterationMethod() {
  // 获取原始数据对象target
  const target = this.raw;
  // 通过target.values获取原始迭代器方法
  const itr = target.values();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  // 调用track函数建立响应联系
  track(target, ITERATE_KEY);

  // 返回自定义的迭代器
  return {
    next() {
      // 调用原始迭代器的next方法获取value和key
      const { value, done } = itr.next();
      return {
        // value是值，而非键值对，所以只需要包裹value即可
        value: wrap(value),
        done,
      };
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}

const MAP_KEY_ITERATE_KEY = Symbol();

// 抽离为独立的函数，便于复用
function keysIterationMethod() {
  // 获取原始数据对象target
  const target = this.raw;
  // 通过target.keys获取原始迭代器方法
  const itr = target.keys();

  const wrap = (val) =>
    typeof val === "object" && val !== null ? reactive(val) : val;

  // 调用track函数跟踪依赖，在副作用函数与Map_KEY_ITERATE_KEY之间建立响应联系
  track(target, MAP_KEY_ITERATE_KEY);

  // 返回自定义的迭代器
  return {
    next() {
      // 调用原始迭代器的next方法获取value和key
      const { value, done } = itr.next();
      return {
        // value是值，而非键值对，所以只需要包裹value即可
        value: wrap(value),
        done,
      };
    },
    // 实现可迭代协议
    [Symbol.iterator]() {
      return this;
    },
  };
}

// 定义一个对象，将自定义的add方法定义到该对象下
const mutableInstrumentations = {
  add(key) {
    // this仍然指向的是代理对象，通过raw属性获取原始数据对象
    const target = this.raw;
    const hadKey = target.has(key);
    // 只要在值不存在的情况下，才需要触发响应
    if (!hadKey) {
      // 通过原始数据对象执行add方法删除具体的值
      // 注意，这里不再需要.bind了，因为是直接通过target调用并执行的
      const res = target.add(key);
      // 调用trigger函数触发响应，并指定操作类型为ADD
      trigger(target, key, "ADD");
      // 返回操作结果
      return res;
    }
  },
  delete(key) {
    const target = this.raw;
    const hadKey = target.has(key);
    const res = target.delete(key);
    // 当要删除的元素确认存在时，才触发响应
    if (hadKey) {
      trigger(target, key, "DELETE");
    }
    return res;
  },
  get(key) {
    // 获取原始对象
    const target = this.raw;
    // 判断读取的key是否存在
    const had = target.has(key);
    // 追踪依赖，建立响应联系
    track(target, key);
    // 如果存在，则返回结果，这里需要注意的是，如果得到的结果res仍然是可代理的数据，
    // 则要返回使用reactive包装后的响应式数据
    if (had) {
      const res = target.get(key);
      return typeof res === "object" ? reactive(res) : res;
    }
  },
  set(key, value) {
    const target = this.raw;
    const had = target.has(key);
    // 获取旧值
    const oldValue = target.get(key);
    // 设置新值
    target.set(key, value);

    // 获取原始数据，由于value本身可能已是原始数据，所以此时value.raw不存在，则直接使用value
    const rawValue = value.raw || value;
    target.set(key, rawValue);
    if (!had) {
      // 如果不存在，则说明是ADD类型的操作，意味着新增
      trigger(target, key, "ADD");
    } else if (
      oldValue !== value ||
      (oldValue === oldValue && value === value)
    ) {
      // 如果存在，并且值变了，则是SET类型的操作，意味着修改
      trigger(target, key, "SET");
    }
  },
  forEach(callback, thisArg) {
    // wrap函数用来把可代理的值转换为响应式数据
    const wrap = (val) => (typeof val === "object" ? reactive(val) : val);
    // 取到原始数据对象
    const target = this.raw;
    // 与ITERATE_KEY建立响应联系
    track(target, ITERATE_KEY);
    // 通过原始数据对象调用forEach方法，并把callback传递过去
    target.forEach((v, k) => {
      // 手动调用callback，用wrap函数包裹value和key后再传给callback，这样就实现了深响应
      // 通过.call调用callback，并传递thisArg
      callback.call(thisArg, wrap(v), wrap(k), this);
    });
  },
  // 共用iterationMethod方法
  [Symbol.iterator]: iterationMethod,
  entries: iterationMethod,
  values: valuesIterationMethod,
  keys: keysIterationMethod,
};

// 在creteReactive58里封装用于代理Set/Map类型数据的逻辑
function createReactive58(obj, isShadow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 如果读取的是raw属性，则返回原始数据对象target
      if (key === "raw") return target;
      if (key === "size") {
        // 如果读取的是size属性
        // 调用track函数建立响应联系
        track(target, ITERATE_KEY);
        // 通过指定第三个参数receiver为原始对象target从而修复问题
        return Reflect.get(target, key, target);
      }
      // 返回定义在mutableInstrumentations对象下的方法
      return mutableInstrumentations[key];
    },
  });
}

const p58 = reactive(
  new Map([
    ["key1", "value1"],
    ["key2", "value2"],
  ])
);

effect(() => {
  for (const value of p58.keys()) {
    console.log(value);
  }
});

p58.set("key2", "value3");
p58.set("key3", "value3");

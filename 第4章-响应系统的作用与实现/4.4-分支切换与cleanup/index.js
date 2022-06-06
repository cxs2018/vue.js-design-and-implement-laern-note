/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 20:59:07
 * @LastEditTime: 2022-06-06 21:07:49
 * @LastEditors: your name
 */
console.log("4.4=============index");

// 存储副作用函数的桶
const bucket = new WeakMap();

const data = { text: "hello world" };

// old effect函数
// // 用一个全局变量存储被注册的副作用函数
// let activeEffect;
// // effect函数用于注册副作用函数
// function effect(fn) {
//   // 当调用effect注册副作用函数时，将副作用函数fn赋值给activeEffect
//   activeEffect = fn;
//   // 执行副作用函数
//   fn();
// }

// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// effect函数用于注册副作用函数
function effect(fn) {
  const effectFn = () => {
    // 调用cleanup函数完成清除工作
    cleanup(effectFn);
    // 当effectFn执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    fn();
  };
  // activeEffect.deps用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  effectFn();
}

const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数activeEffect添加到存储副作用函数的桶中
    track(target, key);
    // 返回属性值
    return target[key];
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
function trigger(target, key) {
  // 根据target从桶中取得depsMap，它是key-->effects
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 根据key取得所有副作用函数effects
  const effects = depsMap.get(key);

  // 避免无限循环，使用新的set集合
  const effectsToRun = new Set(effects);
  // 执行副作用函数
  effectsToRun.forEach((effectFn) => effectFn());
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

effect(() => {
  document.body.innerText = obj.text + obj.newText;
});

setTimeout(() => {
  obj.text = "hello cxs";
  obj.newText = "timi";
}, 1000);

console.log(bucket, data, obj);

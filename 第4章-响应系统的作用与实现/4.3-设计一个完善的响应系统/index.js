/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 17:40:09
 * @LastEditTime: 2022-06-05 20:58:17
 * @LastEditors: your name
 */
console.log("4.3===========");

// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { text: "hello world" };

// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将activeEffect中存储的副作用函数收集到“桶”中
    if (activeEffect) {
      bucket.add(activeEffect);
    }
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newVal) {
    // 设置属性值
    target[key] = newVal;
    // 把副作用函数从桶里取出并执行
    bucket.forEach((fn) => fn());
    // 返回true代表设置操作成功
    return true;
  },
});

// 用一个全局变量存储被注册的副作用函数
let activeEffect;
// effect函数用于注册副作用函数
function effect(fn) {
  // 当调用effect注册副作用函数时，将副作用函数fn赋值给activeEffect
  activeEffect = fn;
  // 执行副作用函数
  fn();
}

// 执行注册副作用函数，触发读取
effect(
  // 一个匿名的副作用函数
  () => {
    console.log("effect run");
    document.body.innerText = obj.text;
  }
);

// 1s后修改响应数据
setTimeout(() => {
  // 副作用函数中并没有读取noExist属性的值
  obj.noExist = "hello vue3";
}, 1000);

// 缺陷 没有在副作用函数与被操作的目标字段之间建立明确的联系

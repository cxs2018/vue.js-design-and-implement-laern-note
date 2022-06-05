/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 17:40:09
 * @LastEditTime: 2022-06-05 17:58:35
 * @LastEditors: your name
 */
console.log("4.2===========111");

// 副作用函数
function effect() {
  document.body.innerText = obj.text;
  console.log("=======", obj.text);
}

// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { text: "hello world" };

// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将副作用函数effect添加到存储副作用函数的桶中
    bucket.add(effect);
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

// 执行副作用函数，触发读取
effect();

// 1s后修改响应数据
setTimeout(() => {
  obj.text = "hello vue3";
}, 1000);

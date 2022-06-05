<!--
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-06-05 17:31:15
 * @LastEditTime: 2022-06-05 17:37:37
 * @LastEditors: your name
-->

副作用函数：会产生副作用的函数

```js
const obj = { test: "hello world" };
function effect() {
  document.body.innerText = obj.text;
}
```

effect 函数的执行，会设置 body 的文本内容，但除了 effect 函数以外的任何函数都可以读取或设置 body 的文本内容。

effect 函数的执行会直接或间接影响其他函数的执行，这时我们说 effect 函数产生了副作用。

响应式数据，当修改 obj.text 的值，我们希望当值变化后，副作用函数可以重新执行，如果能实现这个目标，那么对象 obj 就是响应式数据

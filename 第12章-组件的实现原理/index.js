/*
 * @Description:
 * @Author: cuixuesen
 * @Date: 2022-10-03 10:11:26
 * @LastEditTime: 2022-10-03 11:08:19
 * @LastEditors: your name
 */
// MyComponent 是一个组件，它的值是一个选项对象
const MyComponent = {
  name: "MyComponent",
  data() {
    return { foo: 1 };
  },
};

// 该vnode用来描述普通标签
const vNode = {
  type: "div",
};

// Fragment => 片段
// Text => 文本节点

function patch(n1, n2, container, anchor) {
  if (n1 && n1.type !== n2.type) {
    unmount(n1);
    n1 = null;

    const { type } = n2;

    if (typeof type === "string") {
      // 作为普通元素处理
    } else if (typeof type === Text) {
      // 作为文本节点处理
    } else if (type === Fragment) {
      // 作为片段处理
    } else if (typeof type === "object") {
      // vnode.type 的值是选项对象，作为组件处理
      if (!n1) {
        // 挂载组件
        mountComponent(n2, container, anchor);
      } else {
        // 更新组件
        patchComponent(n1, n2, container);
      }
    }
  }
}

// 渲染器有能力处理组件之后，设计组件在用户层面的接口：用户应该如何编写组件？组件的选项对象必须包含哪些内容？组件拥有哪些能力

const MyComponent = {
  // 组件名称，可选
  name: "MyComponent",
  // 用data函数来定义组件自身的状态
  data() {
    return {
      foo: "hello world",
    };
  },
  // 组件的渲染函数，其返回值必须为虚拟DOM
  render() {
    // 返回虚拟DOM
    return {
      type: "div",
      children: `foo的值是: ${this.foo}`, // 在渲染函数内使用组件状态
    };
  },
};

// 用来描述组件的VNode对象，type属性为组件的选项对象
const CompVNode = {
  type: MyComponent,
};

// 调用渲染器来渲染组件
renderer.render(CompVNode, document.querySelector("#app"));

function mountComponent(vnode, container, anchor) {
  // 通过vnode获取组件的选项对象，即vnode.type
  const componentOptions = vnode.type;
  // 获取组件的渲染函数 render
  const { render, data } = componentOptions;

  // 调用data函数得到原始数据，并调用reactive函数将其包装为响应式数据
  const state = reactive(data());

  // 将组件的render函数调用包装到effect中
  effect(
    () => {
      // 执行渲染函数，获取组件要渲染的内容，即render函数返回的虚拟DOM
      // 调用render函数时，将其this设置为state,
      // 从而render函数内部可以通过this访问组件自身状态数据
      const subTree = render.call(state, state);
      // 最好调用patch函数来挂载组件所描述的内容，即subTree
      patch(null, subTree, container, anchor);
    },
    {
      // 指定该副作用函数的调度器为queueJob
      scheduler: queueJob,
    }
  );
}

// 任务缓存队列，用一个Set数据结构来表示，这样就可以自动对任务进行去重
const queue = new Set();
// 一个标志，代表是否正在刷新任务队列
let isFlushing = false;
// 创建一个立即resolve的Promise实例
const p = Promise.resolve();

// 调度器的主要函数，用来将一个任务添加到缓冲队列中，并开始刷新队列
function queueJob(job) {
  // 将job添加到任务队列queue中
  queue.add(job);
  // 如果还没有开始刷新队列，则刷新之
  if (!isFlushing) {
    // 将该标志设置为true以避免重复刷新
    isFlushing = true;
    // 在微任务中刷新缓冲队列
    p.then(() => {
      try {
        // 执行任务队列中的任务
        queue.forEach((job) => job());
      } finally {
        // 重置状态
        isFlushing = false;
        queue.length = 0;
      }
    });
  }
}

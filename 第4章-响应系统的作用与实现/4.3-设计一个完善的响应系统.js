let activeEffect;

function effect(fn) {
  activeEffect = fn;
  fn();
}

const data = { text: "Hello, world!" };

const bucket = new WeakMap();

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = bucket.get(target);
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }
  let deps = depsMap.get(key);
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  deps.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  effects && effects.forEach((fn) => fn());
}

const obj = new Proxy(data, {
  get(target, key) {
    track(target, key);
    return target[key];
  },
  set(target, key, newVal) {
    target[key] = newVal;
    trigger(target, key);
    return true;
  },
});

effect(() => {
  console.log("我读取了响应式数据data.text: ", obj.text);
});

obj.text = "你好，世界！";

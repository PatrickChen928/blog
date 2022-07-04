(function (e) {
  function t(t) {
    for (
      var r, a, i = t[0], l = t[1], c = t[2], p = 0, d = [];
      p < i.length;
      p++
    )
      (a = i[p]),
        Object.prototype.hasOwnProperty.call(o, a) && o[a] && d.push(o[a][0]),
        (o[a] = 0);
    for (r in l) Object.prototype.hasOwnProperty.call(l, r) && (e[r] = l[r]);
    s && s(t);
    while (d.length) d.shift()();
    return u.push.apply(u, c || []), n();
  }
  function n() {
    for (var e, t = 0; t < u.length; t++) {
      for (var n = u[t], r = !0, i = 1; i < n.length; i++) {
        var l = n[i];
        0 !== o[l] && (r = !1);
      }
      r && (u.splice(t--, 1), (e = a((a.s = n[0]))));
    }
    return e;
  }
  var r = {},
    o = { app: 0 },
    u = [];
  function a(t) {
    if (r[t]) return r[t].exports;
    var n = (r[t] = { i: t, l: !1, exports: {} });
    return e[t].call(n.exports, n, n.exports, a), (n.l = !0), n.exports;
  }
  (a.m = e),
    (a.c = r),
    (a.d = function (e, t, n) {
      a.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: n });
    }),
    (a.r = function (e) {
      "undefined" !== typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(e, "__esModule", { value: !0 });
    }),
    (a.t = function (e, t) {
      if ((1 & t && (e = a(e)), 8 & t)) return e;
      if (4 & t && "object" === typeof e && e && e.__esModule) return e;
      var n = Object.create(null);
      if (
        (a.r(n),
        Object.defineProperty(n, "default", { enumerable: !0, value: e }),
        2 & t && "string" != typeof e)
      )
        for (var r in e)
          a.d(
            n,
            r,
            function (t) {
              return e[t];
            }.bind(null, r)
          );
      return n;
    }),
    (a.n = function (e) {
      var t =
        e && e.__esModule
          ? function () {
              return e["default"];
            }
          : function () {
              return e;
            };
      return a.d(t, "a", t), t;
    }),
    (a.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t);
    }),
    (a.p = "/");
  var i = (window["webpackJsonp"] = window["webpackJsonp"] || []),
    l = i.push.bind(i);
  (i.push = t), (i = i.slice());
  for (var c = 0; c < i.length; c++) t(i[c]);
  var s = l;
  u.push([0, "chunk-vendors"]), n();
})({
  0: function (e, t, n) {
    e.exports = n("56d7");
  },
  "1bb9": function (e, t, n) {
    "use strict";
    var r = n("1c22"),
      o = n.n(r);
    o.a;
  },
  "1c22": function (e, t, n) {},
  2395: function (e, t, n) {},
  "4dcb": function (e, t, n) {},
  "56d7": function (e, t, n) {
    "use strict";
    n.r(t);
    var r = n("a026"),
      o = function () {
        var e = this,
          t = e.$createElement,
          n = e._self._c || t;
        return n("div", { attrs: { id: "app" } }, [n("router-view")], 1);
      },
      u = [],
      a = (n("7c55"), n("2877")),
      i = {},
      l = Object(a["a"])(i, o, u, !1, null, null, null),
      c = l.exports,
      s = n("8c4f"),
      p = function () {
        var e = this,
          t = e.$createElement,
          n = e._self._c || t;
        return n("div", { staticClass: "home" }, [
          n("div", { staticClass: "left_edit--box" }, [
            n("button", { on: { click: e.run } }, [e._v("运行代码")]),
            n("textarea", {
              directives: [
                {
                  name: "model",
                  rawName: "v-model",
                  value: e.tempValue,
                  expression: "tempValue",
                },
              ],
              domProps: { value: e.tempValue },
              on: {
                input: function (t) {
                  t.target.composing || (e.tempValue = t.target.value);
                },
              },
            }),
          ]),
          e._m(0),
        ]);
      },
      d = [
        function () {
          var e = this,
            t = e.$createElement,
            n = e._self._c || t;
          return n("div", { staticClass: "J__right_show--box" }, [
            n("div", { attrs: { id: "showBox" } }),
          ]);
        },
      ],
      f =
        '<template>\n    <div>\n        <h1>{{num}}</h1>\n        <button @click="addNum">增加</button>\n    </div>\n</template>\n\n<script>\n    export default {\n\n        data() {\n            return {\n                num: 0 \n            }\n        },\n        methods: {\n            addNum() {\n                this.num++;\n            }\n        }\n    }\n</script>\n\n<style>\n    h1 {\n        font-size: 40px;\n        color: red;\n    }\n    button {\n        width: 100px;\n        line-height: 32px;\n        font-size: 14px;\n        color: #fff;\n        background: #4e6ef2;\n        border-radius: 4px;\n        border: none;\n    }\n</style>\n',
      m = {
        name: "Home",
        data() {
          return { tempValue: f };
        },
        methods: {
          getSource(e, t) {
            const n = new RegExp(`<${t}[^>]*>`);
            let r = e.match(n);
            return r
              ? ((r = r[0]),
                e.slice(e.indexOf(r) + r.length, e.lastIndexOf(`</${t}>`)))
              : "";
          },
          run() {
            let e = this.getSource(this.tempValue, "template"),
              t = this.getSource(this.tempValue, "script").replace(
                "export default",
                "return"
              ),
              n = this.getSource(this.tempValue, "style"),
              o = new Function(t)();
            (e = "<div> " + e + " </div>"), (o.template = e);
            const u = r["a"].extend(o);
            let a = new u().$mount().$el;
            this.handleCss(n);
            document.getElementById("showBox").innerHTML = '';
            document.getElementById("showBox").append(a);
          },
          handleCss(e) {
            let t = document.createElement("style");
            (t.innerHTML = e), document.head.appendChild(t);
          },
        },
      },
      h = m,
      v = (n("1bb9"), Object(a["a"])(h, p, d, !1, null, "26e69330", null)),
      b = v.exports;
    r["a"].use(s["a"]);
    const g = [{ path: "/", name: "Home", component: b }],
      x = new s["a"]({ mode: "hash", base: "/", routes: g });
    var y = x;
    n("4dcb");
    (r["a"].config.productionTip = !1),
      new r["a"]({
        router: y,
        render: function (e) {
          return e(c);
        },
      }).$mount("#app");
  },
  "7c55": function (e, t, n) {
    "use strict";
    var r = n("2395"),
      o = n.n(r);
    o.a;
  },
});

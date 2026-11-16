import { useState, useEffect } from "react";
import { api } from "./api";

const CATS = [["Home", ""], ["Apparel", "apparel"], ["Electronics", "electronics"], ["Mobile", "mobile"], ["Cosmetics", "cosmetics"], ["Furniture", "furniture"], ["Best Seller", "best"], ["Food Items", "food"]];
const SLIDES = [
  ["Up to 60% off on Apparel & Electronics", "Festive offers on every product, this week only", "s1"],
  ["Pay later with easy EMI", "3, 6, 9 or 12 months on mobiles and furniture", "s2"],
  ["Sell on Buykart", "Create a seller account and list your first product in minutes", "s3"],
];
const money = (n) => "₹" + Number(n).toLocaleString("en-IN");

function Auth({ onDone, onClose }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", role: "buyer" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr("");
    try {
      if (mode === "signup") await api("/auth/register/", { method: "POST", body: f });
      const t = await api("/auth/login/", { method: "POST", body: { username: f.email, password: f.password } });
      localStorage.access = t.access; localStorage.refresh = t.refresh;
      onDone(await api("/auth/me/"));
    } catch (x) { setErr(x.detail || "Check your details and try again"); }
  };
  return (
    <div className="overlay"><form className="modal" onSubmit={submit}>
      <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
      <h2>{mode === "login" ? "Welcome back to Buykart" : "Create your Buykart account"}</h2>
      {mode === "signup" && <>
        <input placeholder="Full name" value={f.name} onChange={set("name")} required />
        <input placeholder="Contact number" value={f.phone} onChange={set("phone")} required />
      </>}
      <input type="email" placeholder="Email ID" value={f.email} onChange={set("email")} required />
      <input type="password" placeholder="Password" value={f.password} onChange={set("password")} required />
      {mode === "signup" && <div className="roles">
        {["buyer", "seller"].map((r) => <label key={r} className={f.role === r ? "on" : ""}>
          <input type="radio" checked={f.role === r} onChange={() => setF({ ...f, role: r })} />{r === "buyer" ? "Buyer account" : "Seller account"}</label>)}
      </div>}
      {err && <p className="err">{typeof err === "string" ? err : JSON.stringify(err)}</p>}
      <button className="btn">{mode === "login" ? "Log in" : "Sign up"}</button>
      <p className="swap" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "New here? Create an account" : "Already registered? Log in"}</p>
    </form></div>
  );
}

function Slider() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 4500); return () => clearInterval(t); }, []);
  const [h, p, c] = SLIDES[i];
  return <section className={"slider " + c}><div><h1>{h}</h1><p>{p}</p></div>
    <div className="dots">{SLIDES.map((_, n) => <button key={n} className={n === i ? "on" : ""} onClick={() => setI(n)} aria-label={"Slide " + (n + 1)} />)}</div></section>;
}

function Checkout({ items, onClose, onPlaced }) {
  const total = items.reduce((s, i) => s + i.product_detail.price * i.qty, 0);
  const [pay, setPay] = useState("cod"); const [m, setM] = useState(6);
  const opts = [["paypal", "PayPal"], ["gpay", "GPay"], ["cod", "Cash on delivery"], ["emi", "EMI"]];
  const [err, setErr] = useState("");
  const place = async () => {
    setErr("");
    try {
      if (pay === "cod") { await api("/orders/", { method: "POST", body: { payment: "cod" } }); return onPlaced(); }
      const months = pay === "emi" ? m : 0;
      const o = await api("/payments/create/", { method: "POST", body: { payment: pay } });
      new window.Razorpay({
        key: o.key, amount: o.amount, currency: "INR", order_id: o.order_id, name: "Buykart", description: "Order payment",
        prefill: { method: { gpay: "upi", emi: "emi", paypal: "paypal" }[pay] },
        handler: async (r) => {
          try { await api("/payments/verify/", { method: "POST", body: { ...r, payment: pay, emi_months: months } }); onPlaced(); }
          catch (x) { setErr(x.detail || "Payment could not be verified"); }
        },
        modal: { ondismiss: () => setErr("Payment cancelled. Your cart is unchanged.") },
      }).open();
    } catch (x) { setErr(x.detail || "Couldn't start the payment. Try again."); }
  };
  return <div className="overlay"><div className="modal">
    <button className="x" onClick={onClose} aria-label="Close">×</button>
    <h2>Choose payment · {money(total)}</h2>
    {opts.map(([k, l]) => <label key={k} className={"pay " + (pay === k ? "on" : "")}><input type="radio" checked={pay === k} onChange={() => setPay(k)} />{l}</label>)}
    {pay === "emi" && <select value={m} onChange={(e) => setM(+e.target.value)}>
      {[3, 6, 9, 12].map((n) => <option key={n} value={n}>{n} months · {money(total / n)} / month</option>)}</select>}
    {err && <p className="err">{err}</p>}
    <button className="btn" onClick={place}>{pay === "cod" ? "Place order" : "Pay " + money(total)}</button>
  </div></div>;
}

function Card({ p, onAdd }) {
  return <article className="card"><img src={p.image} alt={p.name} />
    <div><h3>{p.name}</h3><small>{p.category}{p.best_seller && " · Best seller"}</small>
      <p className="desc">{p.description}</p><strong>{money(p.price)}</strong></div>
    {onAdd && <button className="btn" onClick={() => onAdd(p)}>Add to cart</button>}</article>;
}

function Seller() {
  const blank = { name: "", category: "apparel", price: "", description: "", best_seller: false };
  const [f, setF] = useState(blank); const [img, setImg] = useState(null);
  const [edit, setEdit] = useState(null); const [list, setList] = useState([]);
  const load = () => api("/products/?mine=1").then(setList);
  useEffect(() => { load(); }, []);
  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => ["name", "category", "price", "description", "best_seller"].includes(k) && fd.append(k, v));
    if (img) fd.append("image", img);
    await api(edit ? `/products/${edit}/` : "/products/", { method: edit ? "PATCH" : "POST", form: fd });
    setF(blank); setImg(null); setEdit(null); e.target.reset(); load();
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return <main className="page"><h2>Seller dashboard</h2>
    <form className="sform" onSubmit={save}>
      <input type="file" accept="image/*" onChange={(e) => setImg(e.target.files[0])} required={!edit} />
      <input placeholder="Product name" value={f.name} onChange={set("name")} required />
      <select value={f.category} onChange={set("category")}>{CATS.filter(([, v]) => v && v !== "best").map(([l, v]) => <option key={v} value={v}>{l}</option>)}</select>
      <input type="number" placeholder="Price (₹)" value={f.price} onChange={set("price")} required />
      <textarea placeholder="Product description" value={f.description} onChange={set("description")} required />
      <label><input type="checkbox" checked={f.best_seller} onChange={(e) => setF({ ...f, best_seller: e.target.checked })} /> Show in Best Seller</label>
      <button className="btn">{edit ? "Save changes" : "Submit product"}</button>
    </form>
    <h3>Your products</h3>
    <div className="grid">{list.map((p) => <div key={p.id}><Card p={p} />
      <div className="row"><button className="ghost" onClick={() => { setEdit(p.id); setF({ name: p.name, category: p.category, price: p.price, description: p.description, best_seller: p.best_seller }); scrollTo(0, 0); }}>Edit</button>
        <button className="ghost" onClick={async () => { await api(`/products/${p.id}/`, { method: "DELETE" }); load(); }}>Delete</button></div></div>)}
      {!list.length && <p>No products yet. Add your first one above.</p>}</div></main>;
}

export default function App() {
  const [user, setUser] = useState(null); const [auth, setAuth] = useState(false);
  const [view, setView] = useState("home"); const [cat, setCat] = useState(""); const [q, setQ] = useState("");
  const [products, setProducts] = useState([]); const [cart, setCart] = useState([]); const [orders, setOrders] = useState([]);
  const [pay, setPay] = useState(false); const [top, setTop] = useState(false); const [toast, setToast] = useState("");

  useEffect(() => {
    (localStorage.access ? api("/auth/me/").then(setUser).catch(() => setAuth(true)) : Promise.resolve(setAuth(true)));
    const s = () => setTop(scrollY > 300); addEventListener("scroll", s); return () => removeEventListener("scroll", s);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(); if (cat === "best") p.set("best", 1); else if (cat) p.set("category", cat); if (q) p.set("q", q);
    api("/products/?" + p).then(setProducts).catch(() => {});
  }, [cat, q]);
  const loadCart = () => user?.role === "buyer" && api("/cart/").then(setCart);
  const loadOrders = () => user?.role === "buyer" && api("/orders/").then(setOrders);
  useEffect(() => { loadCart(); loadOrders(); }, [user]);
  const say = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const add = async (p) => {
    if (!user) return setAuth(true);
    await api("/cart/", { method: "POST", body: { product: p.id } }); loadCart(); say("Added to cart");
  };
  const logout = () => { localStorage.clear(); setUser(null); setView("home"); setAuth(true); };
  const go = (v, c = "") => { setView(v); setCat(c); };
  const seller = user?.role === "seller";

  return <>
    {auth && !user && <Auth onDone={(u) => { setUser(u); setAuth(false); }} onClose={() => setAuth(false)} />}
    {pay && <Checkout items={cart} onClose={() => setPay(false)} onPlaced={() => { setPay(false); loadCart(); loadOrders(); setView("orders"); say("Order placed"); }} />}
    <header>
      <div className="top"><b className="logo" onClick={() => go("home")}>Buy<span>kart</span></b>
        <input className="search" placeholder="Search products on Buykart" value={q} onChange={(e) => { setQ(e.target.value); setView("home"); }} />
        <div className="acts">
          {user ? <><span>Hi, {user.first_name}</span>
            {!seller && <><button onClick={() => setView("orders")}>My orders</button><button onClick={() => setView("cart")}>Cart ({cart.length})</button></>}
            {seller && <button onClick={() => setView("seller")}>Seller dashboard</button>}
            <button onClick={logout}>Log out</button></> : <button onClick={() => setAuth(true)}>Log in / Sign up</button>}
        </div></div>
      <nav>{CATS.map(([l, v]) => <button key={l} className={view === "home" && cat === v ? "on" : ""} onClick={() => go("home", v)}>{l}</button>)}</nav>
    </header>

    {view === "home" && <>{!cat && !q && <Slider />}
      <main className="page"><h2>{q ? `Results for “${q}”` : cat === "best" ? "Best sellers" : cat ? cat[0].toUpperCase() + cat.slice(1) : "Fresh on Buykart"}</h2>
        <div className="grid">{products.map((p) => <Card key={p.id} p={p} onAdd={seller ? null : add} />)}
          {!products.length && <p>No products found. Try another category or search word.</p>}</div></main></>}

    {view === "cart" && <main className="page"><h2>Your cart</h2>
      {cart.map((i) => <div className="line" key={i.id}><img src={i.product_detail.image} alt="" /><span>{i.product_detail.name} × {i.qty}</span>
        <strong>{money(i.product_detail.price * i.qty)}</strong>
        <button className="ghost" onClick={async () => { await api(`/cart/${i.id}/`, { method: "DELETE" }); loadCart(); }}>Remove</button></div>)}
      {cart.length ? <button className="btn" onClick={() => setPay(true)}>Buy now</button> : <p>Your cart is empty.</p>}</main>}

    {view === "orders" && <main className="page"><h2>My orders</h2>
      {orders.map((o) => <div className="line" key={o.id}><img src={o.product_detail.image} alt="" />
        <span>{o.product_detail.name} × {o.qty}<br /><small>{o.payment.toUpperCase()}{o.emi_months ? ` · ${o.emi_months} months` : ""} · {o.status}</small></span>
        <strong>{money(o.total)}</strong>
        {o.status === "placed" ? <button className="ghost" onClick={async () => { await api(`/orders/${o.id}/cancel/`, { method: "POST" }); loadOrders(); }}>Cancel order</button> : <em>Cancelled</em>}</div>)}
      {!orders.length && <p>No orders yet.</p>}</main>}

    {view === "seller" && seller && <Seller />}

    <footer><div><b>Buykart</b><p>Shop apparel, electronics, mobiles, cosmetics, furniture and food in one place.</p></div>
      <div><b>Help</b><p>Track order · Returns · Contact us</p></div><div><b>Sell</b><p>Create a seller account · Seller guide</p></div>
      <small>© 2026 Buykart</small></footer>
    {top && <button className="up" onClick={() => scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top">↑</button>}
    {toast && <div className="toast">{toast}</div>}
  </>;
}

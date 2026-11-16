const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
// Sends the access token; if it has expired (401) it silently gets a new one with the refresh token.
export async function api(path, { method = "GET", body, form } = {}) {
  const h = {};
  if (localStorage.access) h.Authorization = "Bearer " + localStorage.access;
  if (body) h["Content-Type"] = "application/json";
  const go = () => fetch(API + path, { method, headers: h, body: form || (body && JSON.stringify(body)) });
  let r = await go();
  if (r.status === 401 && localStorage.refresh) {
    const t = await fetch(API + "/auth/refresh/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: localStorage.refresh }) });
    if (t.ok) { localStorage.access = (await t.json()).access; h.Authorization = "Bearer " + localStorage.access; r = await go(); }
    else { localStorage.clear(); location.reload(); }
  }
  const d = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw d || { detail: "Something went wrong" };
  return d;
}

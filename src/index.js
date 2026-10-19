const MAX_IMAGE_BYTES = 1_500_000; // 1.5 MB per foto; batas praktis untuk penyimpanan di D1
const SESSION_SECONDS = 60 * 60 * 8;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const found = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : "";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(signature)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function validSession(request, env) {
  if (!env.ADMIN_PIN) return false;
  const token = cookieValue(request, "admin_session");
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (await sign(payload, env.ADMIN_PIN) !== signature) return false;
  try {
    const parsed = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return parsed.exp > Date.now();
  } catch { return false; }
}

function sessionCookie(token, maxAge = SESSION_SECONDS) {
  return `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function page(storeName) {
  const title = escapeHtml(storeName || "TOKO FOTO");
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0b3d3b">
<title>${title}</title>
<style>
:root{--teal:#0b3d3b;--orange:#bd5121;--paper:#faf7f2;--ink:#202625;--muted:#66706d}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{background:var(--teal);color:#fff;border-bottom:8px solid var(--orange)}
.wrap{max-width:1100px;margin:auto;padding:0 22px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:26px 0}
.brand{font-weight:850;letter-spacing:.08em;font-size:clamp(1.2rem,3vw,1.8rem)}
.sub{color:#d7e6e2;margin:4px 0 0;font-size:.95rem}
button,.button{border:0;border-radius:8px;padding:11px 16px;font:inherit;font-weight:700;cursor:pointer}
.btn-admin{background:var(--orange);color:white}.btn-primary{background:var(--teal);color:#fff}.btn-light{background:#eee7df;color:var(--ink)}
main{padding:34px 0 70px}.intro{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:22px}
h1{font-size:clamp(1.5rem,4vw,2.2rem);line-height:1.15;margin:0 0 8px}.muted{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}
.card{background:white;border:1px solid #e9e2da;border-radius:13px;overflow:hidden;box-shadow:0 5px 18px #163a3510}
.photo{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#e9e2da}
.card-body{padding:14px}.card h2{font-size:1.05rem;margin:0 0 5px;overflow-wrap:anywhere}.desc{color:var(--muted);font-size:.92rem;white-space:pre-wrap;overflow-wrap:anywhere}
.empty{border:1px dashed #c9c1b8;border-radius:14px;padding:48px 20px;text-align:center;color:var(--muted)}
footer{background:#eee7df;padding:18px 0;color:#5b625f;font-size:.9rem}
dialog{border:0;border-radius:14px;padding:0;width:min(520px,calc(100% - 28px));box-shadow:0 20px 80px #0004}
dialog::backdrop{background:#071b1acc}.modal-head{padding:18px 22px;background:var(--teal);color:white;display:flex;justify-content:space-between;align-items:center}
.modal-body{padding:22px}.modal-body label{display:block;font-weight:700;margin:13px 0 6px}
input,textarea{width:100%;padding:11px 12px;border:1px solid #cfc9c1;border-radius:8px;font:inherit;background:white}
textarea{min-height:80px;resize:vertical}.row-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
.admin-list{margin-top:20px;display:grid;gap:10px}.admin-item{display:flex;align-items:center;gap:12px;border:1px solid #e4ddd5;border-radius:10px;padding:10px}
.thumb{width:58px;height:65px;object-fit:cover;border-radius:6px;background:#eee}.admin-item .meta{flex:1;min-width:0;overflow-wrap:anywhere}
.small{font-size:.82rem}.status{min-height:1.4em;color:var(--orange);font-size:.92rem;margin-top:10px}
.hidden{display:none!important}
@media(max-width:560px){.top{align-items:flex-start}.intro{align-items:flex-start;flex-direction:column}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.card-body{padding:11px}.wrap{padding:0 14px}}
</style>
</head>
<body>
<header><div class="wrap top"><div><div class="brand">${title}</div><p class="sub">Koleksi produk, ditampilkan dengan sederhana.</p></div><button class="btn-admin" id="openAdmin">Admin</button></div></header>
<main class="wrap"><div class="intro"><div><h1>Galeri Produk</h1><div class="muted">Lihat foto produk terbaru kami.</div></div><div class="muted small" id="count"></div></div><div class="grid" id="products"></div><div class="empty hidden" id="empty"><strong>Belum ada foto produk.</strong><br>Foto produk akan tampil di halaman ini setelah ditambahkan oleh admin.</div></main>
<footer><div class="wrap">© <span id="year"></span> ${title}</div></footer>
<dialog id="adminDialog">
<div class="modal-head"><strong id="modalTitle">Konsol Admin</strong><button class="btn-light" id="closeAdmin" aria-label="Tutup">Tutup</button></div>
<div class="modal-body">
<section id="loginPanel"><p class="muted">Masukkan PIN untuk mengelola foto produk.</p><label for="pin">PIN admin</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Masukkan PIN"><div class="row-actions"><button class="btn-primary" id="loginBtn">Masuk</button></div><div class="status" id="loginStatus"></div></section>
<section id="managePanel" class="hidden">
<form id="uploadForm"><label for="productName">Nama produk *</label><input id="productName" required maxlength="100" placeholder="Contoh: Tas kanvas">
<label for="productDesc">Keterangan (opsional)</label><textarea id="productDesc" maxlength="500" placeholder="Warna, ukuran, atau detail singkat"></textarea>
<label for="productImage">Foto produk * (JPG, PNG, WebP, maksimal 1,5 MB)</label><input id="productImage" type="file" accept="image/jpeg,image/png,image/webp" required>
<div class="row-actions"><button class="btn-primary" type="submit" id="uploadBtn">Tambah foto</button><button class="btn-light" type="button" id="logoutBtn">Keluar</button></div><div class="status" id="uploadStatus"></div></form>
<h3>Foto yang sudah dipajang</h3><div id="adminList" class="admin-list"></div>
</section>
</div></dialog>
<script>
const $=id=>document.getElementById(id);
$("year").textContent=new Date().getFullYear();
const dialog=$("adminDialog");
$("openAdmin").onclick=()=>{dialog.showModal();checkSession()};
$("closeAdmin").onclick=()=>dialog.close();
async function api(url,opts={}){const r=await fetch(url,opts);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Terjadi kesalahan");return d}
function showLogin(){ $("loginPanel").classList.remove("hidden");$("managePanel").classList.add("hidden");$("modalTitle").textContent="Konsol Admin"; }
function showManage(){ $("loginPanel").classList.add("hidden");$("managePanel").classList.remove("hidden");$("modalTitle").textContent="Kelola Foto Produk";loadAdminList(); }
async function checkSession(){try{const d=await api("/api/session");d.authenticated?showManage():showLogin()}catch{showLogin()}}
$("loginBtn").onclick=async()=>{ $("loginStatus").textContent="Memeriksa PIN…";try{await api("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:$("pin").value})});$("pin").value="";$("loginStatus").textContent="";showManage()}catch(e){$("loginStatus").textContent=e.message}};
$("pin").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").onclick=async()=>{try{await api("/api/logout",{method:"POST"})}finally{showLogin();$("loginStatus").textContent="Anda sudah keluar."}};
$("uploadForm").onsubmit=async e=>{e.preventDefault();const file=$("productImage").files[0];if(!file)return;$("uploadStatus").textContent="Mengunggah foto…";$("uploadBtn").disabled=true;try{const fd=new FormData();fd.append("name",$("productName").value.trim());fd.append("description",$("productDesc").value.trim());fd.append("image",file);await api("/api/products",{method:"POST",body:fd});$("uploadForm").reset();$("uploadStatus").textContent="Foto berhasil ditambahkan.";await loadProducts();await loadAdminList()}catch(err){$("uploadStatus").textContent=err.message}finally{$("uploadBtn").disabled=false}};
async function loadProducts(){try{const {products}=await api("/api/products");$("count").textContent=products.length+" produk";$("products").innerHTML="";$("empty").classList.toggle("hidden",products.length>0);for(const p of products){const article=document.createElement("article");article.className="card";const img=document.createElement("img");img.className="photo";img.loading="lazy";img.alt=p.name;img.src="/api/products/"+p.id+"/image";const body=document.createElement("div");body.className="card-body";const h=document.createElement("h2");h.textContent=p.name;body.append(h);if(p.description){const desc=document.createElement("div");desc.className="desc";desc.textContent=p.description;body.append(desc)}article.append(img,body);$("products").append(article)}}catch(e){$("empty").classList.remove("hidden");$("empty").textContent="Produk belum dapat dimuat. Coba muat ulang halaman."}}
async function loadAdminList(){try{const {products}=await api("/api/products");$("adminList").innerHTML="";if(!products.length){$("adminList").textContent="Belum ada foto.";return}for(const p of products){const item=document.createElement("div");item.className="admin-item";const img=document.createElement("img");img.className="thumb";img.src="/api/products/"+p.id+"/image";img.alt="";const meta=document.createElement("div");meta.className="meta";const strong=document.createElement("strong");strong.textContent=p.name;const date=document.createElement("div");date.className="muted small";date.textContent=p.created_at;meta.append(strong,date);const del=document.createElement("button");del.className="btn-light";del.textContent="Hapus";del.onclick=async()=>{if(!confirm('Hapus foto "'+p.name+'"?'))return;try{await api("/api/products/"+p.id,{method:"DELETE"});await loadProducts();await loadAdminList()}catch(e){alert(e.message)}};item.append(img,meta,del);$("adminList").append(item)}}catch(e){$("adminList").textContent=e.message}}
loadProducts();
</script>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/" && method === "GET") {
      return new Response(page(env.STORE_NAME), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (path === "/api/session" && method === "GET") {
      return json({ authenticated: await validSession(request, env) });
    }

    if (path === "/api/login" && method === "POST") {
      if (!env.ADMIN_PIN) return json({ error: "ADMIN_PIN belum disetel di Cloudflare." }, 500);
      let body;
      try { body = await request.json(); } catch { return json({ error: "Format permintaan tidak valid." }, 400); }
      if (typeof body.pin !== "string" || body.pin.length > 64 || body.pin !== env.ADMIN_PIN) {
        return json({ error: "PIN salah." }, 401);
      }
      const payload = btoa(JSON.stringify({ exp: Date.now() + SESSION_SECONDS * 1000 }))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const token = payload + "." + await sign(payload, env.ADMIN_PIN);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie(token) });
    }

    if (path === "/api/logout" && method === "POST") {
      return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
    }

    if (path === "/api/products" && method === "GET") {
      const { results = [] } = await env.DB.prepare(
        "SELECT id, name, description, mime_type, created_at FROM products ORDER BY id DESC"
      ).all();
      return json({ products: results });
    }

    const imageMatch = path.match(/^\/api\/products\/(\d+)\/image$/);
    if (imageMatch && method === "GET") {
      const row = await env.DB.prepare("SELECT image, mime_type FROM products WHERE id = ?")
        .bind(Number(imageMatch[1])).first();
      if (!row) return new Response("Foto tidak ditemukan", { status: 404 });
      return new Response(row.image, {
        headers: {
          "content-type": row.mime_type,
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (path === "/api/products" && method === "POST") {
      if (!await validSession(request, env)) return json({ error: "Silakan masuk sebagai admin." }, 401);
      let form;
      try { form = await request.formData(); } catch { return json({ error: "Form unggahan tidak valid." }, 400); }
      const name = String(form.get("name") || "").trim();
      const description = String(form.get("description") || "").trim();
      const image = form.get("image");
      if (!name || name.length > 100) return json({ error: "Nama produk wajib diisi (maksimal 100 karakter)." }, 400);
      if (description.length > 500) return json({ error: "Keterangan maksimal 500 karakter." }, 400);
      if (!(image instanceof File) || !image.size) return json({ error: "Pilih foto produk." }, 400);
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        return json({ error: "Format foto harus JPG, PNG, atau WebP." }, 400);
      }
      if (image.size > MAX_IMAGE_BYTES) return json({ error: "Ukuran foto maksimal 1,5 MB." }, 413);
      const bytes = new Uint8Array(await image.arrayBuffer());
      await env.DB.prepare(
        "INSERT INTO products (name, description, mime_type, image) VALUES (?, ?, ?, ?)"
      ).bind(name, description, image.type, bytes).run();
      return json({ ok: true }, 201);
    }

    const productMatch = path.match(/^\/api\/products\/(\d+)$/);
    if (productMatch && method === "DELETE") {
      if (!await validSession(request, env)) return json({ error: "Silakan masuk sebagai admin." }, 401);
      await env.DB.prepare("DELETE FROM products WHERE id = ?").bind(Number(productMatch[1])).run();
      return json({ ok: true });
    }

    return new Response("Tidak ditemukan", { status: 404 });
  },
};

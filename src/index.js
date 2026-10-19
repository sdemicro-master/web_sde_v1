const MAX_IMAGE_BYTES = 1_500_000;
const SESSION_SECONDS = 60 * 60 * 8;
const ALLOWED_CATEGORIES = new Set(["Fashion","Elektronik","Rumah & Living","Kecantikan","Aksesori","Olahraga","Anak","Sale","Lainnya"]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const found = raw.split(";").map(v => v.trim()).find(v => v.startsWith(name + "="));
  return found ? found.slice(name.length + 1) : "";
}
function bytesToBase64(bytes) {
  let binary = "";
  for (let i=0; i<bytes.length; i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(binary);
}
async function sign(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(sig)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
}
async function validSession(request, env) {
  if (!env.ADMIN_PIN) return false;
  const token = cookieValue(request,"admin_session"), dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payload = token.slice(0,dot);
  if (await sign(payload,env.ADMIN_PIN) !== token.slice(dot+1)) return false;
  try {
    const normalized = payload.replace(/-/g,"+").replace(/_/g,"/");
    const parsed = JSON.parse(atob(normalized + "=".repeat((4-normalized.length%4)%4)));
    return parsed.exp > Date.now();
  } catch { return false; }
}
function sessionCookie(token, maxAge=SESSION_SECONDS) {
  return `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}
function page(storeName) {
const title = escapeHtml(storeName || "URBAN CART");
return `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0b3d3b"><meta name="description" content="Galeri produk pilihan dengan foto dan kategori.">
<title>${title} — Pilihan Produk</title>
<link rel="preconnect" href="https://images.unsplash.com">
<style>
:root{--teal:#0b3d3b;--teal2:#164f49;--orange:#bd5121;--paper:#faf8f4;--ink:#17211e;--muted:#65716c;--line:#e7e4dd;--white:#fff}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
button,input,select,textarea{font:inherit}button{cursor:pointer}a{color:inherit;text-decoration:none}.wrap{width:min(1160px,calc(100% - 40px));margin:auto}
.announcement{background:var(--teal);color:#eaf2ee;padding:9px max(20px,calc((100% - 1160px)/2));font-size:11px;letter-spacing:.02em;display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap}.announcement span{white-space:nowrap}
header{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.nav{height:76px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:900;letter-spacing:.04em;color:var(--teal);white-space:nowrap}
.brand-mark{width:34px;height:34px;border-radius:11px;background:var(--orange);color:white;display:grid;place-items:center;font-weight:900;transform:rotate(-5deg)}
.navlinks{display:flex;gap:26px;color:#47534e;font-size:13px;font-weight:700}.navlinks a:hover{color:var(--orange)}
.navright{display:flex;align-items:center;gap:10px}.searchbox{display:flex;align-items:center;background:#f5f5f0;border:1px solid #e7e6df;border-radius:99px;padding:8px 13px;gap:8px}.searchbox input{border:0;background:transparent;outline:0;width:130px;font-size:12px}
.btn{border:0;border-radius:7px;padding:11px 16px;font-size:12px;font-weight:800;transition:transform .2s,background .2s,box-shadow .2s}.btn:hover{transform:translateY(-2px);box-shadow:0 7px 16px #0b3d3b22}.btn-dark{background:var(--teal);color:white}.btn-orange{background:var(--orange);color:white}.btn-ghost{background:#edf1ed;color:var(--teal)}
.hero{padding:30px 0 24px}.hero-panel{min-height:380px;border-radius:16px;overflow:hidden;background:linear-gradient(90deg,#f3e9dc 0%,#f3e9dc 42%,#e9dfd1 100%);display:grid;grid-template-columns:.94fr 1.06fr;position:relative;box-shadow:0 12px 32px #183b300a}
.hero-copy{padding:48px 10px 44px 48px;align-self:center;z-index:1}.eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--teal);font-weight:900;display:flex;align-items:center;gap:9px}.eyebrow:before{content:"";width:22px;height:2px;background:var(--orange)}
h1{font-family:Georgia,serif;font-size:clamp(35px,4.5vw,57px);line-height:.99;letter-spacing:-.04em;margin:17px 0 16px;max-width:470px;color:#1a2521}.hero-copy p{max-width:390px;color:#5e645d;margin:0 0 23px;font-size:14px}.hero-actions{display:flex;gap:10px;align-items:center}.hero-image{min-height:350px;background-image:linear-gradient(90deg,#f3e9dc00,#f3e9dc00),url('https://images.unsplash.com/photo-154 shopping');background-size:cover;background-position:center}
.hero-visual{position:relative;min-height:380px;overflow:hidden;background:radial-gradient(circle at 65% 35%,#fff9ed 0 15%,transparent 45%),linear-gradient(140deg,#ead8c5,#f5eee5)}
.hero-visual img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;object-position:center;mix-blend-mode:multiply;animation:slowzoom 16s ease-in-out infinite alternate}
.hero-chip{position:absolute;bottom:24px;left:18px;background:#fffdf6ed;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px #513d2518;font-size:11px;font-weight:800;max-width:170px}.hero-sale{position:absolute;right:7%;top:12%;width:112px;height:112px;border-radius:50%;background:var(--orange);border:2px solid #fff8e9;color:white;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;box-shadow:0 8px 24px #1d100e35;transform:rotate(7deg);animation:floatbadge 4s ease-in-out infinite}.hero-sale{font-size:9px;letter-spacing:.08em}.hero-sale strong{font-size:34px;line-height:1;font-weight:900;letter-spacing:-.05em}.hero-sale small{font-size:8px;letter-spacing:0}
.hero-chip span{display:block;color:var(--orange);font-size:10px;margin-top:3px}
.benefits{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid var(--line);border-radius:12px;margin-top:16px;padding:15px 12px;gap:8px}
.benefit{display:flex;align-items:center;justify-content:center;gap:10px;font-size:11px;font-weight:800}.benefit-icon{width:32px;height:32px;display:grid;place-items:center;background:#edf2ec;border-radius:50%;font-size:16px}.benefit small{display:block;color:var(--muted);font-weight:500;font-size:10px}
.promo{margin:22px 0 38px;border-radius:12px;background:var(--teal);color:white;padding:18px 26px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:relative;overflow:hidden}
.promo:after{content:"";position:absolute;width:220px;height:220px;border:1px solid #ffffff18;border-radius:50%;right:18%;top:-135px;box-shadow:0 0 0 25px #ffffff08,0 0 0 50px #ffffff05}
.promo-tag{font-size:34px;line-height:1}.promo small{display:block;color:#d5e0d9;letter-spacing:.1em;font-size:9px;text-transform:uppercase}.promo strong{font-family:Georgia,serif;font-size:clamp(22px,3vw,34px);display:block;line-height:1.1;margin:3px 0}.promo p{margin:0;color:#e1e9e3;font-size:11px}.promo-code{border:1px dashed #9fb5a8;border-radius:8px;padding:10px 22px;text-align:center;z-index:1}.promo-code b{display:block;letter-spacing:.14em;font-size:13px}
.section{padding:4px 0 28px;scroll-margin-top:105px}.section-head{text-align:center;margin-bottom:20px}.section-head .kicker{font-size:9px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:var(--teal)}.section-head h2{font:700 clamp(26px,3vw,34px)/1.1 Georgia,serif;margin:5px 0 8px}.section-head p{color:var(--muted);font-size:12px;margin:0}.heading-line{display:flex;align-items:center;justify-content:center;gap:12px}.heading-line:before,.heading-line:after{content:"";height:1px;width:44px;background:#c8c6bb}
.filters{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:0 0 20px}.filter{border:1px solid #e0e2d9;background:#fff;color:#5d6861;border-radius:99px;padding:8px 14px;font-size:11px;font-weight:750;transition:all .2s}.filter.active,.filter:hover{background:var(--teal);color:#fff;border-color:var(--teal)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}.product{background:#fff;border:1px solid #e9e7df;border-radius:12px;overflow:hidden;position:relative;transition:transform .25s,box-shadow .25s;animation:rise .55s both}.product:hover{transform:translateY(-5px);box-shadow:0 15px 30px #183b3012}.product-media{aspect-ratio:1/1.02;background:#eee9df;position:relative;overflow:hidden}.product-media img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s}.product:hover .product-media img{transform:scale(1.055)}.tag{position:absolute;top:10px;left:10px;border-radius:4px;background:var(--orange);color:white;padding:4px 7px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.product-info{padding:12px}.category-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:800}.product h3{font-size:13px;line-height:1.3;margin:5px 0 7px;min-height:34px;overflow-wrap:anywhere}.product-desc{font-size:11px;color:var(--muted);min-height:18px;overflow-wrap:anywhere}.product-bottom{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:11px}.product-bottom .btn{padding:9px 11px;font-size:10px}.product-date{font-size:9px;color:#8b9189}
.empty{grid-column:1/-1;text-align:center;padding:40px 18px;background:#fff;border:1px dashed #d9d7cd;border-radius:12px;color:var(--muted)}
.category-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}.category{border:1px solid #e6e8df;background:#fff;border-radius:12px;padding:16px 6px;text-align:center;transition:transform .2s,background .2s;cursor:pointer}.category:hover{transform:translateY(-4px);background:#edf3ec}.category-icon{width:43px;height:43px;border-radius:50%;background:#eaf0e8;margin:0 auto 8px;display:grid;place-items:center;font-size:20px}.category strong{font-size:10px;display:block}
.about{display:grid;grid-template-columns:1fr 1fr;gap:25px;align-items:center;background:#edf1eb;border-radius:16px;padding:28px;margin:15px 0 38px}.about h2{font:700 28px/1.1 Georgia,serif;margin:10px 0}.about p{font-size:12px;color:#5e6b63}.about-badges{display:flex;gap:8px;flex-wrap:wrap}.about-badges span{background:#fff;border-radius:99px;padding:8px 11px;font-size:10px;font-weight:800}.about-img{width:100%;height:210px;object-fit:cover;border-radius:12px}
footer{background:#092f2e;color:#e5eee8;padding:30px 0 20px}.footer-main{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}.footer-main p{font-size:11px;color:#b7cbc0;max-width:320px}.footer-links{display:flex;gap:18px;flex-wrap:wrap;font-size:11px}.copyright{border-top:1px solid #ffffff22;margin-top:22px;padding-top:14px;font-size:10px;color:#b7cbc0;display:flex;justify-content:space-between;gap:10px}
dialog{border:0;border-radius:14px;padding:0;width:min(540px,calc(100% - 24px));box-shadow:0 20px 80px #0005}dialog::backdrop{background:#071b1acc;backdrop-filter:blur(4px)}.modal-head{padding:17px 20px;background:var(--teal);color:white;display:flex;justify-content:space-between;align-items:center}.modal-body{padding:20px;max-height:75vh;overflow:auto}.modal-body label{display:block;font-size:12px;font-weight:800;margin:13px 0 6px}.modal-body input,.modal-body textarea,.modal-body select{width:100%;padding:11px;border:1px solid #d6d8d0;border-radius:8px;background:white}.modal-body textarea{min-height:72px;resize:vertical}.row-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}.admin-list{margin-top:15px;display:grid;gap:9px}.admin-item{display:flex;align-items:center;gap:10px;border:1px solid var(--line);border-radius:9px;padding:9px}.thumb{width:52px;height:58px;object-fit:cover;border-radius:6px;background:#eee}.meta{flex:1;min-width:0;overflow-wrap:anywhere;font-size:12px}.small{font-size:10px;color:var(--muted)}.status{min-height:1.4em;color:var(--orange);font-size:12px;margin-top:9px}.hidden{display:none!important}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes slowzoom{from{transform:scale(1)}to{transform:scale(1.07)}}@keyframes floatbadge{0%,100%{transform:translateY(0) rotate(7deg)}50%{transform:translateY(-7px) rotate(3deg)}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media(max-width:900px){.navlinks{gap:13px}.searchbox input{width:90px}.grid{grid-template-columns:repeat(3,minmax(0,1fr))}.category-grid{grid-template-columns:repeat(4,1fr)}.hero-copy{padding-left:30px}.benefits{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.announcement{justify-content:center;gap:8px;font-size:9px;padding:8px}.announcement span:nth-child(2){display:none}.wrap{width:calc(100% - 24px)}.nav{height:auto;min-height:66px;flex-wrap:wrap;padding:12px 0;gap:12px}.navlinks{order:3;width:100%;justify-content:space-between;gap:6px;font-size:11px}.navright{margin-left:auto}.searchbox{display:none}.brand{font-size:17px}.hero{padding-top:14px}.hero-panel{grid-template-columns:1fr}.hero-copy{padding:30px 24px 15px}.hero-copy p{font-size:12px}.hero-visual{min-height:215px}.hero-visual img{object-position:center 48%}.hero-chip{bottom:12px;left:12px}.benefits{padding:11px 4px}.benefit{justify-content:flex-start;font-size:10px}.benefit-icon{width:28px;height:28px}.promo{padding:15px;align-items:flex-start}.promo-tag{font-size:27px}.promo-code{padding:8px}.promo-code b{font-size:10px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-info{padding:10px}.product h3{font-size:12px}.product-bottom{align-items:flex-start;flex-direction:column}.product-bottom .btn{width:100%}.category-grid{grid-template-columns:repeat(4,1fr);gap:7px}.category{padding:12px 4px}.category-icon{width:37px;height:37px}.about{grid-template-columns:1fr;padding:19px;gap:14px}.about-img{height:160px}.footer-main{flex-direction:column}.copyright{flex-direction:column}}
</style></head><body>
<div class="announcement"><span>♧ &nbsp; Gratis ongkir untuk pembelian tertentu</span><span>◇ &nbsp; Katalog produk pilihan</span><span>◌ &nbsp; Foto produk diperbarui berkala</span></div>
<header><div class="wrap nav">
<a class="brand" href="#"><span class="brand-mark">U</span><span>${title}</span></a>
<nav class="navlinks"><a href="#beranda">Beranda</a><a href="#produk">Produk</a><a href="#kategori">Kategori</a><a href="#tentang">Tentang Kami</a><a href="#kontak">Kontak</a></nav>
<div class="navright"><label class="searchbox"><span>⌕</span><input id="search" placeholder="Cari produk..."></label><button class="btn btn-dark" id="openAdmin">Admin ↗</button></div>
</div></header>
<main>
<section class="hero wrap" id="beranda"><div class="hero-panel">
<div class="hero-copy"><div class="eyebrow">Pilihan cerdas, hidup lebih baik</div><h1>Temukan Produk<br>Favorit Anda</h1><p>Kualitas terbaik, pilihan lengkap, dan inspirasi untuk memenuhi kebutuhan Anda sehari-hari.</p><div class="hero-actions"><a class="btn btn-dark" href="#produk">JELAJAHI PRODUK&nbsp; →</a><a class="btn btn-ghost" href="#kategori">Lihat kategori</a></div></div>
<div class="hero-visual"><img src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=85" alt="Koleksi produk fashion dan gaya hidup" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'"><div class="hero-chip">Koleksi pilihan<span>Temukan produk favorit Anda ↗</span></div><div class="hero-sale">DISKON PILIHAN<strong>50%</strong><small>Untuk koleksi tertentu</small></div></div>
</div>
<div class="benefits"><div class="benefit"><span class="benefit-icon">▣</span><span>Foto Produk Jelas<small>Lihat detail produk</small></span></div><div class="benefit"><span class="benefit-icon">♡</span><span>Koleksi Pilihan<small>Kurasi dengan cermat</small></span></div><div class="benefit"><span class="benefit-icon">↻</span><span>Update Berkala<small>Produk terbaru</small></span></div><div class="benefit"><span class="benefit-icon">⌕</span><span>Mudah Dicari<small>Filter per kategori</small></span></div></div>
<div class="promo"><div class="promo-tag">✦</div><div><small>Temukan sesuatu yang spesial</small><strong>Gaya pilihan. Setiap hari.</strong><p>Jelajahi produk terbaru di katalog kami.</p></div><a class="promo-code" href="#produk"><small>LIHAT KOLEKSI</small><b>JELAJAHI ↗</b></a></div>
</section>
<section class="section wrap" id="produk"><div class="section-head"><div class="kicker">Dikurasi untuk Anda</div><div class="heading-line"><h2>Produk Pilihan</h2></div><p>Galeri produk terbaru, langsung dari katalog kami.</p></div>
<div class="filters" id="filters"><button class="filter active" data-category="Semua">Semua Produk</button><button class="filter" data-category="Fashion">Fashion</button><button class="filter" data-category="Elektronik">Elektronik</button><button class="filter" data-category="Rumah & Living">Rumah & Living</button><button class="filter" data-category="Kecantikan">Kecantikan</button><button class="filter" data-category="Aksesori">Aksesori</button><button class="filter" data-category="Olahraga">Olahraga</button><button class="filter" data-category="Anak">Anak</button><button class="filter" data-category="Sale">Sale</button></div>
<div class="grid" id="products"></div><div class="empty hidden" id="empty">Belum ada produk di kategori ini. Admin dapat menambahkan foto melalui tombol Admin.</div>
</section>
<section class="section wrap" id="kategori"><div class="section-head"><div class="kicker">Jelajahi lebih mudah</div><div class="heading-line"><h2>Belanja per Kategori</h2></div><p>Pilih kategori untuk menemukan koleksi yang Anda cari.</p></div>
<div class="category-grid">
<button class="category" data-pick="Fashion"><span class="category-icon">♧</span><strong>Fashion</strong></button><button class="category" data-pick="Elektronik"><span class="category-icon">▣</span><strong>Elektronik</strong></button><button class="category" data-pick="Rumah & Living"><span class="category-icon">⌂</span><strong>Rumah & Living</strong></button><button class="category" data-pick="Kecantikan"><span class="category-icon">✿</span><strong>Kecantikan</strong></button><button class="category" data-pick="Aksesori"><span class="category-icon">◇</span><strong>Aksesori</strong></button><button class="category" data-pick="Olahraga"><span class="category-icon">◎</span><strong>Olahraga</strong></button><button class="category" data-pick="Anak"><span class="category-icon">♧</span><strong>Anak</strong></button><button class="category" data-pick="Sale"><span class="category-icon">%</span><strong>Sale</strong></button>
</div></section>
<section class="wrap" id="tentang"><div class="about"><div><div class="eyebrow">Tentang ${title}</div><h2>Temukan yang Anda butuhkan, dengan mudah.</h2><p>Kami menyajikan katalog foto produk yang terus diperbarui. Jelajahi koleksi, gunakan pencarian, dan temukan inspirasi sesuai kategori favorit Anda.</p><div class="about-badges"><span>✦ Koleksi pilihan</span><span>◉ Katalog terorganisir</span><span>↻ Update produk</span></div></div><img class="about-img" src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=900&q=80" alt="Koleksi produk" loading="lazy" onerror="this.style.display='none'"></div></section>
</main>
<footer id="kontak"><div class="wrap"><div class="footer-main"><div><a class="brand" style="color:white" href="#"><span class="brand-mark">U</span><span>${title}</span></a><p>Katalog produk pilihan dengan foto yang jelas, kategori yang praktis, dan tampilan sederhana.</p></div><div class="footer-links"><a href="#beranda">Beranda</a><a href="#produk">Produk</a><a href="#kategori">Kategori</a><a href="#tentang">Tentang Kami</a><a href="#" id="footerAdmin">Admin</a></div></div><div class="copyright"><span>© <span id="year"></span> ${title}. Semua hak dilindungi.</span><span>Dibuat untuk katalog produk Anda.</span></div></div></footer>
<dialog id="adminDialog"><div class="modal-head"><strong id="modalTitle">Konsol Admin</strong><button class="btn btn-ghost" id="closeAdmin">Tutup ✕</button></div><div class="modal-body">
<section id="loginPanel"><p style="color:var(--muted);font-size:12px">Masuk dengan PIN untuk mengelola katalog produk.</p><label for="pin">PIN Admin</label><input id="pin" type="password" inputmode="numeric" autocomplete="current-password" placeholder="Masukkan PIN"><div class="row-actions"><button class="btn btn-dark" id="loginBtn">Masuk ke konsol →</button></div><div class="status" id="loginStatus"></div></section>
<section id="managePanel" class="hidden"><form id="uploadForm"><label for="productName">Nama produk *</label><input id="productName" required maxlength="100" placeholder="Contoh: Tas kanvas premium">
<label for="productCategory">Kategori *</label><select id="productCategory" required><option>Fashion</option><option>Elektronik</option><option>Rumah & Living</option><option>Kecantikan</option><option>Aksesori</option><option>Olahraga</option><option>Anak</option><option>Sale</option><option>Lainnya</option></select>
<label for="productDesc">Keterangan produk</label><textarea id="productDesc" maxlength="500" placeholder="Keterangan singkat produk"></textarea><label for="productImage">Foto produk * (JPG, PNG, WebP, maksimal 1,5 MB)</label><input id="productImage" type="file" accept="image/jpeg,image/png,image/webp" required>
<div class="row-actions"><button class="btn btn-dark" type="submit" id="uploadBtn">＋ Tambah produk</button><button class="btn btn-ghost" type="button" id="logoutBtn">Keluar</button></div><div class="status" id="uploadStatus"></div></form><h3 style="font:700 20px Georgia,serif;margin:24px 0 10px">Kelola produk</h3><div id="adminList" class="admin-list"></div></section>
</div></dialog>
<script>
const $=id=>document.getElementById(id);$("year").textContent=new Date().getFullYear();
const dialog=$("adminDialog");let allProducts=[],activeCategory="Semua";
async function openAdminConsole(){try{await api("/api/logout",{method:"POST"})}catch{}showLogin();$("loginStatus").textContent="";$("pin").value="";dialog.showModal();$("pin").focus()}
$("openAdmin").onclick=openAdminConsole;
$("footerAdmin").onclick=e=>{e.preventDefault();openAdminConsole()};
$("closeAdmin").onclick=async()=>{try{await api("/api/logout",{method:"POST"})}catch{}dialog.close()};
dialog.addEventListener("close",()=>{api("/api/logout",{method:"POST"}).catch(()=>{})});
async function api(url,opts={}){const r=await fetch(url,opts);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||"Terjadi kesalahan");return d}
function showLogin(){$("loginPanel").classList.remove("hidden");$("managePanel").classList.add("hidden");$("modalTitle").textContent="Konsol Admin"}
function showManage(){$("loginPanel").classList.add("hidden");$("managePanel").classList.remove("hidden");$("modalTitle").textContent="Kelola Katalog";loadAdminList()}
$("loginBtn").onclick=async()=>{$("loginStatus").textContent="Memeriksa PIN…";try{await api("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin:$("pin").value})});$("pin").value="";$("loginStatus").textContent="";showManage()}catch(e){$("loginStatus").textContent=e.message}};
$("pin").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").onclick=async()=>{try{await api("/api/logout",{method:"POST"})}finally{showLogin();$("loginStatus").textContent="Anda sudah keluar."}};
$("uploadForm").onsubmit=async e=>{e.preventDefault();const file=$("productImage").files[0];if(!file)return;$("uploadStatus").textContent="Mengunggah foto…";$("uploadBtn").disabled=true;try{const fd=new FormData();fd.append("name",$("productName").value.trim());fd.append("category",$("productCategory").value);fd.append("description",$("productDesc").value.trim());fd.append("image",file);await api("/api/products",{method:"POST",body:fd});$("uploadForm").reset();$("uploadStatus").textContent="Produk berhasil ditambahkan.";await loadProducts();await loadAdminList()}catch(err){$("uploadStatus").textContent=err.message}finally{$("uploadBtn").disabled=false}};
function fallbackImage(category){const map={"Fashion":"photo-1483985988355-763728e1935b","Elektronik":"photo-1505740420928-5e560c06d30e","Rumah & Living":"photo-1600210492486-724fe5c67fb0","Kecantikan":"photo-1608248543803-ba4f8c70ae0b","Aksesori":"photo-1523275335684-37898b6baf30","Olahraga":"photo-1542291026-7eec264c27ff","Anak":"photo-1519238263530-99bdd11df2ea","Sale":"photo-1542291026-7eec264c27ff","Lainnya":"photo-1523275335684-37898b6baf30"};return "https://images.unsplash.com/"+(map[category]||map["Lainnya"])+"?auto=format&fit=crop&w=700&q=80"}
function makeImg(src,name,category,cls){const img=document.createElement("img");img.className=cls||"";img.src=src;img.alt=name;img.loading="lazy";img.onerror=()=>{img.onerror=null;img.src=fallbackImage(category)};return img}
const DEMO_PRODUCTS=[
{id:"demo-camera",name:"Kamera Digital Retro",description:"Contoh tampilan produk",category:"Elektronik",image:"https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=700&q=85"},
{id:"demo-bag",name:"Tas Wanita Elegan",description:"Contoh tampilan produk",category:"Fashion",image:"https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=700&q=85"},
{id:"demo-shoes",name:"Sneakers Kasual",description:"Contoh tampilan produk",category:"Olahraga",image:"https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85"},
{id:"demo-watch",name:"Jam Tangan Minimalis",description:"Contoh tampilan produk",category:"Aksesori",image:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85"},
{id:"demo-perfume",name:"Parfum Premium",description:"Contoh tampilan produk",category:"Kecantikan",image:"https://images.unsplash.com/photo- perfume"},
{id:"demo-earbuds",name:"Earbuds Nirkabel",description:"Contoh tampilan produk",category:"Elektronik",image:"https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=85"}
];
DEMO_PRODUCTS[4].image="https://images.unsplash.com/photo-1594035910387-fea47794261f?auto=format&fit=crop&w=700&q=85";
function renderProducts(){const q=$("search").value.trim().toLowerCase();const sourceProducts=allProducts.length?allProducts:DEMO_PRODUCTS;const filtered=sourceProducts.filter(p=>(activeCategory==="Semua"||p.category===activeCategory)&&(!q||(p.name+" "+p.description+" "+p.category).toLowerCase().includes(q)));$("products").innerHTML="";$("empty").classList.toggle("hidden",filtered.length>0);if(!filtered.length){$("empty").textContent=q?"Produk tidak ditemukan. Coba kata kunci atau kategori lain.":"Belum ada contoh produk untuk kategori ini."}
filtered.forEach((p,i)=>{const card=document.createElement("article");card.className="product";card.style.animationDelay=Math.min(i*45,350)+"ms";const media=document.createElement("div");media.className="product-media";media.append(makeImg(p.image||("/api/products/"+p.id+"/image"),p.name,p.category));if(!allProducts.length){const tag=document.createElement("span");tag.className="tag";tag.textContent="Contoh";media.append(tag)}else if(p.category==="Sale"){const tag=document.createElement("span");tag.className="tag";tag.textContent="Pilihan";media.append(tag)}const info=document.createElement("div");info.className="product-info";const cat=document.createElement("div");cat.className="category-label";cat.textContent=p.category||"Lainnya";const h=document.createElement("h3");h.textContent=p.name;const desc=document.createElement("div");desc.className="product-desc";desc.textContent=p.description||"Produk pilihan";const bottom=document.createElement("div");bottom.className="product-bottom";const date=document.createElement("span");date.className="product-date";date.textContent="Koleksi produk";const btn=document.createElement("button");btn.className="btn btn-dark";btn.textContent="LIHAT FOTO ↗";btn.onclick=()=>{const imageUrl=p.image||("/api/products/"+p.id+"/image");const w=window.open(imageUrl,"_blank","noopener");if(!w)location.href=imageUrl};bottom.append(date,btn);info.append(cat,h,desc,bottom);card.append(media,info);$("products").append(card)})}
async function loadProducts(){try{const d=await api("/api/products");allProducts=d.products||[];renderProducts()}catch(e){$("products").innerHTML="";$("empty").classList.remove("hidden");$("empty").textContent="Produk belum dapat dimuat. Periksa konfigurasi database D1 lalu muat ulang."}}
async function loadAdminList(){try{const {products}=await api("/api/products");$("adminList").innerHTML="";if(!products.length){$("adminList").textContent="Belum ada produk.";return}for(const p of products){const item=document.createElement("div");item.className="admin-item";item.append(makeImg("/api/products/"+p.id+"/image",p.name,p.category,"thumb"));const meta=document.createElement("div");meta.className="meta";const strong=document.createElement("strong");strong.textContent=p.name;const detail=document.createElement("div");detail.className="small";detail.textContent=(p.category||"Lainnya")+" · "+p.created_at;meta.append(strong,detail);const del=document.createElement("button");del.className="btn btn-ghost";del.textContent="Hapus";del.onclick=async()=>{if(!confirm('Hapus produk "'+p.name+'"?'))return;try{await api("/api/products/"+p.id,{method:"DELETE"});await loadProducts();await loadAdminList()}catch(e){alert(e.message)}};item.append(meta,del);$("adminList").append(item)}}catch(e){$("adminList").textContent=e.message}}
$("search").addEventListener("input",renderProducts);
document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x===b));renderProducts()});
document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.pick;document.querySelectorAll(".filter").forEach(x=>x.classList.toggle("active",x.dataset.category===activeCategory));document.querySelector("#produk").scrollIntoView({behavior:"smooth"});renderProducts()});
loadProducts();
</script></body></html>`;
}

export default {
 async fetch(request, env) {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if(path==="/"&&method==="GET")return new Response(page(env.STORE_NAME),{headers:{"content-type":"text/html; charset=utf-8","x-content-type-options":"nosniff"}});
  if(path==="/api/session"&&method==="GET")return json({authenticated:await validSession(request,env)});
  if(path==="/api/login"&&method==="POST"){
   if(!env.ADMIN_PIN)return json({error:"ADMIN_PIN belum disetel di Cloudflare."},500);
   let body;try{body=await request.json()}catch{return json({error:"Format permintaan tidak valid."},400)}
   if(typeof body.pin!=="string"||body.pin.length>128||body.pin!==env.ADMIN_PIN)return json({error:"PIN salah."},401);
   const payload=bytesToBase64(new TextEncoder().encode(JSON.stringify({exp:Date.now()+SESSION_SECONDS*1000}))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
   const token=payload+"."+await sign(payload,env.ADMIN_PIN);return json({ok:true},200,{"set-cookie":sessionCookie(token)});
  }
  if(path==="/api/logout"&&method==="POST")return json({ok:true},200,{"set-cookie":sessionCookie("",0)});
  if(path==="/api/products"&&method==="GET"){
   const {results=[]}=await env.DB.prepare("SELECT id,name,description,category,mime_type,created_at FROM products ORDER BY id DESC").all();
   return json({products:results});
  }
  const imageMatch=path.match(/^\/api\/products\/(\d+)\/image$/);
  if(imageMatch&&method==="GET"){
   const row=await env.DB.prepare("SELECT image,mime_type FROM products WHERE id=?").bind(Number(imageMatch[1])).first();
   if(!row)return new Response("Foto tidak ditemukan",{status:404});
   let body=row.image;
   if(body instanceof ArrayBuffer)body=new Uint8Array(body);
   else if(Array.isArray(body))body=new Uint8Array(body);
   else if(body && !(body instanceof Uint8Array) && typeof body==="object")body=new Uint8Array(Object.values(body));
   if(!(body instanceof Uint8Array))return new Response("Format foto di database tidak dikenali",{status:500});
   return new Response(body,{headers:{"content-type":row.mime_type||"application/octet-stream","cache-control":"public, max-age=3600","x-content-type-options":"nosniff"}});
  }
  if(path==="/api/products"&&method==="POST"){
   if(!await validSession(request,env))return json({error:"Silakan masuk sebagai admin."},401);
   let form;try{form=await request.formData()}catch{return json({error:"Form unggahan tidak valid."},400)}
   const name=String(form.get("name")||"").trim(), description=String(form.get("description")||"").trim(), category=String(form.get("category")||"Lainnya");
   const image=form.get("image");
   if(!name||name.length>100)return json({error:"Nama produk wajib diisi (maksimal 100 karakter)."},400);
   if(description.length>500)return json({error:"Keterangan maksimal 500 karakter."},400);
   if(!ALLOWED_CATEGORIES.has(category))return json({error:"Kategori tidak valid."},400);
   if(!(image instanceof File)||!image.size)return json({error:"Pilih foto produk."},400);
   if(!["image/jpeg","image/png","image/webp"].includes(image.type))return json({error:"Format foto harus JPG, PNG, atau WebP."},400);
   if(image.size>MAX_IMAGE_BYTES)return json({error:"Ukuran foto maksimal 1,5 MB."},413);
   const bytes=new Uint8Array(await image.arrayBuffer());
   await env.DB.prepare("INSERT INTO products(name,description,category,mime_type,image) VALUES(?,?,?,?,?)").bind(name,description,category,image.type,bytes).run();
   return json({ok:true},201);
  }
  const productMatch=path.match(/^\/api\/products\/(\d+)$/);
  if(productMatch&&method==="DELETE"){
   if(!await validSession(request,env))return json({error:"Silakan masuk sebagai admin."},401);
   await env.DB.prepare("DELETE FROM products WHERE id=?").bind(Number(productMatch[1])).run();return json({ok:true});
  }
  return new Response("Tidak ditemukan",{status:404});
 }
};

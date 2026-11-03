// Tahta Bot Paneli: kendi WhatsApp botumuzun (Vivollo yerine) yönetimi.
// Veri soru-kontrol Supabase'inde b_ tablolarında; okuma RLS (d_yetkili_mi), yazma yalnız RPC'lerle.
// Giriş destek paneliyle aynı hesaplar (d_yetkili). Talimat yayımı ve ayarlar yalnız yönetici.
const SB_URL = "https://rbjrnevngfuribasrnph.supabase.co";
const SB_ANON = "sb_publishable_yK1dNA6CGKIQ88U3gp53xA_nBLQGNVJ";
const sb = window.supabase.createClient(SB_URL, SB_ANON);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tarih = t => t ? new Date(t).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const ikon = () => window.lucide && lucide.createIcons();
let ben = null, sekme = "sohbet";
const yonetici = () => ben?.rol === "yonetici";

function bildir(m) { const b = $("#bildirim"); b.textContent = m; b.hidden = false; clearTimeout(bildir.t); bildir.t = setTimeout(() => b.hidden = true, 2600); }
async function rpc(ad, arg) { const { data, error } = await sb.rpc(ad, arg); if (error) { bildir("Hata: " + error.message); throw error; } return data; }

const MOD = { golge: ["Gölge", "Cevap üretir, müşteriye göndermez. Vivollo canlı."], test: ["Test", "Yalnız test kanallarına gönderir."], canli: ["Canlı", "Bütün müşterilere bot cevap verir."] };
const DEVIR = { transfer_to_agent: ["Satışa devretti", "mor"], destege_aktar: ["Desteğe devretti", "sari"], egitmen_kapat: ["Eğitmen hattına yönlendirdi", ""], resolve_conversation: ["Kapattı", "yesil"] };
const DURUM = { acik: ["Açık", "mor"], devredildi: ["Devredildi", "sari"], kapandi: ["Kapandı", "yesil"], arsiv: ["Arşiv", ""] };
const et = (m, a) => { const x = m[a]; return x ? `<span class="etiket ${x[1]}">${x[0]}</span>` : (a ? `<span class="etiket">${esc(a)}</span>` : ""); };

// ---------- giriş ----------
async function basla() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return girisGoster();
  const y = await sb.from("d_yetkili").select("ad,rol").eq("email", session.user.email.toLowerCase()).maybeSingle();
  if (!y.data) { await sb.auth.signOut(); return girisGoster("Bu hesabın panele yetkisi yok."); }
  ben = { ...y.data, email: session.user.email };
  $("#giris").hidden = true; $("#uygulama").hidden = false;
  document.querySelector(".k-ad").textContent = ben.ad || ben.email;
  document.querySelector(".k-rol").textContent = yonetici() ? "Yönetici" : "Destek";
  const h = location.hash.slice(1).split("/");
  git(h[0] || "sohbet", h[1]);
  modGoster(); rozet(); setInterval(rozet, 60000);
}
function girisGoster(m = "") { $("#uygulama").hidden = true; $("#giris").hidden = false; $("#g-hata").textContent = m; }
$("#giris-form").onsubmit = async ev => {
  ev.preventDefault(); $("#g-hata").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("#g-eposta").value.trim(), password: $("#g-sifre").value });
  if (error) return $("#g-hata").textContent = "E-posta ya da şifre hatalı.";
  basla();
};
$("#cikis").onclick = async () => { await sb.auth.signOut(); location.hash = ""; girisGoster(); };
document.querySelectorAll("#sekmeler button").forEach(b => b.onclick = () => git(b.dataset.s));
window.onhashchange = () => { const h = location.hash.slice(1).split("/"); if (h[0] && (h[0] !== sekme || h[1] !== git.son)) git(h[0], h[1], true); };

function git(s, id, hashtenGeldi) {
  sekme = s; git.son = id;
  document.querySelectorAll("#sekmeler button").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  if (!hashtenGeldi) history.replaceState(null, "", "#" + s + (id ? "/" + id : ""));
  const f = { sohbet: id ? sohbetAyrinti : sohbetler, bosluk: bosluklar, bilgi: id ? bilgiDuzen : bilgiler, talimat: id ? talimatDuzen : talimatlar, ayar: ayarlar }[s] || sohbetler;
  $("#icerik").innerHTML = '<div class="bos">Yükleniyor…</div>';
  f(id).then(ikon).catch(e => { $("#icerik").innerHTML = `<div class="bos">Yüklenemedi: ${esc(e.message)}</div>`; });
}
async function rozet() { const { count } = await sb.from("b_bosluk").select("id", { count: "exact", head: true }).eq("durum", "acik"); $("#r-bosluk").textContent = count || ""; }
async function ayarOku() { const { data } = await sb.from("b_ayar").select("*"); return Object.fromEntries((data || []).map(r => [r.anahtar, r.deger])); }
async function modGoster() {
  const a = await ayarOku(); const m = MOD[a.mod] || [a.mod, ""];
  $("#mod-kutu").innerHTML = `<span class="soluk kucuk">Mod</span><b>${a.acik === false ? "Durduruldu" : m[0]}</b><span class="soluk kucuk">${esc(a.model?.ad || "")} · ${esc(a.model?.efor || "")}</span>`;
}

// ---------- sohbetler ----------
async function sohbetler() {
  $("#icerik").innerHTML = `<div class="baslik"><h1>Sohbetler</h1></div>
    <div class="filtre"><input id="f-ara" placeholder="Telefon ya da ad ara"><select id="f-durum"><option value="">Hepsi</option>
    ${Object.entries(DURUM).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("")}</select></div><div class="kart" id="liste"></div>`;
  const yukle = async () => {
    let q = sb.from("b_sohbet").select("uuid,kanal_ad,tel,ad,durum,devir,ticket_key,son_mesaj_at").order("son_mesaj_at", { ascending: false }).limit(200);
    const a = $("#f-ara").value.trim(), d = $("#f-durum").value;
    if (d) q = q.eq("durum", d);
    if (a) q = q.or(`tel.ilike.%${a.replace(/[,()]/g, "")}%,ad.ilike.%${a.replace(/[,()]/g, "")}%`);
    const { data, error } = await q; if (error) throw error;
    $("#liste").innerHTML = data.length ? `<table><tr><th>Kişi</th><th>Kanal</th><th>Durum</th><th>Bot kararı</th><th>Son mesaj</th></tr>${data.map(s => `
      <tr class="tik" data-id="${esc(s.uuid)}"><td><b>${esc(s.ad || "—")}</b><div class="soluk kucuk">${esc(s.tel || "")}</div></td>
      <td class="kucuk">${esc(s.kanal_ad || "")}</td><td>${et(DURUM, s.durum)}</td><td>${et(DEVIR, s.devir)}</td><td class="soluk kucuk">${tarih(s.son_mesaj_at)}</td></tr>`).join("")}</table>`
      : `<div class="bos">Henüz sohbet yok. Connexease'ten mesaj kopyası gelmeye başlayınca burada görünür.</div>`;
    document.querySelectorAll("#liste tr.tik").forEach(t => t.onclick = () => git("sohbet", t.dataset.id));
  };
  let z; $("#f-ara").oninput = () => { clearTimeout(z); z = setTimeout(yukle, 300); }; $("#f-durum").onchange = yukle;
  await yukle();
}
async function sohbetAyrinti(uuid) {
  const [s, m, t] = await Promise.all([
    sb.from("b_sohbet").select("*").eq("uuid", uuid).maybeSingle(),
    sb.from("b_mesaj").select("*").eq("sohbet", uuid).order("at"),
    sb.from("b_tur").select("*, b_arac(*)").eq("sohbet", uuid).order("at"),
  ]);
  if (!s.data) return $("#icerik").innerHTML = '<div class="bos">Sohbet bulunamadı.</div>';
  const S = s.data, adlar = { musteri: "Müşteri", temsilci: "Temsilci", vivollo: "Vivollo", bot: "Bot", sistem: "Sistem" };
  $("#icerik").innerHTML = `<div class="baslik"><button class="ikincil" id="geri"><i data-lucide="arrow-left"></i>Geri</button>
    <h1>${esc(S.ad || S.tel || "Sohbet")}</h1>${et(DURUM, S.durum)} ${et(DEVIR, S.devir)}
    <span class="sag soluk kucuk">${esc(S.tel || "")} · ${esc(S.kanal_ad || "")}${S.ticket_key ? " · Ticket " + esc(S.ticket_key) : ""}</span></div>
    <div class="iki"><div class="kart akis">${(m.data || []).map(x => `<div class="balon ${esc(x.kimden)}"><div class="ust">${adlar[x.kimden] || esc(x.kimden)} · ${tarih(x.at)}</div>${esc(x.metin || (x.ek?.type ? "[" + x.ek.type + "]" : ""))}${x.ek?.media_url ? `<div><a href="${esc(x.ek.media_url)}" target="_blank" rel="noopener">Dosyayı aç</a></div>` : ""}</div>`).join("") || '<div class="bos">Mesaj yok.</div>'}</div>
    <div class="kart"><div class="tur"><h2>Bot turları</h2><div class="soluk kucuk">Her müşteri mesajında botun ürettiği cevap, çağırdığı araçlar ve maliyet.</div></div>
    ${(t.data || []).map(x => `<div class="tur"><div><span class="etiket mor">${esc(x.mod)}</span> ${et(DEVIR, x.karar)} <span class="soluk kucuk">${tarih(x.at)} · ${x.sure_ms ? (x.sure_ms / 1000).toFixed(1) + " sn" : ""} · ${x.maliyet ? "$" + Number(x.maliyet).toFixed(4) : ""}</span></div>
      ${x.vivollo_karar && x.vivollo_karar !== x.karar ? `<div class="kucuk" style="margin-top:4px">Vivollo farklı: ${et(DEVIR, x.vivollo_karar) || esc(x.vivollo_karar)}</div>` : ""}
      ${(x.cikti?.mesajlar || []).map(y => `<div class="balon bot" style="max-width:100%;margin-top:6px">${esc(y)}</div>`).join("")}
      ${(x.b_arac || []).map(a => `<div class="kucuk" style="margin-top:6px"><b>${esc(a.ad)}</b> <span class="soluk">${esc(JSON.stringify(a.arg || {}))}</span>${a.sonuc ? `<pre>${esc(a.sonuc)}</pre>` : ""}${a.hata ? `<div class="hata">${esc(a.hata)}</div>` : ""}</div>`).join("")}
      ${x.cikti?.gerekce ? `<div class="soluk kucuk" style="margin-top:6px">${esc(x.cikti.gerekce)}</div>` : ""}${x.hata ? `<div class="hata">${esc(x.hata)}</div>` : ""}</div>`).join("") || '<div class="bos">Henüz bot turu yok.</div>'}</div></div>`;
  $("#geri").onclick = () => git("sohbet");
}

// ---------- bilgi boşlukları ----------
async function bosluklar() {
  const { data, error } = await sb.from("b_bosluk").select("*").eq("durum", "acik").order("at", { ascending: false }).limit(200); if (error) throw error;
  $("#icerik").innerHTML = `<div class="baslik"><h1>Bilgi boşlukları</h1></div>
    <p class="alt-metin">Botun bilgi bankasında cevap bulamadığı sorular. Cevabı yazınca Bilgi'ye eklenir, bot bir dahakine kendisi cevaplar.</p>
    <div class="kart">${data.length ? `<table><tr><th>Soru</th><th>Neden</th><th>Zaman</th><th></th></tr>${data.map(b => `<tr><td>${esc(b.soru)}${b.sohbet ? `<div><a href="#sohbet/${esc(b.sohbet)}">Sohbeti aç</a></div>` : ""}</td>
      <td class="kucuk soluk">${esc({ bilgi_bulunamadi: "Bilgi bulunamadı", bilmiyorum: "Bot bilmiyorum dedi", bilgi_icin_devir: "Bilgi eksikliğinden devretti", elle: "Elle eklendi" }[b.neden] || b.neden || "")}</td>
      <td class="kucuk soluk">${tarih(b.at)}</td><td style="white-space:nowrap"><button class="birincil" data-c="${b.id}">Cevapla</button> <button class="ikincil" data-y="${b.id}">Yoksay</button></td></tr>`).join("")}</table>`
      : '<div class="bos">Açık bilgi boşluğu yok.</div>'}</div>
    <dialog id="dlg"><h2>Cevabı yaz</h2><p class="soluk kucuk" id="dlg-soru"></p>
      <label>Başlık<input id="dlg-baslik"></label><label>Bota öğretilecek bilgi<textarea id="dlg-cevap" rows="6" placeholder="Müşteriye söylenebilecek doğru bilgi"></textarea></label>
      <div class="dugmeler"><button class="birincil" id="dlg-kaydet">Bilgiye ekle</button><button class="ikincil" id="dlg-kapat">Vazgeç</button></div></dialog>`;
  document.querySelectorAll("[data-y]").forEach(b => b.onclick = async () => { await rpc("b_bosluk_kapat", { p_id: +b.dataset.y, p_durum: "yoksay" }); bildir("Yoksayıldı."); rozet(); bosluklar().then(ikon); });
  document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    const x = data.find(d => d.id === +b.dataset.c); $("#dlg-soru").textContent = x.soru; $("#dlg-baslik").value = x.soru.slice(0, 80); $("#dlg-cevap").value = "";
    $("#dlg-kaydet").onclick = async () => { const c = $("#dlg-cevap").value.trim(); if (!c) return;
      await rpc("b_bosluk_kapat", { p_id: x.id, p_durum: "cevaplandi", p_cevap: c, p_baslik: $("#dlg-baslik").value.trim() }); $("#dlg").close(); bildir("Bilgiye eklendi."); rozet(); bosluklar().then(ikon); };
    $("#dlg-kapat").onclick = () => $("#dlg").close(); $("#dlg").showModal();
  });
}

// ---------- bilgi ----------
async function bilgiler() {
  const { data, error } = await sb.from("b_bilgi").select("id,baslik,metin,aktif,kaynak,yazan,guncelleme").order("aktif", { ascending: false }).order("id"); if (error) throw error;
  const KAY = { ortak_bilgi: "Ortak bilgi", bosluk: "Boşluktan", elle: "Elle", vivollo_eski: "Vivollo (eski)" };
  $("#icerik").innerHTML = `<div class="baslik"><h1>Bilgi</h1><div class="sag"><button class="birincil" id="yeni"><i data-lucide="plus"></i>Yeni bilgi</button></div></div>
    <p class="alt-metin">Botun müşteriye cevap verirken baktığı bilgiler. Pasif olanları bot görmez.</p>
    <div class="kart"><table><tr><th>Başlık</th><th>Kaynak</th><th>Durum</th><th>Güncelleme</th></tr>${data.map(b => `<tr class="tik" data-id="${b.id}">
      <td><b>${esc(b.baslik)}</b><div class="kisa">${esc(b.metin)}</div></td><td class="kucuk">${KAY[b.kaynak] || esc(b.kaynak || "")}</td>
      <td>${b.aktif ? '<span class="etiket yesil">Aktif</span>' : '<span class="etiket">Pasif</span>'}</td><td class="soluk kucuk">${tarih(b.guncelleme)}<div>${esc(b.yazan || "")}</div></td></tr>`).join("")}</table></div>`;
  document.querySelectorAll("tr.tik").forEach(t => t.onclick = () => git("bilgi", t.dataset.id));
  $("#yeni").onclick = () => git("bilgi", "yeni");
}
async function bilgiDuzen(id) {
  const yeni = id === "yeni";
  const b = yeni ? { baslik: "", metin: "", aktif: true, etiket: [] } : (await sb.from("b_bilgi").select("*").eq("id", id).single()).data;
  const g = yeni ? [] : (await sb.from("b_bilgi_gecmis").select("*").eq("bilgi", id).order("at", { ascending: false }).limit(20)).data || [];
  $("#icerik").innerHTML = `<div class="baslik"><button class="ikincil" id="geri"><i data-lucide="arrow-left"></i>Geri</button><h1>${yeni ? "Yeni bilgi" : esc(b.baslik)}</h1></div>
    <div class="iki"><div class="kart duzen"><label>Başlık<input id="b-baslik" value="${esc(b.baslik)}"></label>
      <label>Metin<textarea id="b-metin" class="buyuk">${esc(b.metin)}</textarea></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="b-aktif" style="width:auto" ${b.aktif ? "checked" : ""}>Aktif (bot görür)</label>
      <div class="dugmeler"><button class="birincil" id="b-kaydet">Kaydet</button><span class="soluk kucuk">Kaydedince eski hâli geçmişe yazılır.</span></div></div>
    <div class="kart"><div class="tur"><h2>Geçmiş</h2></div>${g.map(x => `<div class="tur"><div class="soluk kucuk">${tarih(x.at)} · ${esc(x.yazan || "")}</div><b>${esc(x.baslik)}</b><div class="kisa">${esc(x.metin)}</div>
      <button class="ince" data-geri="${x.id}" style="margin-top:4px"><i data-lucide="undo-2"></i>Bu hâline dön</button></div>`).join("") || '<div class="bos">Değişiklik yok.</div>'}</div></div>`;
  $("#geri").onclick = () => git("bilgi");
  const kaydet = async (baslik, metin, aktif) => { const v = await rpc("b_bilgi_kaydet", { p_id: yeni ? null : +id, p_baslik: baslik, p_metin: metin, p_etiket: b.etiket || [], p_aktif: aktif }); bildir("Kaydedildi."); git("bilgi", String(v)); };
  $("#b-kaydet").onclick = () => { const t = $("#b-baslik").value.trim(), m = $("#b-metin").value.trim(); if (!t || !m) return bildir("Başlık ve metin gerekli."); kaydet(t, m, $("#b-aktif").checked); };
  document.querySelectorAll("[data-geri]").forEach(x => x.onclick = () => { const e = g.find(y => y.id === +x.dataset.geri); if (confirm("Bu bilgi seçtiğin eski hâline dönsün mü?")) kaydet(e.baslik, e.metin, e.aktif); });
}

// ---------- talimat ----------
async function talimatlar() {
  const { data, error } = await sb.from("b_talimat").select("id,durum,aciklama,yazan,olusma,yayin_at").order("id", { ascending: false }); if (error) throw error;
  const D = { yayinda: ["Yayında", "yesil"], taslak: ["Taslak", "sari"], eski: ["Eski", ""] };
  $("#icerik").innerHTML = `<div class="baslik"><h1>Talimat</h1></div>
    <p class="alt-metin">Botun sistem talimatı. Her kayıt yeni bir taslak sürüm açar; yayınlanan sürümü bot kullanır. Geri almak için eski sürümü yeniden yayınla.</p>
    <div class="kart"><table><tr><th>Sürüm</th><th>Durum</th><th>Açıklama</th><th>Oluşturma</th></tr>${data.map(t => `<tr class="tik" data-id="${t.id}">
      <td><b>#${t.id}</b></td><td>${et(D, t.durum)}</td><td>${esc(t.aciklama || "")}</td><td class="soluk kucuk">${tarih(t.olusma)} · ${esc(t.yazan || "")}${t.yayin_at ? "<div>Yayın: " + tarih(t.yayin_at) + "</div>" : ""}</td></tr>`).join("")}</table></div>`;
  document.querySelectorAll("tr.tik").forEach(t => t.onclick = () => git("talimat", t.dataset.id));
  if (!data.some(t => t.durum === "yayinda")) $(".alt-metin").insertAdjacentHTML("afterend", '<div class="kart" style="padding:10px 14px;margin-bottom:12px;background:var(--uyari-zemin);color:var(--uyari)">Yayında talimat yok. Bot çalışmadan önce bir sürüm yayınlanmalı.</div>');
}
async function talimatDuzen(id) {
  const { data: t } = await sb.from("b_talimat").select("*").eq("id", id).single();
  $("#icerik").innerHTML = `<div class="baslik"><button class="ikincil" id="geri"><i data-lucide="arrow-left"></i>Geri</button><h1>Talimat #${t.id}</h1>
    <span class="soluk kucuk" id="sayac"></span><div class="sag">${yonetici() && t.durum !== "yayinda" ? '<button class="ikincil" id="t-yayinla"><i data-lucide="rocket"></i>Bu sürümü yayınla</button>' : ""}</div></div>
    <div class="kart duzen"><label>Talimat metni<textarea id="t-metin" class="buyuk">${esc(t.metin)}</textarea></label>
      <label>Değişiklik notu<input id="t-not" placeholder="Ne değişti, neden?"></label>
      <div class="dugmeler"><button class="birincil" id="t-kaydet">Yeni taslak olarak kaydet</button><span class="soluk kucuk">Yayındaki sürüm değişmez; yayınlamak ayrı adım.</span></div></div>`;
  const say = () => $("#sayac").textContent = $("#t-metin").value.length.toLocaleString("tr-TR") + " karakter";
  say(); $("#t-metin").oninput = say;
  $("#geri").onclick = () => git("talimat");
  $("#t-kaydet").onclick = async () => { const n = $("#t-not").value.trim(); if (!n) return bildir("Değişiklik notu yaz.");
    if ($("#t-metin").value === t.metin) return bildir("Metin değişmedi.");
    const v = await rpc("b_talimat_taslak", { p_metin: $("#t-metin").value, p_aciklama: n }); bildir("Taslak #" + v + " kaydedildi."); git("talimat", String(v)); };
  const y = $("#t-yayinla"); if (y) y.onclick = async () => { if (!confirm(`Talimat #${t.id} yayınlansın mı? Bot bundan sonra bu sürümü kullanır.`)) return; await rpc("b_talimat_yayinla", { p_id: t.id }); bildir("Yayınlandı."); git("talimat"); };
}

// ---------- ayarlar ----------
async function ayarlar() {
  const a = await ayarOku(), dis = yonetici() ? "" : "disabled";
  $("#icerik").innerHTML = `<div class="baslik"><h1>Ayarlar</h1></div>${yonetici() ? "" : '<p class="alt-metin">Ayarları yalnız yönetici değiştirebilir.</p>'}
    <div class="kart">
      <div class="ayar-satir"><div><b>Çalışma modu</b><p>${esc(MOD[a.mod]?.[1] || "")}</p></div><div class="secenek" id="mod">${Object.entries(MOD).map(([k, v]) => `<button data-m="${k}" class="${a.mod === k ? "secili" : ""}" ${dis}>${v[0]}</button>`).join("")}</div></div>
      <div class="ayar-satir"><div><b>Acil durdurma</b><p>Kapatınca bot hiçbir mesaja cevap üretmez.</p></div><div class="secenek"><button id="acik" class="${a.acik === false ? "" : "secili"}" ${dis}>${a.acik === false ? "Durduruldu, aç" : "Çalışıyor"}</button>${a.acik === false ? "" : `<button id="durdur" ${dis}>Durdur</button>`}</div></div>
      <div class="ayar-satir"><div><b>Model</b><p>Altın standart testinde gpt-5.4-mini + medium: %92,7 doğru, ayda ~$41.</p></div>
        <select id="model" ${dis}>${["gpt-5.4-mini", "gpt-5.4"].map(m => `<option ${a.model?.ad === m ? "selected" : ""}>${m}</option>`).join("")}</select>
        <select id="efor" style="width:120px" ${dis}>${["low", "medium", "high"].map(e => `<option ${a.model?.efor === e ? "selected" : ""}>${e}</option>`).join("")}</select></div>
      <div class="ayar-satir"><div><b>Test kanalları</b><p>Test modunda yalnız bu Connexease kanal kimliklerine gönderilir. Virgülle ayır.</p></div><input id="test" value="${esc((a.test_kanallar || []).join(", "))}" ${dis}></div>
    </div>${yonetici() ? '<div class="dugmeler"><button class="birincil" id="ayar-kaydet">Model ve test kanallarını kaydet</button></div>' : ""}`;
  if (!yonetici()) return;
  const yaz = async (k, v) => { await rpc("b_ayar_yaz", { p_anahtar: k, p_deger: v }); };
  document.querySelectorAll("#mod button").forEach(b => b.onclick = async () => {
    const m = b.dataset.m; if (m === a.mod) return;
    if (m === "canli" && prompt('Canlıya geçiş bütün müşterilere bot cevabı gönderir. Onay için "CANLI" yaz.') !== "CANLI") return;
    await yaz("mod", m); bildir("Mod: " + MOD[m][0]); modGoster(); ayarlar().then(ikon);
  });
  $("#acik").onclick = async () => { if (a.acik === false) { await yaz("acik", true); bildir("Bot açıldı."); modGoster(); ayarlar().then(ikon); } };
  const d = $("#durdur"); if (d) d.onclick = async () => { if (!confirm("Bot durdurulsun mu?")) return; await yaz("acik", false); bildir("Bot durduruldu."); modGoster(); ayarlar().then(ikon); };
  $("#ayar-kaydet").onclick = async () => {
    await yaz("model", { ad: $("#model").value, efor: $("#efor").value });
    await yaz("test_kanallar", $("#test").value.split(",").map(s => s.trim()).filter(Boolean));
    bildir("Kaydedildi."); modGoster();
  };
}

basla();

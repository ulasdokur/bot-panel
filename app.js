// Tahta Bot Paneli: kendi WhatsApp botumuzun (Vivollo yerine) yönetimi.
// Veri soru-kontrol Supabase'inde b_ tablolarında; okuma RLS (d_yetkili_mi), yazma yalnız RPC'lerle.
// Giriş destek paneliyle aynı hesaplar (d_yetkili). Talimat yayımı ve ayarlar yalnız yönetici.
const SB_URL = "https://rbjrnevngfuribasrnph.supabase.co";
const SB_ANON = "sb_publishable_yK1dNA6CGKIQ88U3gp53xA_nBLQGNVJ";
const MOTOR = "https://2-28-141-221.sslip.io";
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
  if (git.engel && !git.engel()) { if (hashtenGeldi) history.replaceState(null, "", "#" + sekme + (git.son ? "/" + git.son : "")); return; }
  git.engel = null; sekme = s; git.son = id;
  document.querySelectorAll("#sekmeler button").forEach(b => b.classList.toggle("secili", b.dataset.s === s));
  if (!hashtenGeldi) history.replaceState(null, "", "#" + s + (id ? "/" + id : ""));
  const f = { sohbet: id ? sohbetAyrinti : sohbetler, bosluk: bosluklar, bilgi: id ? bilgiDuzen : bilgiler, talimat: id ? talimatDuzen : talimatlar, ayar: ayarlar, dene: denemeEkrani, akis: id ? akisGoster : akislar }[s] || sohbetler;
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

// ---------- dene ----------
// Sahte sohbet: bot cevabı + arka planda ne yaptığı (araçlar, süre, token, maliyet). Hiçbir şey kaydedilmez, hiçbir dış sistem çağrılmaz.
const dene = { mesajlar: [], turlar: [], toplam: 0 };
async function denemeEkrani() {
  const [a, tl] = await Promise.all([ayarOku(), sb.from("b_talimat").select("id,durum,aciklama").neq("durum", "eski").order("id", { ascending: false })]);
  $("#icerik").innerHTML = `<div class="baslik"><h1>Dene</h1><div class="sag">
      <select id="d-talimat" style="width:230px">${(tl.data || []).map(t => `<option value="${t.id}">#${t.id} ${t.durum === "yayinda" ? "yayında" : "taslak"} · ${esc((t.aciklama || "").slice(0, 28))}</option>`).join("")}</select>
      <select id="d-model" style="width:140px">${["gpt-5.4-mini", "gpt-5.4"].map(m => `<option ${a.model?.ad === m ? "selected" : ""}>${m}</option>`).join("")}</select>
      <select id="d-efor" style="width:100px">${["low", "medium", "high"].map(e => `<option ${a.model?.efor === e ? "selected" : ""}>${e}</option>`).join("")}</select>
      <button class="ikincil" id="d-sifirla"><i data-lucide="rotate-ccw"></i>Sıfırla</button></div></div>
    <p class="alt-metin">Müşteri gibi yaz, bot cevap versin. Araçlar gerçekten çalıştırılmaz, yalnız "şunu çağırırdı" diye gösterilir. Hiçbir şey kaydedilmez.</p>
    <div class="iki"><div class="kart dene-sol"><div class="akis" id="d-akis"></div>
      <form class="dene-yaz" id="d-form"><textarea id="d-metin" rows="2" placeholder="Müşteri mesajı… (Enter gönderir, Shift+Enter alt satır)"></textarea><button class="birincil" id="d-gonder"><i data-lucide="send"></i>Gönder</button></form></div>
      <div class="kart"><div class="tur"><h2>Arka plan</h2><div class="soluk kucuk" id="d-toplam"></div></div><div id="d-turlar"></div></div></div>`;
  const ciz = () => {
    $("#d-akis").innerHTML = dene.mesajlar.map(m => m.kimden === "not" ? `<div class="dene-not">${esc(m.metin)}</div>`
      : `<div class="balon ${m.kimden === "musteri" ? "musteri" : "bot"}"><div class="ust">${m.kimden === "musteri" ? "Müşteri" : "Bot"}</div>${esc(m.metin)}</div>`).join("") || '<div class="bos">Bir müşteri mesajı yazarak başla.</div>';
    $("#d-akis").scrollTop = 1e9;
    $("#d-toplam").textContent = dene.turlar.length ? `${dene.turlar.length} tur · toplam $${dene.toplam.toFixed(4)}` : "Her turda süre, düşünme, araçlar ve maliyet burada görünür.";
    $("#d-turlar").innerHTML = dene.turlar.slice().reverse().map((t, i) => {
      const n = dene.turlar.length - i, k = t.token || {};
      return `<div class="tur">
      <div><b>Tur ${n}</b> ${t.karar === "devam" ? '<span class="etiket">Devam</span>' : et(DEVIR, t.karar)}</div>
      <div class="dene-olcu"><span><i data-lucide="timer"></i>${(t.sure_ms / 1000).toFixed(1)} sn</span><span><i data-lucide="brain"></i>${(k.dusunme || 0).toLocaleString("tr-TR")} düşünme token</span>
        <span><i data-lucide="arrow-down-to-line"></i>${(k.girdi || 0).toLocaleString("tr-TR")} girdi${k.cache ? ` (${k.cache.toLocaleString("tr-TR")} önbellek)` : ""}</span><span><i data-lucide="arrow-up-from-line"></i>${(k.cikti || 0).toLocaleString("tr-TR")} çıktı</span>
        <span><i data-lucide="coins"></i>$${Number(t.maliyet || 0).toFixed(4)}</span></div>
      ${t.araclar?.length ? t.araclar.map(x => `<div class="kucuk" style="margin-top:8px"><span class="etiket mor">${esc(x.ad)}</span><pre>${esc(JSON.stringify(x.arg, null, 1))}</pre><div class="soluk">${esc(x.sonuc)}</div></div>`).join("") : '<div class="soluk kucuk" style="margin-top:8px">Araç çağırmadı.</div>'}
      ${t.gerekce ? `<div class="kucuk" style="margin-top:8px"><b>Neden:</b> ${esc(t.gerekce)}</div>` : ""}
      <div class="soluk kucuk" style="margin-top:6px">${esc(t.model?.ad || "")} · ${esc(t.model?.efor || "")} · talimat #${t.talimat?.id ?? "?"}</div>
      ${t.hata ? `<div class="hata">${esc(t.hata)}</div>${t.ham ? `<pre>${esc(t.ham)}</pre>` : ""}` : ""}</div>`;
    }).join("");
    ikon();
  };
  const gonder = async ev => {
    ev?.preventDefault(); const metin = $("#d-metin").value.trim(); if (!metin || gonder.mesgul) return;
    gonder.mesgul = true; $("#d-gonder").disabled = true; $("#d-metin").value = "";
    dene.mesajlar.push({ kimden: "musteri", metin }); ciz();
    $("#d-akis").insertAdjacentHTML("beforeend", '<div class="dene-not">Bot düşünüyor…</div>');
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(MOTOR + "/dene", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + session.access_token },
        body: JSON.stringify({ mesajlar: dene.mesajlar.filter(m => m.kimden !== "not"), talimat: +$("#d-talimat").value || null, model: { ad: $("#d-model").value, efor: $("#d-efor").value } }) });
      const t = await r.json(); if (!r.ok) throw new Error(t.hata || r.status);
      dene.turlar.push(t); dene.toplam += Number(t.maliyet || 0);
      (t.mesajlar || []).forEach(m => dene.mesajlar.push({ kimden: "bot", metin: m }));
      (t.araclar || []).forEach(x => dene.mesajlar.push({ kimden: "not", metin: (DEVIR[x.ad]?.[0] || x.ad) + " (gerçekte bu araç çalışırdı)" }));
      if (!t.mesajlar?.length && !t.araclar?.length) dene.mesajlar.push({ kimden: "not", metin: "Bot bu mesaja cevap yazmadı." });
    } catch (e) { dene.mesajlar.push({ kimden: "not", metin: "Hata: " + e.message }); }
    gonder.mesgul = false; $("#d-gonder").disabled = false; ciz(); $("#d-metin").focus();
  };
  $("#d-form").onsubmit = gonder;
  $("#d-metin").onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) gonder(e); };
  $("#d-sifirla").onclick = () => { dene.mesajlar = []; dene.turlar = []; dene.toplam = 0; ciz(); };
  ciz(); $("#d-metin").focus();
}

basla();

// ---------- akış (görüntüleme + taslak düzenleme) ----------
// Vivollo akışlarının 4 Kas kopyası (b_akis.dugumler, değişmez). Düzenlemeler yalnız b_akis.taslak'a yazılır (b_akis_taslak_kaydet).
// Vivollo'ya ya da canlı bota HİÇBİR ŞEY gitmez.
// Gizli değerler (apikey, Authorization, p_token) tabloya yüklenirken "***" yapıldı.
const DUGUM = {
  START: ["Görüşme açıldı", "play", "tetik"], FALLBACK: ["Mesaj alındı", "message-circle", "tetik"], IDLE: ["Hareketsizlik", "timer", "tetik"],
  RESOLVING: ["Çözülüyor", "loader", "tetik"], RESOLVED: ["Çözüldü", "circle-check", "tetik"],
  SEND_MESSAGE: ["Mesaj gönder", "send", "mesaj"], CAPTURE_USER: ["Kullanıcı bilgilerini al", "user-pen", "mesaj"],
  ASK_AI: ["Yapay zekâya sor", "sparkles", "yz"], AGENTIC_AI: ["Otonom yapay zekâ", "bot", "yz"], USER_INTENT: ["Kullanıcı niyeti", "target", "yz"],
  SEARCH_DOCUMENTS: ["Belgelerde ara", "file-search", "yz"], REPLY_FROM_DOCUMENTS: ["Belgelerden yanıtla", "file-text", "yz"],
  CONDITIONAL: ["Koşul", "git-branch", "kontrol"], REDIRECT_TO_FLOW: ["Başka akışa yönlendir", "corner-up-right", "kontrol"],
  API_CALL: ["API isteği", "globe", "veri"], UPDATE_CONVERSATION: ["Görüşmeyi güncelle", "pencil", "veri"], GET_FILTER_VOCABULARY: ["Filtre değerlerini al", "filter", "veri"],
  LOOKUP_ROWS: ["Satır ara", "table", "veri"], APPEND_ROW: ["Satır ekle", "table-2", "veri"], ASSIGN_USER: ["Kullanıcıya ata", "user-check", "veri"],
  CX_ASSIGN_TO_GROUP: ["Gruba ata", "users", "cx"], CX_ASSIGN_TO_AGENT: ["Temsilciye ata", "user-check", "cx"], CX_ARCHIVE_CONVERSATION: ["Görüşmeyi arşivle", "archive", "cx"],
  CX_UNARCHIVE_CONVERSATION: ["Arşivden çıkar", "archive-restore", "cx"], CX_UPDATE_CONVERSATION_CUSTOM_FIELDS: ["Görüşme alanlarını güncelle", "list", "cx"],
  CX_UPDATE_CUSTOMER: ["Müşteriyi güncelle", "user", "cx"], CX_UPDATE_CUSTOMER_CUSTOM_FIELDS: ["Müşteri alanlarını güncelle", "list", "cx"],
};
const OPER = { CONTAINS: "içerir", NOT_CONTAINS: "içermez", EQUALS: "eşittir", NOT_EQUALS: "eşit değil", STARTS_WITH: "ile başlar", ENDS_WITH: "ile biter",
  IS_EMPTY: "boş", IS_NOT_EMPTY: "dolu", EXISTS: "var", NOT_EXISTS: "yok", REGEX: "regex", MATCHES_REGEX: "regex", GREATER_THAN: "büyük", LESS_THAN: "küçük" };
const GDURUM = { RESOLVED: "Çözüldü", OPEN: "Açık", PENDING: "Bekliyor", ON_HOLD: "Beklemeye alındı", NEW: "Yeni" };
const ALAN = { messages: "Mesajlar", text: "Metin", options: "Seçenekler", request: "İstek", url: "Adres", method: "Yöntem", headers: "Başlıklar", body: "Gövde",
  response_mapping: "Yanıt → değişken", on_failed: "Hata olursa", conditions: "Koşullar", criteria: "Ölçütler", operator: "Operatör", variable: "Değişken",
  value: "Değer", key: "Anahtar", match_any: "Herhangi biri yeter", status: "Durum", metafields: "Özel alanlar", idle_time: "Bekleme (sn)",
  for_one_time: "Bir kez çalıştır", reset_on_interaction: "Yanıt verince yeniden etkinleştir", ignore_skip_flow: "Temsilci devraldıysa da çalıştır",
  tool_actions: "Araç dalları", name: "Ad", assistant_id: "Asistan", flow_id: "Akış", query: "Sorgu", result_limit: "Sonuç sayısı", result_mode: "Sonuç biçimi",
  collection_group_id: "Koleksiyon", filter_groups: "Filtreler", should_halt: "Müşteri yanıtını bekle", next_action_id: "Sonraki düğüm", user_input: "Kullanıcı girdisi",
  is_enabled: "Açık", should_set_variable: "Değişkene yaz", auto_translate: "Otomatik çeviri", is_internal: "Yalnız iç not", pagination: "Sayfalama",
  content: "İçerik", type: "Tür", skills: "Beceriler", fixed_skills: "Sabit beceriler" };
const kisalt = (s, n = 90) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n) + "…" : s; };
const olcut = c => `${esc(c.variable)} <b>${esc(OPER[c.operator] || String(c.operator || "").toLowerCase())}</b> ${c.value != null && c.value !== "" ? `"${esc(kisalt(c.value, 40))}"` : ""}`;

// Bir düğümün bütün çıkışları: [{etiket, hedef}]. etiket boşsa düğümün kendi ana çıkışıdır.
const ANA_CIKIS_YOK = new Set(["CONDITIONAL", "API_CALL", "AGENTIC_AI", "REDIRECT_TO_FLOW", "ASK_AI", "USER_INTENT"]);
const DEGISKENLER = ["cx.last_api_response", "cx.conversation.id", "cx.current_date", "cx.current_time", "cx.current_datetime", "cx.last_lookup", "cx.last_appended_row", "cx.filter_vocabulary"];
const PALET = ["SEND_MESSAGE", "CONDITIONAL", "API_CALL", "AGENTIC_AI", "UPDATE_CONVERSATION", "SEARCH_DOCUMENTS", "REDIRECT_TO_FLOW", "IDLE", "START", "FALLBACK", "RESOLVING", "RESOLVED",
  "CX_ASSIGN_TO_GROUP", "CX_ASSIGN_TO_AGENT", "CX_ARCHIVE_CONVERSATION", "CX_UNARCHIVE_CONVERSATION", "CX_UPDATE_CONVERSATION_CUSTOM_FIELDS", "CX_UPDATE_CUSTOMER_CUSTOM_FIELDS"];
const VARSAYILAN = {
  SEND_MESSAGE: () => ({ messages: [{ type: "TEXT", content: { text: "" }, pagination: null, is_internal: false }], user_input: { is_enabled: false, should_set_variable: false }, should_halt: false, auto_translate: false }),
  CONDITIONAL: () => ({ conditions: [{ criteria: [{ variable: "", operator: "CONTAINS", value: "" }], match_any: true, next_action_id: null }], next_action_id: null }),
  API_CALL: () => ({ request: { url: "", method: "POST", headers: [{ key: "Content-Type", value: "application/json" }], body: [] }, on_failed: { next_action_id: null }, next_action_id: null, response_mapping: [] }),
  AGENTIC_AI: () => ({ skills: [], assistant_id: 1, fixed_skills: false, tool_actions: [] }),
  UPDATE_CONVERSATION: () => ({ status: null, metafields: [] }),
  SEARCH_DOCUMENTS: () => ({ query: "", result_mode: "detailed", result_limit: 3, filter_groups: [], collection_group_id: "" }),
  REDIRECT_TO_FLOW: () => ({ flow_id: null }),
  IDLE: () => ({ idle_time: 300, for_one_time: true, ignore_skip_flow: false, reset_on_interaction: true }),
};
const TETIK = new Set(["START", "FALLBACK", "RESOLVING", "RESOLVED"]);
const yolAl = (o, y) => y.reduce((a, k) => a == null ? a : a[k], o);
const yolYaz = (o, y, v) => { let a = o; y.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = typeof y[i + 1] === "number" ? [] : {}; a = a[k]; }); a[y.at(-1)] = v; };
const egri = (sx, sy, tx, ty) => { const dx = Math.max(50, Math.abs(tx - sx) / 2); return `M${sx} ${sy}C${sx + dx} ${sy},${tx - dx} ${ty},${tx} ${ty}`; };
const kisaAd = d => { if (!d) return "?"; const a = d.arguments || {}, t = (DUGUM[d.type] || [d.type])[0];
  const k = a.messages?.[0]?.content?.text || a.request?.url?.replace(/^https?:\/\/[^/]+/, "") || a.query || (a.status ? GDURUM[a.status] : "") || "";
  return `#${d.id} ${t}${k ? " · " + kisalt(k.replace(/\s+/g, " "), 34) : ""}`; };

// Bir düğümün bütün çıkışları: etiket boşsa düğümün kendi ana çıkışı. yol: hedefin düğüm içindeki yeri (düzenlemede yazılır).
function cikislar(d) {
  const a = d.arguments || {}, o = [];
  if (!ANA_CIKIS_YOK.has(d.type) || d.next_action_id) o.push({ etiket: "", hedef: d.next_action_id, yol: ["next_action_id"] });
  (a.conditions || []).forEach((k, i) => o.push({ etiket: `${i + 1}. ${(k.criteria || []).map(olcut).join(k.match_any ? " ya da " : " ve ") || "(ölçüt yok)"}`, html: true, hedef: k.next_action_id, yol: ["arguments", "conditions", i, "next_action_id"] }));
  if (d.type === "CONDITIONAL") o.push({ etiket: "Değilse", hedef: a.next_action_id, yol: ["arguments", "next_action_id"] });
  else if (d.type === "API_CALL" || a.next_action_id) o.push({ etiket: d.type === "API_CALL" ? "Başarılı" : "Sonra", hedef: a.next_action_id, yol: ["arguments", "next_action_id"] });
  (a.messages || []).forEach((m, mi) => (m.content?.options || []).forEach((s, si) => o.push({ etiket: s.text || "(boş seçenek)", hedef: s.next_action_id, yol: ["arguments", "messages", mi, "content", "options", si, "next_action_id"] })));
  (a.tool_actions || []).forEach((t, i) => o.push({ etiket: t.name || "(adsız araç)", hedef: t.next_action_id, arac: true, yol: ["arguments", "tool_actions", i, "next_action_id"] }));
  if (d.type === "API_CALL" || a.on_failed) o.push({ etiket: "Hata olursa", hedef: a.on_failed?.next_action_id, hata: true, yol: ["arguments", "on_failed", "next_action_id"] });
  return o;
}
function ozet(d) {
  const a = d.arguments || {};
  switch (d.type) {
    case "SEND_MESSAGE": return (a.messages || []).map(m => m.content?.text ? esc(kisalt(m.content.text, 140)) : '<span class="soluk">(boş mesaj)</span>').join("<hr>") + (a.should_halt ? '<div class="soluk">Yanıt bekler</div>' : "");
    case "API_CALL": { const u = a.request?.url || ""; return u ? `<b>${esc(a.request?.method)}</b> ${esc(kisalt(u.replace(/^https?:\/\/[^/]+/, ""), 60))}<div class="soluk">${esc((u.match(/^https?:\/\/([^/]+)/) || [])[1] || "")}</div>` : '<span class="soluk">(adres yok)</span>'; }
    case "UPDATE_CONVERSATION": return (a.status ? `Durum: <b>${esc(GDURUM[a.status] || a.status)}</b>` : "") + (a.metafields || []).map(m => `<div>${esc(m.key)} = ${esc(kisalt(m.value, 40))}</div>`).join("");
    case "IDLE": return `${Math.round((a.idle_time || 0) / 60)} dk sessizlik${a.for_one_time ? " · bir kez" : ""}`;
    case "REDIRECT_TO_FLOW": return `Akış #${esc(a.flow_id ?? "?")}`;
    case "SEARCH_DOCUMENTS": case "REPLY_FROM_DOCUMENTS": return `Sorgu: ${esc(kisalt(a.query, 70))}`;
    case "AGENTIC_AI": return `Asistan #${esc(a.assistant_id)} · ${(a.tool_actions || []).length} araç dalı`;
    case "START": return "Yeni görüşme açılınca";
    case "FALLBACK": return "Müşteri mesaj yazınca";
    default: return "";
  }
}
function alanAgaci(v) {
  if (v === null || v === undefined || v === "") return '<span class="soluk">—</span>';
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v !== "object") return `<span class="deger">${esc(v)}</span>`;
  if (Array.isArray(v)) return v.length ? `<ol>${v.map(x => `<li>${alanAgaci(x)}</li>`).join("")}</ol>` : '<span class="soluk">boş</span>';
  return `<dl>${Object.entries(v).map(([k, x]) => `<dt>${esc(ALAN[k] || k)}</dt><dd>${k === "operator" ? esc(OPER[x] || x) : k === "status" ? esc(GDURUM[x] || x) : alanAgaci(x)}</dd>`).join("")}</dl>`;
}

async function akislar() {
  const { data, error } = await sb.from("b_akis").select("id,ad,kaynak,vivollo_id,aciklama,guncellendi,dugumler,taslak_guncellendi,taslak_yazan").order("id");
  if (error) throw error;
  $("#icerik").innerHTML = `<div class="baslik"><h1>Akışlar</h1></div>
    <p class="alt-metin">Vivollo akışlarının 4 Kas kopyası. Düzenlediğin her şey yalnız bu panelde taslak olarak durur: Vivollo'ya ve bota gitmez.</p>
    <div class="kart"><table><tr><th>Ad</th><th>Kaynak</th><th>Düğüm</th><th>Taslak</th></tr>
    ${(data || []).map(r => `<tr class="tik" data-id="${r.id}"><td><b>${esc(r.ad)}</b>${r.aciklama ? `<div class="kisa">${esc(r.aciklama)}</div>` : ""}</td>
      <td>${esc(r.kaynak)}${r.vivollo_id ? ` #${r.vivollo_id}` : ""}<div class="soluk kucuk">kopya: ${tarih(r.guncellendi)}</div></td><td>${(r.dugumler || []).length}</td>
      <td>${r.taslak_guncellendi ? `<span class="etiket mor">Taslak var</span><div class="soluk kucuk">${tarih(r.taslak_guncellendi)} · ${esc((r.taslak_yazan || "").split("@")[0])}</div>` : '<span class="soluk">—</span>'}</td></tr>`).join("") || '<tr><td colspan="4" class="bos">Akış yok.</td></tr>'}</table></div>`;
  document.querySelectorAll("tr.tik").forEach(t => t.onclick = () => git("akis", t.dataset.id));
}

async function akisGoster(id) {
  const { data: r, error } = await sb.from("b_akis").select("*").eq("id", id).maybeSingle();
  if (error) throw error; if (!r) throw new Error("Akış bulunamadı");
  const A = { r, asil: r.dugumler || [], dl: structuredClone(r.taslak || r.dugumler || []), gecmis: [], secili: null, salt: false, degisti: false, fark: {}, harita: {}, sonAlan: null };
  const asilHarita = Object.fromEntries(A.asil.map(d => [d.id, d]));
  const gor = () => A.salt ? A.asil : A.dl;
  $("#icerik").innerHTML = `<div class="baslik"><button class="ikincil" id="a-geri"><i data-lucide="arrow-left"></i>Akışlar</button><h1>${esc(r.ad)}</h1>
      <div class="secenek" id="a-gorunum"><button data-g="taslak" class="secili">Taslak</button><button data-g="asil">Vivollo kopyası</button></div>
      <div class="sag"><input id="a-ara" placeholder="Ara: metin, araç, #id" style="width:240px"></div></div>
    <div class="akis-alan" id="a-alan">
      <div class="akis-arac" id="a-arac">
        <div class="a-grup"><select id="a-ekle" class="a-duzen" style="width:170px"><option value="">+ Düğüm ekle</option>${PALET.map(t => `<option value="${t}">${esc(DUGUM[t][0])}</option>`).join("")}</select>
          <button class="ikincil a-duzen" id="a-geriAl" title="Geri al (Cmd+Z)"><i data-lucide="undo-2"></i>Geri al</button><span class="a-ayrac a-duzen"></span>
          <button class="ikincil" id="a-toparla" title="Bütün düğümleri akış sırasına göre soldan sağa dizer, çakışmaları açar"><i data-lucide="wand-sparkles"></i>Toparla</button></div>
        <span class="kucuk a-durum" id="a-durum"></span>
        <div class="a-grup"><button class="tehlike a-duzen" id="a-taslakSil" ${r.taslak ? "" : "hidden"}><i data-lucide="trash-2"></i>Taslağı sil</button>
          <button class="birincil a-duzen" id="a-kaydet"><i data-lucide="save"></i>Taslağı kaydet</button></div></div>
      <div class="akis-zoom"><button id="a-kucult" title="Uzaklaş"><i data-lucide="minus"></i></button><button id="a-oran" title="%100'e dön">80%</button>
        <button id="a-buyut" title="Yakınlaş"><i data-lucide="plus"></i></button><span class="a-ayrac"></span><button id="a-sigdir" title="Bütün akışı ekrana sığdır"><i data-lucide="maximize"></i></button></div>
      <div class="akis-tuval" id="a-tuval"><svg class="akis-ok" width="1" height="1">
        <defs><marker id="uc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#a1a1aa"/></marker>
        <marker id="uc2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8b4cfc"/></marker></defs>
        <g id="a-oklar"></g><path id="a-gecici" class="gecici"/></svg><div id="a-dugumler"></div></div>
      <aside class="akis-detay" id="a-detay" hidden></aside></div>
    <datalist id="a-degiskenler">${DEGISKENLER.map(v => `<option value="${v}">`).join("")}</datalist>`;
  const alan = $("#a-alan"), det = $("#a-detay");

  // ----- çizim -----
  const farkHesapla = () => {
    A.fark = {}; if (A.salt) return { yeni: 0, degisti: 0, silindi: 0 };
    const sade = d => JSON.stringify({ ...d, node_payload: undefined });
    let yeni = 0, degisti = 0;
    A.dl.forEach(d => { const a = asilHarita[d.id]; if (!a) { A.fark[d.id] = "yeni"; yeni++; } else if (sade(a) !== sade(d)) { A.fark[d.id] = "degisti"; degisti++; } });
    const ids = new Set(A.dl.map(d => d.id));
    return { yeni, degisti, silindi: A.asil.filter(d => !ids.has(d.id)).length };
  };
  const dugumHtml = d => {
    const t = DUGUM[d.type] || [d.type, "box", "veri"], p = d.node_payload?.position || {}, c = cikislar(d), oz = ozet(d), f = A.fark[d.id], ana = c.findIndex(x => !x.etiket);
    return `<div class="dugum ${t[2]}${A.secili === d.id ? " secili" : ""}" data-id="${d.id}" style="left:${p.x || 0}px;top:${p.y || 0}px">
      <div class="d-bas" ${ana >= 0 ? `data-c="${ana}"` : ""}><i data-lucide="${t[1]}"></i><b>${esc(t[0])}</b>${f ? `<span class="etiket ${f === "yeni" ? "yesil" : "sari"}">${f === "yeni" ? "yeni" : "değişti"}</span>` : ""}<span class="soluk no">#${d.id}</span>${ana >= 0 ? '<i class="nokta" title="Sürükleyip bir düğüme bırak"></i>' : ""}</div>
      ${oz ? `<div class="d-govde">${oz}</div>` : ""}
      ${c.some(x => x.etiket) ? `<div class="d-cikis">${c.map((x, i) => x.etiket ? `<div class="cikis${x.hata ? " hata-dal" : ""}${x.arac ? " arac" : ""}${x.hedef ? "" : " bos-dal"}" data-c="${i}">${x.html ? x.etiket : esc(kisalt(x.etiket, 60))}<i class="nokta" title="Sürükleyip bir düğüme bırak"></i></div>` : "").join("")}</div>` : ""}</div>`;
  };
  const okCiz = () => {
    const g = $("#a-oklar"), ns = "http://www.w3.org/2000/svg"; g.innerHTML = "";
    document.querySelectorAll("#a-dugumler .dugum").forEach(n => {
      const d = A.harita[n.dataset.id]; if (!d) return; const c = cikislar(d);
      n.querySelectorAll("[data-c]").forEach(el => {
        const x = c[+el.dataset.c]; if (!x?.hedef) return;
        const h = document.querySelector(`#a-dugumler .dugum[data-id="${x.hedef}"]`); if (!h) return;
        const p = document.createElementNS(ns, "path"), v = A.secili != null && (A.secili === d.id || A.secili === x.hedef);
        p.setAttribute("d", egri(n.offsetLeft + n.offsetWidth, n.offsetTop + el.offsetTop + el.offsetHeight / 2, h.offsetLeft, h.offsetTop + 18));
        p.setAttribute("class", (x.hata ? "hata-ok" : "") + (v ? " vurgu" : "")); p.setAttribute("marker-end", v ? "url(#uc2)" : "url(#uc)"); g.appendChild(p);
      });
    });
  };
  const durumYaz = () => {
    const f = farkHesapla(), parca = [];
    if (A.salt) parca.push("Vivollo'dan alınan kopya, salt okunur.");
    else {
      if (A.degisti) parca.push('<b class="uyari-metin">Kaydedilmemiş değişiklik var</b>');
      else if (r.taslak_guncellendi) parca.push(`Taslak kaydı: ${tarih(r.taslak_guncellendi)} · ${esc((r.taslak_yazan || "").split("@")[0])}`);
      const ff = [f.yeni && `${f.yeni} yeni`, f.degisti && `${f.degisti} değişti`, f.silindi && `${f.silindi} silindi`].filter(Boolean);
      parca.push(ff.length ? "Kopyaya göre: " + ff.join(", ") : "Kopyayla aynı");
    }
    $("#a-durum").innerHTML = parca.join(" · ");
    $("#a-geriAl").disabled = !A.gecmis.length; $("#a-kaydet").disabled = !A.degisti;
    alan.classList.toggle("salt", A.salt);
    document.querySelectorAll("#a-arac .a-duzen").forEach(b => b.hidden = b.id === "a-taslakSil" ? (!r.taslak || A.salt) : A.salt);
  };
  const yenile = () => {
    A.harita = Object.fromEntries(gor().map(d => [d.id, d])); if (A.secili != null && !A.harita[A.secili]) { A.secili = null; det.hidden = true; }
    farkHesapla(); $("#a-dugumler").innerHTML = gor().map(dugumHtml).join(""); ikon(); okCiz(); durumYaz(); araUygula();
  };
  const dugumYenile = id => {
    const n = document.querySelector(`#a-dugumler .dugum[data-id="${id}"]`); farkHesapla();
    if (n) { n.outerHTML = dugumHtml(A.harita[id]); ikon(); } okCiz(); durumYaz();
  };
  const gecmisEkle = () => { A.gecmis.push(JSON.stringify(A.dl)); if (A.gecmis.length > 150) A.gecmis.shift(); A.degisti = true; };
  const geriAl = () => { if (!A.gecmis.length || A.salt) return; A.dl = JSON.parse(A.gecmis.pop()); A.degisti = true; yenile(); if (A.secili != null) panelCiz(); };

  // ----- kaydır / yakınlaştır -----
  const tuval = $("#a-tuval"); let o = { x: 0, y: 0, k: 0.8 }, surukle = null;
  const uygula = () => { tuval.style.transform = `translate(${o.x}px,${o.y}px) scale(${o.k})`; $("#a-oran").textContent = Math.round(o.k * 100) + "%"; };
  const yakinlas = (k, cx = alan.clientWidth / 2, cy = alan.clientHeight / 2) => { k = Math.min(1.6, Math.max(0.12, k)); o.x = cx - (cx - o.x) * k / o.k; o.y = cy - (cy - o.y) * k / o.k; o.k = k; uygula(); };
  // sınırlar DOM konumundan değil veriden: toparlama animasyonu sürerken de doğru
  const sinir = () => { const ns = [...document.querySelectorAll("#a-dugumler .dugum")].map(n => { const p = A.harita[n.dataset.id]?.node_payload?.position || {}; return { x: p.x || 0, y: p.y || 0, w: n.offsetWidth, h: n.offsetHeight }; });
    return ns.length ? { x0: Math.min(...ns.map(n => n.x)), y0: Math.min(...ns.map(n => n.y)), x1: Math.max(...ns.map(n => n.x + n.w)), y1: Math.max(...ns.map(n => n.y + n.h)) } : { x0: 0, y0: 0, x1: 1, y1: 1 }; };
  const UST = 52; // üst araç şeridi
  const sigdir = () => { const b = sinir(), w = b.x1 - b.x0 + 80, h = b.y1 - b.y0 + 80, ah = alan.clientHeight - UST - 16;
    o.k = Math.min(1, Math.max(0.12, Math.min(alan.clientWidth / w, ah / h))); o.x = (alan.clientWidth - w * o.k) / 2 - (b.x0 - 40) * o.k; o.y = UST + 8 + (ah - h * o.k) / 2 - (b.y0 - 40) * o.k; uygula(); };

  // ----- toparla: katmanlı düzen (soldan sağa). Tetikleyiciden başlar, her düğüm kendisine gelen en uzun yolun sütununa;
  // sütun içinde düğüm, kendisini çağıran çıkışın hizasına yakın durur; kopuk parçalar alt alta, tek başına kalanlar en altta sıra halinde.
  const toparla = liste => {
    const hz = Object.fromEntries(liste.map(d => [d.id, d])), el = id => document.querySelector(`#a-dugumler .dugum[data-id="${id}"]`);
    const boy = id => el(id)?.offsetHeight || 80, port = (id, ci) => { const c = el(id)?.querySelector(`[data-c="${ci}"]`); return c ? c.offsetTop + c.offsetHeight / 2 : 18; };
    const cik = {}, gir = {}; liste.forEach(d => { cik[d.id] = []; gir[d.id] = []; });
    liste.forEach(d => cikislar(d).forEach((x, ci) => { if (x.hedef != null && hz[x.hedef] && x.hedef !== d.id && !cik[d.id].some(e => e.h === x.hedef)) { cik[d.id].push({ h: x.hedef, ci }); gir[x.hedef].push(d.id); } }));
    const pos = d => d.node_payload?.position || {}, kok = d => d.type === "START" ? 0 : TETIK.has(d.type) || d.type === "IDLE" ? 1 : gir[d.id].length ? 3 : 2;
    const sira = [...liste].sort((a, b) => kok(a) - kok(b) || (pos(a).x || 0) - (pos(b).x || 0) || (pos(a).y || 0) - (pos(b).y || 0));
    const si = Object.fromEntries(sira.map((d, i) => [d.id, i]));
    // geri dönen okları (döngü) bul, sütun hesabında sayma
    const dz = {}, geri = new Set(), topo = [];
    const dfs = id => { dz[id] = 1; for (const e of cik[id]) { if (dz[e.h] === 1) geri.add(id + ">" + e.h); else if (!dz[e.h]) dfs(e.h); } dz[id] = 2; topo.push(id); };
    sira.forEach(d => { if (!dz[d.id]) dfs(d.id); }); topo.reverse();
    const kat = {}; topo.forEach(id => kat[id] ??= 0);
    topo.forEach(id => cik[id].forEach(e => { if (!geri.has(id + ">" + e.h)) kat[e.h] = Math.max(kat[e.h], kat[id] + 1); }));
    // bağlı parçalar
    const ata = {}, bul = x => ata[x] === x ? x : (ata[x] = bul(ata[x])); liste.forEach(d => ata[d.id] = d.id);
    liste.forEach(d => cik[d.id].forEach(e => ata[bul(d.id)] = bul(e.h)));
    const parcalar = Object.values(liste.reduce((m, d) => ((m[bul(d.id)] ||= []).push(d.id), m), {})).sort((a, b) => Math.min(...a.map(i => si[i])) - Math.min(...b.map(i => si[i])));
    const GEN = 300, ARA_X = 110, ARA_Y = 28, yeni = {}; let ustY = 0; const tekler = [];
    parcalar.forEach(p => {
      if (p.length === 1) { tekler.push(p[0]); return; }
      const y = {}, kol = {}; p.forEach(id => (kol[kat[id]] ||= []).push(id)); let altY = ustY;
      Object.keys(kol).map(Number).sort((a, b) => a - b).forEach(k => {
        const istek = id => { const ic = gir[id].filter(g => y[g] != null && !geri.has(g + ">" + id)); if (!ic.length) return null;
          return ic.reduce((t, g) => t + y[g] + port(g, cik[g].find(e => e.h === id).ci) - 18, 0) / ic.length; };
        const ks = kol[k].map(id => ({ id, i: istek(id) })).sort((a, b) => (a.i ?? 1e9) - (b.i ?? 1e9) || si[a.id] - si[b.id]);
        let alt = -Infinity;
        ks.forEach(({ id, i }) => { y[id] = Math.max(i ?? ustY, alt === -Infinity ? ustY : alt + ARA_Y); alt = y[id] + boy(id); altY = Math.max(altY, alt); yeni[id] = { x: k * (GEN + ARA_X), y: Math.round(y[id]) }; });
      });
      ustY = altY + 120;
    });
    tekler.sort((a, b) => si[a] - si[b]).forEach((id, i) => { const s = i % 4; if (s === 0 && i) ustY += Math.max(...tekler.slice(i - 4, i).map(boy)) + 40; yeni[id] = { x: s * (GEN + ARA_X), y: ustY }; });
    liste.forEach(d => { if (yeni[d.id]) d.node_payload = { ...(d.node_payload || {}), position: yeni[d.id] }; });
  };
  const konumUygula = anim => {
    const dn = $("#a-dugumler"); if (anim) { dn.classList.add("kayar"); tuval.classList.add("kayar"); }
    gor().forEach(d => { const n = document.querySelector(`#a-dugumler .dugum[data-id="${d.id}"]`), p = d.node_payload?.position || {}; if (n) { n.style.left = (p.x || 0) + "px"; n.style.top = (p.y || 0) + "px"; } });
    sigdir();
    if (!anim) return okCiz();
    const t0 = performance.now(), kare = () => { okCiz(); if (performance.now() - t0 < 470) requestAnimationFrame(kare); else { dn.classList.remove("kayar"); tuval.classList.remove("kayar"); okCiz(); } };
    requestAnimationFrame(kare);
  };
  const tuvalNokta = e => { const b = alan.getBoundingClientRect(); return { x: (e.clientX - b.left - o.x) / o.k, y: (e.clientY - b.top - o.y) / o.k }; };
  alan.onwheel = e => { if (e.target.closest(".akis-detay")) return; e.preventDefault(); if (e.ctrlKey || e.metaKey) { const b = alan.getBoundingClientRect(); yakinlas(o.k * Math.exp(-e.deltaY / 200), e.clientX - b.left, e.clientY - b.top); } else { o.x -= e.deltaX; o.y -= e.deltaY; uygula(); } };
  alan.onpointerdown = e => {
    if (e.button !== 0 || e.target.closest(".akis-detay,.akis-arac,.akis-zoom")) return;
    const nk = e.target.closest(".nokta"), n = e.target.closest(".dugum");
    if (nk && !A.salt) { e.preventDefault(); surukle = { tur: "bag", id: +n.dataset.id, c: +nk.closest("[data-c]").dataset.c, n, el: nk.closest("[data-c]") }; return; }
    if (n) { surukle = { tur: "dugum", id: +n.dataset.id, n, x: e.clientX, y: e.clientY, px: n.offsetLeft, py: n.offsetTop, oynadi: false }; return; }
    surukle = { tur: "kaydir", x: e.clientX - o.x, y: e.clientY - o.y }; alan.classList.add("tutuldu");
  };
  window.onpointermove = e => {
    if (!surukle || !document.body.contains(alan)) return;
    const s = surukle;
    if (s.tur === "kaydir") { o.x = e.clientX - s.x; o.y = e.clientY - s.y; uygula(); }
    else if (s.tur === "dugum") {
      const dx = (e.clientX - s.x) / o.k, dy = (e.clientY - s.y) / o.k;
      if (A.salt || (!s.oynadi && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 5)) return;
      if (!s.oynadi) { gecmisEkle(); s.oynadi = true; }
      const d = A.harita[s.id], p = { x: Math.round(s.px + dx), y: Math.round(s.py + dy) };
      d.node_payload = { ...(d.node_payload || {}), position: p }; s.n.style.left = p.x + "px"; s.n.style.top = p.y + "px"; okCiz();
    } else if (s.tur === "bag") {
      const m = tuvalNokta(e); $("#a-gecici").setAttribute("d", egri(s.n.offsetLeft + s.n.offsetWidth, s.n.offsetTop + s.el.offsetTop + s.el.offsetHeight / 2, m.x, m.y));
    }
  };
  window.onpointerup = e => {
    const s = surukle; surukle = null; if (!s || !document.body.contains(alan)) return;
    alan.classList.remove("tutuldu");
    if (s.tur === "dugum") { if (!s.oynadi) sec(s.id); else durumYaz(); }
    else if (s.tur === "bag") {
      $("#a-gecici").setAttribute("d", "");
      const h = document.elementFromPoint(e.clientX, e.clientY)?.closest("#a-dugumler .dugum");
      if (h && +h.dataset.id !== s.id) { gecmisEkle(); const d = A.harita[s.id]; yolYaz(d, cikislar(d)[s.c].yol, +h.dataset.id); yenile(); if (A.secili != null) panelCiz(); bildir("Bağlandı."); }
    }
  };
  window.onkeydown = e => {
    if (!document.body.contains(alan) || e.target.closest("input,textarea,select")) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "z") { e.preventDefault(); geriAl(); }
    else if ((e.key === "Delete" || e.key === "Backspace") && A.secili != null && !A.salt) { e.preventDefault(); dugumSil(A.secili); }
  };
  git.engel = () => !(document.body.contains(alan) && A.degisti) || confirm("Akışta kaydedilmemiş değişiklikler var. Çıkılsın mı?");
  window.onbeforeunload = e => { if (document.body.contains(alan) && A.degisti) { e.preventDefault(); return ""; } };

  // ----- düğüm işlemleri -----
  const yeniId = () => Math.max(900000, ...A.dl.map(d => +d.id || 0)) + 1;
  const dugumSil = id => {
    gecmisEkle(); A.dl = A.dl.filter(d => d.id !== id);
    A.dl.forEach(d => cikislar(d).forEach(x => { if (x.hedef === id) yolYaz(d, x.yol, null); }));
    A.secili = null; det.hidden = true; yenile(); bildir("Düğüm silindi (Geri al ile dönebilirsin).");
  };
  const ekle = tur => {
    const m = { x: (alan.clientWidth / 2 - 150 - o.x) / o.k, y: (alan.clientHeight / 2 - 60 - o.y) / o.k };
    const d = { id: yeniId(), type: tur, arguments: TETIK.has(tur) ? null : (VARSAYILAN[tur]?.() ?? {}), node_payload: { position: { x: Math.round(m.x), y: Math.round(m.y) } }, next_action_id: null, linked_published_action_id: null };
    gecmisEkle(); A.dl.push(d); yenile(); sec(d.id);
  };
  $("#a-ekle").onchange = e => { if (e.target.value) ekle(e.target.value); e.target.value = ""; };
  $("#a-geriAl").onclick = geriAl;
  $("#a-toparla").onclick = () => {
    if (!A.salt) gecmisEkle(); toparla(gor()); konumUygula(true); durumYaz();
    bildir(A.salt ? "Görünüm toparlandı; kopya değişmedi." : "Düğümler toparlandı. Beğenmezsen Geri al; kalsın istersen Taslağı kaydet.");
  };
  $("#a-kaydet").onclick = async () => {
    await rpc("b_akis_taslak_kaydet", { p_id: r.id, p_dugumler: A.dl });
    r.taslak = structuredClone(A.dl); r.taslak_guncellendi = new Date().toISOString(); r.taslak_yazan = ben.email; A.degisti = false; durumYaz();
    bildir("Taslak kaydedildi. Yalnız panelde; Vivollo'ya ve bota gitmedi.");
  };
  $("#a-taslakSil").onclick = async () => {
    if (!confirm("Taslak silinsin mi? Akış Vivollo kopyasına döner. (Silinen taslak yedekte saklanır.)")) return;
    await rpc("b_akis_taslak_sil", { p_id: r.id }); A.degisti = false; git.engel = null; bildir("Taslak silindi."); git("akis", r.id);
  };
  $("#a-geri").onclick = () => { git("akis"); };
  document.querySelectorAll("#a-gorunum button").forEach(b => b.onclick = () => {
    A.salt = b.dataset.g === "asil"; document.querySelectorAll("#a-gorunum button").forEach(x => x.classList.toggle("secili", x === b));
    A.secili = null; det.hidden = true; yenile();
    if (A.salt && !A.asilDizildi) { A.asilDizildi = true; toparla(A.asil); konumUygula(false); } // kopya yalnız ekranda dizilir, kaydedilmez
  });

  // ----- ayrıntı / düzenleme paneli -----
  const sec = id => { A.secili = id; document.querySelectorAll("#a-dugumler .dugum").forEach(n => n.classList.toggle("secili", +n.dataset.id === id)); okCiz(); panelCiz(); };
  const Y = y => esc(JSON.stringify(y));
  const inp = (d, y, tur = "metin", ek = "") => { const v = yolAl(d, y); return `<input data-yol="${Y(y)}" data-tur="${tur}" value="${esc(tur === "dk" ? Math.round((v || 0) / 60) : v ?? "")}" ${ek}>`; };
  const yazi = (d, y, satir = 3) => `<textarea data-yol="${Y(y)}" data-tur="metin" rows="${satir}">${esc(yolAl(d, y) ?? "")}</textarea>`;
  const kutu = (d, y, metin) => `<label class="kutu"><input type="checkbox" data-yol="${Y(y)}" data-tur="bool" ${yolAl(d, y) ? "checked" : ""}>${metin}</label>`;
  const secim = (d, y, ops, tur = "metin", ek = "") => { const v = yolAl(d, y); return `<select data-yol="${Y(y)}" data-tur="${tur}" ${ek}>${ops.map(([k, ad]) => `<option value="${esc(k)}" ${String(v ?? "") === String(k) ? "selected" : ""}>${esc(ad)}</option>`).join("")}${v != null && v !== "" && !ops.some(([k]) => String(k) === String(v)) ? `<option selected value="${esc(v)}">${esc(v)}</option>` : ""}</select>`; };
  const silB = (y, i, t = "Sil") => `<button class="sil-b" data-sil="${Y(y)}" data-i="${i}" title="${t}"><i data-lucide="x"></i></button>`;
  const ekleB = (y, sablon, t) => `<button class="ince ekle-b" data-ekle="${Y(y)}" data-sablon="${esc(JSON.stringify(sablon))}"><i data-lucide="plus"></i>${t}</button>`;
  const kv = (d, y, t = "Satır ekle", a1 = "key", a2 = "value", y1 = "Anahtar", y2 = "Değer") => (yolAl(d, y) || []).map((x, i) => `<div class="f-satir">${inp(d, [...y, i, a1], "metin", `placeholder="${y1}"`)}${inp(d, [...y, i, a2], "metin", `placeholder="${y2}"`)}${silB(y, i)}</div>`).join("") + ekleB(y, { [a1]: "", [a2]: "" }, t);
  const formHtml = d => {
    const A_ = ["arguments"], a = d.arguments || {};
    switch (d.type) {
      case "SEND_MESSAGE": return (a.messages || []).map((m, mi) => { const y = [...A_, "messages", mi];
        return `<div class="f-grup"><div class="f-ust"><b>Mesaj ${mi + 1}</b>${secim(d, [...y, "type"], [["TEXT", "Metin"], ["OPTIONS", "Hızlı yanıt seçenekli"]], "metin", 'data-yeniden="1" style="width:auto"')}${silB([...A_, "messages"], mi, "Mesajı sil")}</div>
          ${yazi(d, [...y, "content", "text"], 4)}
          ${m.type === "OPTIONS" ? `<div class="f-alt">Seçenekler</div>${(m.content?.options || []).map((s, si) => `<div class="f-satir">${inp(d, [...y, "content", "options", si, "text"], "metin", 'placeholder="Düğme metni"')}${silB([...y, "content", "options"], si)}</div>`).join("")}${ekleB([...y, "content", "options"], { text: "", next_action_id: null }, "Seçenek ekle")}` : ""}</div>`; }).join("")
        + ekleB([...A_, "messages"], { type: "TEXT", content: { text: "" }, pagination: null, is_internal: false }, "Mesaj ekle") + kutu(d, [...A_, "should_halt"], "Müşteri yanıtını bekle");
      case "CONDITIONAL": return '<p class="soluk kucuk">Koşullar yukarıdan aşağı denenir; ilk sağlanan dala gider, hiçbiri sağlanmazsa "Değilse".</p>' + (a.conditions || []).map((k, ki) => { const y = [...A_, "conditions", ki];
        return `<div class="f-grup"><div class="f-ust"><b>Koşul ${ki + 1}</b>${secim(d, [...y, "match_any"], [["true", "Herhangi biri yeter"], ["false", "Hepsi gerekli"]], "boolsec", 'style="width:auto"')}${silB([...A_, "conditions"], ki, "Koşulu sil")}</div>
          ${(k.criteria || []).map((c, ci) => `<div class="f-satir uc">${inp(d, [...y, "criteria", ci, "variable"], "metin", 'list="a-degiskenler" placeholder="Değişken"')}${secim(d, [...y, "criteria", ci, "operator"], Object.entries(OPER))}${inp(d, [...y, "criteria", ci, "value"], "metin", 'placeholder="Değer"')}${silB([...y, "criteria"], ci)}</div>`).join("")}
          ${ekleB([...y, "criteria"], { variable: "", operator: "CONTAINS", value: "" }, "Ölçüt ekle")}</div>`; }).join("")
        + ekleB([...A_, "conditions"], { criteria: [{ variable: "", operator: "CONTAINS", value: "" }], match_any: true, next_action_id: null }, "Koşul ekle");
      case "API_CALL": return `<div class="f-satir">${secim(d, [...A_, "request", "method"], ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map(x => [x, x]), "metin", 'style="width:96px;flex:none"')}${inp(d, [...A_, "request", "url"], "metin", 'placeholder="https://…"')}</div>
        <div class="f-alt">Başlıklar</div>${kv(d, [...A_, "request", "headers"], "Başlık ekle")}<div class="f-alt">Gövde (JSON alanları)</div>${kv(d, [...A_, "request", "body"], "Alan ekle")}
        <div class="f-alt">Yanıttan değişkene</div>${kv(d, [...A_, "response_mapping"], "Eşleme ekle", "key", "value", "Değişken", "Yanıttaki yol")}
        <p class="soluk kucuk">"***" görünen değerler gizli anahtarlar; kopyada maskelendi. Yanıt cx.last_api_response'a düşer.</p>`;
      case "UPDATE_CONVERSATION": return `<label>Durum${secim(d, [...A_, "status"], [["", "Değiştirme"], ["NEW", "Yeni"], ["OPEN", "Açık"], ["PENDING", "Bekliyor"], ["ON_HOLD", "Beklemeye alındı"], ["RESOLVED", "Çözüldü"]], "bosnull")}</label>
        <div class="f-alt">Özel alanlar</div>${kv(d, [...A_, "metafields"], "Alan ekle", "key", "value", "cs.alan", "Değer")}`;
      case "IDLE": return `<label>Kaç dakika sessiz kalırsa (1-10)${inp(d, [...A_, "idle_time"], "dk", 'type="number" min="1" max="10"')}</label>
        ${kutu(d, [...A_, "for_one_time"], "Bir kez çalıştır")}${kutu(d, [...A_, "reset_on_interaction"], "Müşteri yanıt verince yeniden etkinleştir")}${kutu(d, [...A_, "ignore_skip_flow"], "Temsilci devraldıysa da çalıştır")}`;
      case "REDIRECT_TO_FLOW": return `<label>Akış numarası (Vivollo)${inp(d, [...A_, "flow_id"], "sayi", 'type="number"')}</label><p class="soluk kucuk">Yönlendirdikten sonra bu akışa geri dönülmez.</p>`;
      case "SEARCH_DOCUMENTS": case "REPLY_FROM_DOCUMENTS": return `<label>Sorgu${yazi(d, [...A_, "query"], 2)}</label><div class="f-satir"><label>Sonuç sayısı${inp(d, [...A_, "result_limit"], "sayi", 'type="number" min="1"')}</label><label>Koleksiyon${inp(d, [...A_, "collection_group_id"])}</label></div>`;
      case "AGENTIC_AI": return `<label>Asistan numarası${inp(d, [...A_, "assistant_id"], "sayi", 'type="number"')}</label><div class="f-alt">Araç dalları (asistan bu aracı çağırınca hangi düğüme gidilir)</div>
        ${(a.tool_actions || []).map((t, i) => `<div class="f-satir">${inp(d, [...A_, "tool_actions", i, "name"], "metin", 'placeholder="araç adı"')}${silB([...A_, "tool_actions"], i)}</div>`).join("")}${ekleB([...A_, "tool_actions"], { name: "", next_action_id: null }, "Araç dalı ekle")}`;
      default: return TETIK.has(d.type) ? '<p class="soluk kucuk">Bu tetikleyicinin ayarı yok; yalnız nereye gideceğini seç.</p>' : '<p class="soluk kucuk">Bu düğümün ayarları için aşağıdaki "Gelişmiş (JSON)" alanını kullan.</p>';
    }
  };
  const panelCiz = () => {
    const d = A.harita[A.secili]; if (!d) { det.hidden = true; return; }
    const t = DUGUM[d.type] || [d.type, "box"], gelen = [...new Set(gor().filter(x => cikislar(x).some(c => c.hedef === d.id)).map(x => x.id))];
    const git2 = x => `<button class="baglanti" data-git="${x}">${esc(kisaAd(A.harita[x]))}</button>`;
    const hedefler = gor().filter(x => x.id !== d.id && !TETIK.has(x.type) && x.type !== "IDLE");
    det.hidden = false; const kay = det.scrollTop;
    det.innerHTML = `<div class="d-ust"><i data-lucide="${t[1]}"></i><h2>${esc(t[0])} <span class="soluk">#${d.id}</span></h2>
        ${A.salt ? "" : '<button class="ince" data-is="cogalt" title="Çoğalt"><i data-lucide="copy"></i></button><button class="ince" data-is="sil" title="Sil (Delete)"><i data-lucide="trash-2"></i></button>'}
        <button class="ince" data-is="kapat" title="Kapat"><i data-lucide="x"></i></button></div>
      <div class="d-bolum"><div class="d-baslik">Nereden gelir</div>${gelen.map(git2).join("") || '<span class="soluk kucuk">Hiçbir düğüm buraya bağlanmıyor (tetikleyici ya da kopuk).</span>'}</div>
      <div class="d-bolum"><div class="d-baslik">Nereye gider</div>${cikislar(d).map(x => A.salt
        ? `<div class="kucuk">${x.etiket ? (x.html ? x.etiket : esc(x.etiket)) + " → " : ""}${x.hedef ? git2(x.hedef) : '<span class="soluk">bağlı değil (burada durur)</span>'}</div>`
        : `<div class="f-bag"><span class="kucuk">${x.etiket ? (x.html ? x.etiket : esc(x.etiket)) : "Sonraki adım"}</span><select data-yol="${Y(x.yol)}" data-tur="hedef">
            <option value="">— bağlı değil (burada durur) —</option>${hedefler.map(h => `<option value="${h.id}" ${h.id === x.hedef ? "selected" : ""}>${esc(kisaAd(h))}</option>`).join("")}</select>
            ${x.hedef ? `<button class="ince" data-git="${x.hedef}" title="Git"><i data-lucide="arrow-right"></i></button>` : ""}</div>`).join("") || '<span class="soluk kucuk">Burada biter.</span>'}
        ${A.salt ? "" : '<p class="soluk kucuk">İpucu: kutudaki küçük noktayı sürükleyip başka bir kutuya bırakarak da bağlayabilirsin.</p>'}</div>
      <div class="d-bolum"><div class="d-baslik">Ayarlar</div>${A.salt ? `<div class="alanlar">${alanAgaci(d.arguments)}</div>` : `<div class="f">${formHtml(d)}</div>`}</div>
      <details class="d-bolum"><summary class="d-baslik">Gelişmiş (JSON)</summary>${A.salt ? `<pre>${esc(JSON.stringify(d, null, 1))}</pre>`
        : `<textarea id="a-json" rows="12" class="kod">${esc(JSON.stringify(d.arguments, null, 1))}</textarea><button class="ikincil" data-is="json" style="margin-top:8px">JSON'u uygula</button>`}</details>`;
    det.scrollTop = kay; ikon();
  };
  const deger = el => { const t = el.dataset.tur, v = el.value;
    return t === "bool" ? el.checked : t === "boolsec" ? v === "true" : t === "sayi" ? (v === "" ? null : +v) : t === "dk" ? Math.max(1, Math.min(10, +v || 1)) * 60 : t === "hedef" ? (v ? +v : null) : t === "bosnull" ? (v || null) : v; };
  det.oninput = e => {
    const el = e.target; if (!el.dataset.yol || A.salt) return;
    if (A.sonAlan !== el) { gecmisEkle(); A.sonAlan = el; }
    yolYaz(A.harita[A.secili], JSON.parse(el.dataset.yol), deger(el));
    if (el.dataset.tur === "hedef") { A.sonAlan = null; yenile(); panelCiz(); } else { dugumYenile(A.secili); if (el.dataset.yeniden) { A.sonAlan = null; panelCiz(); } }
  };
  det.addEventListener("focusout", () => A.sonAlan = null);
  det.onclick = e => {
    const b = e.target.closest("button"); if (!b) return; const d = A.harita[A.secili];
    if (b.dataset.git) { odakla(+b.dataset.git); return; }
    if (b.dataset.is === "kapat") { A.secili = null; det.hidden = true; document.querySelectorAll("#a-dugumler .dugum.secili").forEach(n => n.classList.remove("secili")); okCiz(); return; }
    if (A.salt) return;
    if (b.dataset.ekle) { gecmisEkle(); const y = JSON.parse(b.dataset.ekle); if (!Array.isArray(yolAl(d, y))) yolYaz(d, y, []); yolAl(d, y).push(JSON.parse(b.dataset.sablon)); dugumYenile(d.id); okCiz(); panelCiz(); }
    else if (b.dataset.sil) { gecmisEkle(); yolAl(d, JSON.parse(b.dataset.sil)).splice(+b.dataset.i, 1); yenile(); panelCiz(); }
    else if (b.dataset.is === "sil") dugumSil(d.id);
    else if (b.dataset.is === "cogalt") { const k = structuredClone(d), p = d.node_payload?.position || {}; k.id = yeniId(); k.node_payload = { ...(k.node_payload || {}), position: { x: (p.x || 0) + 40, y: (p.y || 0) + 60 } }; gecmisEkle(); A.dl.push(k); yenile(); sec(k.id); }
    else if (b.dataset.is === "json") { let v; try { v = JSON.parse($("#a-json").value); } catch (err) { return bildir("JSON hatalı: " + err.message); } gecmisEkle(); d.arguments = v; yenile(); panelCiz(); bildir("Uygulandı."); }
  };
  const odakla = id => { const n = document.querySelector(`#a-dugumler .dugum[data-id="${id}"]`); if (!n) return; if (o.k < 0.6) o.k = 0.8;
    o.x = alan.clientWidth / 2 - 190 - (n.offsetLeft + n.offsetWidth / 2) * o.k; o.y = alan.clientHeight / 2 - (n.offsetTop + 40) * o.k; uygula(); sec(id); };
  const araUygula = () => { const q = $("#a-ara").value.trim().toLocaleLowerCase("tr");
    document.querySelectorAll("#a-dugumler .dugum").forEach(n => n.classList.toggle("soluk-dugum", !!q && !(("#" + n.dataset.id + " " + JSON.stringify(A.harita[n.dataset.id]) + " " + n.textContent).toLocaleLowerCase("tr").includes(q)))); };
  $("#a-ara").oninput = araUygula;
  $("#a-ara").onkeydown = e => { if (e.key === "Enter") { const q = e.target.value.trim().replace(/^#/, ""); const n = document.querySelector(`#a-dugumler .dugum[data-id="${CSS.escape(q)}"]`) || document.querySelector("#a-dugumler .dugum:not(.soluk-dugum)"); if (n && q) odakla(+n.dataset.id); } };
  $("#a-buyut").onclick = () => yakinlas(o.k * 1.25); $("#a-kucult").onclick = () => yakinlas(o.k / 1.25); $("#a-sigdir").onclick = sigdir; $("#a-oran").onclick = () => yakinlas(1);

  yenile();
  // kayıtlı taslak yoksa Vivollo konumları bizim kutu boyumuza uymuyor (üst üste biniyor): açılışta düzenli diz, değişiklik sayma
  if (!r.taslak) { toparla(A.dl); konumUygula(false); }
  // açılışta okunur ölçekte ilk tetikleyiciye odaklan; bütün akış için "Sığdır"
  const ilk = gor().find(d => d.type === "START") || gor().find(d => TETIK.has(d.type)) || gor()[0];
  const n0 = ilk && document.querySelector(`#a-dugumler .dugum[data-id="${ilk.id}"]`);
  if (n0) { o.k = 0.8; o.x = 40 - n0.offsetLeft * o.k; o.y = UST + 70 - n0.offsetTop * o.k; } uygula();
}

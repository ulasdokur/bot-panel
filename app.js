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
  sekme = s; git.son = id;
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

// ---------- akış (salt görüntüleme) ----------
// Vivollo akışlarının kopyası (b_akis). Yalnız gösterir; Vivollo'ya ya da canlı bota hiçbir şey yazmaz.
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
function cikislar(d) {
  const a = d.arguments || {}, o = [];
  if (d.next_action_id) o.push({ etiket: "", hedef: d.next_action_id });
  (a.conditions || []).forEach((k, i) => o.push({ etiket: `${i + 1}. ${(k.criteria || []).map(olcut).join(k.match_any ? " ya da " : " ve ")}`, hedef: k.next_action_id, html: true }));
  if (d.type === "CONDITIONAL") o.push({ etiket: "Değilse", hedef: a.next_action_id });
  else if (a.next_action_id) o.push({ etiket: d.type === "API_CALL" ? "Başarılı" : "", hedef: a.next_action_id });
  (a.messages || []).forEach(m => (m.content?.options || []).forEach(s => o.push({ etiket: s.text, hedef: s.next_action_id })));
  (a.tool_actions || []).forEach(t => o.push({ etiket: t.name, hedef: t.next_action_id, arac: true }));
  if (a.on_failed) o.push({ etiket: "Hata olursa", hedef: a.on_failed.next_action_id, hata: true });
  return o;
}
function ozet(d) {
  const a = d.arguments || {};
  switch (d.type) {
    case "SEND_MESSAGE": return (a.messages || []).map(m => esc(kisalt(m.content?.text, 140))).join("<hr>") + (a.should_halt ? '<div class="soluk">Yanıt bekler</div>' : "");
    case "API_CALL": { const u = a.request?.url || ""; return `<b>${esc(a.request?.method)}</b> ${esc(kisalt(u.replace(/^https?:\/\/[^/]+/, ""), 60))}<div class="soluk">${esc((u.match(/^https?:\/\/([^/]+)/) || [])[1] || "")}</div>`; }
    case "UPDATE_CONVERSATION": return (a.status ? `Durum: <b>${esc(GDURUM[a.status] || a.status)}</b>` : "") + (a.metafields || []).map(m => `<div>${esc(m.key)} = ${esc(kisalt(m.value, 40))}</div>`).join("");
    case "IDLE": return `${Math.round((a.idle_time || 0) / 60)} dk sessizlik${a.for_one_time ? " · bir kez" : ""}`;
    case "REDIRECT_TO_FLOW": return `Akış #${esc(a.flow_id)}`;
    case "SEARCH_DOCUMENTS": case "REPLY_FROM_DOCUMENTS": return `Sorgu: ${esc(kisalt(a.query, 70))}`;
    case "AGENTIC_AI": return `Asistan #${esc(a.assistant_id)} · ${(a.tool_actions || []).length} araç dalı`;
    case "START": return "Yeni görüşme açılınca";
    case "FALLBACK": return "Müşteri mesaj yazınca";
    default: return "";
  }
}
function alanAgaci(v, derin = 0) {
  if (v === null || v === undefined || v === "") return '<span class="soluk">—</span>';
  if (typeof v === "boolean") return v ? "Evet" : "Hayır";
  if (typeof v !== "object") return `<span class="deger">${esc(v)}</span>`;
  if (Array.isArray(v)) return v.length ? `<ol>${v.map(x => `<li>${alanAgaci(x, derin + 1)}</li>`).join("")}</ol>` : '<span class="soluk">boş</span>';
  return `<dl>${Object.entries(v).map(([k, x]) => `<dt>${esc(ALAN[k] || k)}</dt><dd>${k === "operator" ? esc(OPER[x] || x) : k === "status" ? esc(GDURUM[x] || x) : alanAgaci(x, derin + 1)}</dd>`).join("")}</dl>`;
}

async function akislar() {
  const { data, error } = await sb.from("b_akis").select("id,ad,kaynak,vivollo_id,aciklama,guncellendi,dugumler").order("id");
  if (error) throw error;
  $("#icerik").innerHTML = `<div class="baslik"><h1>Akışlar</h1></div>
    <p class="alt-metin">Vivollo'daki akışların kopyası. Yalnız görüntüleme: burada hiçbir şey canlıya gitmez.</p>
    <div class="kart"><table><tr><th>Ad</th><th>Kaynak</th><th>Düğüm</th><th>Güncellendi</th></tr>
    ${(data || []).map(r => `<tr class="tik" data-id="${r.id}"><td><b>${esc(r.ad)}</b>${r.aciklama ? `<div class="kisa">${esc(r.aciklama)}</div>` : ""}</td>
      <td>${esc(r.kaynak)}${r.vivollo_id ? ` #${r.vivollo_id}` : ""}</td><td>${(r.dugumler || []).length}</td><td class="soluk">${tarih(r.guncellendi)}</td></tr>`).join("") || '<tr><td colspan="4" class="bos">Akış yok.</td></tr>'}</table></div>`;
  document.querySelectorAll("tr.tik").forEach(t => t.onclick = () => git("akis", t.dataset.id));
}

async function akisGoster(id) {
  const { data: r, error } = await sb.from("b_akis").select("*").eq("id", id).maybeSingle();
  if (error) throw error; if (!r) throw new Error("Akış bulunamadı");
  const dl = r.dugumler || [], harita = Object.fromEntries(dl.map(d => [d.id, d]));
  const xs = dl.map(d => d.node_payload?.position?.x || 0), ys = dl.map(d => d.node_payload?.position?.y || 0);
  const ox = 40 - Math.min(...xs), oy = 40 - Math.min(...ys), W = Math.max(...xs) + ox + 420, H = Math.max(...ys) + oy + 600;
  $("#icerik").innerHTML = `<div class="baslik"><button class="ikincil" id="a-geri"><i data-lucide="arrow-left"></i>Akışlar</button><h1>${esc(r.ad)}</h1>
      <span class="etiket">${dl.length} düğüm</span><span class="etiket sari">Salt görüntüleme</span>
      <div class="sag"><input id="a-ara" placeholder="Düğümde ara (metin, araç, #id)" style="width:240px">
      <button class="ikincil" id="a-kucult" title="Uzaklaş"><i data-lucide="zoom-out"></i></button><button class="ikincil" id="a-buyut" title="Yakınlaş"><i data-lucide="zoom-in"></i></button>
      <button class="ikincil" id="a-sigdir"><i data-lucide="maximize"></i>Sığdır</button></div></div>
    <div class="akis-alan" id="a-alan"><div class="akis-tuval" id="a-tuval" style="width:${W}px;height:${H}px"><svg class="akis-ok" id="a-svg" width="${W}" height="${H}">
      <defs><marker id="uc" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#a1a1aa"/></marker>
      <marker id="uc2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#8b4cfc"/></marker></defs></svg>
    ${dl.map(d => { const t = DUGUM[d.type] || [d.type, "box", "veri"], p = d.node_payload?.position || {}, c = cikislar(d).filter(x => x.etiket);
      return `<div class="dugum ${t[2]}" data-id="${d.id}" style="left:${(p.x || 0) + ox}px;top:${(p.y || 0) + oy}px">
        <div class="d-bas"><i data-lucide="${t[1]}"></i><b>${esc(t[0])}</b><span class="soluk">#${d.id}</span></div>
        ${ozet(d) ? `<div class="d-govde">${ozet(d)}</div>` : ""}
        ${c.length ? `<div class="d-cikis">${c.map(x => `<div class="cikis${x.hata ? " hata-dal" : ""}${x.arac ? " arac" : ""}${x.hedef ? "" : " bos-dal"}" data-hedef="${x.hedef || ""}">${x.html ? x.etiket : esc(kisalt(x.etiket, 60))}</div>`).join("")}</div>` : ""}
      </div>`; }).join("")}</div>
    <aside class="akis-detay" id="a-detay" hidden></aside></div>`;
  $("#a-geri").onclick = () => git("akis");
  ikon();
  // oklar: düğüm konumları ölçeğe bağlı değil (offset), bir kez çizilir
  const svg = $("#a-svg"), ns = "http://www.w3.org/2000/svg", oklar = [];
  document.querySelectorAll(".dugum").forEach(n => {
    const kaynak = +n.dataset.id, x0 = n.offsetLeft, y0 = n.offsetTop, d = harita[kaynak];
    const ciz = (hedef, cy, sinif) => {
      const h = document.querySelector(`.dugum[data-id="${hedef}"]`); if (!h) return;
      const sx = x0 + n.offsetWidth, sy = y0 + cy, tx = h.offsetLeft, ty = h.offsetTop + 18, dx = Math.max(50, Math.abs(tx - sx) / 2);
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", `M${sx} ${sy}C${sx + dx} ${sy},${tx - dx} ${ty},${tx} ${ty}`); p.setAttribute("class", sinif || ""); p.setAttribute("marker-end", "url(#uc)");
      svg.appendChild(p); oklar.push({ p, kaynak, hedef: +hedef });
    };
    const ana = cikislar(d).filter(x => !x.etiket && x.hedef);
    ana.forEach(x => ciz(x.hedef, 18));
    n.querySelectorAll(".cikis[data-hedef]").forEach(c => c.dataset.hedef && ciz(c.dataset.hedef, c.offsetTop + c.offsetHeight / 2, c.classList.contains("hata-dal") ? "hata-ok" : ""));
  });
  // kaydır / yakınlaştır
  const alan = $("#a-alan"), tuval = $("#a-tuval"); let o = { x: 0, y: 0, k: 1 };
  const uygula = () => tuval.style.transform = `translate(${o.x}px,${o.y}px) scale(${o.k})`;
  const yakinlas = (k, cx = alan.clientWidth / 2, cy = alan.clientHeight / 2) => { k = Math.min(1.6, Math.max(0.15, k)); o.x = cx - (cx - o.x) * k / o.k; o.y = cy - (cy - o.y) * k / o.k; o.k = k; uygula(); };
  const sigdir = () => { o.k = Math.min(1, (alan.clientWidth - 20) / W, (alan.clientHeight - 20) / H); o.x = (alan.clientWidth - W * o.k) / 2; o.y = 10; uygula(); };
  alan.onwheel = e => { e.preventDefault(); if (e.ctrlKey || e.metaKey) { const b = alan.getBoundingClientRect(); yakinlas(o.k * Math.exp(-e.deltaY / 200), e.clientX - b.left, e.clientY - b.top); } else { o.x -= e.deltaX; o.y -= e.deltaY; uygula(); } };
  let surukle = null;
  alan.onpointerdown = e => { if (e.target.closest(".dugum,.akis-detay")) return; surukle = { x: e.clientX - o.x, y: e.clientY - o.y }; alan.classList.add("tutuldu"); };
  window.onpointermove = e => { if (!surukle || !document.body.contains(alan)) return; o.x = e.clientX - surukle.x; o.y = e.clientY - surukle.y; uygula(); };
  window.onpointerup = () => { surukle = null; alan.classList.remove("tutuldu"); };
  $("#a-buyut").onclick = () => yakinlas(o.k * 1.25); $("#a-kucult").onclick = () => yakinlas(o.k / 1.25); $("#a-sigdir").onclick = sigdir;
  // açılışta okunur ölçekte ilk tetikleyiciye odaklan; bütün akış için "Sığdır"
  const ilk = dl.find(d => d.type === "START") || dl.find(d => DUGUM[d.type]?.[2] === "tetik") || dl[0];
  { const n = document.querySelector(`.dugum[data-id="${ilk.id}"]`); o.k = 0.8; o.x = 30 - n.offsetLeft * o.k; o.y = alan.clientHeight / 3 - n.offsetTop * o.k; uygula(); }
  // seçim + ayrıntı paneli
  const sec = id => {
    document.querySelectorAll(".dugum").forEach(n => n.classList.toggle("secili", +n.dataset.id === id));
    oklar.forEach(a => { const v = a.kaynak === id || a.hedef === id; a.p.classList.toggle("vurgu", v); a.p.setAttribute("marker-end", v ? "url(#uc2)" : "url(#uc)"); });
    const d = harita[id], t = DUGUM[d.type] || [d.type, "box"], gelen = oklar.filter(a => a.hedef === id).map(a => a.kaynak);
    const git2 = x => `<button class="baglanti" data-git="${x}">#${x} ${esc((DUGUM[harita[x]?.type] || [harita[x]?.type])[0])}</button>`;
    const det = $("#a-detay"); det.hidden = false;
    det.innerHTML = `<div class="d-ust"><i data-lucide="${t[1]}"></i><h2>${esc(t[0])} <span class="soluk">#${d.id}</span></h2><button id="a-kapat" title="Kapat"><i data-lucide="x"></i></button></div>
      <div class="d-bolum"><div class="d-baslik">Nereden gelir</div>${[...new Set(gelen)].map(git2).join("") || '<span class="soluk kucuk">Hiçbir düğüm buraya bağlanmıyor (tetikleyici ya da kopuk).</span>'}</div>
      <div class="d-bolum"><div class="d-baslik">Nereye gider</div>${cikislar(d).map(x => `<div class="kucuk">${x.etiket ? (x.html ? x.etiket : esc(x.etiket)) + " → " : ""}${x.hedef ? git2(x.hedef) : '<span class="soluk">bağlı değil (burada durur)</span>'}</div>`).join("") || '<span class="soluk kucuk">Burada biter.</span>'}</div>
      <div class="d-bolum"><div class="d-baslik">Ayarlar</div><div class="alanlar">${alanAgaci(d.arguments)}</div></div>
      <details class="d-bolum"><summary class="d-baslik">Ham JSON</summary><pre>${esc(JSON.stringify(d, null, 1))}</pre></details>`;
    det.querySelectorAll("[data-git]").forEach(b => b.onclick = () => odakla(+b.dataset.git));
    $("#a-kapat").onclick = () => { det.hidden = true; document.querySelectorAll(".dugum.secili").forEach(n => n.classList.remove("secili")); oklar.forEach(a => { a.p.classList.remove("vurgu"); a.p.setAttribute("marker-end", "url(#uc)"); }); };
    ikon();
  };
  const odakla = id => { const n = document.querySelector(`.dugum[data-id="${id}"]`); if (!n) return; if (o.k < 0.6) o.k = 0.8;
    o.x = alan.clientWidth / 2 - 180 - (n.offsetLeft + n.offsetWidth / 2) * o.k; o.y = alan.clientHeight / 2 - (n.offsetTop + 40) * o.k; uygula(); sec(id); };
  document.querySelectorAll(".dugum").forEach(n => n.onclick = () => sec(+n.dataset.id));
  $("#a-ara").oninput = e => { const q = e.target.value.trim().toLocaleLowerCase("tr");
    document.querySelectorAll(".dugum").forEach(n => n.classList.toggle("soluk-dugum", !!q && !(("#" + n.dataset.id + " " + JSON.stringify(harita[n.dataset.id]) + " " + n.textContent).toLocaleLowerCase("tr").includes(q)))); };
  $("#a-ara").onkeydown = e => { if (e.key === "Enter") { const q = e.target.value.trim().replace(/^#/, ""); const n = document.querySelector(`.dugum[data-id="${CSS.escape(q)}"]`) || document.querySelector(".dugum:not(.soluk-dugum)"); if (n && e.target.value.trim()) odakla(+n.dataset.id); } };
}

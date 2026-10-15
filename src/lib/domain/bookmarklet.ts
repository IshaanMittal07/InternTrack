/**
 * The "Save to tracker" bookmark. Clicked on a job page, it reads the role
 * and company from the page's JobPosting data (which works even on pages that
 * need a sign-in, unlike reading the link from the server) and opens this
 * app's /save page with them. Plain ES5 so it runs on any site.
 */
const SOURCE = `(function () {
  var d = document, company = "", role = "";
  function find(v) {
    if (!v || typeof v !== "object") return null;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) { var a = find(v[i]); if (a) return a; }
      return null;
    }
    if ([].concat(v["@type"]).indexOf("JobPosting") >= 0) return v;
    for (var k in v) { var b = find(v[k]); if (b) return b; }
    return null;
  }
  var scripts = d.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < scripts.length; i++) {
    try {
      var job = find(JSON.parse(scripts[i].textContent));
      if (!job) continue;
      var org = job.hiringOrganization;
      company = typeof org === "string" ? org : org && typeof org.name === "string" ? org.name : "";
      role = typeof job.title === "string" ? job.title : "";
      break;
    } catch (e) {}
  }
  var u = new URL("/save", __ORIGIN__);
  u.searchParams.set("url", location.href);
  if (company) u.searchParams.set("company", company.slice(0, 300));
  if (role) u.searchParams.set("role", role.slice(0, 300));
  u.searchParams.set("title", d.title.slice(0, 300));
  if (!window.open(u.href, "_blank")) location.href = u.href;
})();`;

/**
 * The "Add LinkedIn contact" bookmark. Clicked on a LinkedIn profile, it reads
 * the name, headline and current company from the page (the user is signed in
 * there; LinkedIn blocks reading profiles from a server) and opens
 * /save/contact, which adds the person to a posting that is already saved.
 * Only raw text is sent; the app cleans it up.
 */
const CONTACT_SOURCE = `(function () {
  var d = document;
  function text(sel) {
    var el = d.querySelector(sel);
    return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "";
  }
  var h1 = d.querySelector("main h1") || d.querySelector("h1");
  var name = h1 ? (h1.textContent || "").replace(/\\s+/g, " ").trim() : "";
  var headline = text("main .text-body-medium");
  var btn = d.querySelector('[aria-label^="Current company"]');
  var company = btn ? btn.getAttribute("aria-label") || "" : "";
  var u = new URL("/save/contact", __ORIGIN__);
  u.searchParams.set("url", location.href);
  if (name) u.searchParams.set("name", name.slice(0, 300));
  if (headline) u.searchParams.set("headline", headline.slice(0, 300));
  if (company) u.searchParams.set("company", company.slice(0, 300));
  u.searchParams.set("title", d.title.slice(0, 300));
  if (!window.open(u.href, "_blank")) location.href = u.href;
})();`;

function toHref(source: string, origin: string): string {
  const code = source.replace("__ORIGIN__", JSON.stringify(origin)).replace(/\s*\n\s*/g, " ");
  return `javascript:${encodeURIComponent(code)}`;
}

/** The bookmark's address, for the app running at `origin`. */
export function bookmarkletHref(origin: string): string {
  return toHref(SOURCE, origin);
}

/** The "Add LinkedIn contact" bookmark's address, for the app running at `origin`. */
export function contactBookmarkletHref(origin: string): string {
  return toHref(CONTACT_SOURCE, origin);
}

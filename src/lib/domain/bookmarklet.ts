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

/** The bookmark's address, for the app running at `origin`. */
export function bookmarkletHref(origin: string): string {
  const code = SOURCE.replace("__ORIGIN__", JSON.stringify(origin)).replace(/\s*\n\s*/g, " ");
  return `javascript:${encodeURIComponent(code)}`;
}

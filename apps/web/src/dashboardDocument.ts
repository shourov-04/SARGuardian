export type DashboardView = 'public' | 'evidence' | 'science';

const dashboardViews = new Set<DashboardView>(['public', 'evidence', 'science']);

export function parseDashboardView(value: string | null | undefined): DashboardView {
  return dashboardViews.has(value as DashboardView) ? value as DashboardView : 'public';
}

export function buildDashboardRouteUrl(origin: string, jobId: string, view: DashboardView): string {
  const url = new URL('/dashboard', origin);
  url.searchParams.set('jobId', jobId);
  url.searchParams.set('view', view);
  return url.toString();
}

const howItWorksShellStyle = `<style id="sarguardian-how-it-works-shell">
.claude-home{position:relative;isolation:isolate;min-height:100vh;overflow-x:hidden;overflow-y:auto;color:#f7fbff;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,"Segoe UI",system-ui,sans-serif}
.claude-background{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:linear-gradient(180deg,rgba(5,18,28,.04),rgba(4,18,28,.34)),url('/scenery/alpine-lake.jpg') center 46% / cover fixed no-repeat}
.claude-background::after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 27%,transparent 0 23%,rgba(1,11,17,.18) 72%)}
.claude-background i{display:none}
.claude-nav-shell{position:sticky;top:10px;z-index:50;width:min(980px,calc(100% - 24px));margin:10px auto 0;border:1px solid rgba(255,255,255,.82);border-radius:999px;background:rgba(238,248,251,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.74),0 14px 40px -18px rgba(0,8,18,.7);backdrop-filter:blur(28px) saturate(190%);-webkit-backdrop-filter:blur(28px) saturate(190%)}
.claude-nav-inner{position:relative;height:58px;padding:0 10px 0 16px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.claude-brand{display:flex;width:auto;height:46px;align-items:center;gap:8px;text-decoration:none}
.claude-brand-mark{position:relative;display:block;width:42px;height:42px;overflow:hidden;border-radius:50%}
.brand-logo-image.claude-brand-logo{position:absolute;top:0;left:-9px;width:60px;height:60px;border-radius:0;object-fit:cover;object-position:center top;background:transparent;box-shadow:none;filter:drop-shadow(0 1px 1px rgba(255,255,255,.55)) drop-shadow(0 4px 10px rgba(2,13,22,.15))}
.claude-brand-word{color:#061c2d;font-size:17px;font-weight:500;letter-spacing:-.035em;text-shadow:0 1px 0 rgba(255,255,255,.58)}.claude-brand-word b{font-weight:760}
.claude-nav-links{display:flex;align-items:center;gap:7px}.archive-home-link{display:inline-flex;min-height:34px;padding:0 18px;align-items:center;border:0;border-radius:999px;color:#fff;background:#0071e3;font-size:13px;font-weight:700;text-decoration:none;box-shadow:0 8px 18px rgba(0,80,180,.25)}
.site-header{display:block;border:0;padding:0;margin-bottom:18px}.site-header .hero-copy,.site-header .header-actions{display:none!important}
</style>`;

const howItWorksHeader = '<div class="claude-nav-shell is-archive"><div class="claude-nav-inner"><a class="claude-brand" href="/" aria-label="SARGuardian home"><span class="claude-brand-mark"><img class="brand-logo-image claude-brand-logo" src="/sarguardian-logo.png" alt="SARGuardian" decoding="async"></span><span class="claude-brand-word"><b>SAR</b>Guardian</span></a><nav class="claude-nav-links" aria-label="Main navigation"><a class="archive-home-link" href="/">Home</a></nav></div></div>';

function applyHowItWorksShell(html: string): string {
  let result = html;
  result = result.replace(/<body\b([^>]*)>/i, (_match, attributes: string) => `<body${attributes} class="claude-home">`);
  result = result.replace(/<\/head>/i, `${howItWorksShellStyle}</head>`);
  result = result.replace(/(<body\b[^>]*>)/i, `$1<div class="claude-background" aria-hidden="true"><i></i><i></i><i></i></div>`);
  result = result.replace(/<div class="brand-rail">[\s\S]*?<\/div>/i, howItWorksHeader);
  if (!result.includes('claude-nav-shell')) {
    result = result.replace(/<header class="site-header">/i, `<header class="site-header">${howItWorksHeader}`);
  }
  return result;
}

/**
 * Keep the dashboard on a first-party, refreshable URL while preserving
 * relative asset resolution and the Google Maps website-key referrer.
 */
export function withDashboardPreferredView(html: string, view: DashboardView, origin: string): string {
  const safeOrigin = new URL(origin).origin;
  const headPattern = /<head\b[^>]*>/i;
  const headMatch = html.match(headPattern);
  if (!headMatch) throw new Error('The saved dashboard document has no HTML head section.');

  const withoutExistingBase = html.replace(/<base\b[^>]*>/gi, '');
  const withBrowserContext = withoutExistingBase.replace(
    headPattern,
    headMatch[0] + '<base href="' + safeOrigin + '/"><meta name="referrer" content="origin">',
  );
  const script = [
    '<script id="sarguardian-preferred-dashboard-view">',
    '(function () {',
    '  var preferredView = ' + JSON.stringify(view) + ';',
    '  function selectPreferredView() {',
    '    var button = document.querySelector("[data-sg-mode=\'" + preferredView + "\']");',
    '    if (!button) return false;',
    '    if (button.getAttribute("aria-selected") !== "true") button.click();',
    '    return true;',
    '  }',
    '  function start() {',
    '    if (selectPreferredView()) return;',
    '    var observer = new MutationObserver(function () {',
    '      if (selectPreferredView()) observer.disconnect();',
    '    });',
    '    observer.observe(document.body, { childList: true, subtree: true });',
    '    window.setTimeout(function () { observer.disconnect(); }, 5000);',
    '  }',
    '  if (document.readyState === "loading") {',
    '    document.addEventListener("DOMContentLoaded", start, { once: true });',
    '  } else {',
    '    start();',
    '  }',
    '})();',
    '</script>',
  ].join('\n');
  const withShell = applyHowItWorksShell(withBrowserContext);
  return /<\/body>/i.test(withShell)
    ? withShell.replace(/<\/body>/i, script + '</body>')
    : withShell + script;
}

export function writeDashboardDocument(target: Pick<Document, 'open' | 'write' | 'close'>, html: string): void {
  target.open();
  target.write(html);
  target.close();
}

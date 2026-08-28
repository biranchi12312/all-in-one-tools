(function () {
  "use strict";

  const PUBLIC_VIEWS = Object.freeze([
    { id: "tools", path: "/tools/", title: "All Tools | AuraStudio", eyebrow: "TOOL DIRECTORY", description: "Browse every AuraStudio image and PDF tool from one place.", kind: "tools" },
    { id: "help", path: "/help/", title: "Help Center | AuraStudio", eyebrow: "SUPPORT", description: "Find quick guidance for AuraStudio tools and common workflows.", kind: "help" },
    { id: "about", path: "/about/", title: "About AuraStudio | Image & PDF Tools", eyebrow: "ABOUT", showEyebrow: false, description: "Learn about AuraStudio and its focused workspace for everyday image and PDF tasks.", kind: "about" },
    { id: "contact", path: "/contact/", title: "Contact AuraStudio", eyebrow: "CONTACT", showEyebrow: false, description: "Find guidance for feedback, bug reports and general AuraStudio questions.", kind: "contact" },
    { id: "privacy", path: "/privacy/", title: "Privacy | AuraStudio", eyebrow: "LEGAL", showEyebrow: false, description: "Read how AuraStudio handles files, service information and third-party resources.", kind: "privacy" },
    { id: "terms", path: "/terms/", title: "Terms | AuraStudio", eyebrow: "LEGAL", showEyebrow: false, description: "Read the rules and limitations that apply when using AuraStudio tools and services.", kind: "terms" },
    { id: "notFound", path: null, title: "Page Not Found | AuraStudio", eyebrow: "404", description: "The page you requested is not available.", kind: "notFound" }
  ]);

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  function toolsMarkup() {
    const registry = window.AuraToolRegistry;
    const tools = registry && typeof registry.getAll === "function" ? registry.getAll() : [];
    return `<div class="public-tools-grid">${tools.map(tool => `
      <a class="public-tool-card" href="${escapeHtml(tool.seoPath || "/tools/")}" data-open-view="${escapeHtml(tool.route)}">
        <span class="public-tool-category">${escapeHtml(tool.category)}</span>
        <strong>${escapeHtml(tool.name)}</strong>
        <small>${escapeHtml(tool.description)}</small>
        <em aria-hidden="true">→</em>
      </a>`).join("")}</div>`;
  }

  function helpMarkup() {
    const registry = window.AuraToolRegistry;
    const tools = registry && typeof registry.getAll === "function" ? registry.getAll() : [];
    return `
      <div class="help-intro-card">
        <strong>Start with the tool you need</strong>
        <p>Select a tool below for a quick workflow summary, then open the workspace when you are ready.</p>
      </div>
      <div class="help-tool-grid">${tools.map(tool => `
        <article class="help-tool-card" id="help-${escapeHtml(tool.helpSlug)}">
          <span class="public-tool-category">${escapeHtml(tool.category)}</span>
          <h2>${escapeHtml(tool.name)}</h2>
          <p>${escapeHtml(tool.description)}</p>
          <ol>
            <li>Open the ${escapeHtml(tool.name)} workspace.</li>
            <li>Select the files or options required for your task.</li>
            <li>Run the operation and download the result when it is ready.</li>
          </ol>
          <a class="public-primary-action" href="${escapeHtml(tool.seoPath || "/tools/")}" data-open-view="${escapeHtml(tool.route)}">Open ${escapeHtml(tool.name)}</a>
        </article>`).join("")}</div>`;
  }


  function aboutMarkup() {
    return `
      <div class="about-story-card">
        <div>
          <span class="public-tool-category">FOCUSED WORKFLOW</span>
          <h2>Useful file tools without making the workspace feel complicated.</h2>
          <p>AuraStudio brings common image and PDF workflows into one focused interface. The goal is straightforward: open the tool you need, complete the task, and get back to what you were doing.</p>
        </div>
        <div class="about-principles">
          <article><strong>Focused tools</strong><p>Separate workspaces for common image and PDF tasks instead of one overloaded editor.</p></article>
          <article><strong>Simple experience</strong><p>Clear controls and guided workflows help you move from upload to result without unnecessary steps.</p></article>
          <article><strong>Clear navigation</strong><p>Tools, help and public information stay connected through one consistent application experience.</p></article>
        </div>
      </div>
      <section class="about-tool-summary" aria-label="What you can do with AuraStudio">
        <div class="about-summary-heading">
          <span class="workspace-kicker">WHAT'S INSIDE</span>
          <h2>Image tools and PDF tools in one workspace.</h2>
        </div>
        <div class="about-summary-grid">
          <article><h3>Image workflows</h3><p>Compress, convert, resize, crop and rotate images with dedicated controls for each task.</p></article>
          <article><h3>PDF workflows</h3><p>Merge PDFs, split documents, convert PDF pages to images and build PDFs from images.</p></article>
        </div>
      </section>
      <div class="about-actions">
        <a class="public-primary-action" href="/tools/" data-open-view="tools">Browse All Tools</a>
        <a class="public-secondary-action" href="/help/" data-open-view="help">Open Help Center</a>
      </div>`;
  }

  function contactMarkup() {
    return `
      <div class="contact-intro-card">
        <span class="public-tool-category">SUPPORT & FEEDBACK</span>
        <h2>Tell us what needs attention.</h2>
        <p>Use the categories below to prepare a clear message and include the details that will help the AuraStudio team understand your request.</p>
      </div>
      <div class="contact-grid">
        <article class="contact-card"><span class="contact-card-icon" aria-hidden="true">✦</span><h2>General feedback</h2><p>Ideas, feature requests and feedback about the overall AuraStudio experience.</p><ul><li>What you were trying to do</li><li>What would make it better</li></ul></article>
        <article class="contact-card"><span class="contact-card-icon" aria-hidden="true">!</span><h2>Report a problem</h2><p>Help isolate issues by describing the tool, the exact step and what happened.</p><ul><li>Tool name and action</li><li>Steps leading to the issue</li><li>What happened versus expected</li></ul></article>
        <article class="contact-card"><span class="contact-card-icon" aria-hidden="true">?</span><h2>Help request</h2><p>Check the Help Center first, then include the workflow and issue you are stuck on.</p><a class="public-secondary-action" href="/help/" data-open-view="help">Open Help Center</a></article>
      </div>
      <div class="contact-status-card" role="status">
        <strong>Contact channel availability</strong>
        <p>Dedicated public contact details are being finalized and will be published here before the next public release. Until then, use the Help Center for tool guidance and troubleshooting.</p>
      </div>`;
  }


  function privacyMarkup() {
    return `
      <div class="legal-meta">Last updated: August 28, 2026</div>
      <div class="legal-layout">
        <article class="legal-card legal-card--lead">
          <h2>Privacy at a glance</h2>
          <p>AuraStudio is built to help you complete image and PDF tasks through a clear, focused workflow. We aim to collect and use information only where it is reasonably needed to provide, protect, support or improve the service, subject to this Privacy page and the features available at the time you use AuraStudio.</p>
          <p>Your files are handled for the tool action you choose. AuraStudio does not use the content of your files for unrelated advertising or promotional purposes.</p>
        </article>

        <section class="legal-section">
          <h2>1. Files you choose</h2>
          <p>When you use a file tool, the files you select are used to provide the requested operation and make the resulting output available to you. Depending on the feature and service configuration, file handling may evolve as AuraStudio infrastructure and capabilities develop.</p>
          <ul>
            <li>You remain responsible for choosing the files you want to process.</li>
            <li>AuraStudio does not provide a user account system in this checkpoint.</li>
            <li>We will update this Privacy page before or when a material change to file handling is introduced.</li>
          </ul>
        </section>

        <section class="legal-section">
          <h2>2. Service information</h2>
          <p>Like most online services, AuraStudio and its service providers may process limited technical information needed to deliver pages, maintain security, prevent abuse and keep the service operating reliably.</p>
          <p>AuraStudio should not be treated as a guaranteed storage, backup or archival service. Keep your own copies of important files and do not rely on a workspace or result history as the only place where a file exists.</p>
        </section>

        <section class="legal-section">
          <h2>3. Third-party services</h2>
          <p>AuraStudio may use third-party services and software components for functions such as hosting, delivery, typography, infrastructure or processing support. Those providers may receive information required to deliver their services, and their own privacy practices may also apply.</p>
          <p>Providers and infrastructure can change as AuraStudio evolves. Where a change materially affects how information is handled, this Privacy page will be updated accordingly.</p>
        </section>

        <section class="legal-section">
          <h2>4. Contact and messages</h2>
          <p>If AuraStudio provides a public contact channel or submission feature, information you choose to send may be used to respond to your request, investigate a reported issue or improve support. The specific handling of a new contact feature will be reflected here when that feature is introduced.</p>
        </section>

        <section class="legal-section">
          <h2>5. Future changes</h2>
          <p>AuraStudio may add or change hosting, infrastructure, processing capabilities, accounts, analytics, advertising, cookies or support services as the project develops. Before or when a material data-handling change is introduced, this Privacy page will be reviewed and updated. The latest revision date will appear at the top of this page.</p>
        </section>
      </div>`;
  }


  function termsMarkup() {
    return `
      <div class="legal-meta">Last updated: August 28, 2026</div>
      <div class="legal-layout">
        <article class="legal-card legal-card--lead">
          <h2>Using AuraStudio</h2>
          <p>By using AuraStudio, you agree to use the service lawfully and responsibly. AuraStudio provides tools for common image and PDF tasks and aims to keep the experience clear and straightforward, but individual files and workflows can produce different results.</p>
        </article>

        <section class="legal-section">
          <h2>1. Your files and content</h2>
          <p>You are responsible for the files and content you choose to process. Do not use AuraStudio in a way that violates applicable law or infringes another person's rights, including copyright, privacy or other proprietary rights.</p>
          <p>You should only process content that you are authorized to use and keep your own backups of important originals.</p>
        </section>

        <section class="legal-section">
          <h2>2. Service availability</h2>
          <p>AuraStudio may change over time. Features can be added, modified, limited or removed, and availability may vary based on supported file types, service capacity, maintenance, network conditions or third-party dependencies.</p>
          <p>We may update the underlying infrastructure or processing capabilities as the service develops without changing the core purpose of the tools: helping you complete common image and PDF tasks efficiently.</p>
        </section>

        <section class="legal-section">
          <h2>3. Results and responsibility</h2>
          <p>File conversion, compression and document operations can change file size, metadata, formatting, image quality or compatibility. Review your result before relying on it for important, professional, legal or irreversible use.</p>
          <p>You remain responsible for checking whether an output is suitable for your intended purpose.</p>
        </section>

        <section class="legal-section">
          <h2>4. No guarantee of loss prevention</h2>
          <p>AuraStudio is not a backup or archival service. Keep copies of original files before processing them. The service should not be used as the sole safeguard against data loss, corruption or accidental changes.</p>
        </section>

        <section class="legal-section">
          <h2>5. Third-party software and services</h2>
          <p>Some functionality may depend on third-party software, infrastructure or external services. Their availability and terms may affect how AuraStudio operates, and applicable third-party notices or licenses remain relevant to those components.</p>
        </section>

        <section class="legal-section">
          <h2>6. Changes to these terms</h2>
          <p>AuraStudio may update these terms as the project develops. The latest revision date will be shown at the top of this page. Continued use after an updated version is published means you should review the revised terms before continuing to use the affected features.</p>
        </section>
      </div>`;
  }


  function createView(definition) {
    const section = document.createElement("section");
    section.id = `${definition.id}View`;
    section.className = "view public-view";
    section.setAttribute("data-public-view", definition.id);
    section.setAttribute("aria-labelledby", `${definition.id}ViewTitle`);

    const body = definition.kind === "tools"
      ? toolsMarkup()
      : definition.kind === "help"
        ? helpMarkup()
        : definition.kind === "about"
          ? aboutMarkup()
          : definition.kind === "contact"
            ? contactMarkup()
            : definition.kind === "privacy"
              ? privacyMarkup()
              : definition.kind === "terms"
                ? termsMarkup()
                : definition.kind === "notFound"
                  ? `<a class="public-primary-action" href="/" data-open-view="dashboard">Return to dashboard</a>`
                  : `<div class="public-view-placeholder" aria-live="polite"><span>Foundation ready</span><p>This section is registered and ready for its dedicated content phase.</p></div>`;

    section.innerHTML = `
      <div class="public-view-shell">
        <div class="public-view-hero${definition.showEyebrow === false ? " public-view-hero--no-eyebrow" : ""}">
          ${definition.showEyebrow === false ? "" : `<span class="workspace-kicker">${escapeHtml(definition.eyebrow)}</span>`}
          <h1 id="${definition.id}ViewTitle">${escapeHtml(definition.title)}</h1>
          <p>${escapeHtml(definition.description)}</p>
        </div>
        ${body}
      </div>`;
    return section;
  }

  function mount(host) {
    if (!host) throw new Error("[AuraStudio PublicViews] Main host is required.");
    const views = {};
    PUBLIC_VIEWS.forEach(definition => {
      const section = createView(definition);
      host.appendChild(section);
      views[definition.id] = section;
    });
    return views;
  }

  function getDefinitions() { return PUBLIC_VIEWS.slice(); }

  window.AuraPublicViews = Object.freeze({ mount, getDefinitions });
})();

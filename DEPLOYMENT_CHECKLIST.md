# OrivaStudio Production Deployment Checklist

1. Deploy the Phase 6 project as one complete folder. Do not mix files with older builds.
2. Use HTTPS before relying on service worker features.
3. After replacing an old build, perform one hard refresh and allow the new service worker to activate.
4. Test direct deep links before requesting indexing.
5. Run qa/smoke-test.html on the deployed domain.
6. Verify robots.txt and sitemap.xml on the real domain.
7. Submit the real sitemap URL to Search Console only after canonical domain decisions are final.
8. Do not claim full offline PDF functionality: external PDF runtimes may require network on first use.
9. If the host does not support _headers, configure equivalent headers in the host dashboard/server.

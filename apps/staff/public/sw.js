/* Service Worker of the staff web app (spec 002 research N5, N14). Shows a pushed notification and
   opens its link on tap; while the app is visible it hands the push to the app's banner instead. The payload is { title, body, link, tag }; `link` is an app path such as
   "/pozadavky", resolved against this worker's scope so it works under /staff and in development. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Pekárna U Lípy";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // A visible window of the app shows its own banner instead (spec 002 FR-026, research N14).
      const visible = windows.filter(
        (w) => w.visibilityState === "visible" && w.url.startsWith(self.registration.scope),
      );
      if (visible.length > 0) {
        for (const w of visible) w.postMessage({ type: "notification", tag: data.tag });
        return undefined;
      }
      return self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag,
        data: { link: data.link || "/" },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = String((event.notification.data && event.notification.data.link) || "/").replace(/^\//, "");
  const url = new URL(path, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.registration.scope) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

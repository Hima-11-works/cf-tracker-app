const inFlightGetRequests = new Map<string, Promise<Response>>();

/** Share an in-flight GET across effects and event handlers in this browser runtime. */
export function fetchDeduped(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" || init.signal) return fetch(url, init);

  let request = inFlightGetRequests.get(url);
  if (!request) {
    request = fetch(url, init);
    inFlightGetRequests.set(url, request);
    void request.then(
      () => { if (inFlightGetRequests.get(url) === request) inFlightGetRequests.delete(url); },
      () => { if (inFlightGetRequests.get(url) === request) inFlightGetRequests.delete(url); },
    );
  }

  return request.then((response) => response.clone());
}

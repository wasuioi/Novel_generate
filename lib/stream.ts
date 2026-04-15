export async function readBufferedStream(
  body: ReadableStream<Uint8Array>,
  onFlush: (chunk: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (!buffer) return;
    const out = buffer;
    buffer = "";
    onFlush(out);
  };

  const abortHandler = () => { reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortHandler);

  try {
    while (true) {
      if (signal.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
      }
    }
  } finally {
    flush();
    signal.removeEventListener("abort", abortHandler);
    try { reader.releaseLock(); } catch { /* already released by cancel */ }
  }
}

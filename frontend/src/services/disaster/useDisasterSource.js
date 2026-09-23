import { useEffect, useState } from 'react';
export default function useDisasterSource(loader, interval, enabled = true) {
  const [state, setState] = useState({ data: null, loading: enabled, error: false });
  useEffect(() => {
    if (!enabled) return;
    setState(previous => ({ ...previous, loading: !previous.data }));
    const controller = new AbortController();
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await loader(controller.signal);
        if (!controller.signal.aborted) setState({ data, loading: false, error: false });
      } catch {
        if (!controller.signal.aborted) setState(previous => ({ ...previous, loading: false, error: true }));
      } finally { busy = false; }
    };
    refresh();
    const timer = setInterval(refresh, interval);
    return () => { controller.abort(); clearInterval(timer); };
  }, [loader, interval, enabled]);
  return state;
}

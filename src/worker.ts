import { calculate } from "./engine";
self.onmessage = (e) => {
  const { revision, config } = e.data;
  try {
    self.postMessage({ revision, results: calculate(config) });
  } catch (error) {
    self.postMessage({
      revision,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

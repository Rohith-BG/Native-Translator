import { useCallback, useEffect, useState } from 'react';

import { modelManager } from '@/services/litert/modelManager';
import type { ModelStatus } from '@/services/litert/types';

export const useModelStatus = () => {
  const [status, setStatus] = useState<ModelStatus>(modelManager.getStatus());
  const [detail, setDetail] = useState<string | undefined>(modelManager.getDetail());
  const [progress, setProgress] = useState(modelManager.getProgress());

  useEffect(() => {
    modelManager.ensureLifecycleWatch();
    const unsubscribeStatus = modelManager.subscribe((next, message) => {
      setStatus(next);
      setDetail(message);
    });
    const unsubscribeProgress = modelManager.onProgress(setProgress);
    return () => {
      unsubscribeStatus();
      unsubscribeProgress();
    };
  }, []);

  const load = useCallback(async () => {
    await modelManager.load();
  }, []);

  const release = useCallback(() => {
    modelManager.release();
  }, []);

  const reload = useCallback(async () => {
    await modelManager.reload();
  }, []);

  return {
    status,
    detail,
    progress,
    isReady: status === 'ready',
    load,
    release,
    reload,
  };
};

'use client';

import { useEffect, useState } from 'react';
import { requestBlob } from '@/lib/api';

export function ProtectedPhoto({
  src,
  alt,
  fallback = '/default-student-avatar.svg',
  className,
}: {
  src: string | null;
  alt: string;
  fallback?: string;
  className?: string;
}) {
  const [url, setUrl] = useState(fallback);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (!src) {
      setUrl(fallback);
      return () => undefined;
    }
    requestBlob(src)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setUrl(fallback);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fallback, src]);

  return <img className={className} src={url} alt={alt} />;
}

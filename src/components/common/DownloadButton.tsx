import type { ReactNode } from 'react';
import { download } from '../../api';

interface DownloadButtonProps {
  path: string;
  filename: string;
  children: ReactNode;
  primary?: boolean;
}

export default function DownloadButton({ path, filename, children, primary = false }: DownloadButtonProps) {
  const handleClick = () => download(path, filename).catch((e: Error) => alert(e.message));

  return (
    <button className={primary ? 'btn pri' : 'btn'} onClick={handleClick}>
      {children}
    </button>
  );
}

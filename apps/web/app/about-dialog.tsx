"use client";

import { useRef } from "react";
import { Compass } from "lucide-react";

/** GitHub mark (filled), the same icon the resources archive's about dialog uses. */
function GithubMark() {
  return (
    <svg className="is-fill" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export const ARCHIVE_VERSION = "v1.1.4";

/** The rail's version number; clicking it opens the about dialog (same layout as the GM workbench's). */
export function AboutDialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" className="rail-version" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog" aria-label={`关于寻仙音乐资料库，版本 ${ARCHIVE_VERSION}`}>{ARCHIVE_VERSION}</button>
      <dialog
        ref={dialogRef}
        className="about-dialog"
        aria-labelledby="about-dialog-title"
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      >
        <h3 id="about-dialog-title" className="about-dialog-head">寻仙音乐资料库 {ARCHIVE_VERSION}</h3>
        <div className="about-dialog-body">
          <div className="about-row">
            <GithubMark />
            <span className="about-label">项目地址</span>
            <a href="https://github.com/icosohedral/xunxian-audio-archive" target="_blank" rel="noopener noreferrer" title="github.com/icosohedral/xunxian-audio-archive">xunxian-audio-archive</a>
          </div>
          <div className="about-row">
            <Compass size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className="about-label">资源总站</span>
            <a href="https://xunxian.wiki">xunxian.wiki</a>
          </div>
          <p className="about-notice">本站为资料整理与试听项目，游戏及相关权利归原权利人所有。</p>
        </div>
        <div className="about-dialog-foot">
          <button type="button" className="about-dialog-ok" onClick={close} autoFocus>知道了</button>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useRef } from "react";
import { Compass, Github } from "lucide-react";

export const ARCHIVE_VERSION = "v1.1.2";

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
            <Github size={16} aria-hidden="true" />
            <span className="about-label">项目地址</span>
            <a href="https://github.com/icosohedral/xunxian-audio-archive" target="_blank" rel="noopener noreferrer">github.com/icosohedral/xunxian-audio-archive</a>
          </div>
          <div className="about-row">
            <Compass size={16} aria-hidden="true" />
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

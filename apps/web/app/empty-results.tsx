import { SearchX } from "lucide-react";

/** Shown in place of the list when search or filters match nothing; carries the usage hint. */
export function EmptyResults({ onReset }: { onReset: () => void }) {
  return (
    <div className="empty-results" role="status">
      <SearchX size={22} aria-hidden="true" />
      <strong>没有找到匹配的音频</strong>
      <p>可按文件名的一部分搜索，例如 <code>boss</code>、<code>night</code>；也可以换个分类试试。</p>
      <button type="button" onClick={onReset}>清除搜索与筛选</button>
    </div>
  );
}

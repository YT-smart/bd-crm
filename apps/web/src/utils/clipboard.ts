/**
 * 复制文本到剪贴板。非 HTTPS（内网 IP 访问）时 navigator.clipboard 不可用，退回 execCommand。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 退回旧方案 */
  }
  // 弹窗/抽屉会把焦点锁在自身内部，临时输入框放在 body 上会被抢走焦点导致复制为空，
  // 所以放进最上层打开着的弹窗/抽屉里（Safari 点击按钮不会让按钮获得焦点，不能靠焦点元素来找）
  const active = document.activeElement as HTMLElement | null;
  const layers = document.querySelectorAll<HTMLElement>('.n-modal, .n-drawer');
  const host = layers.length ? layers[layers.length - 1] : document.body;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none';
  host.appendChild(ta);
  ta.focus({ preventScroll: true });
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.({ preventScroll: true });
  return ok;
}

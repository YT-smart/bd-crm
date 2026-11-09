/** 推出状态对应的颜色 */
export function pushPill(status: string) {
  switch (status) {
    case '已签约':
      return 'pill-success';
    case '重点跟进':
      return 'pill-warning';
    case '已推出':
      return 'pill-brand';
    default:
      return 'pill-neutral';
  }
}

/** 意向度：差的标灰，好的标色 */
export function intentionPill(v: string | null) {
  if (!v) return '';
  if (['重点跟进', '已面谈', '已签约'].includes(v)) return 'pill-warning';
  if (['联系不上', '放弃'].includes(v)) return 'pill-danger';
  return 'pill-neutral';
}

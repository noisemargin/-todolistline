// ===== 日期工具 & 画布布局常量 =====
// 这里集中放"和时间轴/布局有关的计算与尺寸",画布只管画,算交给这里。

/** 每个日期之间的横向像素间距。让每天形成足够宽的"格子",卡片不拥挤。 */
export const DAY_WIDTH = 260;

/** 时间轴竖线的高度(像素)。先给一个足够大的值。 */
export const TIMELINE_HEIGHT = 2000;

/** 卡片宽度。比 DAY_WIDTH 小,留出左右间距。 */
export const CARD_WIDTH = 140;

/** 第一条主线行的纵向起点(在日期标签下方)。 */
export const ROW_START_Y = 80;

/** 每条主线行的高度(决定上下两条主线间距)。 */
export const ROW_HEIGHT = 150;

// ---- 时间轴范围(以"今天"为基准,前后大范围,可滚动)----
/** 往过去覆盖多少天。 */
export const PAST_DAYS = 30;
/** 往未来覆盖多少天。 */
export const FUTURE_DAYS = 180;
/** 时间轴一共多少天(含今天)。 */
export const TOTAL_DAYS = PAST_DAYS + FUTURE_DAYS + 1;
/** 时间轴第一天相对今天的偏移(负数=过去)。 */
export const START_OFFSET = -PAST_DAYS;

/** 在 base 基础上加 n 天,返回新日期(不改原对象)。 */
export function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(base.getDate() + n);
  return d;
}

/**
 * 生成从 start 开始、连续 count 天的日期数组。
 * 例:buildDates(6/28, 3) => [6/28, 6/29, 6/30]
 */
export function buildDates(start: Date, count: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < count; i++) {
    dates.push(addDays(start, i));
  }
  return dates;
}

/** 把日期格式化成 "6/30" 这种简短形式。 */
export function formatMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 判断两个日期是不是同一天(忽略时分秒)。 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * 计算 to 比 from 晚多少个"日历天"(忽略时分秒)。
 * 必须按日历天算,否则任务带了具体时分(如 14:30)会让差值偏移。
 */
export function diffDays(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** 返回"今天 0 点 + offset 天"的日期。offset 可正可负。 */
export function dayFromToday(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

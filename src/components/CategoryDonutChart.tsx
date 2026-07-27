"use client";

export type DonutSegment = {
  id: string;
  label: string;
  value: number;
  color: string;
};

export default function CategoryDonutChart({
  segments,
  total,
}: {
  segments: DonutSegment[];
  total: number;
}) {
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 2; // px surface gap between segments

  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Spending by category"
    >
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e1e0d9"
          strokeWidth={strokeWidth}
        />
        {total > 0 &&
          segments.map((s) => {
            const fraction = s.value / total;
            const length = Math.max(fraction * circumference - gap, 0);
            const dasharray = `${length} ${circumference - length}`;
            const dashoffset = -offset;
            offset += fraction * circumference;
            return (
              <circle
                key={s.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            );
          })}
      </g>
      <text
        x="50%"
        y="47%"
        textAnchor="middle"
        className="fill-slate-900"
        style={{ fontSize: 11, fontWeight: 600 }}
      >
        Total
      </text>
      <text
        x="50%"
        y="60%"
        textAnchor="middle"
        className="fill-slate-500"
        style={{ fontSize: 10 }}
      >
        {segments.length} categories
      </text>
    </svg>
  );
}

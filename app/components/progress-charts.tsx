import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ChartProblem = {
  section: string;
  rating: number | null;
  status: "not_attempted" | "accepted" | "tle_mle" | "wrong_answer";
};

type TopicProgress = {
  section: string;
  accepted: number;
  total: number;
  percent: number;
};

type RatingSlice = {
  label: string;
  color: string;
  count: number;
};

const RATING_COLORS = [
  "var(--chart-blue)",
  "var(--chart-cyan)",
  "var(--chart-violet)",
  "var(--chart-green)",
  "var(--chart-yellow)",
  "var(--chart-muted)",
] as const;

const RADAR = { width: 300, height: 250, cx: 150, cy: 125, radius: 92, labelRadius: 110 } as const;
const DONUT = { center: 100, radius: 74, stroke: 22 } as const;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT.radius;

function radarPoint(index: number, count: number, radius: number) {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
  return {
    x: RADAR.cx + Math.cos(angle) * radius,
    y: RADAR.cy + Math.sin(angle) * radius,
  };
}

function pointList(points: Array<{ x: number; y: number }>) {
  return points.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function TopicRadar({ topics }: { topics: TopicProgress[] }) {
  const gridLevels = [25, 50, 75, 100];
  const topicPoints = topics.map((topic, index) => radarPoint(index, topics.length, RADAR.radius * topic.percent / 100));
  const gridPoints = (level: number) => pointList(topics.map((_, index) => radarPoint(index, topics.length, RADAR.radius * level / 100)));
  const description = topics.map((topic) => `${topic.section}: ${topic.accepted} of ${topic.total} accepted, ${topic.percent} percent`).join(". ");

  return (
    <div className="chart-layout">
      <svg className="topic-radar" viewBox={`0 0 ${RADAR.width} ${RADAR.height}`} role="img" aria-labelledby="topic-radar-title topic-radar-description">
        <title id="topic-radar-title">Accepted share by topic</title>
        <desc id="topic-radar-description">Radar chart with a zero to one hundred percent scale. {description}</desc>
        {gridLevels.map((level) => (
          topics.length >= 3 ? (
            <polygon key={level} className="radar-grid" points={gridPoints(level)} />
          ) : (
            <circle key={level} className="radar-grid" cx={RADAR.cx} cy={RADAR.cy} r={RADAR.radius * level / 100} />
          )
        ))}
        {topics.map((topic, index) => {
          const outer = radarPoint(index, topics.length, RADAR.radius);
          return <line key={`axis-${topic.section}`} className="radar-axis" x1={RADAR.cx} y1={RADAR.cy} x2={outer.x} y2={outer.y} />;
        })}
        {topics.length >= 3 ? (
          <polygon className="radar-area" points={pointList(topicPoints)} />
        ) : topics.length === 2 ? (
          <polyline className="radar-outline" points={pointList(topicPoints)} />
        ) : null}
        {topicPoints.map((point, index) => (
          <circle key={`point-${topics[index].section}`} className="radar-point" cx={point.x} cy={point.y} r="3.5" />
        ))}
        {topics.map((topic, index) => {
          const label = radarPoint(index, topics.length, RADAR.labelRadius);
          return <text key={`label-${topic.section}`} className="radar-index" x={label.x} y={label.y}>{index + 1}</text>;
        })}
      </svg>

      <ol className="chart-key" aria-label="Accepted problems by topic">
        {topics.map((topic, index) => (
          <li className="topic-key-item" key={topic.section}>
            <span className="topic-key-index">{String(index + 1).padStart(2, "0")}</span>
            <div className="topic-key-body">
              <div className="topic-key-line">
                <span className="topic-key-name">{topic.section}</span>
                <span className="topic-key-value">{topic.accepted}/{topic.total} · {topic.percent}%</span>
              </div>
              <div className="topic-key-track" aria-hidden="true"><span style={{ width: topic.percent + "%" }} /></div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RatingDonut({ ratings, total }: { ratings: RatingSlice[]; total: number }) {
  const visibleRatings = ratings.filter((rating) => rating.count > 0);
  let accumulated = 0;
  const segments = visibleRatings.map((rating) => {
    const length = (rating.count / total) * DONUT_CIRCUMFERENCE;
    const offset = -(accumulated / total) * DONUT_CIRCUMFERENCE;
    accumulated += rating.count;
    return { ...rating, length, offset };
  });
  const description = visibleRatings.map((rating) => `${rating.label}: ${rating.count}`).join(". ");

  return (
    <div className="chart-layout">
      <svg className="rating-donut" viewBox="0 0 200 200" role="img" aria-labelledby="rating-donut-title rating-donut-description">
        <title id="rating-donut-title">Accepted problems by rating</title>
        <desc id="rating-donut-description">Donut chart of {total} accepted problems with a rating, grouped by exact Codeforces rating. {description || "No accepted problems with a rating yet."}</desc>
        <circle className="rating-donut-track" cx={DONUT.center} cy={DONUT.center} r={DONUT.radius} strokeWidth={DONUT.stroke} />
        {segments.map((segment) => (
          <circle
            key={segment.label}
            className="rating-donut-segment"
            cx={DONUT.center}
            cy={DONUT.center}
            r={DONUT.radius}
            strokeWidth={DONUT.stroke}
            stroke={segment.color}
            strokeDasharray={`${segment.length} ${DONUT_CIRCUMFERENCE - segment.length}`}
            strokeDashoffset={segment.offset}
            transform={`rotate(-90 ${DONUT.center} ${DONUT.center})`}
          />
        ))}
        <text className="rating-donut-total" x={DONUT.center} y={DONUT.center + 2}>{total}</text>
        <text className="rating-donut-caption" x={DONUT.center} y={DONUT.center + 20}>rated solved</text>
      </svg>

      {total > 0 ? (
        <ul className="chart-key" aria-label="Accepted problems by exact rating">
          {visibleRatings.map((rating) => (
            <li className="rating-key-item" key={rating.label}>
              <span className="rating-swatch" style={{ backgroundColor: rating.color }} aria-hidden="true" />
              <span className="rating-key-label">{rating.label}</span>
              <span className="rating-key-count">{rating.count} · {Math.round((rating.count / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="chart-empty">No accepted problems with a rating yet.</p>
      )}
    </div>
  );
}

export function ProgressCharts({ problems }: { problems: ChartProblem[] }) {
  if (problems.length === 0) return null;

  const topicCounts = new Map<string, { accepted: number; total: number }>();
  for (const problem of problems) {
    const progress = topicCounts.get(problem.section) ?? { accepted: 0, total: 0 };
    progress.total += 1;
    if (problem.status === "accepted") progress.accepted += 1;
    topicCounts.set(problem.section, progress);
  }
  const topics = [...topicCounts.entries()].map(([section, counts]) => ({
    section,
    ...counts,
    percent: Math.round((counts.accepted / counts.total) * 100),
  }));

  const ratingCounts = new Map<string, number>();
  for (const problem of problems) {
    if (problem.status !== "accepted") continue;
    if (problem.rating === null || !Number.isFinite(problem.rating)) continue;
    const label = String(problem.rating);
    ratingCounts.set(label, (ratingCounts.get(label) ?? 0) + 1);
  }
  const ratingSlices = [...ratingCounts.entries()]
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([label, count], index) => ({ label, count, color: RATING_COLORS[index % RATING_COLORS.length] }));
  const solvedCount = ratingSlices.reduce((total, rating) => total + rating.count, 0);

  return (
    <section className="progress-charts" aria-label="Probation sheet progress charts">
      <Card className="progress-chart-card" aria-labelledby="topic-progress-heading">
        <CardHeader className="progress-chart-heading">
          <CardTitle className="chart-card-title"><h3 id="topic-progress-heading">Topic progress</h3></CardTitle>
          <CardDescription>Accepted share of problems in each section</CardDescription>
        </CardHeader>
        <CardContent className="progress-chart-content"><TopicRadar topics={topics} /></CardContent>
      </Card>

      <Card className="progress-chart-card" aria-labelledby="rating-progress-heading">
        <CardHeader className="progress-chart-heading">
          <CardTitle className="chart-card-title"><h3 id="rating-progress-heading">Solved by rating</h3></CardTitle>
          <CardDescription>Accepted problems grouped by exact rating</CardDescription>
        </CardHeader>
        <CardContent className="progress-chart-content"><RatingDonut ratings={ratingSlices} total={solvedCount} /></CardContent>
      </Card>
    </section>
  );
}
